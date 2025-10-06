// ===== Backend-Basis =====
export const API_BASE = "https://password-backend-fc0k.onrender.com/api";

// ===== Auth-Storage =====
const LS_AUTH = "pm_auth"; // { token, email }

export function getAuth() {
  try { return JSON.parse(localStorage.getItem(LS_AUTH)) || {}; }
  catch { return {}; }
}
export function setAuth(token, email) {
  localStorage.setItem(LS_AUTH, JSON.stringify({ token, email }));
}
export function clearAuth() {
  localStorage.removeItem(LS_AUTH);
}
export function authHeader() {
  const s = getAuth();
  return s?.token ? { "Authorization": "Bearer " + s.token } : {};
}
export function requireAuthOrRedirect() {
  if (!getAuth()?.token) {
    window.location.href = "../logon/Logon.html";
    return false;
  }
  return true;
}

// ===== AJAX Helper =====
export function ajaxJSON(path, method = "GET", body = undefined, extraHeaders = {}) {
  return $.ajax({
    url: API_BASE + path,
    method,
    data: body ? JSON.stringify(body) : undefined,
    contentType: body ? "application/json" : undefined,
    dataType: "json",
    headers: { ...authHeader(), ...extraHeaders }
  });
}

// ===== Fehlertext schöner anzeigen =====
export function humanError(x) {
  return (x?.responseJSON?.error) || (x?.responseJSON?.message) || x?.statusText || "Fehler";
}

// ===== User laden =====
export function fetchMe() {
  return ajaxJSON("/user/me", "GET");
}
