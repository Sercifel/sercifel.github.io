import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { buildSite } from "../scripts/build.mjs";
import { renderMarkdown } from "../scripts/lib/markdown.mjs";

const execFileAsync = promisify(execFile);

test("buildSite writes index and article pages", async () => {
  let outDir;
  try {
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), "blog-build-"));
    await buildSite({
      contentDir: "tests/fixtures/blogs",
      outDir,
    });

    const index = await fs.readFile(path.join(outDir, "index.html"), "utf8");
    const reportsHub = await fs.readFile(
      path.join(outDir, "reports", "index.html"),
      "utf8"
    );
    const article = await fs.readFile(
      path.join(outDir, "reports", "sample", "sample", "index.html"),
      "utf8"
    );

    assert.ok(index.includes("Research Reports"));
    assert.ok(reportsHub.includes("Reports"));
    assert.ok(article.includes("Sample Post"));
    assert.ok(article.includes("data-toc-toggle"));
    assert.ok(index.includes("data-search-modal"));
    assert.ok(index.includes("data-search-open"));
    assert.ok(index.includes("data-search-input"));
    assert.ok(
      index.includes(
        "placeholder=\"Search by company, category, or keyword… e.g. gearboxes\""
      )
    );
  } finally {
    if (outDir) {
      await fs.rm(outDir, { recursive: true, force: true });
    }
  }
});

test("build.mjs entrypoint runs with relative path", async () => {
  let tempDir;
  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "blog build-"));
    const blogsDir = path.join(tempDir, "blogs", "reports", "sample");
    const assetsDir = path.join(tempDir, "assets");
    await fs.mkdir(blogsDir, { recursive: true });
    await fs.mkdir(assetsDir, { recursive: true });

    await fs.writeFile(
      path.join(blogsDir, "entry-post.md"),
      "---\n" +
        "title: Entry Post\n" +
        "date: 2024-01-01\n" +
        "description: Entry Test\n" +
        "---\n\n" +
        "# Hello\n",
      "utf8"
    );
    await fs.writeFile(path.join(assetsDir, "site.css"), "", "utf8");
    await fs.writeFile(path.join(assetsDir, "search.js"), "", "utf8");
    await fs.writeFile(path.join(assetsDir, "toc.js"), "", "utf8");

    const resolvedTempDir = await fs.realpath(tempDir);
    const repoLink = path.join(resolvedTempDir, "repo link");
    await fs.symlink(path.resolve("."), repoLink, "dir");

    const relativeScriptPath = path.join("repo link", "scripts", "build.mjs");
    await execFileAsync("node", [relativeScriptPath], {
      cwd: resolvedTempDir,
      env: {
        ...process.env,
        NODE_OPTIONS: "--preserve-symlinks-main",
      },
    });

    const indexHtml = await fs.readFile(
      path.join(resolvedTempDir, "public", "index.html"),
      "utf8"
    );
    assert.ok(indexHtml.includes("Research Reports"));
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
});

test("renderMarkdown nests h3 under h2 in toc", () => {
  const markdown = "## Alpha\n\n### Beta\n\n## Gamma\n";
  const { toc } = renderMarkdown(markdown);

  assert.deepEqual(toc, [
    {
      level: 2,
      id: "alpha",
      text: "Alpha",
      children: [{ level: 3, id: "beta", text: "Beta" }],
    },
    {
      level: 2,
      id: "gamma",
      text: "Gamma",
      children: [],
    },
  ]);
});

test("buildSite escapes html and avoids empty path segments", async () => {
  let outDir;
  try {
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), "blog-build-"));
    await buildSite({
      contentDir: "tests/fixtures/blogs",
      outDir,
    });

    const index = await fs.readFile(path.join(outDir, "index.html"), "utf8");
    const article = await fs.readFile(
      path.join(outDir, "uncategorized", "general", "escape", "index.html"),
      "utf8"
    );

    assert.ok(index.includes("Escape Post"));
    assert.ok(index.includes("Summary &lt;strong&gt;value&lt;/strong&gt;"));
    assert.ok(article.includes("2024-01-15 &amp; Co"));
    assert.ok(article.includes("Title &lt;Test&gt; &amp; &quot;Quotes&quot;"));
    assert.ok(article.includes("Escape Post"));
  } finally {
    if (outDir) {
      await fs.rm(outDir, { recursive: true, force: true });
    }
  }
});

test("buildSite sanitizes subcategory segments", async () => {
  let outDir;
  try {
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), "blog-build-"));
    await buildSite({
      contentDir: "tests/fixtures/blogs",
      outDir,
    });

    const hub = await fs.readFile(
      path.join(outDir, "reports", "badsection", "index.html"),
      "utf8"
    );
    const article = await fs.readFile(
      path.join(outDir, "reports", "badsection", "sanitize", "index.html"),
      "utf8"
    );

    assert.ok(hub.includes("bad/section"));
    assert.ok(article.includes("Sanitize Post"));
  } finally {
    if (outDir) {
      await fs.rm(outDir, { recursive: true, force: true });
    }
  }
});
