import { ajaxJSON, humanError } from "./common.js";

$(function () {
  const $form = $("#formSignup");
  const $btn  = $("#btnSignup");
  const $err  = $("#formError");

  const isEmail = (v) => /^\S+@\S+\.\S+$/.test(String(v).trim());

  function busy(on) { $btn.prop("disabled", on).text(on ? "Wird angelegt…" : "Konto anlegen"); }

  function validate(email, pw, pw2) {
    if (!isEmail(email)) return "Bitte eine gültige E-Mail eingeben.";
    if (!pw || pw.length < 8) return "Passwort muss mindestens 8 Zeichen haben.";
    if (pw !== pw2) return "Passwörter stimmen nicht überein.";
    return null;
  }

  $btn.on("click", submit);
  $form.on("submit", (e) => { e.preventDefault(); submit(); });

  function submit() {
    $err.text("");
    const f = new FormData($form[0]);
    const email = f.get("email");
    const pw    = f.get("password");
    const pw2   = f.get("password2");

    const msg = validate(email, pw, pw2);
    if (msg) return $err.text(msg);

    busy(true);
    ajaxJSON("/auth/register", "POST", { email, password: pw })
      .done(res => {
        // Falls geliefert: otpauth-URI anzeigen
        if (res?.totpProvisioningUri) {
          alert(
            "Registrierung erfolgreich.\n\n" +
            "Richte jetzt in deiner Authenticator-App folgenden Eintrag ein:\n\n" +
            res.totpProvisioningUri +
            (res?.totpSecret ? `\n\nSecret: ${res.totpSecret}` : "")
          );
        } else {
          alert("Registrierung erfolgreich. Bitte einloggen.");
        }
        window.location.href = "../logon/Logon.html";
      })
      .fail(x => $err.text(humanError(x)))
      .always(() => busy(false));
  }
});
