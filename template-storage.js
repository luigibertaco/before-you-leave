/**
 * Template Storage Module
 *
 * CRUD operations for prompt templates using chrome.storage.sync.
 * Built-in templates are seeded on first install and cannot be deleted.
 */

const BUILT_IN_TEMPLATES = [
  {
    id: "builtin-1on1",
    name: "1:1 Summary",
    prompt:
      "This is an AI summary of a 1:1 meeting, help me summarize it in a few bullet points " +
      "(split by topic discussed) with takeaway and actions.\n" +
      "Keep it short, no more than 10 topics, the less the better.\n" +
      "Topics points shorter than 50 words.\n" +
      "Actions shorter than 30 words.\n" +
      "Follow the Structure:\n" +
      "Notes: - topic description - topic comment1 / 2 / 3…\n" +
      "Actions: - Action 1 / 2 / 3",
    builtIn: true,
  },
  {
    id: "builtin-team",
    name: "Team Meeting",
    prompt:
      "This is an AI summary of a team meeting. Summarize it with the following structure:\n" +
      "Decisions: - List each decision made during the meeting (max 30 words each)\n" +
      "Open Questions: - List unresolved questions or topics needing follow-up\n" +
      "Action Items: - Action description — Owner (if mentioned)\n" +
      "Keep it concise. No more than 10 items per section.",
    builtIn: true,
  },
  {
    id: "builtin-actions",
    name: "Actions Assigned to Me",
    prompt:
      "From this meeting transcript, extract only the action items assigned to me " +
      "(the person requesting this summary). List each action as a short bullet point " +
      "(max 30 words). If no actions were assigned to me, say so. " +
      "Ignore actions assigned to other participants.",
    builtIn: true,
  },
];

const STORAGE_KEYS = {
  templates: "byl_templates",
  defaultId: "byl_default_id",
  initialized: "byl_initialized",
};

/**
 * Ensure built-in templates exist in storage. Called on first install.
 */
async function _seed() {
  const data = await chrome.storage.sync.get(STORAGE_KEYS.initialized);
  if (data[STORAGE_KEYS.initialized]) return;

  await chrome.storage.sync.set({
    [STORAGE_KEYS.templates]: BUILT_IN_TEMPLATES,
    [STORAGE_KEYS.defaultId]: BUILT_IN_TEMPLATES[0].id,
    [STORAGE_KEYS.initialized]: true,
  });
}

/**
 * Get all templates (built-in + custom).
 * @returns {Promise<Array>}
 */
async function getTemplates() {
  await _seed();
  const data = await chrome.storage.sync.get(STORAGE_KEYS.templates);
  return data[STORAGE_KEYS.templates] || [];
}

/**
 * Save a custom template. If the id already exists, update it.
 * Cannot overwrite built-in templates.
 * @param {{ id?: string, name: string, prompt: string }} template
 * @returns {Promise<Object>} The saved template
 */
async function saveTemplate(template) {
  const templates = await getTemplates();

  if (template.id) {
    const existing = templates.find((t) => t.id === template.id);
    if (existing && existing.builtIn) {
      throw new Error("Cannot modify built-in templates");
    }
    const idx = templates.findIndex((t) => t.id === template.id);
    if (idx !== -1) {
      templates[idx] = { ...templates[idx], name: template.name, prompt: template.prompt };
      await chrome.storage.sync.set({ [STORAGE_KEYS.templates]: templates });
      return templates[idx];
    }
  }

  const newTemplate = {
    id: "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    name: template.name,
    prompt: template.prompt,
    builtIn: false,
  };
  templates.push(newTemplate);
  await chrome.storage.sync.set({ [STORAGE_KEYS.templates]: templates });
  return newTemplate;
}

/**
 * Delete a custom template by id. Rejects for built-in templates.
 * If the deleted template was the default, falls back to first built-in.
 * @param {string} id
 */
async function deleteTemplate(id) {
  const templates = await getTemplates();
  const target = templates.find((t) => t.id === id);
  if (!target) throw new Error("Template not found: " + id);
  if (target.builtIn) throw new Error("Cannot delete built-in templates");

  const filtered = templates.filter((t) => t.id !== id);
  await chrome.storage.sync.set({ [STORAGE_KEYS.templates]: filtered });

  // Fall back default if deleted template was default
  const defaultId = await _getDefaultId();
  if (defaultId === id) {
    const firstBuiltIn = filtered.find((t) => t.builtIn);
    await chrome.storage.sync.set({
      [STORAGE_KEYS.defaultId]: firstBuiltIn ? firstBuiltIn.id : filtered[0]?.id,
    });
  }
}

/**
 * Get the raw default template id from storage.
 * @returns {Promise<string|null>}
 */
async function _getDefaultId() {
  const data = await chrome.storage.sync.get(STORAGE_KEYS.defaultId);
  return data[STORAGE_KEYS.defaultId] || null;
}

/**
 * Get the default template.
 * @returns {Promise<Object>}
 */
async function getDefault() {
  const templates = await getTemplates();
  const defaultId = await _getDefaultId();
  const found = templates.find((t) => t.id === defaultId);
  return found || templates.find((t) => t.builtIn) || templates[0];
}

/**
 * Set a template as the default by id.
 * @param {string} id
 */
async function setDefault(id) {
  const templates = await getTemplates();
  const target = templates.find((t) => t.id === id);
  if (!target) throw new Error("Template not found: " + id);
  await chrome.storage.sync.set({ [STORAGE_KEYS.defaultId]: id });
}

// Export for use in content script and options page
// In Chrome extension context, these are accessed via globalThis or importScripts
if (typeof globalThis !== "undefined") {
  globalThis.TemplateStorage = {
    getTemplates,
    saveTemplate,
    deleteTemplate,
    getDefault,
    setDefault,
    BUILT_IN_TEMPLATES,
  };
}
