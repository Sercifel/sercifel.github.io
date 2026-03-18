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
  renderCardItem,
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
const listChildDirs = async (dir) => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
};
const hashContent = (buffer) =>
  createHash("sha256").update(buffer).digest("hex").slice(0, 12);
const buildAssets = async (outDir) => {
  const assetsDir = path.join(outDir, "assets");
  const files = [
    "site.css",
    "search.js",
    "nav.js",
    "toc.js",
    "mi-logo.jpg",
    "default-thumb.svg",
  ];
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
  return renderTemplate("navbar.html", { activeSegment });
};

export async function buildSite({ contentDir = "blogs", outDir = "public" } = {}) {
  await ensureDir(outDir);
  const assetMap = await buildAssets(outDir);
  const topLevelDirs = await listTopLevelDirs(contentDir);
  const categoryFolderNames = await listChildDirs(path.join(contentDir, "Categories"));
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
  const categoryBaseSegment = safeSegment("Categories");
  const categoryFolders = categoryFolderNames.map((name) => ({
    key: name,
    label: humanizeSegment(name),
    segment: safeSegment(name),
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
  const formatMonth = (value) => {
    if (!value) {
      return "";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat("en-US", { month: "short" }).format(parsed);
  };
  const formatDay = (value) => {
    if (!value) {
      return "";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return String(parsed.getDate()).padStart(2, "0");
  };
  const renderFeaturedCard = (item, variant = "large") => {
    if (!item) {
      return "";
    }
    const safeTitle = escapeHtml(item.title);
    const safeDescription = escapeHtml(item.description || "");
    const imageUrl = escapeHtml(item.image || "/assets/default-thumb.svg");
    const titleClass =
      variant === "large"
        ? "text-2xl font-semibold leading-tight sm:text-3xl"
        : "text-lg font-semibold leading-snug";
    const descriptionClass =
      variant === "large" ? "mt-2 text-sm text-slate-100" : "mt-1 text-xs text-slate-100";
    const heightClass = variant === "large" ? "aspect-[16/9]" : "aspect-[4/3]";
    return `
      <article class="relative overflow-hidden rounded border border-slate-200 bg-slate-200">
        <div
          class="${heightClass} bg-cover bg-center"
          style="background-image: url('${imageUrl}')"
        ></div>
        <div class="absolute inset-0 bg-slate-900/55"></div>
        <div class="absolute inset-x-0 bottom-0 p-4 text-white">
          <h3 class="${titleClass}">${safeTitle}</h3>
          ${safeDescription ? `<p class=\"${descriptionClass}\">${safeDescription}</p>` : ""}
        </div>
        <a class="absolute inset-0" href="${item.path}" aria-label="${safeTitle}"></a>
      </article>
    `;
  };
  const shortenLabel = (value, max = 18) => {
    const text = String(value ?? "").trim();
    if (!text || text.length <= max) {
      return text;
    }
    return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
  };
  const renderCategoryTile = (category) => {
    const segment = safeSegment(category.segment ?? category.key);
    const label = category.label ?? category.key;
    const safeLabel = escapeHtml(shortenLabel(label));
    const href = `/${categoryBaseSegment}/${segment}/`;
    const imageUrl = escapeHtml("/assets/default-thumb.svg");
    return `
      <a class="relative overflow-hidden rounded border border-slate-200 bg-slate-200" href="${href}">
        <div
          class="h-24 bg-cover bg-center"
          style="background-image: url('${imageUrl}')"
        ></div>
        <div class="absolute inset-x-0 bottom-0 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-white truncate whitespace-nowrap">${safeLabel}</div>
      </a>
    `;
  };
  const renderLatestRow = (item) => {
    const safeTitle = escapeHtml(item.title);
    const safeDescription = escapeHtml(item.description || "");
    const imageUrl = escapeHtml(item.image || "/assets/default-thumb.svg");
    return `
      <article class="flex gap-4 border-b border-slate-200 pb-4 last:border-b-0 last:pb-0">
        <div
          class="h-20 w-28 shrink-0 rounded bg-cover bg-center"
          style="background-image: url('${imageUrl}')"
        ></div>
        <div>
          <h4 class="text-base font-semibold text-slate-900">
            <a class="hover:text-blue-600" href="${item.path}">${safeTitle}</a>
          </h4>
          <p class="mt-1 text-xs text-slate-600 line-clamp-2">${safeDescription}</p>
          <a class="mt-2 inline-block text-xs font-semibold text-blue-600 hover:text-blue-700" href="${item.path}">Learn More</a>
        </div>
      </article>
    `;
  };
  const monthIndexFor = (label) => {
    if (!label) {
      return -1;
    }
    const key = label.toLowerCase();
    const map = {
      january: 0,
      february: 1,
      march: 2,
      april: 3,
      may: 4,
      june: 5,
      july: 6,
      august: 7,
      september: 8,
      october: 9,
      november: 10,
      december: 11,
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      sept: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    return map[key] ?? -1;
  };
  const parseExhibitionDate = (text) => {
    const regex =
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:\s?[–-]\s?(\d{1,2}))?,\s*(\d{4})/i;
    const match = String(text ?? "").match(regex);
    if (!match) {
      return null;
    }
    const monthLabel = match[1];
    const dayStart = Number(match[2]);
    const dayEnd = match[3] ? Number(match[3]) : null;
    const year = Number(match[4]);
    const monthIndex = monthIndexFor(monthLabel);
    if (monthIndex < 0 || !year || !dayStart) {
      return null;
    }
    const date = new Date(year, monthIndex, dayStart);
    const monthShort = new Intl.DateTimeFormat("en-US", { month: "short" }).format(
      date
    );
    const label = `${monthLabel} ${dayStart}${dayEnd ? `-${dayEnd}` : ""}, ${year}`;
    return {
      date,
      label,
      month: monthShort.toUpperCase(),
      day: String(dayStart).padStart(2, "0"),
    };
  };
  const parseExhibitionDateFromValue = (value) => {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return {
      date: parsed,
      label: formatDate(value),
      month: formatMonth(value).toUpperCase(),
      day: formatDay(value),
    };
  };
  const renderExhibitionItem = (item) => {
    const safeTitle = escapeHtml(item.title);
    const parsed =
      parseExhibitionDate(item.content) ||
      parseExhibitionDateFromValue(item.date);
    const safeDate = escapeHtml(parsed?.label || formatDate(item.date) || "TBD");
    const day = parsed?.day || formatDay(item.date) || "--";
    const month = parsed?.month || formatMonth(item.date).toUpperCase() || "";
    return `
      <li class="flex gap-4 border-b border-slate-200 pb-4 last:border-b-0 last:pb-0">
        <div class="flex h-12 w-12 flex-col items-center justify-center rounded border border-slate-200 bg-white text-center">
          <span class="text-xs font-semibold uppercase text-slate-500">${month}</span>
          <span class="text-sm font-semibold text-slate-900">${day}</span>
        </div>
        <div>
          <a class="text-sm font-semibold text-slate-900 hover:text-blue-600" href="${item.path}">${safeTitle}</a>
          <p class="mt-1 text-xs text-slate-600">${safeDate || "TBD"}</p>
        </div>
      </li>
    `;
  };
  const featured = latest.slice(0, 3);
  const featuredSection = featured.length
    ? `
        <section class="space-y-4 border-b border-slate-200 pb-8">
          <h2 class="text-xl font-semibold">Featured News</h2>
          <div class="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            ${renderFeaturedCard(featured[0], "large")}
            <div class="grid gap-4">
              ${renderFeaturedCard(featured[1], "small")}
              ${renderFeaturedCard(featured[2], "small")}
            </div>
          </div>
          <div class="flex items-center justify-center gap-2">
            <span class="h-2 w-2 rounded-full bg-slate-700"></span>
            <span class="h-2 w-2 rounded-full bg-slate-300"></span>
            <span class="h-2 w-2 rounded-full bg-slate-300"></span>
            <span class="h-2 w-2 rounded-full bg-slate-300"></span>
          </div>
        </section>
      `
    : "";

  const categorySection = !isDateBased
    ? `
        <section class="space-y-4 border-b border-slate-200 pb-8">
          <h2 class="text-xl font-semibold">Explore by Categories</h2>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            ${categoryFolders.slice(0, 9).map(renderCategoryTile).join("")}
          </div>
        </section>
      `
    : "";

  const latestCategory = categories.find(
    (category) => (categoryGroups[category.key] || []).length > 0
  );
  const latestCategoryLabel = latestCategory
    ? escapeHtml(latestCategory.label ?? latestCategory.key)
    : "Latest";
  const latestCategoryItems = latestCategory
    ? (categoryGroups[latestCategory.key] || []).slice(0, 3)
    : latest.slice(0, 3);
  const exhibitionItems = enriched
    .filter((item) => String(item.category).toLowerCase() === "exhibition")
    .map((item) => ({
      item,
      parsed:
        parseExhibitionDate(item.content) ||
        parseExhibitionDateFromValue(item.date),
    }))
    .sort((a, b) => {
      const aDate = a.parsed?.date ? a.parsed.date.getTime() : Infinity;
      const bDate = b.parsed?.date ? b.parsed.date.getTime() : Infinity;
      return aDate - bDate;
    })
    .map((entry) => entry.item)
    .slice(0, 3);
  const latestSection = `
    <section class="grid gap-6 border-b border-slate-200 pb-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <h2 class="text-lg font-semibold">Latest in ${latestCategoryLabel}</h2>
        <div class="mt-4 space-y-4">${latestCategoryItems.map(renderLatestRow).join("")}</div>
      </div>
      <div>
        <h3 class="text-lg font-semibold">Upcoming Exhibitions</h3>
        <ul class="mt-4 space-y-4">${exhibitionItems.map(renderExhibitionItem).join("")}</ul>
      </div>
    </section>
  `;

  let homeContent = `
    <div class="space-y-8">
      ${featuredSection}
      ${categorySection}
      ${latestSection}
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

  const aboutBody = await renderTemplate("about.html", {
    navbar: await renderNavbar({ categories }),
  });
  const aboutHtml = await renderPage({
    title: "About | Automation Atlas",
    description:
      "Machinery Insight curates industrial equipment intelligence for manufacturing leaders.",
    body: aboutBody,
    canonical: "/about/",
    assets: assetMap,
  });
  const aboutDir = path.join(outDir, normalizeOutputPath("/about/"));
  await ensureDir(aboutDir);
  await fs.writeFile(path.join(aboutDir, "index.html"), aboutHtml);

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
      items: list.map(renderCardItem).join(""),
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

    const normalizedCategory = slugify(category.key ?? "");
    const firmNewsIntro =
      normalizedCategory === "firm-news"
        ? `<p class="mt-4 max-w-2xl text-sm text-slate-600">Firm News covers executive moves, partnership announcements, technology milestones, and strategic updates from leading industrial manufacturers. Use this feed to track how suppliers are positioning for the next cycle.</p>`
        : "";
    const subCardsSection =
      normalizedCategory === "firm-news"
        ? ""
        : `<section class=\"mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3\">${subCards}</section>`;
    const hubBody = await renderTemplate("hub.html", {
      navbar: await renderNavbar({ active: category.key, categories }),
      title: safeCategoryLabel,
      intro: firmNewsIntro,
      subCardsSection,
      latestList: scoped.slice(0, 20).map(renderCardItem).join(""),
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
        items: list.map(renderCardItem).join(""),
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
