import assert from "node:assert/strict";
import test from "node:test";

import { articlePath, slugify } from "../scripts/lib/routes.mjs";

test("slugify lowercases, trims, and hyphenates", () => {
  assert.equal(slugify("  Hello, World!  "), "hello-world");
});

test("slugify collapses repeated separators", () => {
  assert.equal(slugify("A---B   C"), "a-b-c");
});

test("slugify removes non-ascii characters", () => {
  assert.equal(slugify("中文 標題"), "");
});

test("articlePath builds a slugged route from parts", () => {
  const path = articlePath({
    category: "Reports",
    subcategory: "Plastic Materials",
    title: "Kun Huang vs Arneplant",
  });

  assert.equal(path, "/reports/plastic-materials/kun-huang-vs-arneplant/");
});

test("articlePath prefers explicit slug", () => {
  const path = articlePath({
    category: "Sites",
    subcategory: "Plastic Materials",
    slug: "arneplant-com",
  });

  assert.equal(path, "/sites/plastic-materials/arneplant-com/");
});
