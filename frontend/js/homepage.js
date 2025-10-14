import { gql, requireAuthOrRedirect, humanError } from "./common.js";

$(async function () {
  if (!requireAuthOrRedirect()) return;

  const $tbody = $("#vaultTable tbody");
  const $error = $("#homeError");
  const $form  = $("#formAddVault");

  async function load() {
    try {
      $error.text("");
      const data = await gql(/* GraphQL */ `
        query {
          vaultItems {
            id
            title
            username
            password
            url
            notes
            createdAt
            updatedAt
          }
        }
      `);
      render(data.vaultItems || []);
    } catch (e) {
      $error.text(humanError(e));
    }
  }

  function render(items) {
    $tbody.empty();
    if (!items.length) {
      $tbody.append(`<tr><td colspan="6" class="text-muted">Keine Einträge vorhanden.</td></tr>`);
      return;
    }
    for (const it of items) {
      const tr = $(`
        <tr data-id="${it.id}">
          <td>${escapeHtml(it.title || "")}</td>
          <td>${escapeHtml(it.username || "")}</td>
          <td>${escapeHtml(it.url || "")}</td>
          <td>${escapeHtml(it.notes || "")}</td>
          <td>${it.createdAt ? new Date(it.createdAt).toLocaleString() : ""}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-outline-danger btn-delete">Löschen</button>
          </td>
        </tr>
      `);
      tr.find(".btn-delete").on("click", () => del(it.id));
      $tbody.append(tr);
    }
  }

  async function del(id) {
    if (!confirm("Eintrag wirklich löschen?")) return;
    try {
      await gql(/* GraphQL */ `
        mutation($id: ID!) {
          deleteVaultItem(id: $id)
        }
      `, { id: String(id) });
      await load();
    } catch (e) {
      $error.text(humanError(e));
    }
  }

  $form.on("submit", async function (e) {
    e.preventDefault();
    $error.text("");

    const body = Object.fromEntries(new FormData(this).entries());
    const input = {
      title: body.title || "",
      username: body.username || "",
      password: body.password || "",
      url: body.url || "",
      notes: body.notes || ""
    };

    try {
      await gql(/* GraphQL */ `
        mutation($input: VaultUpsertInput!) {
          createVaultItem(input: $input) {
            id
          }
        }
      `, { input });
      (this).reset();
      await load();
    } catch (e) {
      $error.text(humanError(e));
    }
  });

  // tiny helper
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  // initial load
  await load();
});
