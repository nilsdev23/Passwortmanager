import { clearAuth, LOGIN_PATH, goTo } from "./common.js";

$(function () {
  clearAuth();
  $("#message").text("Du wurdest abgemeldet.");
  setTimeout(() => { goTo(LOGIN_PATH); }, 800);
});
