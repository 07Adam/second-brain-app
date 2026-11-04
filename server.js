// second-brain-app — malý server, ktorý beží na mojom notebooku
// a posiela appku (HTML, CSS, JS) do mobilu.
// Používa iba moduly, ktoré má Node.js v sebe — nič netreba inštalovať cez npm.

const http = require("node:http");   // modul na webový server
const fs = require("node:fs");       // modul na čítanie súborov
const path = require("node:path");   // modul na skladanie ciest k súborom

// --- 1. Nastavenia -----------------------------------------------------------
// Nastavenia sú v config.json (ten NEJDE na GitHub, sú v ňom moje cesty).
// Ak config.json neexistuje, použijeme config.example.json.
const configFile = fs.existsSync(path.join(__dirname, "config.json"))
  ? "config.json"
  : "config.example.json";
const config = JSON.parse(fs.readFileSync(path.join(__dirname, configFile), "utf8"));

const HOST = config.host; // na akej adrese server počúva (napr. moja Tailscale adresa 100.x.y.z)
const PORT = config.port; // číslo portu, napr. 3000

// priečinok so súbormi appky
const PUBLIC_DIR = path.join(__dirname, "public");

// --- 2. Typy súborov ---------------------------------------------------------
// Prehliadač potrebuje vedieť, či mu posielam HTML, obrázok, CSS...
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

// --- 3. Čo robiť pri každej požiadavke --------------------------------------
function handleRequest(req, res) {
  // z adresy zoberieme len cestu, napr. "/style.css" (bez ?parametrov)
  const url = new URL(req.url, "http://localhost");

  // jednoduchá kontrola, či server žije — appka sa sem bude pýtať
  if (url.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": TYPES[".json"] });
    res.end(JSON.stringify({ ok: true, time: new Date().toISOString() }));
    return;
  }

  // "/" znamená hlavnú stránku
  let file = url.pathname === "/" ? "/index.html" : url.pathname;

  // BEZPEČNOSŤ: path.join + kontrola zabráni triku "/../../heslo.txt",
  // ktorým by niekto chcel čítať súbory mimo priečinka public
  const fullPath = path.join(PUBLIC_DIR, path.normalize(file));
  if (!fullPath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    res.end("Zakázané");
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // súbor neexistuje → chyba 404
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Nenašlo sa");
      return;
    }
    const type = TYPES[path.extname(fullPath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

// --- 4. Spustenie servera ----------------------------------------------------
const server = http.createServer(handleRequest);

server.on("error", (err) => {
  // najčastejšia chyba: Tailscale je vypnutý, takže adresa v "host" teraz neexistuje
  if (err.code === "EADDRNOTAVAIL") {
    console.error(`Adresa ${HOST} teraz neexistuje. Je zapnutý Tailscale? (alebo zmeň "host" v config.json)`);
  } else if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} už používa iný program. Zmeň "port" v config.json.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Appka beží: http://${HOST}:${PORT}  (nastavenia z ${configFile})`);
  console.log("Zastavenie: Ctrl+C");
});
