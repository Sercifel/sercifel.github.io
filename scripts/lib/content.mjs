import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

import { slugify } from "./routes.mjs";

const walkMarkdown = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const resolvedPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(resolvedPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(resolvedPath);
    }
  }

  return files;
};

const humanizeSegment = (value) => {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
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

const normalizeTags = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,/]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
};

const stripInlineMarkdown = (value) => {
  const input = String(value ?? "");
  if (!input) {
    return "";
  }
  return input
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const extractLeadingTitle = (markdown) => {
  const source = String(markdown ?? "");
  if (!source.trim()) {
    return { title: "", content: source };
  }
  const lines = source.split(/\r?\n/);
  let inFence = false;
  let fenceMarker = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(```|~~~)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fenceMatch[1];
      } else if (trimmed.startsWith(fenceMarker)) {
        inFence = false;
        fenceMarker = "";
      }
      continue;
    }

    if (inFence) {
      continue;
    }

    const atxMatch = line.match(/^#\s+(.+?)\s*$/);
    if (atxMatch) {
      const title = stripInlineMarkdown(atxMatch[1]);
      const nextLines = [...lines.slice(0, index), ...lines.slice(index + 1)];
      return { title, content: nextLines.join("\n").replace(/^\s*\n/, "") };
    }

    const next = lines[index + 1];
    if (next && /^=+\s*$/.test(next) && trimmed) {
      const title = stripInlineMarkdown(line);
      const nextLines = [
        ...lines.slice(0, index),
        ...lines.slice(index + 2),
      ];
      return { title, content: nextLines.join("\n").replace(/^\s*\n/, "") };
    }
  }

  return { title: "", content: source };
};

const extractFirstImage = (content) => {
  if (!content) {
    return "";
  }
  const markdownMatch = content.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (markdownMatch && markdownMatch[1]) {
    return markdownMatch[1].split(/\s+/)[0].replace(/^<|>$/g, "");
  }
  const htmlMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (htmlMatch && htmlMatch[1]) {
    return htmlMatch[1];
  }
  return "";
};

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

const normalizeDateString = (value) => {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  return text
    .replace(/^([0-9]{4}-[0-9]{2}-[0-9]{2})\s+T?/, "$1T")
    .replace(/T\s+/, "T");
};

const normalizeContent = (filePath, rootDir, data, content) => {
  const relativePath = path.relative(rootDir, filePath);
  const pathSegments = relativePath.split(path.sep);
  const rawCategory = data.category ?? pathSegments[0] ?? "";
  const inferredSubcategory = pathSegments.length > 2 ? pathSegments[1] ?? "" : "";
  const rawSubcategory = data.subcategory ?? inferredSubcategory;
  const category = rawCategory.trim() ? rawCategory : "uncategorized";
  const subcategory = rawSubcategory.trim() ? rawSubcategory : "general";
  const filename = path.basename(filePath, ".md");
  const { title: markdownTitle, content: strippedContent } = extractLeadingTitle(content);
  const metaTitle = String(data.title ?? "").trim();
  const title = markdownTitle || metaTitle || humanizeSegment(filename);
  const slugSource = filename;
  const slugText = typeof slugSource === "string" ? slugSource.trim() : String(slugSource ?? "").trim();
  let slug = slugify(slugText);
  if (!slug) {
    const fallback = slugText || filename || "entry";
    slug = encodeURIComponent(fallback);
  }
  const normalizeDate = (value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === "string") {
      return normalizeDateString(value);
    }

    return "";
  };

  const today = new Date().toISOString().slice(0, 10);

  const image = data.image ?? data.thumbnail ?? extractFirstImage(strippedContent);
  const description = extractExcerpt(strippedContent);
  const metaDescription =
    String(data.meta_description ?? data.description ?? data.summary ?? "").trim();
  const date = normalizeDate(data.date) || today;

  return {
    category,
    subcategory,
    slug,
    title,
    metaTitle,
    date,
    description,
    metaDescription,
    tags: normalizeTags(data.tags ?? data.tag),
    image,
    content: strippedContent,
  };
};

const loadContent = async (rootDir) => {
  const files = await walkMarkdown(rootDir);
  files.sort();
  const items = [];

  for (const filePath of files) {
    const source = await fs.readFile(filePath, "utf8");
    const { data, content } = matter(source);
    items.push(normalizeContent(filePath, rootDir, data, content));
  }

  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return items;
};

export { loadContent };
