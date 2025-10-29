import { gql, requireAuthOrRedirect, humanError } from "./common.js";

if (!requireAuthOrRedirect("/logon/Logon.html")) {
  throw new Error("Redirecting to login");
}

$(async function () {
  if (!requireAuthOrRedirect()) return;

  const $cards = $("#vaultCards");
  const $errLst = $("#listError");
  const $empty = $("#emptyState");
  const $form = $("#formItem");
  const $modalEl = document.getElementById("pwModal");
  const $modalTitle = $("#pwModal .modal-title");
  const $saveBtn = $("#btnSave");
  const BS = window.bootstrap || undefined;
  const modal = BS ? new BS.Modal($modalEl) : null;
  const defaultModalTitle = $modalTitle.text();
  const defaultSaveLabel = $saveBtn.text();

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
    $cards.empty();
    if (!items.length) {
      $empty.removeClass("d-none");
      return;
    }
    $empty.addClass("d-none");

    for (const it of items) {
      $cards.append(buildCard(it));
    }
  }

  function buildCard(item) {
    const title = item.titleEnc || "Ohne Titel";
    const username = item.usernameEnc || "—";
    const password = item.passwordEnc || "";
    const url = item.urlEnc || "";

    const card = $(`
      <article class="vault-card" data-id="${item.id}">
        <div class="vault-card__head">
          <div class="vault-card__avatar"></div>
          <button class="vault-card__peek" type="button" aria-label="Passwort anzeigen"></button>
        </div>
        <div class="vault-card__title"></div>
        <div class="vault-card__field">
          <div class="vault-card__label">BENUTZERNAME</div>
          <div class="vault-card__value vault-card__username"></div>
        </div>
        <div class="vault-card__field">
          <div class="vault-card__label">PASSWORT</div>
          <div class="vault-card__password">
            <input class="vault-card__password-input" type="password" readonly />
            <button class="vault-card__copy" type="button">Kopieren</button>
          </div>
        </div>
        <div class="vault-card__field vault-card__field--url d-none">
          <div class="vault-card__label">URL</div>
          <a class="vault-card__value vault-card__url" target="_blank" rel="noopener"></a>
        </div>
        <div class="vault-card__actions">
          <button class="btn btn-outline-secondary btn-edit" type="button">Bearbeiten</button>
          <button class="btn btn-danger btn-delete" type="button">Löschen</button>
        </div>
      </article>
    `);

    card.find(".vault-card__avatar").text(getInitial(title));
    card.find(".vault-card__title").text(title);
    card.find(".vault-card__username").text(username);

    const pwdInput = card.find(".vault-card__password-input");
    pwdInput.val(password);

    if (url) {
      const $urlField = card.find(".vault-card__field--url");
      $urlField.removeClass("d-none");
      const $url = card.find(".vault-card__url");
      $url.text(formatUrl(url));
      $url.attr("href", ensureAbsoluteUrl(url));
    }

    const toggleBtn = card.find(".vault-card__peek");
    toggleBtn.on("click", () => {
      const isHidden = pwdInput.attr("type") === "password";
      pwdInput.attr("type", isHidden ? "text" : "password");
      card.toggleClass("vault-card--show", isHidden);
      toggleBtn.attr("aria-label", isHidden ? "Passwort verbergen" : "Passwort anzeigen");
    });

    const copyBtn = card.find(".vault-card__copy");
    copyBtn.on("click", async () => {
      try {
        await copyToClipboard(password);
        copyBtn.addClass("vault-card__copy--success");
        copyBtn.text("Kopiert");
      } catch {
        copyBtn.text("Fehler");
      }
      setTimeout(() => {
        copyBtn.removeClass("vault-card__copy--success");
        copyBtn.text("Kopieren");
      }, 2000);
    });

    card.find(".btn-edit").on("click", () => openEdit(item));
    card.find(".btn-delete").on("click", () => del(item.id));

    return card;
  }

  function openEdit(item) {
    resetForm();
    $modalTitle.text("Passwort bearbeiten");
    $saveBtn.text("Aktualisieren");

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
    } catch (err) {
      $("#modalError").text(humanError(err));
    }
  });

  function resetForm() {
    $form[0]?.reset();
    $form.find('input[name="id"]').val("");
    $modalTitle.text(defaultModalTitle);
    $saveBtn.text(defaultSaveLabel);
  }

  function getInitial(text) {
    const t = String(text || "").trim();
    return t ? t[0].toLowerCase() : "?";
  }

  function ensureAbsoluteUrl(url) {
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  }

  function formatUrl(url) {
    return String(url || "").replace(/^https?:\/\//i, "");
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text || "");
      return;
    }
    return new Promise((resolve, reject) => {
      try {
        const input = document.createElement("textarea");
        input.value = text || "";
        input.style.position = "fixed";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.focus();
        input.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(input);
        ok ? resolve() : reject(new Error("copy command failed"));
      } catch (err) {
        reject(err);
      }
    });
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
