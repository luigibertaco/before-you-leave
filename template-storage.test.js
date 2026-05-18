/**
 * Unit tests for Template Storage Module
 *
 * Run with: node --test template-storage.test.js
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// Mock chrome.storage.sync — simulates JSON serialization like real storage
let store = {};
function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}
globalThis.chrome = {
  storage: {
    sync: {
      get: async (keys) => {
        if (typeof keys === "string") {
          return { [keys]: clone(store[keys]) };
        }
        if (Array.isArray(keys)) {
          const result = {};
          for (const k of keys) result[k] = clone(store[k]);
          return result;
        }
        return clone(store);
      },
      set: async (items) => {
        for (const [k, v] of Object.entries(items)) {
          store[k] = clone(v);
        }
      },
    },
  },
};

// Load the module (sets globalThis.TemplateStorage)
require("./template-storage.js");
const { getTemplates, saveTemplate, deleteTemplate, getDefault, setDefault, BUILT_IN_TEMPLATES } =
  globalThis.TemplateStorage;

describe("Template Storage Module", () => {
  beforeEach(() => {
    store = {};
  });

  describe("getTemplates", () => {
    it("seeds built-in templates on first install", async () => {
      const templates = await getTemplates();
      assert.equal(templates.length, 3);
      assert.equal(templates[0].name, "1:1 Summary");
      assert.equal(templates[1].name, "Team Meeting");
      assert.equal(templates[2].name, "Actions Assigned to Me");
      templates.forEach((t) => assert.equal(t.builtIn, true));
    });

    it("returns existing templates on subsequent calls", async () => {
      await getTemplates(); // seed
      const templates = await getTemplates(); // re-read
      assert.equal(templates.length, 3);
    });

    it("returns starter templates before custom templates", async () => {
      await getTemplates();
      const custom = await saveTemplate({ name: "Custom", prompt: "Do something" });

      store.byl_templates = [custom, ...BUILT_IN_TEMPLATES];

      const templates = await getTemplates();
      assert.deepEqual(
        templates.map((t) => t.id),
        ["builtin-1on1", "builtin-team", "builtin-actions", custom.id]
      );
    });
  });

  describe("saveTemplate", () => {
    it("adds a new custom template", async () => {
      await getTemplates(); // seed
      const saved = await saveTemplate({ name: "Custom", prompt: "Do something" });
      assert.equal(saved.name, "Custom");
      assert.equal(saved.builtIn, false);
      assert.ok(saved.id.startsWith("custom-"));

      const all = await getTemplates();
      assert.equal(all.length, 4);
    });

    it("updates an existing custom template", async () => {
      await getTemplates();
      const saved = await saveTemplate({ name: "Custom", prompt: "Original" });
      await saveTemplate({ id: saved.id, name: "Updated", prompt: "Changed" });

      const all = await getTemplates();
      const updated = all.find((t) => t.id === saved.id);
      assert.equal(updated.name, "Updated");
      assert.equal(updated.prompt, "Changed");
      assert.equal(all.length, 4); // no duplicate
    });

    it("rejects modification of built-in templates", async () => {
      await getTemplates();
      await assert.rejects(
        () => saveTemplate({ id: "builtin-1on1", name: "Hacked", prompt: "Bad" }),
        { message: "Cannot modify built-in templates" }
      );
    });
  });

  describe("deleteTemplate", () => {
    it("removes a custom template", async () => {
      await getTemplates();
      const saved = await saveTemplate({ name: "ToDelete", prompt: "Bye" });
      await deleteTemplate(saved.id);

      const all = await getTemplates();
      assert.equal(all.length, 3);
      assert.ok(!all.find((t) => t.id === saved.id));
    });

    it("removes built-in starter templates", async () => {
      await getTemplates();
      await deleteTemplate("builtin-1on1");

      const all = await getTemplates();
      assert.equal(all.length, 2);
      assert.ok(!all.find((t) => t.id === "builtin-1on1"));
    });

    it("keeps deleted starter templates deleted on later reads", async () => {
      await getTemplates();
      await deleteTemplate("builtin-team");

      const firstRead = await getTemplates();
      const secondRead = await getTemplates();

      assert.deepEqual(
        firstRead.map((t) => t.id),
        ["builtin-1on1", "builtin-actions"]
      );
      assert.deepEqual(
        secondRead.map((t) => t.id),
        ["builtin-1on1", "builtin-actions"]
      );
    });

    it("throws for non-existent template", async () => {
      await getTemplates();
      await assert.rejects(() => deleteTemplate("nonexistent"), {
        message: "Template not found: nonexistent",
      });
    });

    it("falls back default to first built-in when default is deleted", async () => {
      await getTemplates();
      const custom = await saveTemplate({ name: "MyDefault", prompt: "Test" });
      await setDefault(custom.id);
      assert.equal((await getDefault()).id, custom.id);

      await deleteTemplate(custom.id);
      const def = await getDefault();
      assert.equal(def.id, "builtin-1on1");
    });

    it("falls back default to first remaining template when built-in default is deleted", async () => {
      await getTemplates();

      await deleteTemplate("builtin-1on1");

      const def = await getDefault();
      assert.equal(def.id, "builtin-team");
    });
  });

  describe("getDefault / setDefault", () => {
    it("defaults to first built-in template on first install", async () => {
      const def = await getDefault();
      assert.equal(def.id, "builtin-1on1");
      assert.equal(def.name, "1:1 Summary");
    });

    it("setDefault changes the default", async () => {
      await getTemplates();
      await setDefault("builtin-team");
      const def = await getDefault();
      assert.equal(def.id, "builtin-team");
      assert.equal(def.name, "Team Meeting");
    });

    it("setDefault works with custom templates", async () => {
      await getTemplates();
      const custom = await saveTemplate({ name: "Mine", prompt: "Test" });
      await setDefault(custom.id);
      const def = await getDefault();
      assert.equal(def.id, custom.id);
    });

    it("rejects setDefault for non-existent template", async () => {
      await getTemplates();
      await assert.rejects(() => setDefault("nonexistent"), {
        message: "Template not found: nonexistent",
      });
    });

    it("falls back gracefully if stored default id is stale", async () => {
      await getTemplates();
      // Manually corrupt the default id
      store.byl_default_id = "deleted-id";
      const def = await getDefault();
      assert.equal(def.id, "builtin-1on1"); // falls back to first built-in
    });
  });
});
