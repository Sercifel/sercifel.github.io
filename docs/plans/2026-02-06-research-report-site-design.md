# Personal Research Report Site - Design

Date: 2026-02-06
Project: Personal Research Report Blog

## Goals
- Deliver a calm, editorial reading experience optimized for long-form research comparisons.
- Keep information architecture simple: Reports and Sites as top-level hubs with identical subcategory structure.
- Support fast discovery: search, category chips, latest lists.
- Ensure SEO-friendly static pages with clear metadata.

## Audience
- Readers looking for structured comparisons and source-backed summaries.
- Personal research archive with high readability and easy navigation.

## Design System
- Source of truth: `design-system/research-reports/MASTER.md`
- Style: editorial research, minimal motion, paper-like background, ink text
- Typography: Crimson Pro (headings) + Atkinson Hyperlegible (body)
- Accent: blue for links and focus

## Information Architecture
- `/` Home: latest 20 posts across all categories, searchable
- `/reports` Hub: subcategories + latest 20 reports
- `/sites` Hub: subcategories + latest 20 site profiles
- `/{category}/{subcategory}`: list of posts for the subcategory
- `/{category}/{subcategory}/{blog-title}`: article detail

## Page Layouts
### Home
- Header: site name, tagline, search input, category tabs (Reports/Sites)
- Latest list: title, date, 2-3 line abstract, category chips
- List is single-column with subtle dividers; date aligned on desktop

### Category Hubs (Reports/Sites)
- Title + short intro
- Subcategory grid with counts
- Latest 20 entries for the hub

### Subcategory Page
- Title + brief intro
- List of entries for the subcategory

### Article Detail
- Title, date, breadcrumb, summary
- TOC: right rail on desktop; collapsible accordion above content on mobile
- Markdown content with strong H2/H3 hierarchy, tables with zebra rows
- Related strip: same subcategory + cross-link to the other hub

## Components
- Global header with site title + search
- Category chips with hover and focus states
- Search results list with count
- TOC component with active-section highlight
- List item card (title, date, summary)
- Breadcrumbs for detail pages

## Data Flow
- Build script converts `blogs/**/*.md` to HTML in `public/`
- Frontmatter used for title, date, description
- Index JSON for search built at build time
- Client-side fuzzy search for titles, descriptions, categories

## SEO and Metadata
- Per-page meta title: `{Title} | Research Reports`
- Meta description from frontmatter or generated summary
- OpenGraph tags for title, description, URL

## Accessibility
- 4.5:1 minimum contrast
- Visible focus ring for all interactive elements
- Keyboard-accessible TOC and search
- Minimum 16px body text on mobile

## Motion
- Subtle fade-in on page load (150-200ms)
- No parallax or heavy animations
- Respect `prefers-reduced-motion`

## Testing
- Verify layout at 375, 768, 1024, 1440
- Check TOC placement and accordion behavior on mobile
- Run fuzzy search with multiple categories
- Validate metadata per page
