// sw.js — "service worker": malý pomocník, ktorý beží v mobile na pozadí.
// Uloží si súbory appky (HTML, CSS, JS, ikony), takže sa appka otvorí
// aj vtedy, keď je notebook vypnutý.
//
// Keď zmením súbory appky, zvýšim číslo verzie → mobil si stiahne nové.
const CACHE = "brain-v1";

// súbory, bez ktorých sa appka neotvorí
const SHELL = [
  "/",
  "/style.css",
  "/app.js",
  "/manifest.webmanifest",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// 1. Inštalácia: stiahni a ulož všetky súbory appky
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting(); // nová verzia sa zapne hneď, nečaká
});

// 2. Aktivácia: zmaž staré verzie uložených súborov
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// pokus o stiahnutie zo siete, ale najviac `ms` milisekúnd
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request).then(
      (response) => { clearTimeout(timer); resolve(response); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

// 3. Každá požiadavka appky prejde cez túto funkciu
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // dáta (/api/...) neukladáme tu — o tie sa stará app.js (localStorage)
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Súbory appky: najprv skús notebook (čerstvá verzia), keď neodpovie do 3 s,
  // použi uloženú kópiu v mobile.
  event.respondWith(
    fetchWithTimeout(event.request, 3000)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone(); // odpoveď sa dá prečítať iba raz → kópia do cache
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request, { ignoreSearch: true });
        // stránka (napr. "/#terminy") → vráť hlavnú stránku "/"
        return cached || caches.match("/");
      })
  );
});
