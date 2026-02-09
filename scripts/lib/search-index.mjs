import { articlePath } from "./routes.mjs";

const buildSearchIndex = (items) => {
  return items.map((item) => ({
    title: item.title,
    description: item.description,
    category: item.category,
    subcategory: item.subcategory,
    path: articlePath(item),
  }));
};

export { buildSearchIndex };
