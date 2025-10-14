/* ===========================
   common.js (Frontend Utils)
   =========================== */

/** Production endpoints (Render) */
export const GQL_URL = "https://password-graphql.onrender.com/graphql";
export const BACKEND_URL = "https://password-backend-fc0k.onrender.com";

/** Route to your login page (for redirects) */
export const LOGIN_PATH = "/logon/Logon.html";

/* ===========================
   Auth storage helpers
   - Stores { token, email } under 'pm_auth'
=========================== */
const AUTH_KEY = "pm_auth";

export function getAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.token === "string") return obj;
    }
    // legacy fallback (token only)
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
    // keep legacy for older pages (optional)
    localStorage.setItem("token", data.token);
  } catch {}
}

export function clearAuth() {
  try {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem("token");
  } catch {}
}

/** Authorization header helper */
export function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Require auth or redirect to login */
export function requireAuthOrRedirect() {
  const t = getToken();
  if (!t) {
    try {
      window.location.href = LOGIN_PATH;
    } catch {}
    return false;
  }
  return true;
}

/* ===========================
   REST helper using fetch (JSON)
=========================== */
export async function ajaxJSON(path, method = "GET", body) {
  // Support both absolute URLs and API-relative paths ("/api/...")
  const url = /^https?:/i.test(path) ? path : `${BACKEND_URL}${path}`;

  const isBody = body !== undefined && body !== null;
  const res = await fetch(url, {
    method,
    mode: "cors",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      // Always attach token; public endpoints will ignore
      ...authHeader(),
    },
    body: isBody ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch {
    const err = new Error(`Invalid JSON from backend (HTTP ${res.status})`);
    err.raw = text;
    err.status = res.status;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(json?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

/* ===========================
   GraphQL helper
=========================== */
export async function gql(query, variables = {}) {
  const res = await fetch(GQL_URL, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch {
    const err = new Error(`Invalid response from GraphQL (HTTP ${res.status})`);
    err.raw = text;
    err.status = res.status;
    throw err;
  }

  if (!res.ok || payload.errors) {
    const msg = (payload.errors && payload.errors.map(e => e.message).join("; ")) ||
                `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.graphQLErrors = payload.errors || null;
    throw err;
  }
  return payload.data;
}

/* ===========================
   Small helpers
=========================== */
export function humanError(e) {
  if (!e) return "Unbekannter Fehler";
  if (typeof e === "string") return e;
  if (e.body?.error) return e.body.error;
  if (e.status) return `Fehler ${e.status}`;
  return e.message || "Fehler";
}
