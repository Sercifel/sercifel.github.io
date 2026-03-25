import fs from "node:fs/promises";

const templatesDir = new URL("../../templates/", import.meta.url);
const readTemplate = async (name) =>
  fs.readFile(new URL(name, templatesDir), "utf8");

const escapeHtml = (value) => {
  const input = String(value ?? "");

  return input.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return match;
    }
  });
};

export { escapeHtml };

const formatDate = (value) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed);
};

export { formatDate };

export async function renderTemplate(name, data = {}) {
  const template = await readTemplate(name);
  return Object.entries(data).reduce((output, [key, value]) => {
    const replacement = value ?? "";
    return output.replace(new RegExp(`{{${key}}}`, "g"), replacement);
  }, template);
}

export const renderListItem = (item) => {
  const safeTitle = escapeHtml(item.title);
  const safeDate = escapeHtml(formatDate(item.date));
  const safeDescription = escapeHtml(item.description);
  const imageUrl = escapeHtml(item.image || "/assets/default-thumb.svg");
  const content = typeof item.content === "string" ? item.content : "";
  const words = content
    .replace(/[`*_>#\-\[\]()]|\n/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(words / 200));
  const readingLabel = `Estimated reading time: ${readingMinutes} min${readingMinutes === 1 ? "" : "s"}`;
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const tagClassFor = (tag) => {
    const normalized = String(tag).toLowerCase();
    if (normalized === "automation") {
      return "tag tag-automation";
    }
    if (normalized === "water treatment") {
      return "tag tag-water";
    }
    return "tag";
  };
  const tagsHtml = tags.length
    ? `<div class="mt-3 flex flex-wrap gap-2">${tags
        .map((tag) => `<span class="${tagClassFor(tag)}">${escapeHtml(tag)}</span>`)
        .join("")}</div>`
    : "";

  return `
    <article class="flex gap-4 border-b border-slate-200 py-4">
      <div
        class="h-20 w-28 shrink-0 rounded bg-slate-200 bg-cover bg-center"
        style="background-image: url('${imageUrl}')"
      ></div>
      <div>
        <h3 class="text-xl font-semibold"><a class="link-primary hover:underline" href="${item.path}">${safeTitle}</a></h3>
        <p class="text-sm text-slate-500">${safeDate}<span class="mx-2 text-slate-300">|</span><span class="text-slate-500">${readingLabel}</span></p>
        <p class="mt-2 text-slate-700 line-clamp-2">${safeDescription}</p>
        ${tagsHtml}
      </div>
    </article>
  `;
};

export const renderCardItem = (item) => {
  const safeTitle = escapeHtml(item.title);
  const safeDate = escapeHtml(formatDate(item.date));
  const safeDescription = escapeHtml(item.description);
  const imageUrl = escapeHtml(item.image || "/assets/default-thumb.svg");
  const content = typeof item.content === "string" ? item.content : "";
  const words = content
    .replace(/[`*_>#\-\[\]()]|\n/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(words / 200));
  const readingLabel = `Estimated reading time: ${readingMinutes} min${readingMinutes === 1 ? "" : "s"}`;
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const tagClassFor = (tag) => {
    const normalized = String(tag).toLowerCase();
    if (normalized === "automation") {
      return "tag tag-automation";
    }
    if (normalized === "water treatment") {
      return "tag tag-water";
    }
    return "tag";
  };
  const tagsHtml = tags.length
    ? `<div class="mt-3 flex flex-wrap gap-2">${tags
        .map((tag) => `<span class="${tagClassFor(tag)}">${escapeHtml(tag)}</span>`)
        .join("")}</div>`
    : "";

  return `
    <article class="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
      <div class="h-40 bg-cover bg-center" style="background-image: url('${imageUrl}')"></div>
      <div class="p-4">
        <h3 class="text-lg font-semibold text-slate-900">
          <a class="hover:text-blue-600" href="${item.path}">${safeTitle}</a>
        </h3>
        <p class="mt-1 text-xs text-slate-500">${safeDate}<span class="mx-2 text-slate-300">|</span><span class="text-slate-500">${readingLabel}</span></p>
        <p class="mt-2 text-sm text-slate-700 line-clamp-2">${safeDescription}</p>
        ${tagsHtml}
      </div>
    </article>
  `;
};

export async function renderPage({
  title,
  description,
  body,
  canonical,
  footer,
  assets,
} = {}) {
  return wrapWithBase({
    title: title ?? "",
    description: description ?? "",
    body: body ?? "",
    canonical: canonical ?? "",
    footer: footer ?? "",
    assets,
  });
}

const applyAssetMap = (html, assets) => {
  if (!assets) {
    return html;
  }
  return Object.entries(assets).reduce((output, [from, to]) => {
    return output.replaceAll(from, to);
  }, html);
};

export async function wrapWithBase({
  title,
  description,
  body,
  canonical,
  footer,
  assets,
} = {}) {
  const base = await readTemplate("base.html");
  const safeTitle = escapeHtml(title ?? "");
  const safeDescription = escapeHtml(description ?? "");
  const safeBody = body ?? "";
  const safeCanonical = escapeHtml(canonical ?? "");
  const safeFooter = footer ?? "";

  const shell = base
    .replace(/{{title}}/g, safeTitle)
    .replace(/{{description}}/g, safeDescription)
    .replace(/{{canonical}}/g, safeCanonical)
    .replace(/{{body}}/g, safeBody)
    .replace(/{{footer}}/g, safeFooter);

  return applyAssetMap(shell, assets);
}
