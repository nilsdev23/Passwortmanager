import { ajaxJSON, setAuth, humanError, redirectAfterLogin, BACKEND_URL } from "./common.js";

const state = { tmpToken: null };

function buildRedirectUri() {
  // Callback-Seite im Frontend
  const url = new URL(window.location.origin + "/logon/SkillCallback.html");
  // Optionale Weiterleitungsseite nach erfolgreichem Login
  // (redirectAfterLogin() liest selbst aus LocalStorage/QueryParam – hier nicht nötig)
  return url.toString();
}

$(function () {
  // 1) E-Mail/Passwort Login
  $("#formLogin").on("submit", function (e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(this).entries());

    ajaxJSON("/auth/login", body)
      .done(res => {
        state.tmpToken = res?.tmpToken;
        if (!state.tmpToken) {
          $("#formError").text("Kein tmpToken erhalten.");
          return;
        }
        // 2FA-Schritt einblenden
        $("#formLogin").hide();
        $("#formTotp").show();
        $("#formError").text("");
        $("#totpError").text("");
      })
      .fail(x => {
        $("#formError").text(humanError(x));
      });
  });

  // 2) TOTP Schritt
  $("#formTotp").on("submit", function (e) {
    e.preventDefault();
    if (!state.tmpToken) {
      $("#totpError").text("Fehlender tmpToken. Bitte neu anmelden.");
      return;
    }
    const body = Object.fromEntries(new FormData(this).entries());
    body.tmpToken = state.tmpToken;

    ajaxJSON("/auth/login/totp-verify", body)
      .done(res => {
        const token = res?.token || "";
        const email = res?.email || "";
        if (!token) {
          $("#totpError").text("Kein Token erhalten.");
          return;
        }
        setAuth(token, email);
        redirectAfterLogin();
      })
      .fail(x => {
        $("#totpError").text(humanError(x));
      });
  });

  // 3) Skill Login (OAuth2/OIDC)
  $("#btnSkillLogin").on("click", function (e) {
    e.preventDefault();
    const redirectUri = buildRedirectUri();

    // Standard Spring Security OAuth2 Client-Endpoint:
    // /oauth2/authorization/{registrationId}
    const authUrl = new URL(`${BACKEND_URL}/oauth2/authorization/skill`);
    authUrl.searchParams.set("redirect_uri", redirectUri);

    // Optional: State mit Rücksprungziel (z.B. homepage)
    // Wird vom Backend normalerweise validiert/gespiegelt
    const next = new URLSearchParams(window.location.search).get("next") || "/homepage.html";
    authUrl.searchParams.set("state", encodeURIComponent(next));

    window.location.href = authUrl.toString();
  });
});
