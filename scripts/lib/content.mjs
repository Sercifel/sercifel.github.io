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

const normalizeContent = (filePath, rootDir, data, content) => {
  const relativePath = path.relative(rootDir, filePath);
  const pathSegments = relativePath.split(path.sep);
  const rawCategory = data.category ?? pathSegments[0] ?? "";
  const inferredSubcategory = pathSegments.length > 2 ? pathSegments[1] ?? "" : "";
  const rawSubcategory = data.subcategory ?? inferredSubcategory;
  const category = rawCategory.trim() ? rawCategory : "uncategorized";
  const subcategory = rawSubcategory.trim() ? rawSubcategory : "general";
  const filename = path.basename(filePath, ".md");
  const title = data.title ?? humanizeSegment(filename);
  const slugSource = data.slug ?? filename;
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
      return value;
    }

    return "";
  };

  const today = new Date().toISOString().slice(0, 10);

  const image = data.image ?? data.thumbnail ?? extractFirstImage(content);
  const description =
    data.description ?? data.meta_description ?? data.summary ?? extractExcerpt(content);
  const date = normalizeDate(data.date) || today;

  return {
    category,
    subcategory,
    slug,
    title,
    date,
    description,
    tags: normalizeTags(data.tags ?? data.tag),
    image,
    content,
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
