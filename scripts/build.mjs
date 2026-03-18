import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

import { loadContent } from "./lib/content.mjs";
import { renderMarkdown } from "./lib/markdown.mjs";
import { articlePath, slugify } from "./lib/routes.mjs";
import { buildSearchIndex } from "./lib/search-index.mjs";
import {
  escapeHtml,
  formatDate,
  renderPage,
  renderListItem,
  renderTemplate,
} from "./lib/render.mjs";

const ensureDir = (dir) => fs.mkdir(dir, { recursive: true });
const normalizeOutputPath = (value) => value.replace(/^\/+/, "");
const safeSegment = (value) => {
  const slug = slugify(value ?? "");
  const fallback = slug || "section";
  const cleaned = fallback.replace(/[\\/]/g, "").replace(/\.\./g, "");
  return cleaned || "section";
};
const isDateSegment = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const humanizeSegment = (value) => {
  const text = String(value ?? "").trim();
  if (!text || isDateSegment(text)) {
    return text;
  }
  const looksSlug = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(text);
  if (!looksSlug) {
    return text;
  }
  return text
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      return lower ? lower[0].toUpperCase() + lower.slice(1) : "";
    })
    .join(" ");
};
const listTopLevelDirs = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name);
};
const hashContent = (buffer) =>
  createHash("sha256").update(buffer).digest("hex").slice(0, 12);
const buildAssets = async (outDir) => {
  const assetsDir = path.join(outDir, "assets");
  const files = ["site.css", "search.js", "nav.js", "toc.js"];
  await fs.rm(assetsDir, { recursive: true, force: true });
  await ensureDir(assetsDir);

  const assetMap = {};

  for (const file of files) {
    const sourcePath = path.join("assets", file);
    const data = await fs.readFile(sourcePath);
    const hash = hashContent(data);
    const ext = path.extname(file);
    const base = path.basename(file, ext);
    const hashedName = `${base}.${hash}${ext}`;
    await fs.writeFile(path.join(assetsDir, hashedName), data);
    assetMap[`/assets/${file}`] = `/assets/${hashedName}`;
  }

  return assetMap;
};
const groupBy = (items, key) =>
  items.reduce((acc, item) => {
    const entryKey = item[key] || "uncategorized";
    acc[entryKey] = acc[entryKey] || [];
    acc[entryKey].push(item);
    return acc;
  }, {});
const renderNavbar = async ({ active, categories } = {}) => {
  const activeSegment = safeSegment(active ?? "");
  const navItems = (categories ?? [])
    .map((category) => {
      const segment = safeSegment(category.key);
      const label = escapeHtml(category.label ?? category.key);
      const isActive = segment && segment === activeSegment;
      const className = [
        "rounded-full border px-3 py-1 text-sm font-medium transition-colors duration-200",
        isActive
          ? "border-blue-600 bg-blue-50 text-blue-700"
          : "border-transparent text-slate-600 hover:border-blue-600 hover:text-blue-600",
      ].join(" ");
      return `<a class="${className}" href="/${segment}/">${label}</a>`;
    })
    .join("");
  return renderTemplate("navbar.html", { navItems });
};

export async function buildSite({ contentDir = "blogs", outDir = "public" } = {}) {
  await ensureDir(outDir);
  const assetMap = await buildAssets(outDir);
  const topLevelDirs = await listTopLevelDirs(contentDir);
  const items = await loadContent(contentDir);

  const enriched = items.map((item) => ({
    ...item,
    path: articlePath(item),
  }));

  const latest = enriched.slice(0, 20);
  const categoryKeys = [];
  const categorySet = new Set();
  for (const dir of topLevelDirs) {
    if (!categorySet.has(dir)) {
      categorySet.add(dir);
      categoryKeys.push(dir);
    }
  }
  for (const entry of enriched) {
    if (entry.category && !categorySet.has(entry.category)) {
      categorySet.add(entry.category);
      categoryKeys.push(entry.category);
    }
  }
  const categories = categoryKeys.map((key) => ({
    key,
    label: humanizeSegment(key),
  }));

  const isDateBased =
    topLevelDirs.length > 0 && topLevelDirs.every((dir) => isDateSegment(dir));

  const categoryGroups = groupBy(enriched, "category");
  const archiveGroups = enriched.reduce((acc, item) => {
    if (!item.date) {
      return acc;
    }
    const parsed = new Date(item.date);
    if (Number.isNaN(parsed.getTime())) {
      return acc;
    }
    const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
  const timelineEntries = Object.entries(archiveGroups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, list]) => {
      const [year, month] = key.split("-");
      const label = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
      }).format(new Date(Number(year), Number(month) - 1, 1));
      return {
        key,
        label: escapeHtml(label),
        count: list.length,
      };
    })
    .filter((entry) => entry.count > 0);
  const renderTimelineList = (entries, listClass) => {
    if (!entries.length) {
      return "<p class=\"text-sm text-slate-500\">No archives yet.</p>";
    }
    const items = entries
      .map(
        (entry) =>
          `<li class=\"flex items-center justify-between text-sm text-slate-600\"><a class=\"link-primary\" href=\"/archive/${entry.key}/\">${entry.label}</a><span class=\"text-xs text-slate-500\">${entry.count}</span></li>`
      )
      .join("");
    return `<ul class=\"${listClass}\">${items}</ul>`;
  };
  const timelineHtml = renderTimelineList(timelineEntries, "space-y-2");
  const timelineCompactHtml = renderTimelineList(timelineEntries.slice(0, 4), "space-y-3");

  const featuredGradients = [
    "from-slate-900/80 via-slate-800/70 to-slate-700/60",
    "from-emerald-900/80 via-slate-900/70 to-slate-700/60",
    "from-sky-900/80 via-slate-900/70 to-slate-700/60",
  ];
  const categoryGradients = [
    "from-amber-100 via-white to-slate-50",
    "from-emerald-100 via-white to-slate-50",
    "from-sky-100 via-white to-slate-50",
    "from-violet-100 via-white to-slate-50",
    "from-rose-100 via-white to-slate-50",
    "from-lime-100 via-white to-slate-50",
    "from-cyan-100 via-white to-slate-50",
    "from-orange-100 via-white to-slate-50",
  ];
  const renderFeaturedCard = (item, index, variant = "large") => {
    if (!item) {
      return "";
    }
    const safeTitle = escapeHtml(item.title);
    const safeDescription = escapeHtml(item.description || "");
    const safeDate = escapeHtml(formatDate(item.date));
    const gradient = featuredGradients[index % featuredGradients.length];
    const sizeClass =
      variant === "large" ? "min-h-[280px] sm:min-h-[360px]" : "min-h-[160px]";
    const titleClass =
      variant === "large"
        ? "text-2xl font-semibold leading-tight sm:text-3xl"
        : "text-lg font-semibold leading-snug";
    const descriptionClass =
      variant === "large"
        ? "mt-3 text-sm text-slate-200 line-clamp-2"
        : "mt-2 text-xs text-slate-200 line-clamp-2";
    return `
      <article class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm">
        <div class="absolute inset-0 bg-gradient-to-br ${gradient}"></div>
        <div class="absolute inset-0 bg-slate-950/40"></div>
        <div class="relative ${sizeClass} p-6">
          <p class="text-xs uppercase tracking-[0.2em] text-slate-200">${safeDate}</p>
          <h3 class="mt-3 ${titleClass}">${safeTitle}</h3>
          <p class="${descriptionClass}">${safeDescription}</p>
        </div>
        <a
          class="absolute inset-0 z-10 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          href="${item.path}"
          aria-label="${safeTitle}"
        ></a>
      </article>
    `;
  };
  const renderCompactItem = (item) => {
    const safeTitle = escapeHtml(item.title);
    const safeDate = escapeHtml(formatDate(item.date));
    const safeDescription = escapeHtml(item.description || "");
    return `
      <li class="flex gap-4 border-b border-slate-200 pb-4 last:border-b-0 last:pb-0">
        <div class="h-16 w-20 shrink-0 rounded-xl bg-gradient-to-br from-slate-200 via-white to-slate-50"></div>
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-slate-500">${safeDate}</p>
          <h4 class="mt-1 text-sm font-semibold text-slate-900">
            <a class="hover:text-blue-600" href="${item.path}">${safeTitle}</a>
          </h4>
          <p class="mt-1 text-xs text-slate-600 line-clamp-2">${safeDescription}</p>
        </div>
      </li>
    `;
  };
  const renderBulletLink = (item) => {
    const safeTitle = escapeHtml(item.title);
    const safeDate = escapeHtml(formatDate(item.date));
    return `
      <li class="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
        <a class="text-sm font-semibold text-slate-800 hover:text-blue-600" href="${item.path}">${safeTitle}</a>
        <span class="text-xs uppercase tracking-[0.2em] text-slate-400">${safeDate}</span>
      </li>
    `;
  };

  const featured = latest.slice(0, 3);
  const featuredSection = featured.length
    ? `
        <section class="space-y-6">
          <div class="flex items-end justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Featured news</p>
              <h2 class="mt-2 text-2xl font-semibold">Signals from the floor</h2>
            </div>
            <a class="text-sm font-semibold text-blue-600 hover:text-blue-700" href="#latest">Browse all</a>
          </div>
          <div class="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            ${renderFeaturedCard(featured[0], 0, "large")}
            <div class="grid gap-6">
              ${renderFeaturedCard(featured[1], 1, "small")}
              ${renderFeaturedCard(featured[2], 2, "small")}
            </div>
          </div>
        </section>
      `
    : "";

  const categoryCards = !isDateBased
    ? categories
        .slice(0, 8)
        .map((category, index) => {
          const segment = safeSegment(category.key);
          const safeLabel = escapeHtml(category.label ?? category.key);
          const count = (categoryGroups[category.key] || []).length;
          const gradient = categoryGradients[index % categoryGradients.length];
          return `
            <a class="group rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md" href="/${segment}/">
              <div class="h-20 rounded-xl bg-gradient-to-br ${gradient}"></div>
              <div class="mt-4 flex items-center justify-between">
                <h3 class="text-sm font-semibold text-slate-900">${safeLabel}</h3>
                <span class="text-xs text-slate-500">${count} posts</span>
              </div>
              <p class="mt-2 text-xs text-slate-500">Category overview and latest analysis.</p>
            </a>
          `;
        })
        .join("")
    : "";
  const categorySection = categoryCards
    ? `
        <section class="space-y-6">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Explore by categories</p>
            <h2 class="mt-2 text-2xl font-semibold">Navigate reports and site notes</h2>
          </div>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">${categoryCards}</div>
        </section>
      `
    : "";

  const spotlightCategory = categories.find(
    (category) => (categoryGroups[category.key] || []).length > 0
  );
  const spotlightItems = spotlightCategory
    ? (categoryGroups[spotlightCategory.key] || []).slice(0, 3)
    : [];
  const spotlightLabel = spotlightCategory
    ? escapeHtml(spotlightCategory.label ?? spotlightCategory.key)
    : "";
  const spotlightSegment = spotlightCategory ? safeSegment(spotlightCategory.key) : "";
  const spotlightSection =
    spotlightItems.length || timelineEntries.length
      ? `
          <section class="grid gap-6 ${spotlightItems.length ? "lg:grid-cols-[minmax(0,1fr)_260px]" : "lg:grid-cols-1"}">
            ${
              spotlightItems.length
                ? `
                    <div class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                      <div class="flex items-start justify-between">
                        <div>
                          <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Latest in ${spotlightLabel}</p>
                          <h2 class="mt-2 text-xl font-semibold">New field notes</h2>
                        </div>
                        <a class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 hover:text-blue-700" href="/${spotlightSegment}/">View all</a>
                      </div>
                      <ul class="mt-5 space-y-4">${spotlightItems.map(renderCompactItem).join("")}</ul>
                    </div>
                  `
                : ""
            }
            <div class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Archive highlights</p>
              <h3 class="mt-2 text-lg font-semibold">Recent months</h3>
              <div class="mt-4">${timelineCompactHtml}</div>
            </div>
          </section>
        `
      : "";

  const latestSection = `
    <section id="latest" class="space-y-6">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Latest updates</p>
        <h2 class="mt-2 text-2xl font-semibold">Recent articles</h2>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div class="space-y-4">${latest.map(renderListItem).join("")}</div>
      </div>
    </section>
  `;

  const updatesSection =
    latest.length >= 8
      ? `
          <section class="grid gap-6 lg:grid-cols-2">
            <div class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Industry updates</p>
              <h3 class="mt-2 text-lg font-semibold">Operational shifts</h3>
              <ul class="mt-4 space-y-3">${latest.slice(3, 7).map(renderBulletLink).join("")}</ul>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Trending articles</p>
              <h3 class="mt-2 text-lg font-semibold">Most read this week</h3>
              <ul class="mt-4 space-y-3">${latest.slice(7, 11).map(renderBulletLink).join("")}</ul>
            </div>
          </section>
        `
      : "";

  let homeContent = `
    <div class="space-y-12">
      ${featuredSection}
      ${categorySection}
      ${spotlightSection}
      ${latestSection}
      ${updatesSection}
    </div>
  `;
  const sidebarSections = categories
    .map((category) => {
      const scoped = categoryGroups[category.key] || [];
      if (!scoped.length) {
        return "";
      }
      const categorySegment = safeSegment(category.key);
      const categoryLabel = escapeHtml(category.label ?? category.key);
      const subgroups = groupBy(scoped, "subcategory");
      const subLinks = Object.entries(subgroups)
        .sort(([a], [b]) => humanizeSegment(a).localeCompare(humanizeSegment(b)))
        .map(([name, list]) => {
          const segment = safeSegment(name);
          const nameLabel = humanizeSegment(name);
          const safeName = escapeHtml(nameLabel);
          return `<li class="flex items-center justify-between gap-3"><a class="link-primary" href="/${categorySegment}/${segment}/">${safeName}</a><span class="text-xs text-slate-500">${list.length}</span></li>`;
        })
        .join("");

      return `
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <a class="text-sm font-semibold text-slate-900 hover:text-blue-600" href="/${categorySegment}/">${categoryLabel}</a>
            <span class="text-xs text-slate-500">${scoped.length}</span>
          </div>
          <ul class="space-y-2 text-sm text-slate-600">${subLinks}</ul>
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  const sidebar = `
    <aside class="lg:sticky lg:top-24 h-fit">
      <div class="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <h2 class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Categories</h2>
        <div class="mt-4 space-y-5">
          ${sidebarSections || "<p class=\"text-sm text-slate-500\">No categories yet.</p>"}
        </div>
        <div class="mt-6 border-t border-slate-200 pt-4">
          <h3 class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Timeline Archive</h3>
          <div class="mt-3">${timelineHtml}</div>
        </div>
      </div>
    </aside>
  `;

  const homeBody = await renderTemplate("home.html", {
    navbar: await renderNavbar({ categories }),
    homeContent,
    sidebar,
  });

  const homeHtml = await renderPage({
    title: "Automation Atlas",
    description: "Mapping reliable operations for always-on teams",
    body: homeBody,
    canonical: "/",
    assets: assetMap,
  });

  await fs.writeFile(path.join(outDir, "index.html"), homeHtml);

  const archiveEntries = Object.entries(archiveGroups).sort(([a], [b]) => b.localeCompare(a));
  for (const [key, list] of archiveEntries) {
    const [year, month] = key.split("-");
    const label = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
    }).format(new Date(Number(year), Number(month) - 1, 1));
    const archiveBody = await renderTemplate("list.html", {
      navbar: await renderNavbar({ categories }),
      title: `${label} Archive`,
      items: list.map(renderListItem).join(""),
    });
    const archiveHtml = await renderPage({
      title: `${label} | Automation Atlas`,
      description: `Articles from ${label}`,
      body: archiveBody,
      canonical: `/archive/${key}/`,
      assets: assetMap,
    });
    const archiveDir = path.join(outDir, normalizeOutputPath(`/archive/${key}/`));
    await ensureDir(archiveDir);
    await fs.writeFile(path.join(archiveDir, "index.html"), archiveHtml);
  }

  for (const category of categories) {
    const scoped = enriched.filter((item) => item.category === category.key);
    const subgroups = groupBy(scoped, "subcategory");
    const subCards = Object.entries(subgroups)
      .map(([name, list]) => {
        const segment = safeSegment(name);
        const nameLabel = humanizeSegment(name);
        const safeName = escapeHtml(nameLabel);
        const categorySegment = safeSegment(category.key);
        return `<a class="link-primary block border border-slate-200 rounded p-4 hover:border-blue-600" href="/${categorySegment}/${segment}/">${safeName} (${list.length})</a>`;
      })
      .join("");
    const categoryLabel = category.label ?? category.key;
    const safeCategoryLabel = escapeHtml(categoryLabel);
    const categorySegment = safeSegment(category.key);

    const hubBody = await renderTemplate("hub.html", {
      navbar: await renderNavbar({ active: category.key, categories }),
      title: safeCategoryLabel,
      subCards,
      latestList: scoped.slice(0, 20).map(renderListItem).join(""),
    });

    const hubHtml = await renderPage({
      title: `${categoryLabel} | Automation Atlas`,
      description: `Latest ${categoryLabel} automation notes and analysis`,
      body: hubBody,
      canonical: `/${categorySegment}/`,
      assets: assetMap,
    });

    const hubDir = path.join(outDir, normalizeOutputPath(`/${categorySegment}/`));
    await ensureDir(hubDir);
    await fs.writeFile(path.join(hubDir, "index.html"), hubHtml);

    for (const [name, list] of Object.entries(subgroups)) {
      const segment = safeSegment(name);
      const nameLabel = humanizeSegment(name);
      const safeName = escapeHtml(nameLabel);
      const listBody = await renderTemplate("list.html", {
        navbar: await renderNavbar({ active: category.key, categories }),
        title: safeName,
        items: list.map(renderListItem).join(""),
      });

      const listHtml = await renderPage({
        title: `${nameLabel} | ${categoryLabel}`,
        description: `Latest ${nameLabel} items`,
        body: listBody,
        canonical: `/${categorySegment}/${segment}/`,
        assets: assetMap,
      });

      const listDir = path.join(
        outDir,
        normalizeOutputPath(`/${categorySegment}/${segment}/`)
      );
      await ensureDir(listDir);
      await fs.writeFile(path.join(listDir, "index.html"), listHtml);
    }
  }

  for (const item of enriched) {
    const { html, toc } = renderMarkdown(item.content);
    const tocHtml = toc
      .map(
        (section) => `
          <li>
            <a data-toc-link="${section.id}" class="hover:text-blue-600" href="#${section.id}">${escapeHtml(
              section.text
            )}</a>
            <ul class="ml-4 text-sm text-slate-600">
              ${section.children
                .map(
                  (child) =>
                    `<li><a data-toc-link="${child.id}" href="#${child.id}">${escapeHtml(
                      child.text
                    )}</a></li>`
                )
                .join("")}
            </ul>
          </li>`
      )
      .join("");

    const safeTitle = escapeHtml(item.title);
    const safeDate = escapeHtml(formatDate(item.date));
    const safeDescription = escapeHtml(item.description);

    const relatedCandidates = enriched.filter((entry) => entry.path !== item.path);
    const relatedPrimary = relatedCandidates.filter(
      (entry) => entry.category === item.category && entry.subcategory === item.subcategory
    );
    const relatedSecondary = relatedCandidates.filter(
      (entry) => entry.category === item.category && entry.subcategory !== item.subcategory
    );
    const relatedTertiary = relatedCandidates.filter(
      (entry) => entry.category !== item.category
    );
    const relatedItems = [
      ...relatedPrimary,
      ...relatedSecondary,
      ...relatedTertiary,
    ].slice(0, 3);
    const relatedHtml = relatedItems.length
      ? `
          <section class="mt-12 border-t border-slate-200 pt-6">
            <h2 class="text-lg font-semibold">You might also be interested in...</h2>
            <ul class="mt-4 flex flex-wrap gap-3 text-sm">
              ${relatedItems
                .map(
                  (entry) =>
                    `<li><a class="link-primary rounded border border-slate-200 px-3 py-1 hover:border-blue-600" href="${entry.path}">${escapeHtml(
                      entry.title
                    )}</a></li>`
                )
                .join("")}
            </ul>
          </section>
        `
      : "";

    const body = await renderTemplate("article.html", {
      navbar: await renderNavbar({ active: item.category, categories }),
      title: safeTitle,
      date: safeDate,
      description: safeDescription,
      toc: tocHtml,
      content: html,
      related: relatedHtml,
    });

    const pageHtml = await renderPage({
      title: `${item.title} | Automation Atlas`,
      description: item.description,
      body,
      canonical: item.path,
      assets: assetMap,
    });

    const pageDir = path.join(outDir, normalizeOutputPath(item.path));
    await ensureDir(pageDir);
    await fs.writeFile(path.join(pageDir, "index.html"), pageHtml);
  }

  const searchIndex = buildSearchIndex(enriched);
  await fs.writeFile(
    path.join(outDir, "search-index.json"),
    JSON.stringify(searchIndex, null, 2)
  );

}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildSite();
}
