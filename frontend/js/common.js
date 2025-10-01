// Globale Basis-URL (bei Bedarf anpassen, z.B. "http://localhost:8080/api")
export const API_BASE = "/api";

// ===== Auth Helpers =====
export function getAuth() {
  try { return JSON.parse(localStorage.getItem("pm_auth")) || {}; }
  catch { return {}; }
}
export function setAuth(token, user) {
  localStorage.setItem("pm_auth", JSON.stringify({ token, user }));
}
export function clearAuth() {
  localStorage.removeItem("pm_auth");
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

// ===== AJAX Helper (jQuery) =====
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

// ===== Kleine UI-Utils =====
export function showSel(selector, on) {
  $(selector).toggleClass("d-none", !on);
}
export function show($el, on) {
  $el.toggleClass("d-none", !on);
}
