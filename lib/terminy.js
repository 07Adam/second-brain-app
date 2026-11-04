// lib/terminy.js — prečíta tabuľku "Aktívne deadliny" z Obsidianu
// a vráti zoznam termínov, s ktorým vie appka pracovať.
// Súbor v Obsidiane iba ČÍTAME, nikdy doň nezapisujeme.

const fs = require("node:fs");
const path = require("node:path");

// cesta k poznámke s termínmi vo vaulte
const NOTE = path.join("01 - Škola", "Zoznam úloh a termínov.md");

// dni v týždni, ako ich píšem v poznámkach (pre "každú stredu")
const WEEKDAYS = ["nedeľu", "pondelok", "utorok", "stredu", "štvrtok", "piatok", "sobotu"];

// odstráni Markdown: **tučné**, [[odkaz|text]] → text, [[odkaz]] → odkaz, `kód`
function cleanText(text) {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// z textu "10.11.2026 (utorok) 9:10" vytiahne dátum a čas
function findDate(cell) {
  // ak je termín presunutý ("pôvodne X → asi Y"), platí dátum za slovom "asi"
  let text = cell;
  const asiIndex = text.indexOf(" asi ");
  if (asiIndex !== -1) {
    text = text.slice(asiIndex);
  }

  // rozsah "11.–12.1.2027" → berieme prvý deň (11.1.2027)
  const range = text.match(/(\d{1,2})\.\s*[–-]\s*\d{1,2}\.(\d{1,2})\.(\d{4})/);
  // obyčajný dátum "10.11.2026"
  const single = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);

  let day, month, year;
  if (range) {
    [, day, month, year] = range;
  } else if (single) {
    [, day, month, year] = single;
  } else {
    return null; // žiadny dátum sme nenašli
  }

  // čas "9:10" alebo "14:30" (prvý, ktorý nasleduje za dátumom)
  const time = text.match(/\b(\d{1,2}):(\d{2})\b/);

  return {
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    time: time ? `${time[1].padStart(2, "0")}:${time[2]}` : null,
  };
}

// "každú stredu 9:10" → najbližšia streda od dneška
function findWeekly(cell, today) {
  const match = cell.match(/každ\S* (\S+)/);
  if (!match) {
    return null;
  }
  const weekday = WEEKDAYS.indexOf(match[1]);
  if (weekday === -1) {
    return null;
  }
  const next = new Date(today);
  // koľko dní treba pridať, aby sme sa dostali na ten deň v týždni
  next.setDate(today.getDate() + ((weekday - today.getDay() + 7) % 7));
  const time = cell.match(/\b(\d{1,2}):(\d{2})\b/);
  // ak je to dnes, ale čas už prešiel → až o týždeň
  if (time && next.getDate() === today.getDate()) {
    const minutesNow = today.getHours() * 60 + today.getMinutes();
    const minutesEvent = Number(time[1]) * 60 + Number(time[2]);
    if (minutesEvent < minutesNow) {
      next.setDate(next.getDate() + 7);
    }
  }
  return {
    date: toIsoDate(next),
    time: time ? `${time[1].padStart(2, "0")}:${time[2]}` : null,
  };
}

// Date → "2026-11-04" (v miestnom čase, nie UTC)
function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// rozdelí riadok tabuľky "| a | b | c |" na bunky ["a", "b", "c"]
function splitRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim());
}

function readTerminy(vaultPath, today = new Date()) {
  const file = path.join(vaultPath, NOTE);
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");

  // nájdeme sekciu "## 🔴 Aktívne deadliny" a čítame až po ďalší nadpis "## "
  const start = lines.findIndex((l) => l.startsWith("## ") && l.includes("Aktívne"));
  if (start === -1) {
    throw new Error("V poznámke chýba sekcia 'Aktívne deadliny'");
  }

  const todayIso = toIsoDate(today);
  const items = [];

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      break; // koniec sekcie
    }
    if (!line.trim().startsWith("|")) {
      continue; // nie je to riadok tabuľky
    }
    const cells = splitRow(line);
    if (cells.length < 2 || cells[0] === "Termín" || /^-+$/.test(cells[0].replace(/[\s:]/g, ""))) {
      continue; // hlavička alebo oddeľovač "|---|"
    }

    const [whenCell, whatCell, detailCell = ""] = cells;
    const weekly = /každ/.test(whenCell);
    const when = weekly ? findWeekly(whenCell, today) : findDate(whenCell);
    if (!when) {
      continue;
    }

    const what = cleanText(whatCell);
    // "→ [[Poznámka]]" sú odkazy pre Obsidian — v mobile nemajú zmysel, tak ich vynecháme
    const detail = cleanText(detailCell.replace(/\s*→\s*\[\[[^\]]+\]\]/g, ""));
    const points = (detail + " " + what).match(/(\d+)\s*b\b/); // "20 b." alebo "4 b"

    items.push({
      title: what.replace(/\s*✅\s*/g, "").trim(),
      date: when.date,
      time: when.time,
      weekly, // opakuje sa každý týždeň
      done: what.includes("✅"), // už odovzdané
      uncertain: /NEOVERENÉ|asi /.test(whenCell), // dátum nie je istý
      points: points ? Number(points[1]) : null,
      detail: detail.length > 160 ? detail.slice(0, 157) + "…" : detail,
    });
  }

  // iba budúce (a dnešné) termíny, zoradené od najbližšieho
  return items
    .filter((t) => t.date >= todayIso)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
}

module.exports = { readTerminy };
