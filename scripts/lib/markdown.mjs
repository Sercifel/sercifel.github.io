import markdownIt from "markdown-it";

const slugify = (value) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const extractToc = (state, toc, slugCounts, normalizeHeading) => {
  let headingIndex = 0;
  let currentSection = null;
  for (let i = 0; i < state.tokens.length; i += 1) {
    const token = state.tokens[i];
    if (token.type !== "heading_open") {
      continue;
    }

    const level = Number(token.tag.slice(1));
    if (level !== 2) {
      continue;
    }

    headingIndex += 1;

    const inline = state.tokens[i + 1];
    const rawText = inline?.type === "inline" ? inline.content : "";
    const text = normalizeHeading ? normalizeHeading(rawText) : rawText;
    const baseSlug = slugify(text) || `section-${headingIndex}`;
    const slugCount = slugCounts.get(baseSlug) ?? 0;
    const id = slugCount === 0 ? baseSlug : `${baseSlug}-${slugCount + 1}`;

    slugCounts.set(baseSlug, slugCount + 1);

    token.attrSet("id", id);

    currentSection = { level, id, text, children: [] };
    toc.push(currentSection);
  }
};

const hasProtocol = (href) => /^[a-z][a-z0-9+.-]*:/i.test(href ?? "");

const markExternalLinks = (tokens) => {
  const stack = [];
  for (const token of tokens) {
    if (token.type === "link_open") {
      const href = token.attrGet("href");
      const external = hasProtocol(href);
      if (external) {
        token.meta = { ...(token.meta ?? {}), external: true };
      }
      stack.push(external);
    } else if (token.type === "link_close") {
      const external = stack.pop();
      if (external) {
        token.meta = { ...(token.meta ?? {}), external: true };
      }
    }

    if (token.children) {
      markExternalLinks(token.children);
    }
  }
};

const normalizeHeadingLevels = (tokens) => {
  for (const token of tokens) {
    if (token.type === "heading_open" || token.type === "heading_close") {
      if (token.tag === "h1") {
        token.tag = "h2";
      }
    }
    if (token.children) {
      normalizeHeadingLevels(token.children);
    }
  }
};

const renderMarkdown = (markdown) => {
  const toc = [];
  const md = markdownIt({ html: true, linkify: true });
  const slugCounts = new Map();
  const normalizeHeadingText = (text) => {
    const rendered = md.renderInline(String(text ?? ""));
    const stripped = rendered.replace(/<[^>]*>/g, "");
    const unescaped = md.utils.unescapeAll(stripped);
    return unescaped.trim();
  };
  const externalLinkIcon =
    '<svg class="ml-1 inline h-3 w-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3h7v7"></path><path d="M10 14L21 3"></path><path d="M5 7v14h14v-7"></path></svg>';
  const defaultLinkOpen =
    md.renderer.rules.link_open ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  const defaultLinkClose =
    md.renderer.rules.link_close ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

  md.core.ruler.push("normalize-headings", (state) => {
    normalizeHeadingLevels(state.tokens);
  });
  md.core.ruler.push("extract-toc", (state) => {
    extractToc(state, toc, slugCounts, normalizeHeadingText);
  });
  md.core.ruler.push("mark-external-links", (state) => {
    markExternalLinks(state.tokens);
  });

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token.meta?.external) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer");
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.link_close = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token.meta?.external) {
      return `${externalLinkIcon}${defaultLinkClose(tokens, idx, options, env, self)}`;
    }
    return defaultLinkClose(tokens, idx, options, env, self);
  };

  const html = md.render(markdown);
  return { html, toc };
};

export { renderMarkdown };
