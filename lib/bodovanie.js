// lib/bodovanie.js — nájde v Obsidiane všetky poznámky so sekciou "## Moje body"
// (napr. ZAP - Bodovanie, ZIM - Bodovanie) a vráti z nich tabuľku bodov.
// Súbory v Obsidiane iba ČÍTAME, nikdy do nich nezapisujeme.

const fs = require("node:fs");
const path = require("node:path");

const SCHOOL_DIR = "01 - Škola"; // hľadáme iba v školskom priečinku
const SECTION = "## Moje body";  // podľa tohto nadpisu spoznáme poznámku s bodmi

// odstráni Markdown: **tučné**, [[odkaz|text]], `kód`, a "→ [[Poznámka]]" na konci
function cleanText(text) {
  return text
    .replace(/\s*→\s*\[\[[^\]]+\]\]/g, "")
    .replace(/\[\[([^\]|]+)\\?\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => cleanText(c));
}

// "12 / 20" → { got: 12, max: 20 }; iné texty → null
function parseScore(cell) {
  const m = cell.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+)/);
  return m ? { got: Number(m[1].replace(",", ".")), max: Number(m[2]) } : null;
}

// rekurzívne prejde priečinok a vráti všetky .md súbory
function findNotes(dir) {
  let result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result = result.concat(findNotes(full));
    } else if (entry.name.endsWith(".md")) {
      result.push(full);
    }
  }
  return result;
}

// z jednej poznámky vytiahne tabuľku pod "## Moje body" a odrážky pod "### Ako som na tom"
function readSubject(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const start = lines.findIndex((l) => l.trim() === SECTION);
  if (start === -1) {
    return null; // táto poznámka body nemá
  }

  // názov predmetu: prvý nadpis "# ..." bez emoji, inak meno súboru
  const h1 = lines.find((l) => l.startsWith("# "));
  const fullTitle = h1
    ? cleanText(h1.slice(2)).replace(/^[^\p{L}\d]+/u, "") // odstráni emoji na začiatku
    : path.basename(file, ".md");
  // "ZAP – Bodovanie a moje body" → "ZAP" (časť pred pomlčkou)
  const title = fullTitle.split(/\s+[–—-]\s+/)[0];
  const updated = (lines.find((l) => l.startsWith("aktualizovane:")) || "").split(":")[1];

  let header = null;
  const rows = [];
  const status = [];
  let inStatus = false;

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("## ")) {
      break; // ďalšia veľká sekcia → koniec
    }
    if (line.startsWith("### ")) {
      inStatus = line.includes("Ako som na tom");
      continue;
    }
    if (inStatus && line.startsWith("- ")) {
      // dvojbodka na konci uvádza tabuľku v Obsidiane, ktorú v mobile nezobrazujeme
      status.push(cleanText(line.slice(2)).replace(/:$/, ""));
      continue;
    }
    // tabuľku berieme iba prvú (hneď pod "## Moje body"), nie tabuľky v "Ako som na tom"
    if (!inStatus && line.startsWith("|")) {
      const cells = splitRow(line);
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        continue; // oddeľovač "|---|---|"
      }
      if (!header) {
        header = cells;
      } else {
        rows.push(cells);
      }
    }
  }

  if (!header) {
    return null;
  }

  // riadok "Spolu" → súhrnné body; ostatné riadky → jednotlivé položky
  const totalRow = rows.find((r) => /^spolu/i.test(r[0]));
  const items = rows.filter((r) => r !== totalRow);

  const totals = [];
  if (totalRow) {
    totalRow.forEach((cell, index) => {
      const score = parseScore(cell);
      if (score && index > 0) {
        totals.push({ label: header[index] || "Body", ...score });
      }
    });
  }

  return {
    title,
    updated: updated ? updated.trim() : null,
    header,
    items,
    totals,
    status,
  };
}

function readBodovanie(vaultPath) {
  const notes = findNotes(path.join(vaultPath, SCHOOL_DIR));
  const subjects = [];
  for (const file of notes) {
    const subject = readSubject(file);
    if (subject) {
      subjects.push(subject);
    }
  }
  return subjects.sort((a, b) => a.title.localeCompare(b.title, "sk"));
}

module.exports = { readBodovanie };
