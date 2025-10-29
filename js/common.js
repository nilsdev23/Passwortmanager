/* ===========================
   common.js (Frontend Utils)
   =========================== */

/** Production endpoints (Render) – fest verdrahtet */
export const GQL_URL = "https://password-graphql.onrender.com/graphql";
export const BACKEND_URL = "https://password-backend-721738115352.europe-west1.run.app";

/** REST-Prefix deines Backends */
export const API_PREFIX = "/api";

/** Route zu deiner Login-Seite (für Redirects) */
/** Centralized app routes */
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

function ensureLeadingSlash(p) {
  return p.startsWith("/") ? p : `/${p}`;
}

/** Normalisiert alles, was zur Backend-API soll */
function normalizeApiPath(path) {
  // 1) absolute URL bleibt unverändert
  if (isAbsoluteHttpUrl(path)) return path;

  // 2) führenden Slash sicherstellen
  let p = ensureLeadingSlash(String(path || ""));

  // 3) falls kein /api-Prefix vorhanden, hinzufügen
  const hasApiPrefix = (p === API_PREFIX) || p.startsWith(`${API_PREFIX}/`);
  if (!hasApiPrefix) {
    p = `${API_PREFIX}${p}`;
  }

  // 4) an BACKEND_URL anhängen
  return joinUrl(BACKEND_URL, p);
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
export function ajaxJSON(path, methodOrBody, body) {
  const url = normalizeApiPath(path); // fügt automatisch /api hinzu

  // Flexible Aufrufvarianten zulassen:
  // - ajaxJSON(path)
  // - ajaxJSON(path, method)
  // - ajaxJSON(path, method, body)
  // - ajaxJSON(path, body)
  let method = methodOrBody;
  if (methodOrBody && typeof methodOrBody === "object" && !Array.isArray(methodOrBody)) {
    body = methodOrBody;
    method = undefined;
  }
  const isBody = body !== undefined && body !== null;

  const p = (async () => {
    let res;
    try {
      const headers = { ...authHeader() };
      if (isBody) headers["Content-Type"] = "application/json";

      res = await fetch(url, {
        method: method || (isBody ? "POST" : "GET"),
        mode: "cors",
        credentials: "omit",
        headers,
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


/** Spezialfall: wie ajaxJSON, aber mit explizitem Bearer-Token (z. B. tmpToken) */
export async function ajaxJSONWithAuth(path, body = {}, token, method = "POST") {
  const url = normalizeApiPath(path);
  const headers = { "Authorization": "Bearer " + String(token || "").trim() };
  if (body !== undefined && body !== null) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(url, {
      method,
      mode: "cors",
      credentials: "omit",
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
      redirect: "follow",
    });
  } catch (netErr) {
    const err = new Error(`Netzwerkfehler beim Aufruf von ${url}: ${netErr?.message || netErr}`);
    err.cause = netErr;
    err.url = url;
    throw err;
  }

  let json = null;
  const ct = res.headers.get("Content-Type") || "";
  if (ct.includes("application/json")) {
    try { json = await res.json(); } catch (e) { json = null; }
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
  return ajaxJSON("/auth/me");
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

export function isLoggedIn() {
  return !!getToken(); // nutzt pm_auth aus getAuth()
}




/** Navbar für Unangemeldete: nur Login & Registrieren anzeigen */
export function lockUnauthedNavbar() {
  if (isLoggedIn()) return;
  const nav = document.querySelector('.navbar .navbar-nav');
  if (nav) {
    nav.innerHTML = `
      <li class="nav-item"><a class="nav-link" href="/logon/Logon.html">Login</a></li>
      <li class="nav-item"><a class="nav-link" href="/register/Register.html">Registrieren</a></li>
    `;
  }
}

/** Klick auf Brand-Logo: Unangemeldete werden zum Login geschickt */
export function guardBrandLink() {
  const brand = document.querySelector('.navbar-brand');
  if (!brand) return;
  brand.addEventListener('click', (e) => {
    if (!isLoggedIn()) {
      e.preventDefault();
      window.location.href = '/logon/Logon.html';
    }
  });
}

export function setupNavbarForAuth() {
  const nav = document.querySelector(".navbar .navbar-nav");
  if (!nav) return;

  if (isLoggedIn()) {
    nav.innerHTML = `
      <li class="nav-item"><a class="nav-link" href="/homepage.html">Tresor</a></li>
      <li class="nav-item"><a class="nav-link" href="/settings/Settings.html">Settings</a></li>
      <li class="nav-item"><a class="nav-link" id="logoutLink" href="#">Logout</a></li>
    `;
    document.getElementById("logoutLink")?.addEventListener("click", (e) => {
      e.preventDefault();
      clearAuth();
      window.location.href = "/logon/Logon.html";
    });
  } else {
    nav.innerHTML = `
      <li class="nav-item"><a class="nav-link" href="/logon/Logon.html">Login</a></li>
      <li class="nav-item"><a class="nav-link" href="/register/Register.html">Register</a></li>
    `;
  }
}
