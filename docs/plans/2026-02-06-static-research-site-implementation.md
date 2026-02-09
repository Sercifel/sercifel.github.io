# Static Research Report Site Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a static research report site that converts `blogs/**/*.md` into SEO-friendly HTML pages with search and TOC.

**Architecture:** Use a Node.js build script that loads markdown + frontmatter, renders HTML via templates, writes output to `public/`, and creates a JSON search index for client-side fuzzy search. Tailwind is loaded via CDN, with a small custom CSS file for typography and TOC styles.

**Tech Stack:** Node.js, `gray-matter`, `markdown-it`, `fuse.js`, Tailwind CSS (CDN)

---

### Task 0: Create a dedicated worktree

**Files:**
- Create: none

**Step 1: Create a worktree**

Run:
```bash
git worktree add ../test-blog-builder-research-plan -b research-site
```
Expected: A new worktree directory created.

**Step 2: Confirm worktree**

Run:
```bash
git -C ../test-blog-builder-research-plan status
```
Expected: Clean working tree.

**Step 3: Commit**

Skip (no code changes).

---

### Task 1: Add Node tooling and dependencies

**Files:**
- Create: `package.json`

**Step 1: Write the failing test**

Create a minimal test file to validate the test runner:
```js
// tests/smoke.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

test("smoke", () => {
  assert.equal(1 + 1, 2);
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
node --test
```
Expected: FAIL (no package.json / tests directory yet).

**Step 3: Write minimal implementation**

Create `package.json`:
```json
{
  "name": "test-blog-builder",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build.mjs",
    "test": "node --test"
  },
  "dependencies": {
    "fuse.js": "^7.0.0",
    "gray-matter": "^4.0.3",
    "markdown-it": "^14.1.0"
  }
}
```

Create `tests/smoke.test.mjs` from Step 1.

Install deps:
```bash
npm install
```

**Step 4: Run test to verify it passes**

Run:
```bash
node --test
```
Expected: PASS.

**Step 5: Commit**

```bash
git add package.json package-lock.json tests/smoke.test.mjs
git commit -m "chore: add node test harness and deps"
```

---

### Task 2: Markdown rendering + TOC extraction (TDD)

**Files:**
- Create: `scripts/lib/markdown.mjs`
- Create: `tests/markdown.test.mjs`

**Step 1: Write the failing test**

```js
// tests/markdown.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { renderMarkdown } from "../scripts/lib/markdown.mjs";

test("renderMarkdown builds html and toc", () => {
  const md = "# Title\n\n## Section One\nText\n\n### Detail A\nMore\n\n## Section Two\n";
  const { html, toc } = renderMarkdown(md);

  assert.ok(html.includes("<h2"));
  assert.equal(toc.length, 2);
  assert.equal(toc[0].text, "Section One");
  assert.equal(toc[0].children[0].text, "Detail A");
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/markdown.test.mjs
```
Expected: FAIL with "renderMarkdown is not defined".

**Step 3: Write minimal implementation**

```js
// scripts/lib/markdown.mjs
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export function renderMarkdown(markdown) {
  const tokens = md.parse(markdown, {});
  const toc = [];
  let current = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === "heading_open") {
      const level = Number(token.tag.replace("h", ""));
      const text = tokens[i + 1]?.content || "";
      const id = slugify(text);
      token.attrSet("id", id);

      if (level === 2) {
        current = { text, id, children: [] };
        toc.push(current);
      }
      if (level === 3 && current) {
        current.children.push({ text, id });
      }
    }
  }

  const html = md.renderer.render(tokens, md.options, {});
  return { html, toc };
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/markdown.test.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/lib/markdown.mjs tests/markdown.test.mjs
git commit -m "feat: render markdown with toc extraction"
```

---

### Task 3: Slug and route helpers (TDD)

**Files:**
- Create: `scripts/lib/routes.mjs`
- Create: `tests/routes.test.mjs`

**Step 1: Write the failing test**

```js
// tests/routes.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { slugify, articlePath } from "../scripts/lib/routes.mjs";

test("slugify normalizes titles", () => {
  assert.equal(slugify("Orris Drive vs. KHK Gears"), "orris-drive-vs-khk-gears");
});

test("articlePath matches url structure", () => {
  const url = articlePath({
    category: "reports",
    subcategory: "machine-parts",
    slug: "orris-drive-vs-khk-gears"
  });
  assert.equal(url, "/reports/machine-parts/orris-drive-vs-khk-gears/");
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/routes.test.mjs
```
Expected: FAIL with "module not found".

**Step 3: Write minimal implementation**

```js
// scripts/lib/routes.mjs
export const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export const articlePath = ({ category, subcategory, slug }) =>
  `/${category}/${subcategory}/${slug}/`;
```

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/routes.test.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/lib/routes.mjs tests/routes.test.mjs
git commit -m "feat: add slug and routing helpers"
```

---

### Task 4: Load and normalize content (TDD)

**Files:**
- Create: `scripts/lib/content.mjs`
- Create: `tests/fixtures/blogs/reports/sample/sample.md`
- Create: `tests/content.test.mjs`

**Step 1: Write the failing test**

```js
// tests/content.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { loadContent } from "../scripts/lib/content.mjs";

test("loadContent parses frontmatter and paths", async () => {
  const data = await loadContent("tests/fixtures/blogs");
  assert.equal(data.length, 1);
  assert.equal(data[0].category, "reports");
  assert.equal(data[0].subcategory, "sample");
  assert.equal(data[0].title, "Sample Report");
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/content.test.mjs
```
Expected: FAIL with "module not found".

**Step 3: Write minimal implementation**

Create a fixture:
```md
---
title: Sample Report
description: A short summary
date: 2025-01-01T00:00:00+08:00
---

## Section
Body
```

Implementation:
```js
// scripts/lib/content.mjs
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { slugify } from "./routes.mjs";

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(full);
  }
  return files;
}

export async function loadContent(baseDir) {
  const files = await walk(baseDir);
  const items = [];

  for (const file of files) {
    const raw = await fs.readFile(file, "utf8");
    const { data, content } = matter(raw);
    const rel = path.relative(baseDir, file);
    const [category, subcategory] = rel.split(path.sep);
    const slug = slugify(path.basename(file, ".md"));

    items.push({
      category,
      subcategory,
      slug,
      title: data.title,
      description: data.description || "",
      date: data.date,
      content
    });
  }

  return items;
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/content.test.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/lib/content.mjs tests/content.test.mjs tests/fixtures/blogs/reports/sample/sample.md
git commit -m "feat: load markdown content with metadata"
```

---

### Task 5: Build search index helper (TDD)

**Files:**
- Create: `scripts/lib/search-index.mjs`
- Create: `tests/search-index.test.mjs`

**Step 1: Write the failing test**

```js
// tests/search-index.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { buildSearchIndex } from "../scripts/lib/search-index.mjs";

test("buildSearchIndex returns minimal fields", () => {
  const index = buildSearchIndex([
    {
      title: "Sample",
      description: "Summary",
      category: "reports",
      subcategory: "sample",
      slug: "sample"
    }
  ]);

  assert.equal(index[0].title, "Sample");
  assert.equal(index[0].path, "/reports/sample/sample/");
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/search-index.test.mjs
```
Expected: FAIL with "module not found".

**Step 3: Write minimal implementation**

```js
// scripts/lib/search-index.mjs
import { articlePath } from "./routes.mjs";

export function buildSearchIndex(items) {
  return items.map((item) => ({
    title: item.title,
    description: item.description,
    category: item.category,
    subcategory: item.subcategory,
    path: articlePath(item)
  }));
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/search-index.test.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/lib/search-index.mjs tests/search-index.test.mjs
git commit -m "feat: add search index builder"
```

---

### Task 6: Templates and render helpers (TDD)

**Files:**
- Create: `templates/base.html`
- Create: `templates/article.html`
- Create: `templates/list.html`
- Create: `templates/hub.html`
- Create: `scripts/lib/render.mjs`
- Create: `tests/render.test.mjs`

**Step 1: Write the failing test**

```js
// tests/render.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { renderPage } from "../scripts/lib/render.mjs";

test("renderPage injects title and description", () => {
  const html = renderPage({
    title: "Sample",
    description: "Summary",
    body: "<main>Body</main>",
    canonical: "/reports/sample/sample/"
  });

  assert.ok(html.includes("<title>Sample"));
  assert.ok(html.includes("meta name=\"description\""));
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/render.test.mjs
```
Expected: FAIL with "module not found".

**Step 3: Write minimal implementation**

Create `templates/base.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{title}}</title>
    <meta name="description" content="{{description}}" />
    <meta property="og:title" content="{{title}}" />
    <meta property="og:description" content="{{description}}" />
    <meta property="og:url" content="{{canonical}}" />
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="/assets/site.css" />
  </head>
  <body class="bg-[var(--color-background)] text-[var(--color-text)]">
    {{body}}
    <script src="/assets/search.js" defer></script>
    <script src="/assets/toc.js" defer></script>
  </body>
</html>
```

Create `templates/article.html`:
```html
<main class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
  {{content}}
</main>
```

Create `templates/list.html`:
```html
<main class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
  {{content}}
</main>
```

Create `templates/hub.html`:
```html
<main class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
  {{content}}
</main>
```

Create `scripts/lib/render.mjs`:
```js
import fs from "node:fs/promises";
import path from "node:path";

const readTemplate = async (name) =>
  fs.readFile(path.join("templates", name), "utf8");

export function renderPage({ title, description, body, canonical }) {
  return `<!doctype html>${""}`
    .replace("", "");
}

export async function wrapWithBase({ title, description, body, canonical }) {
  const base = await readTemplate("base.html");
  return base
    .replace(/{{title}}/g, title)
    .replace(/{{description}}/g, description)
    .replace(/{{canonical}}/g, canonical)
    .replace(/{{body}}/g, body);
}
```

Update `renderPage` to call `wrapWithBase` (full implementation):
```js
export async function renderPage({ title, description, body, canonical }) {
  return wrapWithBase({ title, description, body, canonical });
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/render.test.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add templates/base.html templates/article.html templates/list.html templates/hub.html scripts/lib/render.mjs tests/render.test.mjs
git commit -m "feat: add html templates and render helper"
```

---

### Task 7: Static assets (CSS + JS)

**Files:**
- Create: `assets/site.css`
- Create: `assets/search.js`
- Create: `assets/toc.js`

**Step 1: Write the failing test**

Skip (static assets are manually verified).

**Step 2: Run test to verify it fails**

Skip.

**Step 3: Write minimal implementation**

Create `assets/site.css`:
```css
:root {
  --color-primary: #111318;
  --color-secondary: #4a5568;
  --color-cta: #2563eb;
  --color-background: #f8f6f2;
  --color-text: #111318;
}

body {
  font-family: "Atkinson Hyperlegible", ui-sans-serif, system-ui;
  line-height: 1.65;
}

h1, h2, h3 {
  font-family: "Crimson Pro", ui-serif, serif;
}

table {
  width: 100%;
  border-collapse: collapse;
}

table th, table td {
  border-bottom: 1px solid #e2e8f0;
  padding: 0.6rem 0.75rem;
}

table tr:nth-child(even) {
  background: #f1efe9;
}
```

Create `assets/search.js`:
```js
import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.esm.js";

const input = document.querySelector("[data-search-input]");
const results = document.querySelector("[data-search-results]");
const count = document.querySelector("[data-search-count]");

if (input && results) {
  fetch("/search-index.json")
    .then((res) => res.json())
    .then((data) => {
      const fuse = new Fuse(data, {
        keys: ["title", "description", "category", "subcategory"],
        threshold: 0.35
      });

      input.addEventListener("input", () => {
        const query = input.value.trim();
        const items = query ? fuse.search(query).map((r) => r.item) : data;
        if (count) count.textContent = `${items.length} results`;
        results.innerHTML = items
          .slice(0, 50)
          .map(
            (item) =>
              `<li><a class="text-blue-600 hover:underline" href="${item.path}">${item.title}</a><p class="text-sm text-slate-600">${item.description}</p></li>`
          )
          .join("");
      });
    });
}
```

Create `assets/toc.js`:
```js
const tocToggle = document.querySelector("[data-toc-toggle]");
const tocPanel = document.querySelector("[data-toc-panel]");

if (tocToggle && tocPanel) {
  tocToggle.addEventListener("click", () => {
    tocPanel.classList.toggle("hidden");
  });
}

const headings = document.querySelectorAll("main h2[id]");
const tocLinks = document.querySelectorAll("[data-toc-link]");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        tocLinks.forEach((link) => link.classList.remove("text-blue-600"));
        const active = document.querySelector(`[data-toc-link='${entry.target.id}']`);
        if (active) active.classList.add("text-blue-600");
      }
    });
  },
  { rootMargin: "-20% 0px -70% 0px" }
);

headings.forEach((h) => observer.observe(h));
```

**Step 4: Run test to verify it passes**

Skip.

**Step 5: Commit**

```bash
git add assets/site.css assets/search.js assets/toc.js
git commit -m "feat: add site css and client scripts"
```

---

### Task 8: Build script + page generation (TDD)

**Files:**
- Create: `scripts/build.mjs`
- Modify: `scripts/lib/render.mjs`
- Modify: `scripts/lib/content.mjs`
- Create: `tests/build.test.mjs`

**Step 1: Write the failing test**

```js
// tests/build.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { buildSite } from "../scripts/build.mjs";

test("buildSite writes index and article pages", async () => {
  const outDir = "tests/tmp";
  await buildSite({
    contentDir: "tests/fixtures/blogs",
    outDir
  });

  const index = await fs.readFile(`${outDir}/index.html`, "utf8");
  const article = await fs.readFile(`${outDir}/reports/sample/sample/index.html`, "utf8");

  assert.ok(index.includes("Latest"));
  assert.ok(article.includes("Sample Report"));
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/build.test.mjs
```
Expected: FAIL with "buildSite is not defined".

**Step 3: Write minimal implementation**

Update `scripts/lib/content.mjs` to sort and normalize dates:
```js
items.sort((a, b) => new Date(b.date) - new Date(a.date));
```

Update `scripts/lib/render.mjs` to expose small template helpers:
```js
export const renderListItem = (item) => `
  <article class="py-4 border-b border-slate-200">
    <h3 class="text-xl font-semibold"><a class="text-blue-600 hover:underline" href="${item.path}">${item.title}</a></h3>
    <p class="text-sm text-slate-500">${item.date}</p>
    <p class="mt-2 text-slate-700 line-clamp-2">${item.description}</p>
  </article>
`;
```

Create `scripts/build.mjs`:
```js
import fs from "node:fs/promises";
import path from "node:path";
import { loadContent } from "./lib/content.mjs";
import { renderMarkdown } from "./lib/markdown.mjs";
import { articlePath } from "./lib/routes.mjs";
import { buildSearchIndex } from "./lib/search-index.mjs";
import { renderPage, renderListItem } from "./lib/render.mjs";

const ensureDir = (dir) => fs.mkdir(dir, { recursive: true });

export async function buildSite({ contentDir = "blogs", outDir = "public" } = {}) {
  await ensureDir(outDir);
  const items = await loadContent(contentDir);

  const enriched = items.map((item) => ({
    ...item,
    path: articlePath(item)
  }));

  const latest = enriched.slice(0, 20);

  const homeBody = `
    <header class="mb-8">
      <h1 class="text-4xl font-semibold">Research Reports</h1>
      <p class="text-slate-600">Personal research comparisons and source summaries</p>
      <div class="mt-4">
        <input class="w-full border border-slate-300 rounded px-3 py-2" placeholder="Search" data-search-input />
        <p class="mt-2 text-sm text-slate-500" data-search-count></p>
      </div>
    </header>
    <ul class="space-y-4" data-search-results>
      ${latest.map(renderListItem).join("")}
    </ul>
  `;

  const homeHtml = await renderPage({
    title: "Research Reports",
    description: "Latest research reports and site profiles",
    body: `<main class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">${homeBody}</main>`,
    canonical: "/"
  });

  await fs.writeFile(path.join(outDir, "index.html"), homeHtml);

  for (const item of enriched) {
    const { html, toc } = renderMarkdown(item.content);
    const tocHtml = toc
      .map(
        (section) => `
          <li>
            <a data-toc-link="${section.id}" class="hover:text-blue-600" href="#${section.id}">${section.text}</a>
            <ul class="ml-4 text-sm text-slate-600">
              ${section.children
                .map((child) => `<li><a data-toc-link="${child.id}" href="#${child.id}">${child.text}</a></li>`)
                .join("")}
            </ul>
          </li>`
      )
      .join("");

    const body = `
      <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
        <article>
          <h1 class="text-3xl font-semibold">${item.title}</h1>
          <p class="text-sm text-slate-500">${item.date}</p>
          <p class="mt-3 text-slate-700">${item.description}</p>
          <div class="prose prose-slate mt-8 max-w-none">${html}</div>
        </article>
        <aside class="hidden lg:block sticky top-24 h-fit">
          <p class="text-sm font-semibold">On this page</p>
          <ul class="mt-2 space-y-2">${tocHtml}</ul>
        </aside>
      </div>
    `;

    const pageHtml = await renderPage({
      title: `${item.title} | Research Reports`,
      description: item.description,
      body: `<main class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">${body}</main>`,
      canonical: item.path
    });

    const pageDir = path.join(outDir, item.path);
    await ensureDir(pageDir);
    await fs.writeFile(path.join(pageDir, "index.html"), pageHtml);
  }

  const searchIndex = buildSearchIndex(enriched);
  await fs.writeFile(path.join(outDir, "search-index.json"), JSON.stringify(searchIndex, null, 2));

  await ensureDir(path.join(outDir, "assets"));
  await fs.copyFile("assets/site.css", path.join(outDir, "assets", "site.css"));
  await fs.copyFile("assets/search.js", path.join(outDir, "assets", "search.js"));
  await fs.copyFile("assets/toc.js", path.join(outDir, "assets", "toc.js"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildSite();
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/build.test.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/build.mjs scripts/lib/render.mjs scripts/lib/content.mjs tests/build.test.mjs
git commit -m "feat: generate static html pages"
```

---

### Task 9: Add Reports/Sites hub pages + subcategory pages

**Files:**
- Modify: `scripts/build.mjs`
- Modify: `scripts/lib/render.mjs`

**Step 1: Write the failing test**

```js
// tests/build.test.mjs
// add assertions
const reportsHub = await fs.readFile(`${outDir}/reports/index.html`, "utf8");
assert.ok(reportsHub.includes("Reports"));
```

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/build.test.mjs
```
Expected: FAIL (missing hub pages).

**Step 3: Write minimal implementation**

Add hub/subcategory rendering in `scripts/build.mjs`:
```js
const groupBy = (items, key) =>
  items.reduce((acc, item) => {
    acc[item[key]] = acc[item[key]] || [];
    acc[item[key]].push(item);
    return acc;
  }, {});

const categories = ["reports", "sites"];

for (const category of categories) {
  const scoped = enriched.filter((item) => item.category === category);
  const subgroups = groupBy(scoped, "subcategory");
  const subCards = Object.entries(subgroups)
    .map(([name, list]) =>
      `<a class="block border border-slate-200 rounded p-4 hover:border-blue-600" href="/${category}/${name}/">${name} (${list.length})</a>`
    )
    .join("");

  const hubBody = `
    <h1 class="text-3xl font-semibold capitalize">${category}</h1>
    <section class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${subCards}</section>
    <section class="mt-10">
      <h2 class="text-xl font-semibold">Latest</h2>
      <div class="mt-4">${scoped.slice(0, 20).map(renderListItem).join("")}</div>
    </section>
  `;

  const hubHtml = await renderPage({
    title: `${category} | Research Reports`,
    description: `Latest ${category} research items`,
    body: `<main class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">${hubBody}</main>`,
    canonical: `/${category}/`
  });

  const hubDir = path.join(outDir, category);
  await ensureDir(hubDir);
  await fs.writeFile(path.join(hubDir, "index.html"), hubHtml);

  for (const [name, list] of Object.entries(subgroups)) {
    const listBody = `
      <h1 class="text-3xl font-semibold">${name}</h1>
      <div class="mt-6">${list.map(renderListItem).join("")}</div>
    `;

    const listHtml = await renderPage({
      title: `${name} | ${category}`,
      description: `Latest ${name} items`,
      body: `<main class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">${listBody}</main>`,
      canonical: `/${category}/${name}/`
    });

    const listDir = path.join(outDir, category, name);
    await ensureDir(listDir);
    await fs.writeFile(path.join(listDir, "index.html"), listHtml);
  }
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/build.test.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/build.mjs tests/build.test.mjs
git commit -m "feat: add hub and subcategory pages"
```

---

### Task 10: Add mobile TOC accordion + related links

**Files:**
- Modify: `scripts/build.mjs`
- Modify: `assets/toc.js`

**Step 1: Write the failing test**

```js
// tests/build.test.mjs
// add assertion for toc toggle
assert.ok(article.includes("data-toc-toggle"));
```

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/build.test.mjs
```
Expected: FAIL (no mobile toc markup).

**Step 3: Write minimal implementation**

Update article body in `scripts/build.mjs`:
```js
const mobileToc = `
  <div class="lg:hidden border border-slate-200 rounded p-4 mb-6">
    <button class="w-full text-left font-semibold" data-toc-toggle>Table of Contents</button>
    <ul class="mt-3 space-y-2 hidden" data-toc-panel>${tocHtml}</ul>
  </div>
`;

const related = enriched
  .filter((other) => other.subcategory === item.subcategory && other.slug !== item.slug)
  .slice(0, 3)
  .map((other) => `<li><a class="text-blue-600 hover:underline" href="${other.path}">${other.title}</a></li>`)
  .join("");

const body = `
  ${mobileToc}
  ...existing article...
  <section class="mt-10">
    <h2 class="text-xl font-semibold">Related</h2>
    <ul class="mt-3 space-y-2">${related}</ul>
  </section>
`;
```

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/build.test.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/build.mjs assets/toc.js tests/build.test.mjs
git commit -m "feat: add mobile toc and related links"
```

---

### Task 11: Manual QA

**Files:**
- Modify: none

**Step 1: Run the build**

Run:
```bash
npm run build
```
Expected: `public/` populated with HTML, assets, and `search-index.json`.

**Step 2: Spot-check pages**

Open in browser:
- `public/index.html`
- `public/reports/index.html`
- One article page under `public/reports/.../index.html`

**Step 3: Commit**

Skip (manual QA only).
