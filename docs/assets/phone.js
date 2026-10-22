// Cielo del preventivo, Lugano on a phone, and the "Riquadri" view on a computer. Up to 720px wide (or on a wider
// screen when the reader chooses "Riquadri" instead of the sky) the page is read by scrolling and tapping:
// the sectors as tiles, a sector as its lines' gaps around the budget, a line as a card that slides up from the bottom,
// "Il tuo franco" and a searchable table. It reads the same window.CIELO and uses the page's own wording, cards and
// deep dive (assets/app.js, loaded first), and keeps the same addresses: #settore/2 is a sector, #settore/212 a line,
// #settore/212/scheda its full card, #quadro the overview. A link copied on a phone opens the same thing on a computer.
"use strict";
{
  const mq = matchMedia("(max-width: 720px)");
  const root = document.getElementById("phone"), main = document.getElementById("ph-main");
  const sheet = document.getElementById("ph-sheet"), tabsEl = document.getElementById("ph-tabs");
  const P = () => T[lang].ph;

  // the colour of a gap: grey on budget, warmer below, cooler above, full strength from ±6%
  const MID = [58, 65, 87], OVER = [159, 182, 255], UNDER = [255, 197, 143], FULL = 6;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const gapRgb = (p) => { if (p == null) return MID; const t = Math.max(-1, Math.min(1, p / FULL)); return t >= 0 ? mix(MID, OVER, t) : mix(MID, UNDER, -t); };
  // dark or light text, whichever has more contrast with the tile (WCAG relative luminance)
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const INK = { dark: [4, 6, 13], light: [238, 241, 250] };
  const inkOn = (rgb) => { const L0 = lum(rgb), cr = (c) => { const L1 = lum(c); return (Math.max(L0, L1) + 0.05) / (Math.min(L0, L1) + 0.05); }; return cr(INK.dark) >= cr(INK.light) ? "#04060d" : "#eef1fa"; };
  // each tile's text is fitted to its space: smaller type first, then the name on one shortened line, then without the
  // gap, then the code alone. Words are never split.
  const FIT = ["", "tight", "tight one", "tight one nogap", "code"];
  // a name shortened with "…" is meant to be cut, so it does not count as overflowing
  const overflows = (el) => el.scrollHeight > el.clientHeight + 1 || [...el.children].some((c) => !(c.tagName === "B" && el.classList.contains("one")) && c.scrollWidth > c.clientWidth + 1);
  function fitTiles() {
    for (const el of main.querySelectorAll(".ph-tile:not(.xs)")) {
      el.classList.remove("tight", "one", "nogap", "code");
      for (const step of FIT) { if (step) el.classList.add(...step.split(" ")); if (!overflows(el)) break; if (step) el.classList.remove(...step.split(" ")); }
      if (overflows(el)) el.classList.add("tight", "one", "nogap", "code");
    }
  }

  // ---------- addresses and the Back button ----------
  const here = () => decodeURIComponent(location.hash.slice(1));
  const parse = (r) => { const [k = "", a = "", b = ""] = r.split("/"); return { k, a, deep: b === "scheda" }; };
  const isSky = (k) => k === "settore" || k === "dicastero";
  const depth = (r) => { const { k, a, deep } = parse(r); return !k ? 0 : isSky(k) ? (a.length > 1 ? 2 : 1) + (deep ? 1 : 0) : 1; };
  const kOf = () => (view === "org" ? "dicastero" : "settore");
  const urlOf = (r) => (r ? "#" + r : location.pathname + location.search);
  let stack = [here()];                                  // the history entries this page made, oldest first
  function go(r) {
    const cur = stack[stack.length - 1];
    if (r === cur) return render();
    if (stack.length > 1 && stack[stack.length - 2] === r) { history.back(); return; }   // the step back is Back
    if (depth(r) > depth(cur)) { stack.push(r); history.pushState({ cielo: 1 }, "", urlOf(r)); }
    else { stack[stack.length - 1] = r; history.replaceState(history.state, "", urlOf(r)); }
    render();
  }
  const back = (fallback) => (stack.length > 1 ? history.back() : go(fallback));
  function route() { const r = here(), i = stack.lastIndexOf(r); if (i >= 0) stack.length = i + 1; else stack.push(r); render(); }
  // the overview and the deep dive belong to app.js; when they open or close, the address follows
  function sync() {
    const r = here(), { k, a, deep } = parse(r);
    let want = r;
    // a full card opened from the overview (a figure's link) comes first: it is where the reader is going
    if (focus) want = `${kOf()}/${focus.s.code}/scheda`;
    else if (!ovEl.hidden) { if (k !== "quadro") want = "quadro"; }
    else if (k === "quadro") want = "";
    else if (deep) { if (stack.length > 1) { history.back(); return; } want = `${k}/${a}`; }   // closing the card returns where it was opened
    if (want !== r) go(want); else title();
  }
  function title() {
    const t = T[lang], { k, a } = parse(here()), s = isSky(k) ? stars.find((x) => x.code === a) : null;
    const name = s ? titleOf(s) : k === "quadro" ? t.ovTitle : k === "tabella" ? t.table : k === "franco" ? P().tabs.franco : "";
    document.title = name ? `${name} · ${t.h1}` : t.h1;
  }

  // ---------- drawing ----------
  let drawn = "", drawnTab = "", sheetCode = null, sheetFrom = null, amount = 1000, query = "", sortBy = 0;
  const scrolls = new Map();
  function render() {
    if (!shown) return;
    const wide = !mq.matches;
    const { k, a, deep } = parse(here());
    if (isSky(k)) { const v = k === "dicastero" ? "org" : "fn"; if (view !== v) setView(v); }
    const s = isSky(k) ? stars.find((x) => x.code === a) : null;
    if (k === "quadro") { if (ovEl.hidden) openOverview(a || null); }
    else if (!ovEl.hidden) showOverview(false);
    if (deep && s) { if (!focus) openFocus(s); else if (focus.s !== s) { focus = { s, open: new Set(s.kind === "line" ? [s.code.slice(0, 2)] : []) }; renderFocus(null); } }
    else if (focus) closeFocus();

    const tab = k === "franco" || k === "tabella" || k === "quadro" ? k : "settori";
    const line = s?.kind === "line" ? s : null;
    // a line opened from the table keeps the table behind its card
    const behind = line && drawnTab === "tabella" ? "tabella" : tab;
    const key = `${lang}|${view}|${mode}|${wide}|${behind}|${behind === "settori" && s ? s.f.code : ""}`;
    if (tab !== "quadro" && key !== drawn) {
      if (drawn) scrolls.set(drawn, root.scrollTop);
      // on a wide screen the tiles stay on the left and the chosen sector (or all sectors) is listed on the right
      main.innerHTML = behind === "franco" ? franco() : behind === "tabella" ? table()
        : wide ? `<div class="ph-cols">${home(s?.f.code)}${s ? sector(s.f) : sectors()}</div>` : s ? sector(s.f) : home();
      wire(behind);
      root.scrollTop = scrolls.get(key) ?? 0;
      drawn = key; drawnTab = behind;
    }
    if (line && !deep) openSheet(line); else closeSheet();
    writeTabs(tab);
    if (pt && !pt.moving && here() !== STEPS[pt.i].r) endPt();             // a move the tour did not make ends it
    document.getElementById("ph-tour").setAttribute("aria-label", P().tour.btn); document.getElementById("ph-tour").title = P().tour.btn;
    document.getElementById("ph-h1").textContent = T[lang].h1;
    document.getElementById("ph-sky").textContent = `✦ ${T[lang].sky}`;
    for (const l of ["it", "en"]) document.getElementById(`ph-${l}`).setAttribute("aria-pressed", String(l === lang));
    title();
  }

  const viewSeg = () => { const t = T[lang]; return `<div class="seg ph-seg" role="group" aria-label="${esc(t.view)}">${["fn", "org"].map((v) => `<button data-view="${v}" aria-pressed="${v === view}">${t.W[v].tab}</button>`).join("")}</div>`; };
  const gapSpan = (b, c) => `<span class="${c >= b ? "ph-up" : "ph-down"}">${sgn(c - b)} ${T[lang].mio} (${sgn(((c - b) / b) * 100)}%)</span>`;

  // squarified treemap (Bruls, Huizing and van Wijk): rows of tiles as close to square as the areas allow
  function squarify(items, w, h) {
    const out = [], total = items.reduce((t, d) => t + d.v, 0); let x = 0, y = 0;
    let rest = items.map((d) => ({ d, a: (d.v * w * h) / total }));
    const worst = (row, side) => { const sum = row.reduce((t, r) => t + r.a, 0), mx = Math.max(...row.map((r) => r.a)), mn = Math.min(...row.map((r) => r.a)); return Math.max((side * side * mx) / (sum * sum), (sum * sum) / (side * side * mn)); };
    while (rest.length) {
      const side = Math.min(w, h); let row = [rest[0]], wr = worst(row, side);
      for (let i = 1; i < rest.length; i++) { const next = [...row, rest[i]], wn = worst(next, side); if (wn > wr) break; row = next; wr = wn; }
      const thick = row.reduce((t, r) => t + r.a, 0) / side; let off = 0;
      for (const r of row) { const len = r.a / thick; out.push(w >= h ? { d: r.d, x, y: y + off, w: thick, h: len } : { d: r.d, x: x + off, y, w: len, h: thick }); off += len; }
      if (w >= h) { x += thick; w -= thick; } else { y += thick; h -= thick; }
      rest = rest.slice(row.length);
    }
    return out;
  }

  function home(chosen) {
    const t = T[lang], p = P(), sl = V.slices, c = sl.reduce((s, f) => s + f.c25, 0), b = sl.reduce((s, f) => s + f.p25, 0);
    const WU = 100, HU = mq.matches ? 120 : 80;          // on a wide screen the map is lower, so it fits beside the list
    // a tile's size in pixels decides how much text it gets: the map's width on a phone, or its column on a wide screen
    const ppu = (mq.matches ? Math.min(innerWidth - 32, 560) : ((Math.min(innerWidth - 56, 1280) - 44) * 1.1) / 2.1) / WU;
    const small = [];                                   // tiles too small for their own label are listed under the map
    const tiles = squarify(sl.filter((f) => f.c25 > 0).sort((x, y) => y.c25 - x.c25).map((f) => ({ v: f.c25, f })), WU, HU).map(({ d: { f }, x, y, w, h }) => {
      const rgb = gapRgb(f.pct), pw = w * ppu, ph = h * ppu, size = pw < 60 || ph < 46 ? "xs" : pw > 122 && ph > 107 ? "lg" : "";
      if (size === "xs") small.push({ f, rgb });
      const label = `${Wd().slice} ${f.code}, ${L(f.name)}: ${n(f.c25)} ${t.mio}, ${sgn(f.pct)}%`;
      return `<button class="ph-tile ${size}${f.code === chosen ? " on" : ""}"${f.code === chosen ? ' aria-current="true"' : ""} data-go="${kOf()}/${f.code}" aria-label="${esc(label)}" style="left:${(x / WU) * 100}%;top:${(y / HU) * 100}%;width:${(w / WU) * 100}%;height:${(h / HU) * 100}%;--tf:rgb(${rgb});--tc:${inkOn(rgb)}">
        ${size === "xs" ? (w >= 7 && h >= 7 ? `<b>${f.code}</b>` : "") : `<i class="c">${f.code}</i><b>${esc(L(f.name))}</b><span class="v">${n(f.c25)}</span><span class="g">${sgn(f.pct)}%</span>`}</button>`;
    }).join("");
    return `<section class="ph-screen">
      <p class="eyebrow">${p.eyebrow}</p>
      <div class="ph-big">${n(c)}<small>${p.spent}</small></div>
      <p class="ph-sub">${p.budgetWas(n(b))} · ${gapSpan(b, c)}</p>
      ${viewSeg()}
      <div class="ph-tm" style="aspect-ratio:${WU} / ${HU}">${tiles}</div>
      ${small.length ? `<div class="ph-small">${small.map(({ f, rgb }) => `<button data-go="${kOf()}/${f.code}"><i style="background:rgb(${rgb})"></i>${f.code} ${esc(L(f.name))} <b>${n(f.c25)}</b> <span class="${f.pct >= 0 ? "ph-up" : "ph-down"}">${sgn(f.pct)}%</span></button>`).join("")}</div>` : ""}
      <div class="ph-key" aria-hidden="true"><span class="ph-down">${p.less}</span><i></i><span class="ph-up">${p.more}</span><em>−${FULL}%</em><em>0</em><em>+${FULL}%</em></div>
      <p class="small">${p.tiles}</p>
      <details class="ph-how"><summary>${p.how}</summary>${p.howText.map((x) => `<p>${x}</p>`).join("")}<p>${t.neutral}</p></details>
      <p class="small ph-wide">${p.wide}</p>
    </section>`;
  }

  const gapOf = (s) => (mode === "pct" ? s.p : s.c - s.b);
  const byGap = (x, y) => (gapOf(x) == null) - (gapOf(y) == null) || Math.abs(gapOf(y)) - Math.abs(gapOf(x));
  const modeRow = (title) => { const t = T[lang]; return `<div class="ph-row"><p class="eyebrow">${title}</p>
        <div class="seg ph-seg" role="group" aria-label="${esc(t.height)}">${["chf", "pct"].map((m) => `<button data-mode="${m}" aria-pressed="${m === mode}">${m === "chf" ? "CHF" : "%"}</button>`).join("")}</div></div>
      <div class="g-axis" aria-hidden="true"><span>${P().less}</span><span class="g-h">${t.horizon}</span><span>${P().more}</span></div>`; };
  // one row per star (a line, or a whole sector): its name, and a bar left or right of the budget line
  function gapRows(list) {
    const t = T[lang], max = Math.max(...list.map((s) => Math.abs(gapOf(s) ?? 0)), 1e-9), SPAN = 34;
    return list.map((s) => {
      const v = gapOf(s);
      let bar;
      if (v == null) bar = `<span class="g-na">${t.notBudget} · ${n(s.c, 2)} ${t.mio}</span>`;
      else {
        const w = Math.max(0.6, (Math.abs(v) / max) * SPAN), cls = onBudget(s) ? "on" : v > 0 ? "up" : "down";
        const txt = mode === "pct" ? `${sgn(v, 1)}%` : sgn(v, 2);
        bar = `<span class="g-bar ${cls}" style="left:${v >= 0 ? 50 : 50 - w}%;width:${w}%"></span><span class="g-val" style="left:calc(${v >= 0 ? 50 + w : 50}% + 6px)">${txt}</span>`;
      }
      // screen readers hear the line and its figures; the drawn bar is hidden from them
      const name = s.kind === "fn" ? L(s.f.name) : L(s.label);
      const said = `${s.code} ${name}: ${t.budget} ${n(s.b, 2)}, ${t.actual} ${n(s.c, 2)} ${t.mio}, ${devText(s)}`;
      return `<li><button class="ph-gap" data-go="${kOf()}/${s.code}" aria-label="${esc(said)}"><span class="g-lab"><i>${s.code}</i>${esc(name)}</span><span class="g-track" aria-hidden="true">${bar}</span></button></li>`;
    }).join("");
  }
  // wide screens, before a sector is chosen: the sectors themselves against their budget
  function sectors() {
    const t = T[lang], p = P();
    const list = stars.filter((s) => s.kind === "fn" && (s.b || s.c)).sort(byGap);
    return `<section class="ph-screen">
      <p class="eyebrow">${p.against}</p>
      <h2 class="ph-h">${t.W[view].tab}</h2>
      <p class="ph-sub">${p.pick}</p>
      ${modeRow(`${p.gapsT.split(" ")[0]} · ${p.gapsUnit[mode]}`)}
      <ol class="ph-gaps">${gapRows(list)}</ol>
    </section>`;
  }
  function sector(f) {
    const t = T[lang], p = P(), name = L(f.name);
    const lines = stars.filter((s) => s.kind === "line" && s.f === f && (s.b || s.c)).sort(byGap);
    const id = view === "fn" ? X.anchors[f.code] : null, st = id ? XS[id] : null;
    const rows = gapRows(lines);
    return `<section class="ph-screen">
      <button class="ph-back" data-back>‹ ${t.W[view].tab}</button>
      <p class="eyebrow">${Wd().slice} ${f.code}</p>
      <h2 class="ph-h">${esc(name)}</h2>
      <p class="ph-sub">${p.spentOf(n(f.c25), n(f.p25))} · ${gapSpan(f.p25, f.c25)}</p>
      ${st ? `<div class="ph-chips"><span class="ph-chip">${esc(L(st.label))}: <b>${p.perRes(val(st.value, st.unit, 0), esc(unitText(st.unit)), st.year)}</b></span>${st.rank ? `<span class="ph-chip">${esc(rankText(st.rank))}</span>` : ""}</div>` : ""}
      ${modeRow(`${p.gapsT}, ${p.gapsUnit[mode]}`)}
      <ol class="ph-gaps">${rows}</ol>
      <p class="small">${p.tapLine}</p>
      <button class="ph-cta" data-go="${kOf()}/${f.code}/scheda">${esc(p.all(name))} →</button>
    </section>`;
  }

  function franco() {
    const p = P();
    return `<section class="ph-screen">
      <p class="eyebrow">${p.tabs.franco}</p>
      ${viewSeg()}
      <label class="ph-sub" for="ph-amt">${p.frLabel}</label>
      <div class="ph-amt"><span>CHF</span><input id="ph-amt" type="number" inputmode="numeric" min="0" max="100000000" step="1" value="${amount}"></div>
      <div class="ph-presets">${[500, 1000, 2500, 5000].map((v) => `<button data-amt="${v}" aria-pressed="${v === amount}">${n(v, 0)}</button>`).join("")}</div>
      <p class="ph-sub" id="fr-lede" aria-live="polite"></p>
      <div class="fr-rows" id="fr-rows"></div>
      <p class="small">${p.frNote}</p>
      <details class="ph-how" id="fr-calc" open></details>
    </section>`;
  }
  const REPO = "https://github.com/nslotus/stato-finanziario-di-lugano/blob/main/";
  function drawFranco() {
    const t = T[lang], p = P(), total = V.slices.reduce((s, f) => s + f.c25, 0);
    const rows = V.slices.map((f) => ({ name: L(f.name), c: f.c25, share: f.c25 / total })).sort((x, y) => y.share - x.share).map((r) => ({ ...r, chf: amount * r.share }));
    document.getElementById("fr-lede").textContent = p.frLede(n(amount, 0), { v: `CHF ${n(rows[0].chf, 0)}`, n: rows[0].name }, { v: `CHF ${n(rows[1].chf, 0)}`, n: rows[1].name });
    document.getElementById("fr-rows").innerHTML = rows.map((r) => `<div class="fr-row"><div class="fr-h"><span>${esc(r.name)}<small>${n(r.share * 100, 1)}% · ${n(r.c)} ${t.mio}</small></span><b>CHF ${n(r.chf, 0)}</b></div><div class="fr-sq" aria-hidden="true">${"<i></i>".repeat(Math.round(r.share * 100))}</div></div>`).join("");
    for (const b of main.querySelectorAll("[data-amt]")) b.setAttribute("aria-pressed", String(+b.dataset.amt === amount));
    // the method, with the first row worked out, and where the numbers come from: the accounts' message and the catalog
    const ex = rows[0], file = view === "org" ? "catalog/dicasteri.json" : "catalog/funzioni.json";
    const src = V.source.filter((s) => /consuntivo/.test(s.file));
    const calc = document.getElementById("fr-calc"), open = calc.open;
    calc.innerHTML = `<summary>${p.calcT}</summary><p>${p.calcText(Wd().slice.toLowerCase())}</p>
      <p>${esc(p.calcEx({ name: ex.name, c: n(ex.c), tot: n(total), share: n(ex.share * 100, 1), amt: n(amount, 0), chf: n(ex.chf, 0) }))}</p>
      <p class="small">${t.sources}</p>${srcHtml(src.length ? src : V.source, null)}
      <p class="small">${p.dataT}</p><div class="src"><div>${p.dataFile}: <a href="${REPO}${file}" target="_blank" rel="noopener">${file} ↗</a></div></div>
      <p><button class="ph-back" data-go="tabella">${p.toTable}</button></p>`;
    calc.open = open;
  }

  function table() {
    const t = T[lang], p = P();
    return `<section class="ph-screen">
      <p class="eyebrow">${t.table}</p>
      ${viewSeg()}
      <input id="ph-q" class="ph-search" type="search" autocomplete="off" placeholder="${esc(p.search)}" aria-label="${esc(p.search)}" value="${esc(query)}">
      <div class="seg ph-seg" role="group" aria-label="${esc(p.sortBy)}">${p.sorts.map((x, i) => `<button data-sort="${i}" aria-pressed="${i === sortBy}">${x}</button>`).join("")}</div>
      <ol class="ph-list" id="ph-list"></ol>
    </section>`;
  }
  const fold = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  function drawList() {
    const t = T[lang], q = fold(query.trim());
    const rows = stars.filter((s) => s.kind === "line" && (s.b || s.c) && (!q || s.code.startsWith(q) || fold(L(s.label)).includes(q) || fold(L(s.f.name)).includes(q)))
      .sort([(a, b) => Math.abs(b.c - b.b) - Math.abs(a.c - a.b), (a, b) => b.c - a.c, (a, b) => a.code.localeCompare(b.code)][sortBy]);
    document.getElementById("ph-list").innerHTML = rows.length ? rows.map((s) => `<li><button class="ph-li" data-go="${kOf()}/${s.code}"><span class="l-c">${s.code}</span><span class="l-n">${esc(L(s.label))}<small>${esc(L(s.f.name))}</small></span>
      <span class="l-v">${n(s.c, 2)}<small class="${s.c >= s.b ? "ph-up" : "ph-down"}">${sgn(s.c - s.b, 2)}</small></span></button></li>`).join("") : `<li class="small">${P().none}</li>`;
    for (const b of main.querySelectorAll("[data-sort]")) b.setAttribute("aria-pressed", String(+b.dataset.sort === sortBy));
    document.getElementById("ph-list").setAttribute("aria-label", `${t.table}: ${t.mio}`);
  }

  function wire(screen) {
    if (main.querySelector(".ph-tm")) fitTiles();
    if (screen === "franco") drawFranco();
    if (screen === "tabella") drawList();
    const amt = document.getElementById("ph-amt");
    if (amt) amt.oninput = () => { amount = Math.max(0, Math.min(1e8, Math.round(+amt.value || 0))); drawFranco(); };
    const q = document.getElementById("ph-q");
    if (q) q.oninput = () => { query = q.value; drawList(); };
  }
  main.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.go) { sheetFrom = b; go(b.dataset.go); }
    else if (b.dataset.back != null) back("");
    else if (b.dataset.view) { if (view !== b.dataset.view) { setView(b.dataset.view); if (isSky(parse(here()).k)) go(""); else render(); } }
    else if (b.dataset.mode) { setMode(b.dataset.mode); render(); }
    else if (b.dataset.amt) { amount = +b.dataset.amt; document.getElementById("ph-amt").value = amount; drawFranco(); }
    else if (b.dataset.sort) { sortBy = +b.dataset.sort; drawList(); }
  });

  // ---------- a line's card, sliding up from the bottom ----------
  function openSheet(s) {
    if (sheetCode === `${lang}|${mode}|${s.code}` && !sheet.hidden) return;
    const t = T[lang], g = groupOf(s.code), own = s.text?.length ? [t.say, s.text[0]] : g && g.code !== s.code && g.text?.length ? [t.sayDiv, g.text[0]] : null;
    const fresh = sheet.hidden;
    sheet.style.setProperty("--hue", s.f.hue);
    sheet.innerHTML = `<div class="sh-dim" data-close></div>
      <div class="sh-card${fresh ? " in" : ""}" role="dialog" aria-modal="true" aria-labelledby="sh-h" tabindex="-1">
        <div class="sh-grip" aria-hidden="true"></div><button class="sh-x" data-close aria-label="${t.close}">×</button>
        <p class="eyebrow">${Wd().slice} ${s.f.code} · ${esc(L(s.f.name))}${g && g.code !== s.code ? ` · ${g.code} ${esc(tr(g.label))}` : ""}</p>
        <h2 id="sh-h"><i>${s.code}</i>${esc(L(s.label))}</h2>
        <div class="dev ${side(s.p)}">${devText(s)}<small>${s.p == null || s.only ? "" : onBudget(s) ? (mode === "chf" ? t.onLineChf : t.onLine) : s.p >= 0 ? t.over : t.under}</small></div>
        ${bars(s.b, s.c)}${nums(s.b, s.c)}
        ${own ? `<p class="say"><b>${own[0]}</b>«${esc(own[1].length > 420 ? own[1].slice(0, 418) + "…" : own[1])}»</p>` : ""}
        ${pagesOf(s)}
        <details class="mini"><summary>${t.sources}</summary>${srcHtml(V.source, view === "fn" ? s.code : null)}</details>
        <button class="ph-cta" data-full>${P().full} →</button>
      </div>`;
    sheet.hidden = false; sheetCode = `${lang}|${mode}|${s.code}`;
    if (fresh) sheet.querySelector(".sh-card").focus({ preventScroll: true });
  }
  function closeSheet() {
    if (sheet.hidden) return;
    sheet.hidden = true; sheet.innerHTML = ""; sheetCode = null;
    if (sheetFrom?.isConnected) sheetFrom.focus({ preventScroll: true });
  }
  const dismiss = () => { const { k, a } = parse(here()); back(drawnTab === "tabella" ? "tabella" : `${k}/${a[0]}`); };
  sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) dismiss();
    else if (e.target.closest("[data-full]")) go(`${here()}/scheda`);
  });
  // pull the grip down to close
  let pull = null;
  sheet.addEventListener("pointerdown", (e) => { if (!e.target.closest(".sh-grip")) return; pull = { y: e.clientY, id: e.pointerId }; e.target.setPointerCapture(e.pointerId); });
  sheet.addEventListener("pointermove", (e) => { if (!pull || e.pointerId !== pull.id) return; const card = sheet.querySelector(".sh-card"); card.style.transform = `translateY(${Math.max(0, e.clientY - pull.y)}px)`; });
  const endPull = (e) => { if (!pull || e.pointerId !== pull.id) return; const dy = e.clientY - pull.y; pull = null; const card = sheet.querySelector(".sh-card"); if (card) card.style.transform = ""; if (dy > 90) dismiss(); };
  sheet.addEventListener("pointerup", endPull); sheet.addEventListener("pointercancel", endPull);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && mq.matches && !sheet.hidden && !focus) dismiss(); });

  // ---------- the tab bar ----------
  const ICON = {
    settori: '<rect x="3" y="3" width="10" height="12" rx="1.5"/><rect x="15" y="3" width="6" height="7" rx="1.5"/><rect x="15" y="12" width="6" height="9" rx="1.5"/><rect x="3" y="17" width="10" height="4" rx="1.5"/>',
    franco: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 16V8h5M9.5 12h4"/>',
    quadro: '<path d="M4 20V10M9.5 20V4M15 20v-7M20.5 20V8"/>',
    tabella: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  };
  function writeTabs(tab) {
    const p = P(), names = { ...p.tabs, quadro: T[lang].ovBtn };
    tabsEl.innerHTML = Object.keys(ICON).map((k) => `<button data-tab="${k}"${k === tab ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>${esc(names[k])}</button>`).join("");
  }
  tabsEl.setAttribute("aria-label", "Menu");
  tabsEl.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (!b) return; const k = b.dataset.tab; sheetFrom = null; go(k === "settori" ? "" : k); });

  for (const l of ["it", "en"]) document.getElementById(`ph-${l}`).onclick = () => { if (lang === l) return; lang = l; writeText(); sheetCode = null; render(); if (pt) showStep(pt.i); else writeHint(); };

  // ---------- a short guided tour: five steps, opened from "?" or from a one-time offer; it never plays by itself ----------
  // Each step goes to its screen, outlines what it talks about and explains it in a small card. Moving elsewhere ends it.
  const ring = document.getElementById("ph-ring"), box = document.getElementById("ph-tourbox"), hint = document.getElementById("ph-hint");
  const STEPS = [{ r: "", el: ".ph-big" }, { r: "", el: ".ph-tm" }, { r: "settore/2", el: ".ph-gaps li" }, { r: "settore/212", el: ".sh-card" }, { r: "", el: "#ph-tabs" }];
  let pt = null;
  const seenTour = () => { try { return localStorage.getItem("ph-tour") === "1"; } catch { return true; } };
  const markSeen = () => { try { localStorage.setItem("ph-tour", "1"); } catch {} };
  function writeHint() {
    const t = P().tour;
    hint.innerHTML = `<span>${t.hint}</span><button data-pt="start">${t.start}</button><button data-pt="nohint" aria-label="${T[lang].close}">×</button>`;
  }
  function startPt() { hint.hidden = true; markSeen(); pt = { i: 0 }; box.hidden = false; showStep(0); }
  function endPt() {
    if (!pt) return; pt = null; box.hidden = true; ring.hidden = true;
    document.getElementById("ph-tour").focus({ preventScroll: true });
  }
  function showStep(i) {
    const t = P().tour, s = STEPS[i]; pt.i = i;
    box.setAttribute("aria-label", t.btn);
    if (here() !== s.r) { pt.moving = true; stack[stack.length - 1] = s.r; history.replaceState(history.state, "", urlOf(s.r)); render(); pt.moving = false; }
    if (s.r === "") root.scrollTop = 0;
    box.innerHTML = `<button class="pt-x" data-pt="end" aria-label="${T[lang].close}">×</button><p class="pt-n">${t.btn} · ${t.count(i + 1, STEPS.length)}</p><p class="pt-t" aria-live="polite">${t.steps[i]}</p>
      <div class="pt-nav">${i ? `<button data-pt="back">${t.back}</button>` : ""}<button class="pt-go" data-pt="${i === STEPS.length - 1 ? "end" : "next"}">${i === STEPS.length - 1 ? t.done : t.next}</button></div>`;
    setTimeout(placeRing, s.el === ".sh-card" ? 320 : 30);
    box.querySelector(".pt-go").focus({ preventScroll: true });
  }
  function placeRing() {
    if (!pt) return;
    const el = document.querySelector(STEPS[pt.i].el); if (!el) { ring.hidden = true; return; }
    if (STEPS[pt.i].el === ".ph-gaps li") el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect(), pad = 6, top = Math.max(4, r.top - pad), bottom = Math.min(innerHeight - 4, r.bottom + pad);
    Object.assign(ring.style, { left: `${Math.max(4, r.left - pad)}px`, top: `${top}px`, width: `${Math.min(innerWidth - 8, r.width + 2 * pad)}px`, height: `${Math.max(0, bottom - top)}px` });
    ring.hidden = false;
    box.classList.toggle("at-top", (top + bottom) / 2 > innerHeight * 0.45);   // the card sits on the side away from what it explains
  }
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pt]"); if (!b) return; const a = b.dataset.pt;
    if (a === "next") showStep(pt.i + 1); else if (a === "back") showStep(pt.i - 1); else { endPt(); go(""); }
  });
  hint.addEventListener("click", (e) => { const b = e.target.closest("[data-pt]"); if (!b) return; if (b.dataset.pt === "start") startPt(); else { hint.hidden = true; markSeen(); } });
  document.getElementById("ph-tour").onclick = () => (pt ? endPt() : startPt());
  root.addEventListener("scroll", () => { if (pt) placeRing(); }, { passive: true });
  addEventListener("resize", () => { if (pt) placeRing(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && pt) endPt(); });

  // ---------- switching between the phone and the sky ----------
  // on a wide screen the reader may choose these views ("Riquadri") instead of the sky; the choice is kept in this browser
  let tiles = false; try { tiles = localStorage.getItem("cielo-layout") === "tiles"; } catch {}
  const want = () => mq.matches || tiles;
  let shown = want();                                    // which layout is on screen; after start() it changes only in apply()
  function apply() {
    shown = want();
    document.body.classList.toggle("phone", shown);
    document.body.classList.toggle("wide", shown && !mq.matches);
    root.hidden = !shown; tabsEl.hidden = !shown;
    if (!shown) { closeSheet(); endPt(); hint.hidden = true; }
  }
  function start() { apply(); stack = [here()]; render(); if (mq.matches && !seenTour() && !here()) { writeHint(); hint.hidden = false; } }
  // turning a tablet or resizing a window across 720px swaps the layouts; resize is checked too, because the media
  // query's own change event does not always arrive
  function swap() {
    if (want() === shown) { if (shown && document.body.classList.contains("wide") === mq.matches) { apply(); drawn = ""; render(); } return; }
    apply();
    if (shown) { if (tour) stopTour(); intro.hidden = true; peek.hidden = true; sel = null; drawn = ""; start(); }
    else { stack = [here()]; applyRoute(); placeTopButtons(); resize(); redraw(); }
  }
  mq.addEventListener("change", swap);
  addEventListener("resize", () => { if (shown && main.querySelector(".ph-tm")) fitTiles(); });
  document.fonts?.ready.then(() => { if (shown && main.querySelector(".ph-tm")) fitTiles(); });
  addEventListener("resize", swap);
  function setTiles(on) { tiles = on; try { localStorage.setItem("cielo-layout", on ? "tiles" : "sky"); } catch {} swap(); }
  document.getElementById("ph-sky").onclick = () => setTiles(false);
  phoneUI = { active: () => shown, start, sync, route, setTiles };
}
