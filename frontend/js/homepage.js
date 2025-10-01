import { ajaxJSON, authHeader } from "./common.js";

// kleine Helfer
const $rows = () => $("#vaultRows");
const $empty = () => $("#emptyState");
const $err = () => $("#listError");

let modal; // Bootstrap Modal Instanz

$(function () {
  // Modal vorbereiten
  modal = new bootstrap.Modal(document.getElementById("pwModal"));

  // Events
  $("#btnAdd").on("click", () => openCreate());
  $("#btnReload").on("click", () => load());
  $("#search").on("input", debounce(() => load($("#search").val().trim()), 250));
  $("#btnGen").on("click", () => {
    $("[name=password]").val(genPassword());
  });

  // Create/Save
  $("#formItem").on("submit", function (e) {
    e.preventDefault();
    $("#modalError").text("");
    const data = Object.fromEntries(new FormData(this).entries());

    const isCreate = !data.id;
    const path = isCreate ? "/vault" : `/vault/${data.id}`;
    const method = isCreate ? "POST" : "PUT";

    ajaxJSON(path, method, data)
      .done(() => {
        modal.hide();
        (this).reset();
        load();
      })
      .fail(x => {
        $("#modalError").text(x?.responseJSON?.message || "Speichern fehlgeschlagen.");
      });
  });

  // Delegiertes Löschen
  $(document).on("click", ".btn-delete", function () {
    const id = $(this).data("id");
    if (!id) return;
    if (!confirm("Eintrag wirklich löschen?")) return;
    ajaxJSON(`/vault/${id}`, "DELETE")
      .done(() => load())
      .fail(() => alert("Löschen fehlgeschlagen."));
  });

  // Start
  load();
});

function load(query = "") {
  $err().text("");
  $.ajax({
    url: "/api/vault" + (query ? `?query=${encodeURIComponent(query)}` : ""),
    headers: authHeader()
  })
    .done(items => {
      renderList(items || []);
    })
    .fail(x => {
      $rows().empty();
      $empty().addClass("d-none");
      $err().text(x?.responseJSON?.message || "Liste konnte nicht geladen werden.");
    });
}

function renderList(items) {
  $rows().empty();
  if (!items.length) {
    $empty().removeClass("d-none");
    return;
  }
  $empty().addClass("d-none");

  items.forEach(it => {
    const row = $(`
      <tr>
        <td class="fw-semibold">${escapeHtml(it.title || "")}</td>
        <td>${escapeHtml(it.username || "")}</td>
        <td>
          ${it.url ? `<a href="${escapeAttr(it.url)}" target="_blank" rel="noopener">${escapeHtml(it.url)}</a>` : ""}
        </td>
        <td>
          ${it.password ? `<code class="user-select-all">${escapeHtml(it.password)}</code>` : "<span class='text-muted'>—</span>"}
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${it.id}">Löschen</button>
        </td>
      </tr>
    `);
    $rows().append(row);
  });
}

function openCreate() {
  const $form = $("#formItem");
  $form[0].reset();
  $form.find("[name=id]").val("");
  $(".modal-title").text("Neues Passwort");
  $("#modalError").text("");
  modal.show();
}

// Utils
function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*()_+";
  let pw = "";
  for (let i = 0; i < 18; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
