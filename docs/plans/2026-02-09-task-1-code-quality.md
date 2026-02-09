# Task 1 Code Quality Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix remaining Task 1 accessibility/code-quality issues in base template and CSS, run tests, and commit.

**Architecture:** Update `templates/base.html` markup for skip link, search input attributes, aria-live on search count, and main content wrapper. Add heading scroll offsets in `assets/site.css` for anchor targets.

**Tech Stack:** HTML templates, Tailwind CSS, Node.js tests.

---

### Task 1: Update base template accessibility markup

**Files:**
- Modify: `templates/base.html`

**Step 1: Write the failing test**

No new test required; existing test suite should cover build output.

**Step 2: Run test to verify it fails**

Run: `node --test tests/build.test.mjs`
Expected: FAIL (current code quality issues).

**Step 3: Write minimal implementation**

- Add skip link before header/body content that targets `#main-content`.
- Wrap `{{body}}` in a container with `id="main-content"`.
- Update search input with `type="search"`, `name="search"`, `autocomplete="off"` (or `on`), and placeholder ending with ellipsis.
- Add `aria-live="polite"` to the element that has `data-search-count`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/build.test.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add templates/base.html
git commit -m "fix: polish modal accessibility"
```

### Task 2: Add heading scroll offset styles

**Files:**
- Modify: `assets/site.css`

**Step 1: Write the failing test**

No new test required; existing test suite should cover build output.

**Step 2: Run test to verify it fails**

Run: `node --test tests/build.test.mjs`
Expected: FAIL (pending CSS change).

**Step 3: Write minimal implementation**

- Add `scroll-margin-top` to `h1`, `h2`, and `h3`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/build.test.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add assets/site.css
git commit -m "fix: polish modal accessibility"
```
