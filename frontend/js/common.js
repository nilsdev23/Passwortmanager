/* ===========================
   common.js (Frontend Utils)
   =========================== */

/** Production endpoints (Render) – fest verdrahtet */
export const GQL_URL = "https://password-graphql.onrender.com/graphql";
export const BACKEND_URL = "https://password-backend-fc0k.onrender.com";

/** Route zu deiner Login-Seite (für Redirects) */
// Centralized app routes
export const HOME_PATH     = "/homepage.html";
export const LOGIN_PATH    = "/logon/Logon.html";
export const LOGOFF_PATH   = "/logon/Logoff.html";
export const REGISTER_PATH = "/register/Register.html";
export const SETTINGS_PATH = "/settings/Settings.html";

// Small helper to navigate consistently
export function goTo(path) {
  try {
    window.location.assign(path);
  } catch {}
}

/* ===========================
   URL- und Format-Helfer
=========================== */

/** Prüft auf absolute HTTP/HTTPS-URL */
function isAbsoluteHttpUrl(u) {
  return /^https?:\/\//i.test(String(u || ""));
}

/** Führt base und path sauber zusammen (keine doppelten/fehlenden Slashes) */
function joinUrl(base, path) {
  const b = String(base || "").replace(/\/+$/g, "");
  const p = String(path || "");
  if (!p) return b || "/";
  if (isAbsoluteHttpUrl(p)) return p;
  const pNorm = p.startsWith("/") ? p : `/${p}`;
  return `${b}${pNorm}`;
}

/** Normalisiert alles, was zur Backend-API soll */
function normalizeApiPath(path) {
  // Akzeptiere absolute URLs, "/api/..." und "api/..."
  if (isAbsoluteHttpUrl(path)) return path;
  return joinUrl(BACKEND_URL, path);
}

/* ===========================
   Auth storage helpers
   - Speichert { token, email } als 'pm_auth'
=========================== */
const AUTH_KEY = "pm_auth";

export function getAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.token === "string") return obj;
    }
    // Legacy-Fallback (nur Token)
    const legacy = localStorage.getItem("token");
    if (legacy) return { token: legacy, email: null };
  } catch {}
  return { token: "", email: null };
}

export function getToken() {
  return getAuth().token || "";
}

export function setAuth(token, email) {
  const data = { token: token || "", email: email || null };
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(data));
    // Optional: Legacy-Schlüssel für ältere Seiten
    localStorage.setItem("token", data.token);
  } catch {}
}

export function clearAuth() {
  try {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem("token");
  } catch {}
}

/** Authorization-Header Helper */
export function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Auth erzwingen oder zur Login-Seite umleiten */
const RETURN_KEY = "pm_return";

function setReturnPathIfNeeded() {
  try {
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    // Avoid storing auth-related pages as return targets
    const blocked = new Set([LOGIN_PATH, REGISTER_PATH, LOGOFF_PATH]);
    if (!blocked.has(window.location.pathname)) {
      sessionStorage.setItem(RETURN_KEY, here);
    }
  } catch {}
}

export function popReturnPath() {
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return v || "";
  } catch { return ""; }
}

export function redirectAfterLogin(defaultPath = HOME_PATH) {
  const target = popReturnPath();
  if (target && typeof target === "string") {
    return goTo(target);
  }
  return goTo(defaultPath);
}

export function requireAuthOrRedirect() {
  const t = getToken();
  if (!t) {
    setReturnPathIfNeeded();
    goTo(LOGIN_PATH);
    return false;
  }
  return true;
}

/* ===========================
   jQuery-kompatibles Promise-Wrapperchen
   - ermöglicht .done/.fail/.always UND native .then/.catch/.finally
=========================== */
function asJQStyle(promise) {
  const obj = {
    done(fn)   { promise.then(fn); return obj; },
    fail(fn)   { promise.catch(fn); return obj; },
    always(fn) { promise.finally(fn); return obj; },
    then:   (...a) => promise.then(...a),
    catch:  (...a) => promise.catch(...a),
    finally:(...a) => promise.finally(...a),
  };
  return obj;
}

/* ===========================
   REST-Helper (JSON) via fetch
=========================== */
export function ajaxJSON(path, method = "GET", body) {
  const url = normalizeApiPath(path); // robust gegen "api/..." und "/api/..."
  const isBody = body !== undefined && body !== null;

  const p = (async () => {
    let res;
    try {
      res = await fetch(url, {
        method,
        mode: "cors",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          // Token wird immer mitgeschickt; Public-Endpoints ignorieren ihn
          ...authHeader(),
        },
        body: isBody ? JSON.stringify(body) : undefined,
        redirect: "follow",
      });
    } catch (netErr) {
      const err = new Error(`Netzwerkfehler beim Aufruf von ${url}: ${netErr?.message || netErr}`);
      err.cause = netErr;
      throw err;
    }

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      const err = new Error(`Ungültiges JSON vom Backend (HTTP ${res.status}) – URL: ${url}`);
      err.raw = text;
      err.status = res.status;
      err.url = url;
      throw err;
    }

    if (!res.ok) {
      const msg = json?.error || json?.message || `HTTP ${res.status}`;
      const err = new Error(`${msg} – URL: ${url}`);
      err.status = res.status;
      err.body = json;
      err.url = url;
      throw err;
    }

    return json;
  })();

  return asJQStyle(p);
}

/* ===========================
   GraphQL-Helper
=========================== */
export async function gql(query, variables = {}) {
  let res;
  try {
    res = await fetch(GQL_URL, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify({ query, variables }),
      redirect: "follow",
    });
  } catch (netErr) {
    const err = new Error(`Netzwerkfehler beim GraphQL-Endpoint ${GQL_URL}: ${netErr?.message || netErr}`);
    err.cause = netErr;
    throw err;
  }

  const text = await res.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    const err = new Error(`Ungültige Antwort vom GraphQL-Server (HTTP ${res.status}) – URL: ${GQL_URL}`);
    err.raw = text;
    err.status = res.status;
    err.url = GQL_URL;
    throw err;
  }

  if (!res.ok || payload.errors) {
    const msg =
      (payload.errors && payload.errors.map(e => e?.message || "Unbekannter GraphQL-Fehler").join("; ")) ||
      `HTTP ${res.status}`;
    const err = new Error(`${msg} – URL: ${GQL_URL}`);
    err.status = res.status;
    err.graphQLErrors = payload.errors || null;
    err.url = GQL_URL;
    throw err;
  }
  return payload.data;
}

/* ===========================
   Komfort-APIs oben drauf
=========================== */
export function fetchMe() {
  // gibt Promise/Thenable zurück → await oder .done möglich
  return ajaxJSON("/auth/me", "GET");
}

/* ===========================
   Kleine Helper
=========================== */
export function humanError(e) {
  if (!e) return "Unbekannter Fehler";
  if (typeof e === "string") return e;
  if (e.body?.error) return e.body.error;
  if (e.status && e.url) return `Fehler ${e.status} bei ${e.url}`;
  if (e.status) return `Fehler ${e.status}`;
  return e.message || "Fehler";
}

/** Optional: bequemer Builder für API-URLs in Aufrufern */
export function api(path) {
  return normalizeApiPath(path);
}
