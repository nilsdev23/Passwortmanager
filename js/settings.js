import { requireAuthOrRedirect, fetchMe, ajaxJSON, humanError } from "./common.js";

let countdownTimer = null;

function startCountdown(ttlSeconds, onTick, onDone) {
  clearInterval(countdownTimer);
  let left = ttlSeconds;
  onTick(left);
  countdownTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(countdownTimer);
      onDone?.();
    } else {
      onTick(left);
    }
  }, 1000);
}

async function loadStatusAndWireUi() {
  const $status = $("#linkStatus");
  const $btnShow = $("#btnShowLoginCode");
  const $wrap = $("#loginCodeWrap");
  const $box  = $("#loginCodeBox");
  const $ttl  = $("#ttl");
  const $btnNew = $("#btnNewLoginCode");

  try {
    const me = await fetchMe(); // GET /api/auth/me

    // Status-Text + Button freischalten
    if (me.alexaLinked) {
      $status.text("Alexa ist verknüpft ✅");
      $btnShow.prop("disabled", false);
    } else {
      $status.text("Alexa ist noch nicht verknüpft ❌");
      $btnShow.prop("disabled", true);
      $wrap.addClass("d-none");
    }

    async function fetchChallenge() {
      try {
        $btnShow.prop("disabled", true);
        $btnNew.prop("disabled", true);

        // POST /api/voice/challenge -> { code, ttlSeconds }
        const { code, ttlSeconds } = await ajaxJSON("/voice/challenge", "POST");

        $box.text(code);
        $wrap.removeClass("d-none");

        startCountdown(
          ttlSeconds,
          (left) => $ttl.text(`Gültig für ${left} Sekunden`),
          () => {
            $ttl.text("Code abgelaufen");
            $btnShow.prop("disabled", false);
            $btnNew.prop("disabled", false);
          }
        );
      } catch (e) {
        alert(humanError(e));
        $btnShow.prop("disabled", false);
        $btnNew.prop("disabled", false);
      }
    }

    $btnShow.off("click").on("click", fetchChallenge);
    $btnNew.off("click").on("click", fetchChallenge);

  } catch (x) {
    alert(humanError(x));
  }
}

$(async function () {
  if (!requireAuthOrRedirect()) return;
  await loadStatusAndWireUi();
});
