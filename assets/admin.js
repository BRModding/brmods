(function () {
  const $ = (id) => document.getElementById(id);
  const SESSION_KEY = "qmh-admin";
  const DRAFT_KEY = "qmh-draft";
  const GH_KEY = "qmh-gh";

  let mods = [];
  let editingIndex = -1;

  // SHA-256 that works everywhere. Browsers only provide crypto.subtle on
  // HTTPS pages, so fall back to a plain-JS version on http:// or file://.
  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    if (window.crypto && crypto.subtle) {
      try {
        const buf = await crypto.subtle.digest("SHA-256", bytes);
        return toHex(new Uint8Array(buf));
      } catch (_) { /* fall through to JS version */ }
    }
    return toHex(sha256Fallback(bytes));
  }

  function toHex(arr) {
    return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function sha256Fallback(msg) {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const len = msg.length;
    const total = (((len + 9) >> 6) + 1) << 6;
    const data = new Uint8Array(total);
    data.set(msg);
    data[len] = 0x80;
    const view = new DataView(data.buffer);
    view.setUint32(total - 8, Math.floor((len * 8) / 0x100000000));
    view.setUint32(total - 4, (len * 8) >>> 0);
    const W = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    const out = new Uint8Array(32);
    const ov = new DataView(out.buffer);
    H.forEach((v, i) => ov.setUint32(i * 4, v));
    return out;
  }

  // ---------- Login ----------
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = $("login-error");
    errorEl.textContent = "";
    if (!window.ADMIN_CONFIG || !window.ADMIN_CONFIG.credentialHash) {
      errorEl.textContent = "Login settings are missing: assets/admin-config.js didn't load. Make sure the assets folder was uploaded with all its files.";
      return;
    }
    try {
      // Username isn't case-sensitive ("Admin" works); stray spaces are ignored.
      const user = $("username").value.trim().toLowerCase();
      const pass = $("password").value.trim();
      const hash = await sha256(`${user}:${pass}`);
      if (hash === window.ADMIN_CONFIG.credentialHash) {
        sessionStorage.setItem(SESSION_KEY, hash);
        $("password").value = "";
        showAdmin();
      } else {
        errorEl.textContent = "Wrong username or password.";
        $("password").value = "";
        $("password").focus();
      }
    } catch (err) {
      errorEl.textContent = `Login error: ${err.message}`;
    }
  });

  $("logout").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(GH_KEY);
    location.reload();
  });

  async function showAdmin() {
    $("login-view").hidden = true;
    $("admin-view").hidden = false;
    $("logout").hidden = false;
    loadGhSettings();
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      mods = JSON.parse(draft);
      setStatus("Loaded your unpublished changes from this browser.");
    } else {
      try {
        const res = await fetch("mods.json", { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        mods = await res.json();
      } catch (err) {
        mods = [];
        setStatus(location.protocol === "file:"
          ? "Couldn't load mods.json because the page was opened as a local file. Open it from your GitHub Pages site (or run: python3 -m http.server) to see your mods."
          : `Couldn't load mods.json (${err.message}). Check that mods.json is in the same folder as admin.html.`);
      }
    }
    render();
  }

  // ---------- Table ----------
  function render() {
    const tbody = $("mod-rows");
    tbody.replaceChildren();
    mods.forEach((m, i) => {
      const tr = document.createElement("tr");
      for (const v of [m.name, m.game, m.category, m.version, m.updated || ""]) {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      }
      const actions = document.createElement("td");
      actions.className = "row-actions";
      const edit = button("Edit", () => openEditor(i));
      const del = button("Delete", () => {
        if (confirm(`Delete "${m.name}"?`)) {
          mods.splice(i, 1);
          changed();
        }
      });
      del.classList.add("danger");
      actions.append(edit, del);
      tr.appendChild(actions);
      tbody.appendChild(tr);
    });
    fillList("game-list", "game");
    fillList("category-list", "category");
  }

  function button(label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-small btn-ghost";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function fillList(id, key) {
    const list = $(id);
    list.replaceChildren(...[...new Set(mods.map((m) => m[key]))].map((v) => new Option(v)));
  }

  function changed() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(mods));
    setStatus("Unsaved changes — download mods.json or publish to GitHub.");
    render();
  }

  function setStatus(msg) { $("status").textContent = msg; }

  // ---------- Editor ----------
  const dialog = $("mod-dialog");
  const form = $("mod-form");

  function openEditor(index) {
    editingIndex = index;
    form.reset();
    const m = index >= 0 ? mods[index] : { game: "Gorilla Tag", updated: new Date().toISOString().slice(0, 10) };
    $("dialog-title").textContent = index >= 0 ? "Edit mod" : "Add mod";
    for (const el of form.elements) {
      if (!el.name) continue;
      el.value = el.name === "tags" ? (m.tags || []).join(", ") : (m[el.name] ?? "");
    }
    dialog.showModal();
  }

  $("new-mod").addEventListener("click", () => openEditor(-1));
  $("cancel-edit").addEventListener("click", () => dialog.close());

  form.addEventListener("submit", () => {
    const data = Object.fromEntries(new FormData(form));
    const mod = {
      name: data.name.trim(),
      game: data.game.trim(),
      category: data.category.trim(),
      author: data.author.trim(),
      version: data.version.trim(),
      updated: data.updated,
      description: data.description.trim(),
      tags: data.tags.split(",").map((t) => t.trim()).filter(Boolean),
      url: data.url.trim(),
    };
    if (editingIndex >= 0) mods[editingIndex] = mod;
    else mods.push(mod);
    changed();
  });

  // ---------- Download ----------
  $("download").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(mods, null, 2) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mods.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---------- Publish to GitHub ----------
  const ghFields = ["gh-owner", "gh-repo", "gh-branch", "gh-token"];

  function loadGhSettings() {
    const saved = JSON.parse(sessionStorage.getItem(GH_KEY) || "{}");
    ghFields.forEach((id) => { if (saved[id]) $(id).value = saved[id]; });
    if (!saved["gh-owner"] && location.hostname.endsWith(".github.io")) {
      $("gh-owner").value = location.hostname.split(".")[0];
      $("gh-repo").value = location.pathname.split("/")[1] || `${$("gh-owner").value}.github.io`;
    }
    ghFields.forEach((id) => $(id).addEventListener("change", saveGhSettings));
  }

  function saveGhSettings() {
    const obj = {};
    ghFields.forEach((id) => (obj[id] = $(id).value.trim()));
    sessionStorage.setItem(GH_KEY, JSON.stringify(obj));
  }

  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }

  $("publish").addEventListener("click", async () => {
    saveGhSettings();
    const owner = $("gh-owner").value.trim();
    const repo = $("gh-repo").value.trim();
    const branch = $("gh-branch").value.trim() || "main";
    const token = $("gh-token").value.trim();
    if (!owner || !repo || !token) {
      document.querySelector(".gh-settings").open = true;
      setStatus("Fill in the GitHub publish settings first.");
      return;
    }
    const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/mods.json`;
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
    setStatus("Publishing…");
    try {
      const cur = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
      const sha = cur.ok ? (await cur.json()).sha : undefined;
      const res = await fetch(api, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: "Update mods.json from admin panel",
          content: toBase64(JSON.stringify(mods, null, 2) + "\n"),
          branch,
          sha,
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.json()).message || ""}`);
      localStorage.removeItem(DRAFT_KEY);
      setStatus("Published! GitHub Pages will update in a minute or two.");
    } catch (err) {
      setStatus(`Publish failed: ${err.message}`);
    }
  });

  // Stay logged in for this tab
  if (window.ADMIN_CONFIG && sessionStorage.getItem(SESSION_KEY) === window.ADMIN_CONFIG.credentialHash) showAdmin();
})();
