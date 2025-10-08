import { ajaxJSON, humanError } from "./common.js";

$(function () {
  const API = "https://password-backend-fc0k.onrender.com/api"; // <-- fix

  const $form = $("#formSignup");
  const $btn  = $("#btnSignup");
  const $err  = $("#formError");

  const isEmail = v => /^\S+@\S+\.\S+$/.test(String(v).trim());
  const busy = on => $btn.prop("disabled", on).text(on ? "Wird angelegt…" : "Konto anlegen");

  function validate(email, pw, pw2) {
    if (!isEmail(email)) return "Bitte eine gültige E-Mail eingeben.";
    if (!pw || pw.length < 8) return "Passwort muss mindestens 8 Zeichen haben.";
    if (pw !== pw2) return "Passwörter stimmen nicht überein.";
    return null;
  }

  $btn.on("click", submit);
  $form.on("submit", e => { e.preventDefault(); submit(); });

  function submit() {
    $err.text("");
    const f = new FormData($form[0]);
    const email = String(f.get("email") || "").trim().toLowerCase(); // Backend prüft case-insensitive
    const pw    = f.get("password");
    const pw2   = f.get("password2");

    const msg = validate(email, pw, pw2);
    if (msg) { $err.text(msg); return; }

    busy(true);
    ajaxJSON(`${API}/auth/register`, "POST", { email, password: pw })
      .done(res => {
        if (res?.totpProvisioningUri) {
          alert(
            "Registrierung erfolgreich.\n\n" +
            "Bitte in deiner Authenticator-App hinzufügen:\n\n" +
            res.totpProvisioningUri +
            (res?.totpSecret ? `\n\nSecret: ${res.totpSecret}` : "")
          );
        } else {
          alert("Registrierung erfolgreich. Bitte einloggen.");
        }
        window.location.href = "../logon/Logon.html";
      })
      .fail(xhr => {
        if (xhr?.status === 409) {
          $err.text("E-Mail ist bereits vergeben.");
        } else if (xhr?.status === 400) {
          $err.text(xhr.responseJSON?.error || "Eingaben unvollständig oder ungültig.");
        } else {
          $err.text(humanError(xhr));
        }
      })
      .always(() => busy(false));
  }
});
