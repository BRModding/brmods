(function () {
  // ---------- Lightning background ----------
  const svg = document.getElementById("bolts");
  const NS = "http://www.w3.org/2000/svg";

  function boltPoints(xStart, spread, height) {
    const pts = [];
    let x = xStart;
    for (let y = -20; y < height + 40; y += 40 + Math.random() * 70) {
      x += (Math.random() - 0.5) * spread;
      x = Math.max(xStart - spread, Math.min(xStart + spread, x));
      pts.push([Math.round(x), Math.round(y)]);
    }
    return pts;
  }

  function branch(from) {
    const pts = [from];
    let [x, y] = from;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const steps = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < steps; i++) {
      x += dir * (20 + Math.random() * 50);
      y += 30 + Math.random() * 60;
      pts.push([Math.round(x), Math.round(y)]);
    }
    return pts;
  }

  function addPath(pts, cls) {
    const p = document.createElementNS(NS, "polyline");
    p.setAttribute("points", pts.map((q) => q.join(",")).join(" "));
    p.setAttribute("class", cls);
    svg.appendChild(p);
  }

  function drawBolts() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.replaceChildren();
    const bolts = [
      { x: w - Math.min(180, w * 0.15), spread: 70, cls: "bolt" },
      { x: w * 0.42, spread: 60, cls: "bolt bolt-faint" },
    ];
    if (w < 700) bolts[0] = { x: w - 30, spread: 40, cls: "bolt" };
    for (const b of bolts) {
      const main = boltPoints(b.x, b.spread, h);
      addPath(main, b.cls);
      for (let i = 0; i < 2; i++) {
        const start = main[1 + Math.floor(Math.random() * (main.length - 2))];
        addPath(branch(start), b.cls + " bolt-branch");
      }
    }
  }

  drawBolts();
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawBolts, 200);
  });
  // Re-strike every few seconds
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setInterval(() => {
      svg.classList.remove("strike");
      void svg.getBoundingClientRect();
      drawBolts();
      svg.classList.add("strike");
    }, 7000);
  }

  // ---------- Mod links ----------
  const list = document.getElementById("link-list");
  const search = document.getElementById("search");
  let mods = [];

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function render() {
    const q = search.value.trim().toLowerCase();
    const shown = mods.filter((m) =>
      !q || [m.name, m.category, m.author, m.description, ...(m.tags || [])].join(" ").toLowerCase().includes(q)
    );
    list.replaceChildren();
    if (!shown.length) {
      list.appendChild(el("p", "empty", "No links match your search."));
      return;
    }
    for (const m of shown) {
      const hasUrl = m.url && /^https?:\/\//.test(m.url);
      const external = hasUrl && new URL(m.url).host !== location.host;
      const card = el(hasUrl ? "a" : "div", "link-card" + (hasUrl ? "" : " disabled"));
      if (hasUrl) {
        card.href = m.url;
        if (external) { card.target = "_blank"; card.rel = "noopener"; }
      }
      const text = el("span", "link-text");
      text.appendChild(el("strong", null, m.name));
      text.appendChild(el("span", null, hasUrl ? m.description : `${m.description} (link coming soon)`));
      card.appendChild(text);
      card.appendChild(el("span", "arrow", external ? "↗" : "→"));
      card.title = `${m.category} · by ${m.author} · v${m.version}`;
      list.appendChild(card);
    }
  }

  fetch("mods.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((data) => { mods = data; render(); })
    .catch(() => {
      list.replaceChildren(el("p", "empty", "Could not load mods.json. If you opened the file directly, run a local server (python3 -m http.server)."));
    });

  search.addEventListener("input", () => {
    render();
    const q = search.value.trim().toLowerCase();
    document.querySelectorAll("details.guide").forEach((d) => {
      d.hidden = Boolean(q) && !d.textContent.toLowerCase().includes(q);
    });
  });

  // Press "/" to jump to search, Esc to clear
  document.addEventListener("keydown", (e) => {
    const typing = /^(input|textarea|select)$/i.test(document.activeElement.tagName);
    if (e.key === "/" && !typing) {
      e.preventDefault();
      search.focus();
    }
    if (e.key === "Escape" && document.activeElement === search) {
      search.value = "";
      search.dispatchEvent(new Event("input"));
      search.blur();
    }
  });
})();
