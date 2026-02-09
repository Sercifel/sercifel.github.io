import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadContent } from "../scripts/lib/content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, "fixtures", "blogs");

test("loadContent reads markdown metadata and path segments", async () => {
  const items = await loadContent(fixtureRoot);

  const item = items.find((entry) => entry.slug === "sample-post");
  assert.ok(item);
  assert.equal(item.category, "reports");
  assert.equal(item.subcategory, "sample");
  assert.equal(item.slug, "sample-post");
  assert.equal(item.title, "Sample Post");
  assert.equal(item.date, "2024-01-15");
  assert.equal(item.description, "Short summary.");
  assert.ok(item.content.includes("# Sample Post"));
});

test("loadContent sorts deterministically and normalizes dates", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "content-test-"));
  const blogRoot = path.join(tempRoot, "reports", "sample");

  try {
    await fs.mkdir(blogRoot, { recursive: true });
    await fs.writeFile(
      path.join(blogRoot, "b.md"),
      [
        "---",
        "title: \"Second\"",
        "slug: \"second\"",
        "date: 2024-02-01",
        "---",
        "# Second",
        "",
      ].join("\n"),
    );
    await fs.writeFile(
      path.join(blogRoot, "a.md"),
      [
        "---",
        "title: \"First\"",
        "slug: \"first\"",
        "date: \"2024-01-15\"",
        "---",
        "# First",
        "",
      ].join("\n"),
    );

    const items = await loadContent(tempRoot);

    assert.deepEqual(
      items.map((item) => item.slug),
      ["second", "first"],
    );

    const second = items.find((item) => item.slug === "second");
    assert.ok(second);
    assert.equal(second.date, "2024-02-01T00:00:00.000Z");

    const first = items.find((item) => item.slug === "first");
    assert.ok(first);
    assert.equal(first.date, "2024-01-15");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
