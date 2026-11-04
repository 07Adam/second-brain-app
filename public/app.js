// app.js — beží v mobile (v Safari), nie na notebooku.

// ---------------------------------------------------------------------------
// 1. Domov: dátum a pozdrav
// ---------------------------------------------------------------------------
const today = new Date();
document.getElementById("date").textContent = today.toLocaleDateString("sk-SK", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const hour = today.getHours();
let greeting = "Ahoj, Adam";
if (hour < 10) {
  greeting = "Dobré ráno, Adam";
} else if (hour >= 18) {
  greeting = "Dobrý večer, Adam";
}
document.getElementById("greeting").textContent = greeting;

// ---------------------------------------------------------------------------
// 2. Je notebook (server) dostupný?
// ---------------------------------------------------------------------------
const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");

async function checkServer() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("server odpovedal chybou");
    }
    statusEl.className = "status online";
    statusText.textContent = "Notebook je pripojený";
    return true;
  } catch (error) {
    statusEl.className = "status offline";
    statusText.textContent = "Notebook nie je dostupný";
    return false;
  }
}

// ---------------------------------------------------------------------------
// 3. Termíny
// ---------------------------------------------------------------------------
const CACHE_KEY = "terminy"; // pod týmto menom si mobil pamätá posledné termíny

// koľko dní zostáva od dneška do dátumu "2026-11-10"
function daysUntil(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);                                   // polnoc v ten deň
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // dnešná polnoc
  return Math.round((target - start) / 86400000);                         // 86 400 000 ms = 1 deň
}

// 0 → "dnes", 1 → "zajtra", 5 → "o 5 dní"
function countdownText(days) {
  if (days === 0) return "dnes";
  if (days === 1) return "zajtra";
  if (days >= 2 && days <= 4) return `o ${days} dni`;
  return `o ${days} dní`;
}

// "2026-11-10" + "09:10" → "utorok 10. 11. · 9:10"
function whenText(t) {
  const [y, m, d] = t.date.split("-").map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString("sk-SK", { weekday: "long" });
  let text = `${day} ${d}. ${m}.`;
  if (t.time) {
    text += ` · ${t.time.replace(/^0/, "")}`;
  }
  if (t.weekly) {
    text += " · každý týždeň";
  }
  return text;
}

// Bezpečné vloženie textu: textContent namiesto innerHTML,
// aby sa text z poznámok nikdy nespustil ako kód.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderTerminy(data, fromCache) {
  const list = document.getElementById("terminy-list");
  list.replaceChildren(); // vymaž starý obsah

  // kedy boli dáta naposledy stiahnuté
  const updated = new Date(data.updated).toLocaleString("sk-SK", {
    day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
  });
  document.getElementById("terminy-updated").textContent = fromCache
    ? `Offline — posledné dáta z ${updated}`
    : `Aktualizované ${updated} z Obsidianu`;

  // vynecháme termíny, ktoré medzitým prešli (dôležité pri offline dátach)
  const terminy = data.terminy.filter((t) => daysUntil(t.date) >= 0);

  if (terminy.length === 0) {
    list.append(el("li", "empty", "Žiadne nadchádzajúce termíny 🎉"));
    return;
  }

  for (const t of terminy) {
    const days = daysUntil(t.date);
    const li = el("li", "item");
    if (t.done) li.classList.add("done");
    else if (days <= 2) li.classList.add("soon");
    else if (days <= 7) li.classList.add("week");

    // ľavý štvorček s počtom dní
    const count = el("div", "count");
    count.append(el("b", "", days === 0 ? "!" : String(days)));
    count.append(el("span", "", days === 0 ? "dnes" : days === 1 ? "deň" : days <= 4 ? "dni" : "dní"));

    // pravá časť s textom
    const body = el("div");
    body.append(el("p", "item-title", t.title));
    body.append(el("p", "item-when", `${countdownText(days)} · ${whenText(t)}`));
    if (t.detail) body.append(el("p", "item-detail", t.detail));

    const tags = el("div", "tags");
    if (t.points) tags.append(el("span", "tag", `${t.points} b`));
    if (t.uncertain) tags.append(el("span", "tag warn", "dátum neoverený"));
    if (t.done) tags.append(el("span", "tag ok", "hotovo ✓"));
    if (tags.children.length) body.append(tags);

    li.append(count, body);
    list.append(li);
  }
}

// najbližší nehotový termín → na dlaždicu na domovskej obrazovke
function renderNextOnTile(data) {
  const next = data.terminy.find((t) => !t.done && !t.weekly && daysUntil(t.date) >= 0);
  const sub = document.getElementById("next-deadline");
  sub.textContent = next ? `${next.title} · ${countdownText(daysUntil(next.date))}` : "nič nehorí 🎉";
}

async function loadTerminy() {
  try {
    const response = await fetch("/api/terminy", { cache: "no-store" });
    if (!response.ok) throw new Error("server odpovedal chybou");
    const data = await response.json();
    // zapamätaj si ich v mobile pre prípad, že notebook bude vypnutý
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* plná pamäť / súkromný režim */ }
    renderTerminy(data, false);
    renderNextOnTile(data);
  } catch (error) {
    // notebook nie je dostupný → ukáž posledné uložené termíny
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { cached = null; }
    if (cached) {
      renderTerminy(cached, true);
      renderNextOnTile(cached);
    } else {
      document.getElementById("terminy-updated").textContent =
        "Termíny sa nedajú načítať — notebook nie je dostupný a v mobile ešte nič uložené nie je.";
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Bodovanie
// ---------------------------------------------------------------------------
const POINTS_KEY = "bodovanie";

// v ktorom stĺpci je hodnota s daným menom (napr. "Spolu"); -1 ak taký nie je
function columnIndex(header, name) {
  return header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
}

function renderBodovanie(data, fromCache) {
  const list = document.getElementById("bodovanie-list");
  list.replaceChildren();

  const updated = new Date(data.updated).toLocaleString("sk-SK", {
    day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
  });
  document.getElementById("bodovanie-updated").textContent = fromCache
    ? `Offline — posledné dáta z ${updated}`
    : `Aktualizované ${updated} z Obsidianu`;

  if (data.predmety.length === 0) {
    list.append(el("p", "empty", "Žiadna poznámka v „01 - Škola“ nemá sekciu „## Moje body“."));
    return;
  }

  for (const p of data.predmety) {
    const card = el("section", "subject");

    // hlavička: názov predmetu + celkové body (posledný súčet, napr. "Spolu")
    const head = el("div", "subject-head");
    head.append(el("h2", "subject-title", p.title));
    const main = p.totals[p.totals.length - 1];
    if (main) {
      const big = el("span", "subject-big", String(main.got));
      big.append(el("small", "", ` / ${main.max}`));
      head.append(big);
    }
    card.append(head);

    // ukazovateľ pre každý súčet (Zápočet, Skúška, Spolu…)
    for (const t of p.totals) {
      const row = el("div", "bar-row");
      const label = el("div", "bar-label");
      label.append(el("span", "", t.label), el("span", "", `${t.got} / ${t.max}`));
      const bar = el("div", "bar");
      const fill = el("div");
      fill.style.width = `${Math.min(100, Math.round((t.got / t.max) * 100))}%`; // percentá
      bar.append(fill);
      row.append(label, bar);
      card.append(row);
    }

    // moje vlastné zhrnutie z poznámky ("Ako som na tom")
    if (p.status.length) {
      const ul = el("ul", "status-list");
      for (const s of p.status) ul.append(el("li", "", s));
      card.append(ul);
    }

    // rozbaľovací zoznam jednotlivých položiek
    if (p.items.length) {
      const details = el("details");
      details.append(el("summary", "", `Položky (${p.items.length})`));
      const rows = el("div", "rows");
      const scoreCol = [columnIndex(p.header, "Spolu"), columnIndex(p.header, "Body"), 1].find((i) => i > 0);
      const noteCol = columnIndex(p.header, "Poznámka");
      for (const item of p.items) {
        const row = el("div", "row");
        const name = el("span", "row-name", item[0]);
        if (noteCol > 0 && item[noteCol]) name.append(el("span", "row-note", item[noteCol]));
        const score = item[scoreCol] || "–";
        row.append(name, el("span", score.startsWith("–") ? "row-score pending" : "row-score", score));
        rows.append(row);
      }
      details.append(rows);
      card.append(details);
    }

    if (p.updated) card.append(el("p", "item-when", `Poznámka upravená ${p.updated}`));
    list.append(card);
  }
}

// na dlaždicu: "ZAP 42 · ZIM 11"
function renderPointsOnTile(data) {
  const parts = data.predmety
    .filter((p) => p.totals.length)
    .map((p) => `${p.title} ${p.totals[p.totals.length - 1].got}`);
  document.getElementById("points-summary").textContent = parts.length ? parts.join(" · ") : "zatiaľ nič";
}

async function loadBodovanie() {
  try {
    const response = await fetch("/api/bodovanie", { cache: "no-store" });
    if (!response.ok) throw new Error("server odpovedal chybou");
    const data = await response.json();
    try { localStorage.setItem(POINTS_KEY, JSON.stringify(data)); } catch (e) { /* nevadí */ }
    renderBodovanie(data, false);
    renderPointsOnTile(data);
  } catch (error) {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(POINTS_KEY)); } catch (e) { cached = null; }
    if (cached) {
      renderBodovanie(cached, true);
      renderPointsOnTile(cached);
    } else {
      document.getElementById("bodovanie-updated").textContent =
        "Body sa nedajú načítať — notebook nie je dostupný a v mobile ešte nič uložené nie je.";
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Prepínanie obrazoviek podľa adresy (#terminy, #bodovanie, # = domov)
// ---------------------------------------------------------------------------
const views = {
  "": document.getElementById("view-home"),
  terminy: document.getElementById("view-terminy"),
  bodovanie: document.getElementById("view-bodovanie"),
};

function showView() {
  const name = location.hash.replace("#", "");
  const target = views[name] ? name : ""; // neznáma obrazovka → domov
  for (const key in views) {
    views[key].hidden = key !== target;
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", showView);

// ---------------------------------------------------------------------------
// 6. Štart
// ---------------------------------------------------------------------------
showView();
checkServer();
loadTerminy();
loadBodovanie();

// každých 30 s skontroluj server; keď sa appka vráti z pozadia, obnov termíny
setInterval(checkServer, 30000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    checkServer();
    loadTerminy();
    loadBodovanie();
  }
});
