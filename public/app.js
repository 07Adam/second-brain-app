// app.js — beží v mobile (v Safari), nie na notebooku.

// 1. Dnešný dátum po slovensky, napr. "streda 4. novembra"
const today = new Date();
document.getElementById("date").textContent = today.toLocaleDateString("sk-SK", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

// 2. Pozdrav podľa času
const hour = today.getHours();
let greeting = "Ahoj, Adam";
if (hour < 10) {
  greeting = "Dobré ráno, Adam";
} else if (hour >= 18) {
  greeting = "Dobrý večer, Adam";
}
document.getElementById("greeting").textContent = greeting;

// 3. Je notebook (server) dostupný? Opýtame sa /api/health.
const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");

async function checkServer() {
  try {
    // fetch = pošli požiadavku na server; await = počkaj na odpoveď
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("server odpovedal chybou");
    }
    statusEl.className = "status online";
    statusText.textContent = "Notebook je pripojený";
  } catch (error) {
    // sem sa dostaneme, keď je notebook vypnutý alebo mimo siete
    statusEl.className = "status offline";
    statusText.textContent = "Notebook nie je dostupný";
  }
}

checkServer();
// skontroluj znova každých 30 sekúnd (30 000 milisekúnd)
setInterval(checkServer, 30000);
