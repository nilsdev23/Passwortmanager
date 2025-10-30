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
function show(el, yes) {
  el.classList.toggle("d-none", !yes);
}

$(async function () {
  if (!requireAuthOrRedirect()) return;

  const $notLinked = document.getElementById("notLinked");
  const $linked    = document.getElementById("linked");

  const $pinNotLinked = document.getElementById("pinNotLinked");
  const $pinUnset     = document.getElementById("pinUnset");
  const $pinSet       = document.getElementById("pinSet");
  const $formSet      = document.getElementById("formSetPin");
  const $formChange   = document.getElementById("formChangePin");
  const $btnChange    = document.getElementById("btnChangePin");
  const $btnClear     = document.getElementById("btnClearPin");

  async function refresh() {
    try {
      const me = await ajaxJSON("/auth/me"); // liefert alexaLinked & voicePinSet
      const linked = !!me.alexaLinked;
      const pinSet = !!me.voicePinSet;

      show($notLinked, !linked);
      show($linked, linked);

      // PIN-Sektion
      show($pinNotLinked, !linked);
      show($pinUnset, linked && !pinSet);
      show($pinSet, linked && pinSet);

      if (!linked) return;
    } catch (x) {
      alert(humanError(x));
    }
  }

  // PIN festlegen
  $formSet?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData($formSet);
    const pin  = String(fd.get("pin") || "").trim();
    const pin2 = String(fd.get("pin2") || "").trim();
    if (pin !== pin2) return alert("PINs stimmen nicht überein.");
    if (!/^\d{4,8}$/.test(pin)) return alert("PIN muss aus 4–8 Ziffern bestehen.");
    try {
      await ajaxJSON("/voice/pin", { pin });
      alert("Sprach-PIN gespeichert.");
      $formSet.reset();
      await refresh();
    } catch (x) {
      alert(humanError(x));
    }
  });

  // PIN ändern (Form ein-/ausblenden)
  $btnChange?.addEventListener("click", () => {
    $formChange.classList.toggle("d-none");
  });

  // PIN ändern (submit)
  $formChange?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData($formChange);
    const pin  = String(fd.get("pin") || "").trim();
    const pin2 = String(fd.get("pin2") || "").trim();
    if (pin !== pin2) return alert("PINs stimmen nicht überein.");
    if (!/^\d{4,8}$/.test(pin)) return alert("PIN muss aus 4–8 Ziffern bestehen.");
    try {
      await ajaxJSON("/voice/pin", { pin });
      alert("Sprach-PIN geändert.");
      $formChange.reset();
      $formChange.classList.add("d-none");
      await refresh();
    } catch (x) {
      alert(humanError(x));
    }
  });

  // PIN löschen
  $btnClear?.addEventListener("click", async () => {
    if (!confirm("Sprach-PIN wirklich löschen?")) return;
    try {
      await ajaxJSON("/voice/pin", "DELETE");
      alert("Sprach-PIN gelöscht.");
      await refresh();
    } catch (x) {
      alert(humanError(x));
    }
  });

  await refresh();
});
$(async function () {
  if (!requireAuthOrRedirect()) return;
  await loadStatusAndWireUi();
});
