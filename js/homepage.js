import { gql, requireAuthOrRedirect, humanError } from "./common.js";

if (!requireAuthOrRedirect('/logon/Logon.html')) {
  throw new Error('Redirecting to login'); // verhindert, dass restlicher Code noch läuft
}

$(async function () {
  if (!requireAuthOrRedirect()) return;

  const $rows    = $("#vaultRows");
  const $errLst  = $("#listError");
  const $empty   = $("#emptyState");
  const $form    = $("#formItem");
  const $modalEl = document.getElementById("pwModal");
  const BS       = window.bootstrap || undefined;
  const modal    = BS ? new BS.Modal($modalEl) : null;

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

  // --- GraphQL Operations (Schema: *_enc + VaultUpsertEncInput) ---
  const Q_VAULT_ITEMS = /* GraphQL */ `
    query {
      vaultItems {
        id
        titleEnc
        usernameEnc
        passwordEnc
        urlEnc
        notesEnc
        createdAt
        updatedAt
      }
    }
  `;
  const M_CREATE = /* GraphQL */ `
    mutation($input: VaultUpsertEncInput!) {
      createVaultItem(input: $input) { id }
    }
  `;
  const M_UPDATE = /* GraphQL */ `
    mutation($id: ID!, $input: VaultUpsertEncInput!) {
      updateVaultItem(id: $id, input: $input) { id }
    }
  `;
  const M_DELETE = /* GraphQL */ `
    mutation($id: ID!) {
      deleteVaultItem(id: $id)
    }
  `;

  async function load() {
    try {
      $errLst.text("");
      const data = await gql(Q_VAULT_ITEMS);
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
          <td>${escapeHtml(it.titleEnc || "")}</td>
          <td>${escapeHtml(it.usernameEnc || "")}</td>
          <td>${escapeHtml(it.urlEnc || "")}</td>
          <td>••••••</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary me-1 btn-edit">Bearbeiten</button>
            <button class="btn btn-sm btn-outline-danger btn-delete">Löschen</button>
          </td>
        </tr>
      `);

      tr.find(".btn-edit").on("click", () => edit(it));
      tr.find(".btn-delete").on("click", () => del(it.id));
      $rows.append(tr);
    }
  }

  function edit(item) {
    // Formular mit vorhandenen Werten füllen (Enc-Felder bleiben Enc – Server verschlüsselt ggf. erneut/erkennt Format)
    $form.find('input[name="id"]').val(String(item.id));
    $form.find('input[name="title"]').val(item.titleEnc || "");
    $form.find('input[name="username"]').val(item.usernameEnc || "");
    $form.find('input[name="password"]').val(item.passwordEnc || "");
    $form.find('input[name="url"]').val(item.urlEnc || "");
    $form.find('textarea[name="notes"]').val(item.notesEnc || "");
    $("#modalError").text("");
    if (modal) modal.show();
  }

  async function del(id) {
    if (!confirm("Eintrag wirklich löschen?")) return;
    try {
      await gql(M_DELETE, { id: String(id) });
      await load();
    } catch (e) {
      $errLst.text(humanError(e));
    }
  }

  $form.on("submit", async function (e) {
    e.preventDefault();
    $("#modalError").text("");

    const body = Object.fromEntries(new FormData(this).entries());
    // Mapping auf *_enc – der Server speichert immer verschlüsselt (und erkennt schon verschlüsselte Werte)
    const input = {
      titleEnc: body.title || "",
      usernameEnc: body.username || "",
      passwordEnc: body.password || "",
      urlEnc: body.url || "",
      notesEnc: body.notes || ""
    };

    const id = (body.id || "").trim();

    try {
      if (id) {
        await gql(M_UPDATE, { id: String(id), input });
      } else {
        await gql(M_CREATE, { input });
      }
      resetForm();
      if (modal) modal.hide();
      await load();
    } catch (e2) {
      $("#modalError").text(humanError(e2));
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
