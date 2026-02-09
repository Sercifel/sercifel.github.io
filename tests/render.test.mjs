import assert from "node:assert/strict";
import test from "node:test";
import { renderPage } from "../scripts/lib/render.mjs";

test("renderPage injects title and description", async () => {
  const html = await renderPage({
    title: "Sample",
    description: "Summary",
    body: "<main>Body</main>",
    canonical: "/reports/sample/sample/",
  });

  assert.ok(html.includes("<title>Sample"));
  assert.ok(html.includes("meta name=\"description\" content=\"Summary\""));
  assert.ok(
    html.includes(
      "meta property=\"og:url\" content=\"/reports/sample/sample/\""
    )
  );
});

test("renderPage escapes meta values", async () => {
  const html = await renderPage({
    title: "Bad & <Title>",
    description: "Desc \"quotes\" & <tag>",
    body: "<main>Body</main>",
    canonical: "/path?x=1&y=<script>",
  });

  assert.ok(html.includes("<title>Bad &amp; &lt;Title&gt;</title>"));
  assert.ok(
    html.includes(
      "meta name=\"description\" content=\"Desc &quot;quotes&quot; &amp; &lt;tag&gt;\""
    )
  );
  assert.ok(
    html.includes(
      "meta property=\"og:url\" content=\"/path?x=1&amp;y=&lt;script&gt;\""
    )
  );
});

test("renderPage avoids undefined placeholders when inputs missing", async () => {
  const html = await renderPage({});

  assert.ok(!html.includes("undefined"));
});

test("renderPage coerces non-string title and description", async () => {
  const html = await renderPage({
    title: 123,
    description: 456,
    body: "<main>Body</main>",
    canonical: "/reports/sample/sample/",
  });

  assert.ok(html.includes("<title>123</title>"));
  assert.ok(html.includes("meta name=\"description\" content=\"456\""));
});
