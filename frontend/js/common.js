// ======= Globale Konfiguration & Utilities =======
const API_BASE = "/api"; // bei Bedarf anpassen


export function getAuth(){
try { return JSON.parse(localStorage.getItem("pm_auth")) || {}; } catch(e){ return {}; }
}
export function setAuth(token, user){
localStorage.setItem("pm_auth", JSON.stringify({ token, user }));
}
export function clearAuth(){
localStorage.removeItem("pm_auth");
}
export function authHeader(){
const s = getAuth();
return s?.token ? { "Authorization": "Bearer "+s.token } : {};
}
export function requireAuthOrRedirect(){
if(!getAuth()?.token){
window.location.href = "../logon/Logon.html";
return false;
}
return true;
}
export function ajaxJSON(path, method = "GET", body = undefined, extraHeaders = {}){
return $.ajax({
url: API_BASE + path,
method,
data: body ? JSON.stringify(body) : undefined,
contentType: body ? "application/json" : undefined,
dataType: "json",
headers: { ...authHeader(), ...extraHeaders }
});
}


// einfache Helfer
export function show($el, on){ $el.toggleClass("hidden", !on); }
export function qs(id){ return $(id); }