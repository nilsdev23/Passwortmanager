import { ajaxJSON, humanError, LOGIN_PATH, goTo } from "./common.js";

$(function () {

  const $form = $("#formSignup");
  const $btn = $("#btnSignup");
  const $err = $("#formError");
  const $totpBox = $("#totpBox");
  const $totpQr = $("#totpQr");
  const $totpLink = $("#totpLink");
  const $totpSecretWrap = $("#totpSecretWrap");
  const $totpSecret = $("#totpSecret");
  $(document).on('click', '#btnGoLogin', () => goTo(LOGIN_PATH));

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
    const pw = f.get("password");
    const pw2 = f.get("password2");

    const msg = validate(email, pw, pw2);
    if (msg) { $err.text(msg); return; }

    busy(true);
    ajaxJSON(`/auth/register`, { email, password: pw })
      .done(res => {
  // Erfolgreich: zeige QR-Code oder Link aus dem Backend-Response
  const uri = res?.totpProvisioningUri || res?.totpUri || res?.otpauth || res?.otpauthUrl || res?.otpauth_url;
  const qrDataUrl = res?.totpQrCodeDataUrl || res?.totpQrCode || res?.qrCodeDataUrl || res?.qr || null;
  const secret = res?.totpSecret || res?.secret;

  // Box einblenden
  $totpBox.removeClass("d-none");

  // QR bevorzugt aus Backend anzeigen
  if (qrDataUrl) {
    $totpQr.attr("src", qrDataUrl).css("display", "block");
  } else if (uri) {
    // Fallback: QR on-the-fly erzeugen
    const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(uri);
    $totpQr.attr("src", qrUrl).css("display", "block");
  } else {
    // Kein QR verfügbar
    $totpQr.css("display", "none");
  }

  // otpauth-URI als Link anzeigen (oder leeren)
  if (uri) {
    $totpLink.text(uri).attr("href", uri);
  } else {
    $totpLink.text("");
    $totpLink.removeAttr("href");
  }

  // Secret optional anzeigen
  if (secret) {
    $totpSecret.text(secret);
    $totpSecretWrap.removeClass("d-none");
  } else {
    $totpSecret.text("");
    $totpSecretWrap.addClass("d-none");
  }

  // Formular deaktivieren, damit keine zweite Registrierung passiert
  const $form = $("#formSignup");
  const $btn  = $("#btnSignup");
  $btn.prop("disabled", true);
  $form.find("input").prop("disabled", true);
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
