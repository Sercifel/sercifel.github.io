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

const normalizeContent = (filePath, rootDir, data, content) => {
  const relativePath = path.relative(rootDir, filePath);
  const pathSegments = relativePath.split(path.sep);
  const rawCategory = data.category ?? pathSegments[0] ?? "";
  const rawSubcategory = data.subcategory ?? pathSegments[1] ?? "";
  const category = rawCategory.trim() ? rawCategory : "uncategorized";
  const subcategory = rawSubcategory.trim() ? rawSubcategory : "general";
  const filename = path.basename(filePath, ".md");
  const title = data.title ?? filename;
  const slugSource = data.slug ?? title;
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

  return {
    category,
    subcategory,
    slug,
    title,
    date: normalizeDate(data.date),
    description: data.description ?? data.summary ?? "",
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
