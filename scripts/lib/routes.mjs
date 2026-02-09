const slugify = (value) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const articlePath = ({ category, subcategory, title, slug }) => {
  const categorySlug = slugify(category ?? "");
  const subcategorySlug = slugify(subcategory ?? "");
  const articleSlug = slug ? slugify(slug) : slugify(title ?? "");

  return `/${categorySlug}/${subcategorySlug}/${articleSlug}/`;
};

export { articlePath, slugify };
