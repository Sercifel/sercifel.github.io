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
const brandSuffix = " | Machinery Insight";
const siteBaseUrl = "https://www.machinesource-global.com";
const siteHostname = new URL(siteBaseUrl).hostname;
const normalizeBaseUrl = (value) => String(value ?? "").replace(/\/+$/, "");
const toAbsoluteUrl = (pathname) => {
  const base = normalizeBaseUrl(siteBaseUrl);
  const pathValue = String(pathname ?? "");
  const normalizedPath = pathValue.startsWith("/") ? pathValue : `/${pathValue}`;
  return `${base}${normalizedPath}`;
};
const withBrandTitle = (title) => {
  const text = String(title ?? "").trim();
  if (!text) {
    return `Home${brandSuffix}`;
  }
  return text.endsWith(brandSuffix) ? text : `${text}${brandSuffix}`;
};
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
const extractExcerpt = (markdown, maxLength = 160) => {
  const source = String(markdown ?? "");
  if (!source.trim()) {
    return "";
  }
  const cleaned = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_~`-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "";
  }
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  const limit = Math.max(0, maxLength - 3);
  return `${cleaned.slice(0, limit).trimEnd()}...`;
};
const formatLastmod = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().split("T")[0];
};
const categoryImageMap = new Map([
  ["machine-tools", "/assets/machine-tools.jpeg"],
  ["plastic-machinery", "/assets/plastic-machinery.jpeg"],
  ["plastics-machinery", "/assets/plastic-machinery.jpeg"],
  ["packaging-machinery", "/assets/packaging-machinery.jpeg"],
  ["food-beverage-processing-machinery", "/assets/food-beverage-processing-machinery.jpeg"],
  ["material-handling-equipment", "/assets/material-handling-equipment.jpeg"],
  ["energy-environmental-equipment", "/assets/energy-environmental-equipment.jpeg"],
  ["semiconductor-electronics-equipment", "/assets/semiconductor-electronics-equipment.jpeg"],
  ["industrial-automation-systems", "/assets/industrial-automation-systems.jpeg"],
  ["general-industrial-equipment", "/assets/general-industrial-equipment.jpeg"],
]);
const buildAssets = async (outDir) => {
  const assetsDir = path.join(outDir, "assets");
  const files = [
    "site.css",
    "search.js",
    "nav.js",
    "toc.js",
    "carousel.js",
    "load-more.js",
    "mi-logo.jpg",
    "mi-logo-removebg-preview.png",
    "favicon.jpg",
    "default-thumb.svg",
    "machine-tools.jpeg",
    "plastic-machinery.jpeg",
    "packaging-machinery.jpeg",
    "food-beverage-processing-machinery.jpeg",
    "material-handling-equipment.jpeg",
    "energy-environmental-equipment.jpeg",
    "semiconductor-electronics-equipment.jpeg",
    "industrial-automation-systems.jpeg",
    "general-industrial-equipment.jpeg",
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
const renderBreadcrumbs = ({ items = [], widthClass = "max-w-7xl" } = {}) => {
  const cleaned = items.filter((item) => item && item.label);
  if (!cleaned.length) {
    return "";
  }
  const list = cleaned
    .map((item, index) => {
      const safeLabel = escapeHtml(item.label);
      const safeHref = item.href ? escapeHtml(item.href) : "";
      const isLast = index === cleaned.length - 1;
      const content = !isLast && safeHref
        ? `<a class="hover:text-blue-600" href="${safeHref}">${safeLabel}</a>`
        : `<span class="text-slate-700"${isLast ? " aria-current=\"page\"" : ""}>${safeLabel}</span>`;
      const separator = !isLast
        ? `<span class="text-slate-400" aria-hidden="true">/</span>`
        : "";
      return `<li class="flex items-center gap-2">${content}${separator}</li>`;
    })
    .join("");
  return `
    <nav class="mx-auto ${widthClass} px-4 sm:px-6 lg:px-8 pt-6 text-xs sm:text-sm text-slate-500" aria-label="Breadcrumb">
      <ol class="flex flex-wrap items-center gap-x-2 gap-y-1 break-words leading-5">${list}</ol>
    </nav>
  `;
};

export async function buildSite({ contentDir = "blogs", outDir = "public" } = {}) {
  await ensureDir(outDir);
  await fs.writeFile(path.join(outDir, "CNAME"), `${siteHostname}\n`);
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
  const categoryOrder = [
    "Machine Tools",
    "Plastics Machinery",
    "Packaging Machinery",
    "Food & Beverage Processing Machinery",
    "Material Handling Equipment",
    "Energy & Environmental Equipment",
    "Semiconductor & Electronics Equipment",
    "Industrial Automation Systems",
    "General Industrial Equipment",
  ];
  const categoryIntroMap = new Map([
    [
      slugify("Machine Tools"),
      "Machine tools cover turning, milling, grinding, EDM, and multi-process systems that shape metal parts. This category summarizes selection criteria, accuracy, and throughput to support production upgrades.",
    ],
    [
      slugify("Plastics Machinery"),
      "Plastics machinery includes injection molding, extrusion, blow molding, forming, and recycling equipment. This category highlights materials, efficiency, and process stability for comparing capacity and part quality.",
    ],
    [
      slugify("Packaging Machinery"),
      "Packaging machinery covers filling, sealing, labeling, cartoning, and palletizing equipment that links upstream and downstream processes. This category focuses on pack formats, speed, and yield for automation planning.",
    ],
    [
      slugify("Food & Beverage Processing Machinery"),
      "Food and beverage processing equipment includes washing, mixing, sterilization, filling, and packaging systems. This category summarizes hygiene requirements and throughput to balance quality and cost.",
    ],
    [
      slugify("Material Handling Equipment"),
      "Material handling equipment includes conveyors, forklifts, AGV/AMR fleets, and warehouse automation. This category covers flow design and efficiency metrics for internal logistics planning.",
    ],
    [
      slugify("Energy & Environmental Equipment"),
      "Energy and environmental equipment spans efficiency systems, air and water treatment, recycling, and carbon management. This category emphasizes compliance and performance metrics for sustainable operations.",
    ],
    [
      slugify("Semiconductor & Electronics Equipment"),
      "Semiconductor and electronics equipment includes wafer and packaging processes, SMT, inspection, and cleanroom systems. This category outlines process nodes and equipment trends for comparing technical capabilities.",
    ],
    [
      slugify("Industrial Automation Systems"),
      "Industrial automation systems cover PLCs, robotics, vision inspection, SCADA, and IIoT integration. This category summarizes architecture and adoption priorities to improve stability and throughput.",
    ],
    [
      slugify("General Industrial Equipment"),
      "General industrial equipment spans cross-industry processing, assembly, and maintenance systems. This category consolidates use cases and selection factors for quick evaluation.",
    ],
  ]);
  const buildCategoryIntro = (label) => {
    const introKey = slugify(label ?? "");
    const introText =
      categoryIntroMap.get(introKey) ??
      `This category focuses on ${label} equipment, processes, and application contexts. It summarizes selection criteria, key technologies, and market direction to clarify the core value of this segment.`;
    return `<p class="mt-3 max-w-3xl text-sm text-slate-600">${escapeHtml(introText)}</p>`;
  };
  const orderedCategoryFolders = [
    ...categoryOrder
      .map((label) => {
        const segment = safeSegment(label);
        return categoryFolders.find((entry) => entry.segment === segment);
      })
      .filter(Boolean),
    ...categoryFolders.filter(
      (entry) => !categoryOrder.some((label) => entry.segment === safeSegment(label))
    ),
  ];
  const footerCategoryLinks = orderedCategoryFolders
    .slice(0, 9)
    .map((entry) => {
      const safeLabel = escapeHtml(entry.label ?? entry.key);
      return `<li><a class="transition-colors duration-200 hover:text-blue-600" href="/${categoryBaseSegment}/${entry.segment}/">${safeLabel}</a></li>`;
    })
    .join("");
  const exhibitionCategory = categories.find(
    (entry) => slugify(entry.key ?? "") === "exhibition"
  );
  const exhibitionSubgroups = exhibitionCategory
    ? groupBy(enriched.filter((item) => item.category === exhibitionCategory.key), "subcategory")
    : {};
  const footerExhibitionLinks = Object.keys(exhibitionSubgroups)
    .sort((a, b) => humanizeSegment(a).localeCompare(humanizeSegment(b)))
    .map((name) => {
      const segment = safeSegment(name);
      const safeName = escapeHtml(humanizeSegment(name));
      const categorySegment = safeSegment(exhibitionCategory?.key);
      return `<li><a class="transition-colors duration-200 hover:text-blue-600" href="/${categorySegment}/${segment}/">${safeName}</a></li>`;
    })
    .join("");
  const footerHtml = `
    <footer class="mt-16 border-t border-slate-200 bg-white">
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div class="grid gap-8 lg:grid-cols-[220px_repeat(3,minmax(0,1fr))]">
          <div>
            <a class="inline-flex items-center" href="/" aria-label="Back to home">
              <img
                class="h-8 w-auto"
                src="/assets/mi-logo-removebg-preview.png"
                alt="Machinery Insight"
                loading="lazy"
              />
            </a>
          </div>
          <div>
            <ul class="mt-3 space-y-2 text-sm text-slate-600">
              <li><a class="transition-colors duration-200 hover:text-blue-600" href="/firm-news/">Firm News</a></li>
              <li><a class="transition-colors duration-200 hover:text-blue-600" href="/exhibition/">Exhibitions</a></li>
              <li><a class="transition-colors duration-200 hover:text-blue-600" href="/categories/">Categories</a></li>
              <li><a class="transition-colors duration-200 hover:text-blue-600" href="/about/">About</a></li>
            </ul>
          </div>
          <div>
            <h2 class="text-sm font-semibold text-slate-700">Exhibitions</h2>
            <ul class="mt-3 space-y-2 text-sm text-slate-600">
              ${footerExhibitionLinks || "<li class=\"text-slate-400\">No exhibitions yet.</li>"}
            </ul>
          </div>
          <div>
            <h2 class="text-sm font-semibold text-slate-700">Categories</h2>
            <ul class="mt-3 space-y-2 text-sm text-slate-600">
              ${footerCategoryLinks || "<li class=\"text-slate-400\">No categories yet.</li>"}
            </ul>
          </div>
        </div>
        <div class="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500">
          <p>Copyright © Machinery Insight All rights reserved.</p>
          <p>
            Relative Platform of
            <a class="ml-2 text-blue-700 hover:text-blue-800" href="https://www.market-prospects.com/" target="_blank" rel="noopener noreferrer">Market Prospects</a>
          </p>
        </div>
      </div>
    </footer>
  `;

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
        ? "text-2xl font-semibold leading-tight sm:text-3xl text-white"
        : "text-lg font-semibold leading-snug text-white";
    const descriptionClass =
      variant === "large" ? "mt-2 text-sm text-white/90" : "mt-1 text-xs text-white/90";
    const heightClass = variant === "large" ? "aspect-[4/3]" : "aspect-[4/3]";
    return `
      <article class="group relative overflow-hidden rounded border border-slate-200 bg-slate-100">
        <div
          class="${heightClass} bg-cover bg-center"
          style="background-image: url('${imageUrl}')"
        ></div>
        <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent"></div>
        <div class="absolute inset-x-0 bottom-0 p-4 text-white">
          <h3 class="${titleClass}">${safeTitle}</h3>
          ${safeDescription ? `<p class=\"${descriptionClass}\">${safeDescription}</p>` : ""}
        </div>
        <a class="absolute inset-0" href="${item.path}" aria-label="${safeTitle}"></a>
      </article>
    `;
  };
  const renderFeaturedSlide = (items = []) => {
    const [primary, secondary, tertiary] = items;
    if (!primary) {
      return "";
    }
    return `
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        ${renderFeaturedCard(primary, "large")}
        <div class="grid gap-4">
          ${renderFeaturedCard(secondary, "small")}
          ${renderFeaturedCard(tertiary, "small")}
        </div>
      </div>
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
    const safeLabel = escapeHtml(label);
    const href = `/${categoryBaseSegment}/${segment}/`;
    const imageUrl = escapeHtml(categoryImageMap.get(segment) || "/assets/default-thumb.svg");
    return `
      <a class="relative overflow-hidden rounded border border-slate-200 bg-slate-200" href="${href}">
        <div
          class="h-24 bg-cover bg-center"
          style="background-image: url('${imageUrl}')"
        ></div>
        <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/70 via-slate-900/35 to-transparent px-3 py-2 text-sm font-semibold text-white whitespace-nowrap">
          ${safeLabel}
        </div>
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
  const renderLatestListWithPagination = (items, perPage = 12) => {
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    const listHtml = items
      .map((item, index) => {
        const page = Math.floor(index / perPage) + 1;
        const hiddenClass = page === 1 ? "" : " hidden";
        return `<div class="latest-item${hiddenClass}" data-page-item data-page="${page}">${renderListItem(
          item
        )}</div>`;
      })
      .join("");
    const paginationHtml =
      totalPages > 1
        ? `
          <nav class="mt-8 flex flex-wrap justify-center gap-2" aria-label="Pagination" data-pagination>
            ${Array.from({ length: totalPages }, (_, index) => {
              const page = index + 1;
              const activeClass = page === 1
                ? "bg-blue-600 text-white border-blue-600"
                : "border-slate-300 text-slate-600 hover:border-blue-600 hover:text-blue-600";
              const ariaCurrent = page === 1 ? " aria-current=\"page\"" : "";
              return `<button class=\"inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-200 ${activeClass}\" type=\"button\" data-page-button data-page=\"${page}\"${ariaCurrent}>${page}</button>`;
            }).join("")}
          </nav>
        `
        : "";
    return { listHtml, paginationHtml };
  };
  const renderCardGridWithPagination = (items, perPage = 12) => {
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    const listHtml = items
      .map((item, index) => {
        const page = Math.floor(index / perPage) + 1;
        const hiddenClass = page === 1 ? "" : " hidden";
        return `<div class="${hiddenClass}" data-page-item data-page="${page}">${renderCardItem(
          item
        )}</div>`;
      })
      .join("");
    const paginationHtml =
      totalPages > 1
        ? `
          <nav class="mt-8 flex flex-wrap justify-center gap-2" aria-label="Pagination" data-pagination>
            ${Array.from({ length: totalPages }, (_, index) => {
              const page = index + 1;
              const activeClass = page === 1
                ? "bg-blue-600 text-white border-blue-600"
                : "border-slate-300 text-slate-600 hover:border-blue-600 hover:text-blue-600";
              const ariaCurrent = page === 1 ? " aria-current=\"page\"" : "";
              return `<button class=\"inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-200 ${activeClass}\" type=\"button\" data-page-button data-page=\"${page}\"${ariaCurrent}>${page}</button>`;
            }).join("")}
          </nav>
        `
        : "";
    return { listHtml, paginationHtml };
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
  const parseFrontMatterDate = (value) => {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  };
  const latestDateForItems = (items = []) => {
    const timestamps = items
      .map((item) => parseFrontMatterDate(item.date)?.getTime())
      .filter((value) => typeof value === "number");
    if (!timestamps.length) {
      return null;
    }
    return new Date(Math.max(...timestamps));
  };
  const now = new Date();
  const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonth = currentMonthDate.getMonth();
  const currentYear = currentMonthDate.getFullYear();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = nextMonthDate.getMonth();
  const nextMonthYear = nextMonthDate.getFullYear();
  const isCurrentMonthFrontMatter = (item) => {
    const parsed = parseFrontMatterDate(item.date);
    return parsed
      ? parsed.getMonth() === currentMonth && parsed.getFullYear() === currentYear
      : false;
  };
  const parseExhibitionDateFromValue = (value) => {
    const parsed = parseFrontMatterDate(value);
    if (!parsed) {
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
      parseExhibitionDateFromValue(item.date) ||
      parseExhibitionDate(item.content);
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
  const currentMonthItems = enriched.filter(isCurrentMonthFrontMatter);
  const featured = (currentMonthItems.length ? currentMonthItems : latest).slice(0, 9);
  const featuredSlides = Array.from(
    { length: Math.ceil(featured.length / 3) },
    (_, index) => renderFeaturedSlide(featured.slice(index * 3, index * 3 + 3))
  ).filter(Boolean);
  const featuredDots = featuredSlides
    .map((_, index) => {
      const activeClass = index === 0 ? " is-active" : "";
      return `<button class="carousel-dot${activeClass}" type="button" data-carousel-dot="${index}" aria-label="Slide ${index + 1}"></button>`;
    })
    .join("");
  const featuredSection = featuredSlides.length
    ? `
        <section class="space-y-4 border-b border-slate-200 pb-8" data-featured-carousel>
          <h2 class="text-xl font-semibold">Featured News</h2>
          <div class="carousel-viewport" data-carousel-viewport>
            <div class="carousel-track" data-carousel-track>
              ${featuredSlides
                .map(
                  (slide, index) => `
                    <div class="carousel-slide" data-carousel-slide="${index}" aria-hidden="${index === 0 ? "false" : "true"}">
                      ${slide}
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
          <div class="carousel-dots" data-carousel-dots>
            ${featuredDots}
          </div>
        </section>
      `
    : "";

  const categorySection = !isDateBased
    ? `
        <section class="space-y-4 border-b border-slate-200 pb-8">
          <h2 class="text-xl font-semibold">Explore by Categories</h2>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            ${orderedCategoryFolders.slice(0, 9).map(renderCategoryTile).join("")}
          </div>
        </section>
      `
    : "";

  const latestMonthItem = currentMonthItems[0];
  const latestCategoryKeyFromMonth = latestMonthItem?.category;
  const latestCategoryFromMonth = latestCategoryKeyFromMonth
    ? categories.find((category) => category.key === latestCategoryKeyFromMonth) || {
        key: latestCategoryKeyFromMonth,
        label: humanizeSegment(latestCategoryKeyFromMonth),
      }
    : null;
  const latestCategory =
    latestCategoryFromMonth ||
    categories.find((category) => (categoryGroups[category.key] || []).length > 0);
  const latestCategoryLabel = latestCategory
    ? escapeHtml(latestCategory.label ?? latestCategory.key)
    : "Latest";
  const latestCategoryItems = latestCategory
    ? (() => {
        const itemsInCategory = categoryGroups[latestCategory.key] || [];
        const monthInCategory = itemsInCategory.filter(isCurrentMonthFrontMatter);
        const nonMonthInCategory = itemsInCategory.filter(
          (item) => !isCurrentMonthFrontMatter(item)
        );
        return [...monthInCategory, ...nonMonthInCategory].slice(0, 3);
      })()
    : currentMonthItems.slice(0, 3);
  const exhibitionItems = enriched
    .filter((item) => String(item.category).toLowerCase() === "exhibition")
    .map((item) => ({
      item,
      parsed: parseExhibitionDateFromValue(item.date),
    }))
    .filter(
      ({ parsed }) =>
        parsed?.date &&
        parsed.date.getMonth() === nextMonth &&
        parsed.date.getFullYear() === nextMonthYear
    )
    .sort((a, b) => {
      const aDate = a.parsed?.date ? a.parsed.date.getTime() : Infinity;
      const bDate = b.parsed?.date ? b.parsed.date.getTime() : Infinity;
      return aDate - bDate;
    })
    .map((entry) => entry.item)
    .slice(0, 3);
  const latestCategoryKey = latestCategory?.key;
  const latestCategoryHref = latestCategoryKey
    ? `/${safeSegment(latestCategoryKey)}/`
    : "/";
  const latestSection = `
    <section class="grid gap-6 border-b border-slate-200 pb-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <h2 class="text-lg font-semibold">Latest in ${latestCategoryLabel}</h2>
        <div class="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          ${latestCategoryItems.map(renderLatestRow).join("")}
        </div>
        <div class="mt-5 flex justify-center">
          <a
            class="inline-flex items-center justify-center rounded-full border border-blue-700 px-5 py-2 text-sm font-semibold text-blue-700 transition-colors duration-200 hover:border-blue-800 hover:text-blue-800"
            href="${latestCategoryHref}"
          >
            Read More
          </a>
        </div>
      </div>
      <div>
        <h3 class="text-lg font-semibold">Upcoming Exhibitions</h3>
        <ul class="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          ${exhibitionItems.map(renderExhibitionItem).join("")}
        </ul>
        <div class="mt-5 flex justify-center">
          <a
            class="inline-flex items-center justify-center rounded-full border border-blue-700 px-5 py-2 text-sm font-semibold text-blue-700 transition-colors duration-200 hover:border-blue-800 hover:text-blue-800"
            href="/exhibition/"
          >
            Read More
          </a>
        </div>
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
  const categoriesByLatest = categories
    .map((category) => ({
      category,
      latestDate: latestDateForItems(categoryGroups[category.key] || []),
    }))
    .sort((a, b) => {
      const aTime = a.latestDate ? a.latestDate.getTime() : -Infinity;
      const bTime = b.latestDate ? b.latestDate.getTime() : -Infinity;
      return bTime - aTime;
    })
    .map(({ category }) => category);
  const sidebarSections = categoriesByLatest
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
          const countHtml = `<span class="text-xs text-slate-500">${list.length}</span>`;
          return `<li class="flex items-center justify-between gap-3"><a class="link-primary" href="/${categorySegment}/${segment}/">${safeName}</a>${countHtml}</li>`;
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

  const homeSidebar = `
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

  const categoriesSubgroups = groupBy(categoryGroups.Categories || [], "subcategory");
  const categoriesSidebarLinks = orderedCategoryFolders
    .slice(0, 9)
    .map((entry) => {
      const safeLabel = escapeHtml(entry.label ?? entry.key);
      return `<li class="flex items-center justify-between gap-3"><a class="link-primary" href="/${categoryBaseSegment}/${entry.segment}/">${safeLabel}</a></li>`;
    })
    .join("");
  const categoriesSidebar = `
    <aside class="lg:sticky lg:top-24 h-fit">
      <div class="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <h2 class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Categories</h2>
        <ul class="mt-4 space-y-2 text-sm text-slate-700">
          ${categoriesSidebarLinks || "<li class=\"text-sm text-slate-500\">No categories yet.</li>"}
        </ul>
      </div>
    </aside>
  `;

  const exhibitionSegment = safeSegment(exhibitionCategory?.key ?? "exhibition");
  const exhibitionRegions = Object.entries(exhibitionSubgroups)
    .map(([name, list]) => ({ name, latestDate: latestDateForItems(list) }))
    .sort((a, b) => {
      const aTime = a.latestDate ? a.latestDate.getTime() : -Infinity;
      const bTime = b.latestDate ? b.latestDate.getTime() : -Infinity;
      return bTime - aTime;
    })
    .map((entry) => entry.name)
    .slice(0, 6);
  const exhibitionSidebarLinks = exhibitionRegions
    .map((name) => {
      const safeLabel = escapeHtml(humanizeSegment(name));
      const segment = safeSegment(name);
      return `<li><a class="link-primary" href="/${exhibitionSegment}/${segment}/">${safeLabel}</a></li>`;
    })
    .join("");
  const exhibitionSidebar = `
    <aside class="lg:sticky lg:top-24 h-fit">
      <div class="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <h2 class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Exhibition</h2>
        <ul class="mt-4 space-y-2 text-sm text-slate-700">
          ${exhibitionSidebarLinks || "<li class=\"text-sm text-slate-500\">No exhibition regions yet.</li>"}
        </ul>
      </div>
    </aside>
  `;

  const sidebarForCategory = (categoryKey) => {
    const normalized = slugify(categoryKey ?? "");
    if (normalized === "categories") {
      return categoriesSidebar;
    }
    if (normalized === "exhibition") {
      return exhibitionSidebar;
    }
    return "";
  };

  const buildSidebarColumn = (sidebarHtml) =>
    sidebarHtml ? `<div class="hidden lg:block">${sidebarHtml}</div>` : "";
  const buildGridClass = (sidebarHtml) =>
    sidebarHtml ? "grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]" : "";
  const buildArticleGridClass = (sidebarHtml) =>
    sidebarHtml
      ? "grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)_220px]"
      : "grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]";

  const sitemapEntries = new Map();
  const addSitemapEntry = (pathname, lastmod) => {
    const loc = toAbsoluteUrl(pathname);
    if (!loc) {
      return;
    }
    const formattedLastmod = formatLastmod(lastmod);
    const existing = sitemapEntries.get(loc);
    if (!existing || (formattedLastmod && existing < formattedLastmod)) {
      sitemapEntries.set(loc, formattedLastmod || existing || "");
    }
  };

  const homeBody = await renderTemplate("home.html", {
    navbar: await renderNavbar({ categories }),
    homeContent,
    sidebar: homeSidebar,
  });

  const homeHtml = await renderPage({
    title: withBrandTitle("Industrial Machinery Insights, News & Exhibitions"),
    description:
      "Machinery Insight delivers industrial equipment news, category guides, and exhibition calendars for manufacturing and automation teams.",
    body: homeBody,
    canonical: "/",
    footer: footerHtml,
    assets: assetMap,
  });

  await fs.writeFile(path.join(outDir, "index.html"), homeHtml);
  addSitemapEntry("/", new Date());

  const aboutBody = await renderTemplate("about.html", {
    navbar: await renderNavbar({ categories }),
    breadcrumbs: renderBreadcrumbs({
      items: [
        { label: "Home", href: "/" },
        { label: "About" },
      ],
      widthClass: "max-w-3xl",
    }),
  });
  const aboutHtml = await renderPage({
    title: withBrandTitle("About Machinery Insight"),
    description:
      "Learn how Machinery Insight curates machinery categories, market updates, and exhibition coverage for industrial decision-makers.",
    body: aboutBody,
    canonical: "/about/",
    footer: footerHtml,
    assets: assetMap,
  });
  const aboutDir = path.join(outDir, normalizeOutputPath("/about/"));
  await ensureDir(aboutDir);
  await fs.writeFile(path.join(aboutDir, "index.html"), aboutHtml);
  addSitemapEntry("/about/", new Date());

  const archiveEntries = Object.entries(archiveGroups).sort(([a], [b]) => b.localeCompare(a));
  for (const [key, list] of archiveEntries) {
    const [year, month] = key.split("-");
    const label = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
    }).format(new Date(Number(year), Number(month) - 1, 1));
    const archiveBody = await renderTemplate("list.html", {
      navbar: await renderNavbar({ categories }),
      breadcrumbs: renderBreadcrumbs({
        items: [
          { label: "Home", href: "/" },
          { label: `${label} Archive` },
        ],
      }),
      title: `${label} Archive`,
      items: list.map(renderCardItem).join(""),
    });
    const archiveHtml = await renderPage({
      title: withBrandTitle(`${label} Archive`),
      description: `Articles from ${label}`,
      body: archiveBody,
      canonical: `/archive/${key}/`,
      footer: footerHtml,
      assets: assetMap,
    });
    const archiveDir = path.join(outDir, normalizeOutputPath(`/archive/${key}/`));
    await ensureDir(archiveDir);
    await fs.writeFile(path.join(archiveDir, "index.html"), archiveHtml);
    addSitemapEntry(`/archive/${key}/`);
  }

  for (const category of categories) {
    const scoped = enriched.filter((item) => item.category === category.key);
    const subgroups = groupBy(scoped, "subcategory");
    const subgroupEntries = Object.entries(subgroups)
      .map(([name, list]) => ({
        name,
        list,
        latestDate: latestDateForItems(list),
      }))
      .sort((a, b) => {
        const aTime = a.latestDate ? a.latestDate.getTime() : -Infinity;
        const bTime = b.latestDate ? b.latestDate.getTime() : -Infinity;
        return bTime - aTime;
      });
    const subCards = subgroupEntries
      .map(({ name, list }) => {
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
    const isCategoriesHub = normalizedCategory === "categories";
    const firmNewsIntro =
      normalizedCategory === "firm-news"
        ? `<p class="mt-4 max-w-2xl text-sm text-slate-600">Firm News covers executive moves, partnership announcements, technology milestones, and strategic updates from leading industrial manufacturers. Use this feed to track how suppliers are positioning for the next cycle.</p>`
        : "";
    const subCardsSection =
      normalizedCategory === "firm-news"
        ? ""
        : `<section class=\"mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3\">${subCards}</section>`;
    const categoryCards = orderedCategoryFolders.slice(0, 9).map(renderCategoryTile).join("");
    const sidebarLinks = orderedCategoryFolders
      .slice(0, 9)
      .map((entry) => {
        const safeLabel = escapeHtml(entry.label ?? entry.key);
        return `<li><a class=\"link-primary hover:underline\" href=\"/${categoryBaseSegment}/${entry.segment}/\">${safeLabel}</a></li>`;
      })
      .join("");
    const scopedCurrentMonth = scoped.filter(isCurrentMonthFrontMatter);
    const scopedLatestSource = scopedCurrentMonth.length ? scopedCurrentMonth : scoped;
    const latestCategoryPayload = renderLatestListWithPagination(scopedLatestSource, 12);
    const latestHubPayload = renderCardGridWithPagination(scopedLatestSource, 12);
    const categorySidebar = sidebarForCategory(category.key);
    const hubBody = isCategoriesHub
      ? await renderTemplate("categories.html", {
          navbar: await renderNavbar({ active: category.key, categories }),
          breadcrumbs: renderBreadcrumbs({
            items: [
              { label: "Home", href: "/" },
              { label: "Categories" },
            ],
          }),
          title: "Explore by Categories",
          sidebarLinks,
          categoryCards,
          latestCategoryList: latestCategoryPayload.listHtml,
          latestPagination: latestCategoryPayload.paginationHtml,
        })
      : await renderTemplate("hub.html", {
          navbar: await renderNavbar({ active: category.key, categories }),
          gridClass: buildGridClass(categorySidebar),
          sidebarColumn: buildSidebarColumn(categorySidebar),
          breadcrumbs: renderBreadcrumbs({
            items: [
              { label: "Home", href: "/" },
              { label: categoryLabel },
            ],
          }),
          title: safeCategoryLabel,
          intro: firmNewsIntro,
          subCardsSection,
          latestList: latestHubPayload.listHtml,
          latestPagination: latestHubPayload.paginationHtml,
        });

    const hubHtml = await renderPage({
      title: withBrandTitle(
        isCategoriesHub
          ? "Industrial Machinery Categories & Topics"
          : `${categoryLabel} Insights & Updates`
      ),
      description: isCategoriesHub
        ? "Browse nine industrial machinery categories, key subtopics, and the latest posts across manufacturing equipment."
        : `Latest ${categoryLabel} news, equipment insights, and market notes curated by Machinery Insight.`,
      body: hubBody,
      canonical: `/${categorySegment}/`,
      footer: footerHtml,
      assets: assetMap,
    });

    const hubDir = path.join(outDir, normalizeOutputPath(`/${categorySegment}/`));
    await ensureDir(hubDir);
    await fs.writeFile(path.join(hubDir, "index.html"), hubHtml);
    addSitemapEntry(`/${categorySegment}/`);

    for (const { name, list } of subgroupEntries) {
      const segment = safeSegment(name);
      const nameLabel = humanizeSegment(name);
      const safeName = escapeHtml(nameLabel);
      const listIntro =
        normalizedCategory === "categories" ? buildCategoryIntro(nameLabel) : "";
      const listPayload = normalizedCategory === "categories"
        ? renderCardGridWithPagination(list, 12)
        : { listHtml: list.map(renderCardItem).join(""), paginationHtml: "" };
      const listBody = await renderTemplate("list.html", {
        navbar: await renderNavbar({ active: category.key, categories }),
        gridClass: buildGridClass(categorySidebar),
        sidebarColumn: buildSidebarColumn(categorySidebar),
        breadcrumbs: renderBreadcrumbs({
          items: [
            { label: "Home", href: "/" },
            { label: categoryLabel, href: `/${categorySegment}/` },
            { label: nameLabel },
          ],
        }),
        title: safeName,
        intro: listIntro,
        items: listPayload.listHtml,
        pagination: listPayload.paginationHtml,
      });

      const listTitle =
        normalizedCategory === "categories"
          ? `${nameLabel} Machinery Insights`
          : `${nameLabel} ${categoryLabel} Articles`;
      const listDescription =
        normalizedCategory === "categories"
          ? `Explore ${nameLabel} coverage with equipment insights, trends, and practical guidance.`
          : `Browse ${nameLabel} coverage in ${categoryLabel}, including equipment insights, trends, and updates.`;
      const listHtml = await renderPage({
        title: withBrandTitle(listTitle),
        description: listDescription,
        body: listBody,
        canonical: `/${categorySegment}/${segment}/`,
        footer: footerHtml,
        assets: assetMap,
      });

      const listDir = path.join(
        outDir,
        normalizeOutputPath(`/${categorySegment}/${segment}/`)
      );
      await ensureDir(listDir);
      await fs.writeFile(path.join(listDir, "index.html"), listHtml);
      addSitemapEntry(`/${categorySegment}/${segment}/`);
    }
  }

  for (const item of enriched) {
    const normalizedContent = item.content;
    const { html, toc } = renderMarkdown(normalizedContent);
    const tocHtml = toc
      .map(
        (section) => `
          <li>
            <a data-toc-link="${section.id}" class="hover:text-blue-600" href="#${section.id}">${escapeHtml(
              section.text
            )}</a>
          </li>`
      )
      .join("");

    const safeDate = escapeHtml(formatDate(item.date));
    const safeTitle = escapeHtml(item.title);
    const descriptionText = item.description?.trim() || extractExcerpt(normalizedContent);
    const metaTitle = item.metaTitle?.trim() || item.title;
    const metaDescription = item.metaDescription?.trim() || descriptionText;

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

    const itemSidebar = sidebarForCategory(item.category);
    const body = await renderTemplate("article.html", {
      navbar: await renderNavbar({ active: item.category, categories }),
      gridClass: buildArticleGridClass(itemSidebar),
      sidebarColumn: buildSidebarColumn(itemSidebar),
      breadcrumbs: renderBreadcrumbs({
        items:
          slugify(item.category ?? "") === "firm-news"
            ? [
                { label: "Home", href: "/" },
                {
                  label: humanizeSegment(item.category),
                  href: `/${safeSegment(item.category)}/`,
                },
                { label: item.title },
              ]
            : [
                { label: "Home", href: "/" },
                {
                  label: humanizeSegment(item.category),
                  href: `/${safeSegment(item.category)}/`,
                },
                {
                  label: humanizeSegment(item.subcategory),
                  href: `/${safeSegment(item.category)}/${safeSegment(item.subcategory)}/`,
                },
                { label: item.title },
              ],
        widthClass: "max-w-7xl",
      }),
      date: safeDate,
      title: safeTitle,
      toc: tocHtml,
      content: html,
      related: relatedHtml,
    });

    const pageHtml = await renderPage({
      title: withBrandTitle(metaTitle),
      description: metaDescription,
      body,
      canonical: item.path,
      footer: footerHtml,
      assets: assetMap,
    });

    const pageDir = path.join(outDir, normalizeOutputPath(item.path));
    await ensureDir(pageDir);
    await fs.writeFile(path.join(pageDir, "index.html"), pageHtml);
    addSitemapEntry(item.path, item.date);
  }

  const searchIndex = buildSearchIndex(enriched);
  await fs.writeFile(
    path.join(outDir, "search-index.json"),
    JSON.stringify(searchIndex, null, 2)
  );

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    Array.from(sitemapEntries.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([loc, lastmod]) => {
        const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
        return `  <url>\n    <loc>${loc}</loc>${lastmodTag}\n  </url>`;
      })
      .join("\n") +
    "\n</urlset>\n";
  await fs.writeFile(path.join(outDir, "sitemap.xml"), sitemapXml);

}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildSite();
}
