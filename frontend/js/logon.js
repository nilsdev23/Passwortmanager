import { ajaxJSON, setAuth, humanError, redirectAfterLogin } from "./common.js";

const state = { tmpToken: null };

$(function () {
  $("#formLogin").on("submit", function (e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(this).entries());

    ajaxJSON("/auth/login", "POST", body)
      .done(res => {
        // Backend liefert tmpToken
        state.tmpToken = res?.tmpToken;
        if (!state.tmpToken) {
          $("#formError").text("Kein tmpToken erhalten.");
          return;
        }
        $("#totpStep").removeClass("d-none");
      })
      .fail(x => $("#formError").text(humanError(x)));
  });

  $("#formTotp").on("submit", function (e) {
    e.preventDefault();
    const code = new FormData(this).get("code");
    if (!state.tmpToken) {
      $("#formError").text("Bitte erst einloggen.");
      return;
    }

    ajaxJSON("/auth/totp-verify", "POST", { tmpToken: state.tmpToken, code })
      .done(async res => {
        const token = res?.token;
        if (!token) {
          $("#formError").text("Kein JWT erhalten.");
          return;
        }
        // persist auth and go where the user came from (or home)
        try { setAuth(token, null); } catch {}
        redirectAfterLogin();
      })
      .fail(x => $("#formError").text(humanError(x)));
  });
});
