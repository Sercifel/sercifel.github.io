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

  return `
    <article class="py-4 border-b border-slate-200">
      <h3 class="text-xl font-semibold"><a class="link-primary hover:underline" href="${item.path}">${safeTitle}</a></h3>
      <p class="text-sm text-slate-500">${safeDate}</p>
      <p class="mt-2 text-slate-700 line-clamp-2">${safeDescription}</p>
    </article>
  `;
};

export async function renderPage({
  title,
  description,
  body,
  canonical,
  assets,
} = {}) {
  return wrapWithBase({
    title: title ?? "",
    description: description ?? "",
    body: body ?? "",
    canonical: canonical ?? "",
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
  assets,
} = {}) {
  const base = await readTemplate("base.html");
  const safeTitle = escapeHtml(title ?? "");
  const safeDescription = escapeHtml(description ?? "");
  const safeBody = body ?? "";
  const safeCanonical = escapeHtml(canonical ?? "");

  const shell = base
    .replace(/{{title}}/g, safeTitle)
    .replace(/{{description}}/g, safeDescription)
    .replace(/{{canonical}}/g, safeCanonical);

  const withAssets = applyAssetMap(shell, assets);
  return withAssets.replace(/{{body}}/g, safeBody);
}
