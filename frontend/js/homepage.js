// vault.js
// UI-Logik für Passworteinträge (Liste, Suche, Neu, Löschen) — jetzt via GraphQL.
import { authHeader, requireAuthOrRedirect, humanError } from "./common.js";

const $rows  = () => $("#vaultRows");
const $empty = () => $("#emptyState");
const $err   = () => $("#listError");
let modal;



// ---- GraphQL Wrapper (liefert jQuery-Promise, kompatibel zu .done/.fail) ----
function gql(query, variables = {}) {
  const d = $.Deferred();
  fetch("https://password-graphql.onrender.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(), // enthält Authorization: Bearer <jwt>
    },
    body: JSON.stringify({ query, variables }),
  })
    .then(async (res) => {
      let json = {};
      try { json = await res.json(); } catch {}
      if (!res.ok) {
        d.reject({ status: res.status, responseJSON: json });
        return;
      }
      if (json.errors && json.errors.length) {
        d.reject({ status: 400, responseJSON: { message: json.errors[0].message } });
        return;
      }
      d.resolve(json.data);
    })
    .catch((err) => d.reject({ status: 0, responseText: String(err) }));
  return d.promise();
}

// ---- GraphQL Operations ----
const Q_VAULT_ITEMS = `
  query VaultItems {
    vaultItems {
      id title username password url notes createdAt updatedAt
    }
  }
`;
const M_CREATE = `
  mutation Create($input: VaultUpsertInput!) {
    createVaultItem(input: $input) { id }
  }
`;
const M_UPDATE = `
  mutation Update($id: ID!, $input: VaultUpsertInput!) {
    updateVaultItem(id: $id, input: $input) { id updatedAt }
  }
`;
const M_DELETE = `
  mutation Delete($id: ID!) {
    deleteVaultItem(id: $id)
  }
`;

$(function () {
  // Wenn Vault geschützt ist: Login verlangen
  if (!requireAuthOrRedirect()) return;

  modal = new bootstrap.Modal(document.getElementById("pwModal"));

  $("#btnAdd").on("click", () => openCreate());
  $("#btnReload").on("click", () => load());
  $("#search").on("input", debounce(() => load($("#search").val().trim()), 250));
  $("#btnGen").on("click", () => $("[name=password]").val(genPassword()));

  $("#formItem").on("submit", function (e) {
    e.preventDefault();
    $("#modalError").text("");

    const data = Object.fromEntries(new FormData(this).entries());
    const isCreate = !data.id;

    // Body konsistent zusammenstellen
    const body = {
      title:    (data.title ?? "").trim(),
      username: (data.username ?? "").trim(),
      password: (data.password ?? "").trim(),
      url:      (data.url ?? "").trim(),
      notes:    (data.notes ?? "").trim()
    };

    const op = isCreate
      ? { query: M_CREATE, variables: { input: body } }
      : { query: M_UPDATE, variables: { id: Number(data.id), input: body } };

    gql(op.query, op.variables)
      .done(() => {
        modal.hide();
        this.reset();
        load();
      })
      .fail(x => $("#modalError").text(humanError(x)));
  });

  $(document).on("click", ".btn-delete", function () {
    const id = $(this).data("id");
    if (!id) return;
    if (!confirm("Eintrag wirklich löschen?")) return;

    gql(M_DELETE, { id: Number(id) })
      .done(() => load())
      .fail(x => alert(humanError(x)));
  });

  load();
});

function load(query = "") {
  $err().text("");

  gql(Q_VAULT_ITEMS)
    .done(({ vaultItems }) => {
      let items = vaultItems || [];
      // Client-seitige Suche (Titel/Username/URL)
      if (query) {
        const q = query.toLowerCase();
        items = items.filter(it =>
          (it.title || "").toLowerCase().includes(q) ||
          (it.username || "").toLowerCase().includes(q) ||
          (it.url || "").toLowerCase().includes(q)
        );
      }
      renderList(items);
    })
    .fail(x => {
      $rows().empty();
      $empty().addClass("d-none");
      $err().text(humanError(x));
      if (x?.status === 401) requireAuthOrRedirect(true);
    });
}

function renderList(items) {
  $rows().empty();
  if (!items.length) { $empty().removeClass("d-none"); return; }
  $empty().addClass("d-none");

items.forEach(it => {
  const urlHtml = it.url
    ? `<a href="${escapeAttr(it.url)}" target="_blank" rel="noopener">${escapeHtml(it.url)}</a>`
    : "";

  const pwHtml = it.password
    ? `<code class="user-select-all">${escapeHtml(it.password)}</code>`
    : "<span class='text-muted'>—</span>";

  const row = $(`
    <tr>
      <td class="fw-semibold">${escapeHtml(it.title || "")}</td>
      <td>${escapeHtml(it.username || "")}</td>
      <td>${urlHtml}</td>
      <td>${pwHtml}</td>
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

// --- kleine Utils ---
function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*()_+";
  let pw = "";
  for (let i = 0; i < 18; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function escapeHtml(s) { return String(s).replace(/[&<>\"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m])); }
function escapeAttr(s) { return escapeHtml(s).replace(/\"/g, "&quot;"); }
