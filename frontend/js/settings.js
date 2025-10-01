import { ajaxJSON, requireAuthOrRedirect, showSel } from "./common.js";

$(function () {
  if (!requireAuthOrRedirect()) return;

  refreshTotp();
  refreshAlexa();

  // TOTP Setup
  $("#btnStart").on("click", function () {
    ajaxJSON("/totp/setup", "POST")
      .done((d) => {
        showSel("#stateDisabled", false);
        showSel("#stateSetup", true);
        $("#otpauth").val(d.otpauthUrl);
        $("#qr").attr("src", `data:image/png;base64,${d.qrPngBase64}`);
      });
  });

  $("#formConfirm").on("submit", function (e) {
    e.preventDefault();
    const code = new FormData(this).get("code");
    ajaxJSON("/totp/verify", "POST", { code })
      .done(() => refreshTotp())
      .fail(() => alert("Code ungültig"));
  });

  $("#btnDisable").on("click", function () {
    if (confirm("TOTP wirklich deaktivieren?")) {
      ajaxJSON("/totp", "DELETE").done(() => refreshTotp());
    }
  });

  // Alexa
  $("#btnTest").on("click", function () {
    ajaxJSON("/alexa/test-ping", "POST").done(() => alert("Test gesendet"));
  });

  function refreshTotp() {
    ajaxJSON("/totp/status")
      .done((s) => {
        showSel("#stateDisabled", !s.enabled);
        showSel("#stateEnabled", !!s.enabled);
        showSel("#stateSetup", false);
      });
  }

  function refreshAlexa() {
    ajaxJSON("/alexa/link-status")
      .done((s) => {
        if (s.linked) {
          showSel("#linked", true); showSel("#notLinked", false);
        } else {
          showSel("#notLinked", true); $("#btnLink").attr("href", s.linkUrl || "#");
        }
      });
  }
});
