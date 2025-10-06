import { requireAuthOrRedirect, fetchMe, humanError } from "./common.js";

$(async function () {
  if (!requireAuthOrRedirect()) return;

  try {
    const me = await fetchMe();
    // falls du irgendwo E-Mail zeigen willst, z. B. in einem Badge
    // $("#userEmail").text(me?.email || "");
  } catch (x) {
    alert(humanError(x));
  }
});
