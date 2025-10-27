
import { ajaxJSON, ajaxJSONWithAuth, setAuth, humanError, redirectAfterLogin, requireAuthOrRedirect, getToken } from "./common.js";

/**
 * Voice/Alexa helpers for linking and login via the skill.
 * Robust to slightly different backend payload keys.
 */

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** Start link-code creation while the user is logged in */
export async function startVoiceLink() {
  // requires normal auth
  try {
    const res = await ajaxJSON("/voice/link/start", {});
    const code = pick(res, "code", "linkCode", "link_code", "value");
    const ttlSec = pick(res, "ttlSec", "ttl", "expiresIn", "expires_in", "validFor");
    const expiresAt = pick(res, "expiresAt", "expires_at", "validUntil");
    return { code, ttlSec, expiresAt, raw: res };
  } catch (e) {
    throw e;
  }
}

/**
 * Starts a voice challenge for passwordless login via the Alexa skill.
 * Returns { code, tmpToken } etc.
 */
export async function startVoiceChallenge() {
  try {
    const res = await ajaxJSON("/voice/challenge", {});
    const code = pick(res, "code", "challenge", "value");
    const tmpToken = pick(res, "tmpToken", "tmp_token", "token");
    const ttlSec = pick(res, "ttlSec", "ttl", "expiresIn", "expires_in");
    if (!tmpToken) {
      const err = new Error("Kein temporärer Token erhalten.");
      err.body = res;
      throw err;
    }
    return { code, tmpToken, ttlSec, raw: res };
  } catch (e) {
    throw e;
  }
}

/** Polls /voice/finalize with the tmp token to exchange it for a full JWT. */
export async function finalizeVoiceLogin(tmpToken, { timeoutMs = 60000, intervalMs = 2000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await ajaxJSONWithAuth("/voice/finalize", {}, tmpToken, "POST");
      const token = pick(res, "token", "jwt");
      if (token) return token;
    } catch (e) {
      // 400 likely means "no-verified-challenge" → keep polling
      // Any other network error: try again until timeout
    }
    await sleep(intervalMs);
  }
  throw new Error("Zeitüberschreitung – nicht verifiziert.");
}

/* ====== UI wiring helpers ====== */

/** Enhance login page with "Login mit Alexa" flow */
export function wireAlexaLoginUI({
  startBtnSelector = "#btnAlexaLogin",
  boxSelector = "#alexaLoginBox",
  codeSelector = "#alexaCode",
  msgSelector = "#alexaMsg",
  errorSelector = "#formError"
} = {}) {
  const $btn = $(startBtnSelector);
  const $box = $(boxSelector);
  const $code = $(codeSelector);
  const $msg = $(msgSelector);
  const $err = $(errorSelector);

  if ($btn.length === 0) return; // not on this page

  $btn.on("click", async (e) => {
    e.preventDefault();
    $err.text("");
    $btn.prop("disabled", true).text("Startet…");
    try {
      const { code, tmpToken } = await startVoiceChallenge();
      $box.removeClass("d-none");
      $code.text(code || "–");
      $("#alexaCodeInline").text(code || "…");
      $msg.text("Sag: „Alexa, öffne Passwortmanager und authentifiziere mich mit Code " + (code || "…") + " und deiner PIN.“");
      // poll finalize
      const jwt = await finalizeVoiceLogin(tmpToken, { timeoutMs: 120000, intervalMs: 2000 });
      try { setAuth(jwt, null); } catch {}
      redirectAfterLogin();
    } catch (e) {
      $err.text(humanError(e));
    } finally {
      $btn.prop("disabled", false).text("Mit Alexa einloggen");
    }
  });
}

/** Enhance settings page with link-code button */
export function wireAlexaLinkUI({
  btnSelector = "#btnAlexaLink",
  codeWrapSelector = "#alexaLinkWrap",
  codeSelector = "#alexaLinkCode",
  infoSelector = "#alexaLinkInfo",
  errorSelector = "#alexaLinkError"
} = {}) {
  const $btn = $(btnSelector);
  const $wrap = $(codeWrapSelector);
  const $code = $(codeSelector);
  const $info = $(infoSelector);
  const $err = $(errorSelector);

  if ($btn.length === 0) return;

  $btn.on("click", async (e) => {
    e.preventDefault();
    $err.text("");
    $btn.prop("disabled", true).text("Wird erzeugt…");
    try {
      const { code, ttlSec } = await startVoiceLink();
      $wrap.removeClass("d-none");
      $code.text(code || "–");
      $info.text("Gültig für ca. " + (ttlSec ? Math.round(ttlSec/60) + " Minuten" : "wenige Minuten") + ". Sag zu Alexa: „Öffne Passwortmanager und verknüpfe mit Code " + (code || "…") + "“.");
    } catch (e) {
      $err.text(humanError(e));
    } finally {
      $btn.prop("disabled", false).text("Verknüpfungs‑Code erstellen");
    }
  });
}
