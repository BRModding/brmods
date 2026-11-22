(function () {
  const $ = (id) => document.getElementById(id);
  const SESSION_KEY = "qmh-admin";
  const DRAFT_KEY = "qmh-draft";
  const GH_KEY = "qmh-gh";

  let mods = [];
  let editingIndex = -1;

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // ---------- Login ----------
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const hash = await sha256(`${$("username").value.trim()}:${$("password").value}`);
    if (hash === window.ADMIN_CONFIG.credentialHash) {
      sessionStorage.setItem(SESSION_KEY, hash);
      $("password").value = "";
      showAdmin();
    } else {
      $("login-error").textContent = "Wrong username or password.";
      $("password").value = "";
      $("password").focus();
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
      const res = await fetch("mods.json", { cache: "no-cache" });
      mods = await res.json();
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
  if (sessionStorage.getItem(SESSION_KEY) === window.ADMIN_CONFIG.credentialHash) showAdmin();
})();
