import assert from "node:assert/strict";
import test from "node:test";

import { renderMarkdown } from "../scripts/lib/markdown.mjs";

test("renderMarkdown returns html and toc for h2/h3 headings", () => {
  const markdown = [
    "# Title",
    "",
    "## Section One",
    "Text here.",
    "",
    "### Subsection A",
    "More text.",
    "",
    "## Section Two",
  ].join("\n");

  const { html, toc } = renderMarkdown(markdown);

  assert.ok(html.includes("<h2 id=\"section-one\">Section One</h2>"));
  assert.ok(html.includes("<h3 id=\"subsection-a\">Subsection A</h3>"));
  assert.ok(html.includes("<h2 id=\"section-two\">Section Two</h2>"));
  assert.deepEqual(toc, [
    {
      level: 2,
      id: "section-one",
      text: "Section One",
      children: [{ level: 3, id: "subsection-a", text: "Subsection A" }],
    },
    { level: 2, id: "section-two", text: "Section Two", children: [] },
  ]);
});

test("renderMarkdown assigns ids for non-ascii headings", () => {
  const markdown = ["# Title", "", "## 中文 標題"].join("\n");

  const { html, toc } = renderMarkdown(markdown);

  assert.ok(html.includes("<h2 id=\"section-1\">中文 標題</h2>"));
  assert.deepEqual(toc, [
    { level: 2, id: "section-1", text: "中文 標題", children: [] },
  ]);
});

test("renderMarkdown disambiguates duplicate heading ids", () => {
  const markdown = [
    "# Title",
    "",
    "## Repeat",
    "Text",
    "",
    "## Repeat",
  ].join("\n");

  const { html, toc } = renderMarkdown(markdown);

  assert.ok(html.includes("<h2 id=\"repeat\">Repeat</h2>"));
  assert.ok(html.includes("<h2 id=\"repeat-2\">Repeat</h2>"));
  assert.deepEqual(toc, [
    { level: 2, id: "repeat", text: "Repeat", children: [] },
    { level: 2, id: "repeat-2", text: "Repeat", children: [] },
  ]);
});
