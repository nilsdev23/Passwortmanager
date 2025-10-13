import { ajaxJSON, authHeader, requireAuthOrRedirect, humanError } from "./common.js";

const $rows   = () => $("#vaultRows");
const $empty  = () => $("#emptyState");
const $err    = () => $("#listError");
let modal;

// ===== Boot =====
$(function () {
  // Login erforderlich
  if (!requireAuthOrRedirect()) return;

  // Navbar anpassen (Login/Registrieren raus, Logout rein)
  tweakNavbarForAuth();

  // Modal initialisieren
  modal = new bootstrap.Modal(document.getElementById("pwModal"));

  // Events
  $("#btnAdd").on("click", () => openCreate());
  $("#btnReload").on("click", () => load());
  $("#search").on("input", debounce(() => load($("#search").val().trim()), 250));
  $("#btnGen").on("click", () => {
    const $pw = $('input[name="password"]');
    $pw.val(genPassword());
    $pw.trigger("focus").trigger("select");
  });

  // Formular-Submit (Create/Update)
  $("#formItem").on("submit", onSubmitForm);

  // Tabellen-Delegation: Edit/Delete/Copy
  $rows().on("click", ".btn-edit", onEditClick);
  $rows().on("click", ".btn-delete", onDeleteClick);
  $rows().on("click", ".btn-copy-user", onCopyUser);
  $rows().on("click", ".btn-copy-pass", onCopyPass);

  // Doppelklick: Username / Passwort kopieren
  $rows().on("dblclick", 'td[data-col="username"]', async function () {
    const text = $(this).find(".val").text().trim();
    if (text) await copyWithAutoClear(text);
    toast("Benutzername kopiert (30s).");
  });
  $rows().on("dblclick", 'td[data-col="password"]', async function () {
    const text = $(this).find(".val").text().trim();
    if (text) await copyWithAutoClear(text);
    toast("Passwort kopiert (30s).");
  });

  // Laden
  load();
});

// ===== Navbar anpassen (eingeloggt => Logout anzeigen)
function tweakNavbarForAuth() {
  // In deiner homepage.html befindet sich:
  //   <ul class="navbar-nav me-auto"> Login | Registrieren | Einstellungen
  // Wir ersetzen Login/Registrieren durch Logout
  const $nav = $(".navbar .navbar-nav.me-auto");
  if (!$nav.length) return;
  const hasLogout = $nav.find('a[href="./logon/Logoff.html"]').length > 0;
  if (hasLogout) return;
  // baue neu: Einstellungen bleibt, davor Logout
  const $settings = $nav.find('a[href="./settings/settings.html"]').closest("li");
  const settingsLi = $settings.length ? $settings[0].outerHTML : "";
  $nav.empty().append(`
    <li class="nav-item"><a class="nav-link" href="./logon/Logoff.html">Logout</a></li>
    ${settingsLi}
  `);
}

// ===== Liste laden/rendern =====
function load(query = "") {
  $err().text("");
  $.ajax({
    url: API_BASE + "/vault" + (query ? `?query=${encodeURIComponent(query)}` : ""),
    headers: authHeader()
  })
    .done(items => renderList(items || []))
    .fail(x => {
      $rows().empty(); $empty().addClass("d-none");
      $err().text(humanError(x));
    });
}

function renderList(items) {
  $rows().empty();
  if (!items.length) { $empty().removeClass("d-none"); return; }
  $empty().addClass("d-none");

  items.forEach(it => {
    const row = $(`
      <tr data-id="${it.id}">
        <td class="fw-semibold" data-col="title"><span class="val">${escapeHtml(it.title || "")}</span></td>
        <td data-col="username">
          <span class="val">${escapeHtml(it.username || "")}</span>
          <button class="btn btn-sm btn-light btn-copy-user ms-2">Copy</button>
        </td>
        <td data-col="url">
          ${it.url ? `<a href="${escapeAttr(it.url)}" target="_blank" rel="noopener">${escapeHtml(it.url)}</a>` : "<span class='text-muted'>—</span>"}
        </td>
        <td data-col="password">
          ${it.password ? `<code class="val user-select-all">${escapeHtml(it.password)}</code>` : "<span class='text-muted'>—</span>"}
          <button class="btn btn-sm btn-outline-secondary btn-copy-pass ms-2">Copy</button>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-secondary btn-edit me-1">Bearb.</button>
          <button class="btn btn-sm btn-outline-danger btn-delete">Löschen</button>
        </td>
      </tr>
    `);
    $rows().append(row);
  });
}

// ===== Create/Update =====
async function onSubmitForm(e) {
  e.preventDefault();
  $("#modalError").text("");
  const data = Object.fromEntries(new FormData(this).entries());
  // normalisieren
  const body = {
    title: (data.title || "").trim(),
    username: (data.username || "").trim(),
    password: (data.password || "").trim(),
    url: (data.url || "").trim(),
    notes: (data.notes || "").trim()
  };
  if (!body.title || !body.username || !body.password) {
    $("#modalError").text("Titel, Nutzername und Passwort sind erforderlich.");
    return;
  }

  try {
    if (data.id) {
      // UPDATE
      await ajaxJSON(`/vault/${encodeURIComponent(data.id)}`, "PUT", body);
    } else {
      // CREATE
      await ajaxJSON("/vault", "POST", body);
    }
    modal.hide();
    load($("#search").val().trim());
  } catch (x) {
    $("#modalError").text(humanError(x));
  }
}

// ===== Edit/Delete/Copy Handler =====
async function onEditClick() {
  const $tr = $(this).closest("tr");
  const id  = $tr.data("id");
  const it  = {
    id,
    title: $tr.find('td[data-col="title"] .val').text().trim(),
    username: $tr.find('td[data-col="username"] .val').text().trim(),
    password: $tr.find('td[data-col="password"] .val').text().trim(),
    url: $tr.find('td[data-col="url"] a').attr("href") || "",
  };
  openEdit(it);
}

async function onDeleteClick() {
  const $tr = $(this).closest("tr");
  const id  = $tr.data("id");
  if (!confirm("Diesen Eintrag wirklich löschen?")) return;
  $.ajax({
    url: API_BASE + `/vault/${encodeURIComponent(id)}`,
    method: "DELETE",
    headers: authHeader()
  })
    .done(() => { $tr.remove(); if (!$rows().children().length) $empty().removeClass("d-none"); })
    .fail(x => alert(humanError(x)));
}

async function onCopyUser() {
  const $tr = $(this).closest("tr");
  const val = $tr.find('td[data-col="username"] .val').text().trim();
  if (!val) return;
  await copyWithAutoClear(val);
  toast("Benutzername kopiert (30s).");
}

async function onCopyPass() {
  const $tr = $(this).closest("tr");
  const val = $tr.find('td[data-col="password"] .val').text().trim();
  if (!val) return;
  await copyWithAutoClear(val);
  toast("Passwort kopiert (30s).");
}

// ===== Modal öffnen (Create/Edit) =====
function openCreate() {
  const $f = $("#formItem");
  $f[0].reset();
  $f.find('input[name="id"]').val("");
  $("#btnSave").text("Speichern");
  $(".modal-title").text("Neues Passwort");
  $("#modalError").text("");
  modal.show();
}

function openEdit(item) {
  const $f = $("#formItem");
  $f[0].reset();
  $f.find('input[name="id"]').val(item.id);
  $f.find('input[name="title"]').val(item.title);
  $f.find('input[name="username"]').val(item.username);
  $f.find('input[name="password"]').val(item.password);
  $f.find('input[name="url"]').val(item.url || "");
  $("#btnSave").text("Aktualisieren");
  $(".modal-title").text("Eintrag bearbeiten");
  $("#modalError").text("");
  modal.show();
}

// ===== Helfer =====
function genPassword(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*()_+";
  let pw = ""; for (let i=0;i<18;i++) pw += chars[Math.floor(Math.random()*chars.length)];
  return pw;
}
function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
function escapeHtml(s){ return String(s??"").replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,"&quot;"); }

async function copyWithAutoClear(text, ms = 30_000) {
  await navigator.clipboard.writeText(text);
  setTimeout(() => navigator.clipboard.writeText("").catch(()=>{}), ms);
}
function toast(msg, ms=1800){
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 14px;border-radius:10px;border:1px solid #374151;z-index:9999;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.18)';
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; }, ms);
  setTimeout(()=> el.remove(), ms+320);
}
