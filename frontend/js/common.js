// ===== Backend-Basis =====
export const API_BASE = "https://password-backend-fc0k.onrender.com/api";

// ===== Auth-Storage =====
const LS_AUTH = "pm_auth"; // { token, email }

// robust lesen (pm_auth JSON, Fallback: legacy "token")
export function getAuth() {
  try {
    const raw = localStorage.getItem(LS_AUTH);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.token === "string") return obj;
    }
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
    // Legacy-Schreibweise beibehalten, damit Altcode nichts bricht:
    localStorage.setItem("token", data.token);
  } catch {}
}

export function clearAuth() {
  try {
    localStorage.removeItem(LS_AUTH);
    localStorage.removeItem("token"); // legacy
  } catch {}
}

export function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}


/**
 * ajaxJSON - immer über die zentrale Basis-URL und mit Auth-Header.
 * @param {string} path  Pfad relativ zu API_BASE, z.B. "/vault"
 * @param {string} method HTTP-Methode, default GET
 * @param {object?} body  JSON-Body
 * @param {object?} extra Zusätzliche $.ajax-Optionen
 */
export function ajaxJSON(path, method = "GET", body, extra = {}) {
  const opts = {
    url: API_BASE + path,
    method,
    headers: { ...authHeader(), ...(extra.headers || {}) },
    data: body != null ? JSON.stringify(body) : undefined,
    contentType: body != null ? "application/json" : undefined,
    dataType: "json",
    // Wenn ihr statt JWT Cookie-/Session-Auth benutzt, einkommentieren:
    // xhrFields: { withCredentials: true },
    ...extra
  };
  return $.ajax(opts);
}

/**
 * requireAuthOrRedirect - prüft Token, leitet sonst auf Login um.
 * @param {boolean} force wenn true, immer redirecten
 * @returns {boolean} true, wenn Auth vorhanden
 */
export function requireAuthOrRedirect(force = false) {
  const has = !!getToken();
  if (!has || force) {
    const target = "/login.html";
    if (location.pathname !== target) {
      const next = encodeURIComponent(location.href);
      location.href = `${target}?next=${next}`;
    }
    return false;
  }
  return true;
}

/**
 * humanError - hübsche, menschenlesbare Fehlermeldung aus jQuery-AJAX Fehlerobjekt.
 */
export function humanError(x) {
  if (!x) return "Unbekannter Fehler";
  if (x.responseJSON?.message) return x.responseJSON.message;
  if (x.responseJSON?.error) return x.responseJSON.error;
  if (typeof x.responseText === "string" && x.responseText.length < 300) return x.responseText;
  if (x.status === 0) return "Netzwerkfehler – ist der Server erreichbar?";
  return `Fehler ${x.status || ""} ${x.statusText || ""}`.trim();
}