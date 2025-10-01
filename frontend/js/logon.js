import { ajaxJSON, setAuth } from "./common.js";

const state = { tempLogin: null };

$(function () {
  $("#formLogin").on("submit", function (e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(this).entries());
    ajaxJSON("/auth/login", "POST", body)
      .done((res) => {
        if (res.requiresTotp) {
          state.tempLogin = res.tempLogin;
          $("#totpStep").removeClass("d-none");
        } else {
          setAuth(res.accessToken, res.user);
          window.location.href = "../settings/settings.html";
        }
      })
      .fail((x) => $("#formError").text(x?.responseJSON?.message || "Login fehlgeschlagen"));
  });

  $("#formTotp").on("submit", function (e) {
    e.preventDefault();
    const code = new FormData(this).get("code");
    ajaxJSON("/auth/totp/verify", "POST", { code, tempLogin: state.tempLogin })
      .done((res) => { setAuth(res.accessToken, res.user); window.location.href = "../settings/settings.html"; })
      .fail(() => $("#formError").text("TOTP ungültig"));
  });
});
