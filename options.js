/**
 * Before You Leave — Options Page
 *
 * Template management UI: list, add, edit, delete, set default.
 */

(function () {
  "use strict";

  const listEl = document.getElementById("template-list");
  const addBtn = document.getElementById("add-btn");
  const addForm = document.getElementById("add-form");
  const newNameInput = document.getElementById("new-name");
  const newPromptInput = document.getElementById("new-prompt");
  const saveNewBtn = document.getElementById("save-new-btn");
  const cancelNewBtn = document.getElementById("cancel-new-btn");
  const addError = document.getElementById("add-error");

  let editingId = null;

  // ── Render ────────────────────────────────────────────

  async function render() {
    const templates = await TemplateStorage.getTemplates();
    const defaultTemplate = await TemplateStorage.getDefault();
    listEl.innerHTML = "";

    templates.forEach((t) => {
      const card = document.createElement("div");
      card.className = "template-card";

      // Header row
      const header = document.createElement("div");
      header.className = "template-header";

      if (editingId === t.id) {
        renderEditMode(card, t, defaultTemplate);
      } else {
        renderViewMode(card, header, t, defaultTemplate);
      }

      listEl.appendChild(card);
    });
  }

  function renderViewMode(card, header, t, defaultTemplate) {
    const name = document.createElement("span");
    name.className = "template-name";
    name.textContent = t.name;
    header.appendChild(name);

    if (t.builtIn) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Built-in";
      header.appendChild(badge);
    }

    card.appendChild(header);

    // Prompt preview
    const preview = document.createElement("div");
    preview.className = "template-prompt-preview";
    preview.textContent = t.prompt;
    card.appendChild(preview);

    // Actions row
    const actions = document.createElement("div");
    actions.className = "template-actions";

    // Default radio
    const defaultLabel = document.createElement("label");
    defaultLabel.className = "default-label";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "default-template";
    radio.checked = defaultTemplate.id === t.id;
    radio.addEventListener("change", async () => {
      await TemplateStorage.setDefault(t.id);
      render();
    });
    defaultLabel.appendChild(radio);
    defaultLabel.appendChild(document.createTextNode("Default"));
    actions.appendChild(defaultLabel);

    if (!t.builtIn) {
      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-edit";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => {
        editingId = t.id;
        render();
      });
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-delete";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async () => {
        await TemplateStorage.deleteTemplate(t.id);
        render();
      });
      actions.appendChild(deleteBtn);
    }

    card.appendChild(actions);
  }

  function renderEditMode(card, t, defaultTemplate) {
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "edit-name-input";
    nameInput.value = t.name;
    nameInput.maxLength = 60;
    card.appendChild(nameInput);

    const promptInput = document.createElement("textarea");
    promptInput.className = "edit-prompt-input";
    promptInput.value = t.prompt;
    promptInput.rows = 6;
    card.appendChild(promptInput);

    const errorEl = document.createElement("p");
    errorEl.className = "error hidden";
    card.appendChild(errorEl);

    const actions = document.createElement("div");
    actions.className = "form-actions";

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-save";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", async () => {
      const newName = nameInput.value.trim();
      const newPrompt = promptInput.value.trim();
      if (!newName || !newPrompt) {
        errorEl.textContent = "Name and prompt are required.";
        errorEl.classList.remove("hidden");
        return;
      }
      await TemplateStorage.saveTemplate({ id: t.id, name: newName, prompt: newPrompt });
      editingId = null;
      render();
    });
    actions.appendChild(saveBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      editingId = null;
      render();
    });
    actions.appendChild(cancelBtn);

    card.appendChild(actions);
  }

  // ── Add form ──────────────────────────────────────────

  addBtn.addEventListener("click", () => {
    addForm.classList.remove("hidden");
    addBtn.classList.add("hidden");
    newNameInput.value = "";
    newPromptInput.value = "";
    addError.classList.add("hidden");
    newNameInput.focus();
  });

  cancelNewBtn.addEventListener("click", () => {
    addForm.classList.add("hidden");
    addBtn.classList.remove("hidden");
  });

  saveNewBtn.addEventListener("click", async () => {
    const name = newNameInput.value.trim();
    const prompt = newPromptInput.value.trim();
    if (!name || !prompt) {
      addError.textContent = "Name and prompt are required.";
      addError.classList.remove("hidden");
      return;
    }
    await TemplateStorage.saveTemplate({ name, prompt });
    addForm.classList.add("hidden");
    addBtn.classList.remove("hidden");
    render();
  });

  // ── Init ──────────────────────────────────────────────

  render();
})();
