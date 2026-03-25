import { createHash } from "node:crypto";

const slugify = (value) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const MAX_SLUG_LENGTH = 80;

const normalizeArticleSlug = (value) => {
  const base = slugify(value ?? "");
  if (!base || base.length <= MAX_SLUG_LENGTH) {
    return base;
  }
  const hash = createHash("sha1").update(base).digest("hex").slice(0, 6);
  const limit = Math.max(0, MAX_SLUG_LENGTH - hash.length - 1);
  const trimmed = base.slice(0, limit).replace(/-+$/g, "");
  return trimmed ? `${trimmed}-${hash}` : base.slice(0, MAX_SLUG_LENGTH);
};

const articlePath = ({ category, subcategory, title, slug }) => {
  const categorySlug = slugify(category ?? "");
  const subcategorySlug = slugify(subcategory ?? "");
  const articleSlug = slug
    ? normalizeArticleSlug(slug)
    : normalizeArticleSlug(title ?? "");

  return `/${categorySlug}/${subcategorySlug}/${articleSlug}/`;
};

export { articlePath, slugify };
