import { ajaxJSON, setAuth, humanError, redirectAfterLogin, BACKEND_URL } from "./common.js";

const state = {
  tmpToken: null,
  email: null,
  voice: {
    code: null,
    ttl: 0,
    ttlTimer: null,
    pollTimer: null,
  },
};

function show(el, yes) { el && (el.style.display = yes ? "" : "none"); }
function addClass(el, cls) { el && el.classList.add(cls); }
function removeClass(el, cls) { el && el.classList.remove(cls); }

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

async function startVoiceChallenge() {
  try {
    // Mit tmpToken im Storage authentifizieren
    const resp = await ajaxJSON("/voice/challenge", {});
    const { code, ttlSeconds } = resp;

    state.voice.code = code;
    state.voice.ttl = ttlSeconds;

    setText("voiceCode", code);
    setText("voiceCodeInline", code);
    setText("voiceTtl", String(ttlSeconds));

    // TTL runterzählen
    if (state.voice.ttlTimer) clearInterval(state.voice.ttlTimer);
    state.voice.ttlTimer = setInterval(() => {
      state.voice.ttl = Math.max(0, state.voice.ttl - 1);
      setText("voiceTtl", String(state.voice.ttl));
      if (state.voice.ttl <= 0) {
        clearInterval(state.voice.ttlTimer);
      }
    }, 1000);

    // Mit dem Polling starten
    startVoiceFinalizePolling();
  } catch (e) {
    setText("voiceError", humanError(e));
  }
}

function stopVoiceTimers() {
  if (state.voice.ttlTimer) clearInterval(state.voice.ttlTimer);
  if (state.voice.pollTimer) clearInterval(state.voice.pollTimer);
  state.voice.ttlTimer = null;
  state.voice.pollTimer = null;
}

function startVoiceFinalizePolling() {
  if (state.voice.pollTimer) clearInterval(state.voice.pollTimer);
  state.voice.pollTimer = setInterval(async () => {
    try {
      const res = await ajaxJSON("/voice/finalize", {}); 
      if (res && res.token) {
        // Erfolgreich – finalen Token speichern und weiter
        stopVoiceTimers();
        setAuth(res.token, state.email);
        redirectAfterLogin();
      }
    } catch (e) {
      
    }
  }, 3000);
}

function cancelVoiceFlow() {
  stopVoiceTimers();
  setText("voiceError", "");
  setText("voiceInfo", "Wir prüfen automatisch alle paar Sekunden, ob Alexa dich bestätigt hat…");
  setText("voiceCode", "----");
  setText("voiceCodeInline", "----");
  setText("voiceTtl", "—");
}

$(function () {
  const $formLogin = $("#formLogin");
  const $formTotp  = $("#formTotp");

  const $mfaContainer = document.getElementById("mfaContainer");
  const $voiceUnavailable = document.getElementById("voiceUnavailable");
  const $voiceSection     = document.getElementById("voiceSection");

  // Schritt 1: E-Mail/Passwort
  $formLogin.on("submit", async function (e) {
    e.preventDefault();
    const fd = new FormData(this);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");

    $("#formError").text("");

    try {
      const { tmpToken } = await ajaxJSON("/auth/login", { email, password });

      // tmpToken merken und TEMPORÄR als "aktuellen" Token setzen,
      // damit /api/me, /voice/challenge und /voice/finalize authentifiziert sind
      state.tmpToken = tmpToken;
      state.email = email;
      setAuth(tmpToken, email, { temporary: true });

      // Login-Form ausblenden, MFA zeigen
      show(document.getElementById("formLogin"), false);
      show($mfaContainer, true);

      // Prüfen, ob Alexa verknüpft & Voice-PIN gesetzt
      const me = await ajaxJSON("/auth/me"); // akzeptiert tmpToken
      const alexaOk = !!me.alexaLinked && !!me.voicePinSet;

      if (alexaOk) {
        removeClass($voiceSection, "d-none");
        addClass($voiceUnavailable, "d-none");
        
        document.getElementById("tab-voice").addEventListener("shown.bs.tab", () => {
          if (!state.voice.code) startVoiceChallenge();
        }, { once: true });
      } else {
        addClass($voiceSection, "d-none");
        removeClass($voiceUnavailable, "d-none");
      }

      
      document.querySelector('#pane-totp input[name="code"]')?.focus();

    } catch (x) {
      $("#formError").text(humanError(x));
    }
  });

  // Schritt 2-A: TOTP verifizieren
  $formTotp.on("submit", async function (e) {
    e.preventDefault();
    const fd = new FormData(this);
    const code = String(fd.get("code") || "").trim();

    $("#totpError").text("");

    try {
      const { token } = await ajaxJSON("/auth/totp-verify", { tmpToken: state.tmpToken, code });
      setAuth(token, state.email);
      redirectAfterLogin();
    } catch (x) {
      $("#totpError").text(humanError(x));
    }
  });

  // Schritt 2-B: Voice – Buttons
  $("#btnRefreshVoiceCode").on("click", function (e) {
    e.preventDefault();
    cancelVoiceFlow();
    startVoiceChallenge();
  });

  $("#btnIHaveSpoken").on("click", async function (e) {
    e.preventDefault();
    
    try {
      const res = await ajaxJSON("/voice/finalize", {});
      if (res && res.token) {
        stopVoiceTimers();
        setAuth(res.token, state.email);
        redirectAfterLogin();
      }
    } catch (x) {
      // Falls noch nicht bestätigt: kurze Info anzeigen
      setText("voiceError", "Noch keine Bestätigung durch Alexa erhalten. Wir prüfen weiter…");
    }
  });

  $("#btnCancelVoice").on("click", function (e) {
    e.preventDefault();
    cancelVoiceFlow();
  });

  
  window.addEventListener("beforeunload", stopVoiceTimers);
});
