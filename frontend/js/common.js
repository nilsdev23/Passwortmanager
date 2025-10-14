/* ===========================
   common.js  (Frontend Utils)
   fest verdrahtete Render-URLs
   =========================== */

/** Feste Endpunkte (testweise direkt angegeben) */
export const GQL_URL = "https://password-graphql.onrender.com/graphql";
export const BACKEND_URL = "https://password-backend-fc0k.onrender.com";

/** Login-Seite (falls Redirect nötig) */
export const LOGIN_PATH = "/login.html";

/** ===========================
 *  Auth-Storage (mit Legacy-Kompatibilität)
 *  - Speichert unter "pm_auth" ein JSON: { token, email }
 *  - Liest zusätzlich legacy "token", falls vorhanden
 * =========================== */
const LS_AUTH = "pm_auth"; // { token, email }

export function getAuth() {
  try {
    const raw = localStorage.getItem(LS_AUTH);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.token === "string") return obj;
    }
    // Legacy-Fallback
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
    localStorage.setItem(LS_AUTH, JSON.stringify(data));
    // Legacy-Schreibweise beibehalten, damit Altcode weiterhin funktioniert
    localStorage.setItem("token", data.token);
  } catch {}
}

export function clearAuth() {
  try {
    localStorage.removeItem(LS_AUTH);
    localStorage.removeItem("token"); // legacy
  } catch {}
}

/** Authorization-Header erzeugen */
export function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** ===========================
 *  JWT-Utilities (optional)
 * =========================== */
export function parseJwt(token) {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function isTokenExpired(token) {
  const p = parseJwt(token);
  if (!p || !p.exp) return false; // ohne exp nicht vorzeitig abmelden
  return Date.now() >= p.exp * 1000;
}

/** Bei abgelaufenem/fehlendem Token: Logout + optional Redirect */
export function handleUnauthorized() {
  clearAuth();
  try {
    window.dispatchEvent(new CustomEvent("pm:unauthorized"));
  } catch {}
  if (typeof window !== "undefined") {
    const here = (window.location && window.location.pathname) || "/";
    if (!here.endsWith(LOGIN_PATH)) {
      try {
        window.location.assign(LOGIN_PATH);
      } catch {}
    }
  }
}

/** ===========================
 *  GraphQL – Fetch Helper
 *  - Hängt immer Authorization an (falls vorhanden)
 *  - Sanitiert HTML-Fehlerseiten (z. B. Render 502)
 *  - Wirft bei Fehlern eine Error-Instanz mit .graphQLErrors/.data
 * =========================== */
export async function gql(query, variables = {}, fetchOptions = {}) {
  // Vorab: abgelaufene Tokens vermeiden
  const tok = getToken();
  if (tok && isTokenExpired(tok)) {
    handleUnauthorized();
    throw new Error("Session expired");
  }

  const res = await fetch(GQL_URL, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(fetchOptions.headers || {})
    },
    body: JSON.stringify({ query, variables }),
    ...fetchOptions,
  });

  // Direktes 401 (selten, aber möglich)
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("401 UNAUTHORIZED");
  }

  // Kann bei Proxies in seltenen Fällen HTML liefern – defensiv parsen
  let payload;
  const text = await res.text();
  try {
    payload = JSON.parse(text);
  } catch {
    const msg = `Invalid response from server (${res.status}).`;
    const err = new Error(msg);
    err.raw = text;
    throw err;
  }

  if (payload.errors && payload.errors.length) {
    const msg = sanitizeGraphQLErrors(payload.errors);
    // Heuristik: Unauthorized erkennen und ausloggen
    if (/unauthor/i.test(msg) || /\b401\b/.test(msg)) {
      handleUnauthorized();
    }
    const err = new Error(msg);
    err.graphQLErrors = payload.errors;
    err.data = payload.data;
    throw err;
  }

  return payload.data;
}

/** Kurzhilfen für Queries/Mutations (optional) */
export const gqlQuery = gql;
export const gqlMutation = gql;

/** ===========================
 *  Fehler-Sanitizing / Utilities
 * =========================== */
function stripTags(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function firstLine(s) {
  const t = String(s || "");
  const i = t.indexOf("\n");
  return i >= 0 ? t.slice(0, i) : t;
}

export function sanitizeGraphQLErrors(errors) {
  try {
    const msgs = errors
      .map(e => e && (e.message || e.toString()) || "")
      .map(m => {
        const looksLikeHtml = /<!DOCTYPE\s+html|<html[\s>]/i.test(m);
        const sanitized = looksLikeHtml ? "Upstream error" : stripTags(m);
        return firstLine(sanitized);
      })
      .filter(Boolean);

    // Duplikate entfernen und auf sinnvolle Länge kürzen
    const uniq = Array.from(new Set(msgs)).slice(0, 3);
    const joined = uniq.join(" | ");
    return joined.length > 400 ? joined.slice(0, 399) + "…" : joined;
  } catch {
    return "Unexpected error";
  }
}

/** ===========================
 *  Bequeme Wrapper für gängige Backend-Operationen über GraphQL
 *  (Passe die Felder an dein Schema an)
 * =========================== */

// Viewer (Header-Echo-Test)
export async function qViewer() {
  return gql(/* GraphQL */ `
    query { viewer { id } }
  `);
}

// Vault-Operationen
export async function qVaultItems() {
  return gql(/* GraphQL */ `
    query {
      vaultItems {
        id
        title
        username
        url
        notes
        createdAt
        updatedAt
      }
    }
  `);
}

export async function mCreateVaultItem(input) {
  return gql(/* GraphQL */ `
    mutation($input: VaultUpsertInput!) {
      createVaultItem(input: $input) {
        id
        title
        username
        url
        notes
        createdAt
        updatedAt
      }
    }
  `, { input });
}

export async function mUpdateVaultItem(id, input) {
  return gql(/* GraphQL */ `
    mutation($id: Long!, $input: VaultUpsertInput!) {
      updateVaultItem(id: $id, input: $input) {
        id
        title
        username
        url
        notes
        createdAt
        updatedAt
      }
    }
  `, { id, input });
}

export async function mDeleteVaultItem(id) {
  return gql(/* GraphQL */ `
    mutation($id: Long!) {
      deleteVaultItem(id: $id)
    }
  `, { id });
}

/** ===========================
 *  Globale Exporte (falls ohne Module verwendet)
 * =========================== */
try {
  if (typeof window !== "undefined") {
    window.PM = Object.assign(window.PM || {}, {
      // Konstanten
      GQL_URL, BACKEND_URL, LOGIN_PATH,
      // Auth
      getAuth, getToken, setAuth, clearAuth, authHeader,
      parseJwt, isTokenExpired, handleUnauthorized,
      // GraphQL
      gql, gqlQuery, gqlMutation,
      sanitizeGraphQLErrors,
      // Convenience
      qViewer, qVaultItems, mCreateVaultItem, mUpdateVaultItem, mDeleteVaultItem,
    });
  }
} catch {}
