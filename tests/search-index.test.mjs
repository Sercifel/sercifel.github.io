import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadContent } from "../scripts/lib/content.mjs";
import { buildSearchIndex } from "../scripts/lib/search-index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, "fixtures", "blogs");

test("buildSearchIndex maps content into searchable entries", async () => {
  const items = await loadContent(fixtureRoot);
  const index = buildSearchIndex(items);

  const entry = index.find((item) => item.path === "/reports/sample/sample-post/");
  assert.ok(entry);
  assert.deepEqual(entry, {
    title: "Sample Post",
    description: "Short summary.",
    category: "reports",
    subcategory: "sample",
    path: "/reports/sample/sample-post/",
  });
});
