// app.js (ESM)
// Lädt otplib & qrcode direkt als ES-Module aus dem CDN:
import { authenticator } from "https://cdn.jsdelivr.net/npm/otplib@12.0.1/+esm";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm";

// --- DOM-Refs
const $ = (sel) => document.querySelector(sel);
const elCanvas   = $("#totp-qr");
const elUri      = $("#otpauth-uri");
const elAccount  = $("#account");
const elIssuer   = $("#issuer");
const elNew      = $("#btn-new-secret");
const elCopyUri  = $("#btn-copy-uri");
const elCode     = $("#totp-code");
const elVerify   = $("#btn-verify");
const elStatus   = $("#status");

// --- State
let state = {
  secret: null,   // Base32
  uri:    null,
};

// --- Helpers
function buildURI(email, issuer, secret) {
  // otplib erzeugt eine korrekt encodierte otpauth:// URI
  return authenticator.keyuri(email, issuer, secret);
}

async function drawQR(uri) {
  await QRCode.toCanvas(elCanvas, uri, { margin: 1 });
}

async function generateNewSecret() {
  state.secret = authenticator.generateSecret(); // Base32
  state.uri = buildURI(elAccount.value.trim(), elIssuer.value.trim() || "LockBox", state.secret);
  elUri.value = state.uri;
  await drawQR(state.uri);
  setStatus("Neues Secret erstellt. QR aktualisiert.", "muted");
}

function setStatus(text, tone = "muted") {
  elStatus.textContent = text;
  elStatus.classList.remove("ok", "bad");
  if (tone === "ok") elStatus.style.color = "#62d392";
  else if (tone === "bad") elStatus.style.color = "#ff6b6b";
  else elStatus.style.color = ""; // default (muted via CSS)
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

// --- Events
elNew.addEventListener("click", generateNewSecret);

elCopyUri.addEventListener("click", async () => {
  if (!state.uri) return;
  const ok = await copy(state.uri);
  setStatus(ok ? "URI kopiert." : "Kopieren nicht erlaubt.", ok ? "ok" : "bad");
  // Optional: nach 30s leeren (Clipboard-Auto-Clear)
  if (ok) setTimeout(() => navigator.clipboard.writeText(""), 30_000);
});

elVerify.addEventListener("click", () => {
  const token = (elCode.value || "").trim();
  if (!token || !state.secret) { setStatus("Bitte Code eingeben / Secret generieren.", "bad"); return; }
  // window=1 => ±1 Zeitschritt akzeptieren (typ. ±30 s)
  const ok = authenticator.check(token, state.secret, { window: 1 });
  setStatus(ok ? "✓ gültig" : "✗ ungültig", ok ? "ok" : "bad");
});

// Wenn Nutzer Account/Issuer ändert, URI/QR neu ableiten:
[elAccount, elIssuer].forEach((inp) => {
  inp.addEventListener("input", async () => {
    if (!state.secret) return;
    state.uri = buildURI(elAccount.value.trim(), elIssuer.value.trim() || "LockBox", state.secret);
    elUri.value = state.uri;
    await drawQR(state.uri);
  });
});

// --- Init
generateNewSecret().catch(console.error);

/*
  🔐 Hinweise für Produktion:
  - Secret serverseitig speichern (z. B. in 2FA-Tabelle), NICHT im Tresor.
  - Codes serverseitig prüfen; Frontend-Check ist nur UI-Komfort/Setup-Test.
  - Drift & Rate-Limits serverseitig konfigurieren (window, max tries).
  - Zeitquelle des Servers per NTP synchronisieren.
  - Optional: QR als PNG serverseitig generieren (QRCode.toDataURL) und ausliefern.
*/
