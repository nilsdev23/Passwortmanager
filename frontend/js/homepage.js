import { gql, requireAuthOrRedirect, humanError } from "./common.js";

$(async function () {
  if (!requireAuthOrRedirect()) return;

  const $rows   = $("#vaultRows");
  const $errLst = $("#listError");
  const $empty  = $("#emptyState");
  const $form   = $("#formItem");
  const $modalEl = document.getElementById("pwModal");
  const BS = window.bootstrap || undefined;
  const modal = BS ? new BS.Modal($modalEl) : null;

  $("#btnReload").on("click", () => load());
  $("#btnAdd").on("click", () => {
    resetForm();
    $("#modalError").text("");
    if (modal) modal.show();
  });
  $("#btnGen").on("click", () => {
    const pwd = genPassword(16);
    $form.find('input[name="password"]').val(pwd);
  });

  async function load() {
    try {
      $errLst.text("");
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
          }
        }
      `);
      render(data.vaultItems || []);
    } catch (e) {
      $errLst.text(humanError(e));
    }
  }

  function render(items) {
    $rows.empty();
    if (!items.length) {
      $empty.removeClass("d-none");
      return;
    }
    $empty.addClass("d-none");
    for (const it of items) {
      const tr = $(`
        <tr data-id="${it.id}">
          <td>${escapeHtml(it.title || "")}</td>
          <td>${escapeHtml(it.username || "")}</td>
          <td>${escapeHtml(it.url || "")}</td>
          <td>••••••</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-danger btn-delete">Löschen</button>
          </td>
        </tr>
      `);
      tr.find(".btn-delete").on("click", () => del(it.id));
      $rows.append(tr);
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
      $errLst.text(humanError(e));
    }
  }

  $form.on("submit", async function (e) {
    e.preventDefault();
    $("#modalError").text("");

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
          createVaultItem(input: $input) { id }
        }
      `, { input });
      resetForm();
      if (modal) modal.hide();
      await load();
    } catch (e) {
      $("#modalError").text(humanError(e));
    }
  });

  function resetForm() {
    $form[0]?.reset();
    $form.find('input[name="id"]').val("");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  function genPassword(len = 16) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_-+=:";
    let out = "";
    const arr = new Uint32Array(len);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(arr);
      for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
    } else {
      for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  await load();
});

