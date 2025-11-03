import { ajaxJSON, setAuth, redirectAfterLogin, humanError } from "./common.js";

function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function getHashParam(name) {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const sp = new URLSearchParams(hash);
  return sp.get(name);
}

async function finishLogin() {
  const $status = $("#status");
  const $error  = $("#error");

  try {
    // 1) Direkter Token-Transport
    const token = getParam("token") || getHashParam("token");
    const email = getParam("email") || getHashParam("email") || "";

    if (token) {
      setAuth(token, email);
      $status.text("Erfolgreich angemeldet.");
      redirectAfterLogin();
      return;
    }

    // 2) Authorization Code -> Token Exchange (Backend)
    const code = getParam("code");
    const err  = getParam("error");
    const desc = getParam("error_description");

    if (err) {
      throw new Error(desc || err);
    }
    if (!code) {
      throw new Error("Weder Token noch Code gefunden.");
    }

    
    const redirectUri = window.location.origin + "/logon/SkillCallback.html";

    const res = await ajaxJSON("/auth/skill/exchange", { code, redirectUri });
    const token2 = res?.token || "";
    const email2 = res?.email || "";

    if (!token2) {
      throw new Error("Kein Token beim Exchange erhalten.");
    }

    setAuth(token2, email2);
    $status.text("Erfolgreich angemeldet.");
    redirectAfterLogin();
  } catch (x) {
    $status.hide();
    $error.text(humanError(x)).show();
  }
}

$(finishLogin);
