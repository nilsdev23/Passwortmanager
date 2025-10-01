import { clearAuth } from "./common.js";

$(function () {
  clearAuth();
  $("#message").text("Du wurdest abgemeldet.");
  setTimeout(() => { window.location.href = "./Logon.html"; }, 800);
});
