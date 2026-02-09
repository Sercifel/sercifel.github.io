# Modal Search UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace inline search with a modal search dialog triggered by a navbar button across all pages.

**Architecture:** Add a global modal container in `templates/base.html` and update the build output to include a consistent navbar with a Search button. `assets/search.js` will handle open/close behavior and render search results into the modal. Tests will assert the modal and trigger exist in generated HTML.

**Tech Stack:** Node.js build script, Tailwind CSS (CDN), vanilla JS

---

### Task 1: Add modal container to base template

**Files:**
- Modify: `templates/base.html`
- Modify: `assets/site.css`

**Step 1: Write the failing test**

Update `tests/build.test.mjs` to assert the modal container exists in generated HTML:
```js
assert.ok(index.includes("data-search-modal"));
assert.ok(index.includes("data-search-input"));
```

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/build.test.mjs
```
Expected: FAIL (modal markup not present).

**Step 3: Write minimal implementation**

Add modal markup to `templates/base.html` (after `{{body}}`):
```html
<div class="fixed inset-0 z-50 hidden" data-search-modal aria-hidden="true">
  <div class="absolute inset-0 bg-slate-950/40" data-search-overlay></div>
  <div class="relative mx-auto flex min-h-full max-w-2xl items-center justify-center px-6">
    <div class="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Search</p>
          <h2 class="mt-2 text-xl font-semibold">Find a report or vendor</h2>
        </div>
        <button class="rounded-full border border-slate-300 px-3 py-1 text-xs uppercase tracking-[0.2em]" data-search-close>
          Close
        </button>
      </div>
      <input class="mt-6 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm" placeholder="Search by company, category, or keyword" data-search-input />
      <p class="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400" data-search-count></p>
      <ul class="mt-6 space-y-4" data-search-results></ul>
    </div>
  </div>
</div>
```

Add modal scroll lock rule to `assets/site.css`:
```css
body[data-modal-open="true"] {
  overflow: hidden;
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/build.test.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add templates/base.html assets/site.css tests/build.test.mjs
git commit -m "feat: add modal search container"
```

---

### Task 2: Add navbar search button to all pages

**Files:**
- Modify: `scripts/build.mjs`
- Modify: `tests/build.test.mjs`

**Step 1: Write the failing test**

Add to `tests/build.test.mjs`:
```js
assert.ok(index.includes("data-search-open"));
```

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/build.test.mjs
```
Expected: FAIL (button not present).

**Step 3: Write minimal implementation**

Add a `renderNavbar()` helper in `scripts/build.mjs`:
```js
const renderNavbar = (active) => `
  <header class="border-b border-slate-200 bg-white/70 backdrop-blur">
    <nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-full border border-slate-300"></div>
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Personal Research</p>
          <p class="text-lg font-semibold">Research Reports</p>
        </div>
      </div>
      <div class="hidden items-center gap-6 text-sm font-medium md:flex">
        <a class="${active === "reports" ? "text-blue-600" : "text-slate-700 hover:text-blue-600"}" href="/reports/">Reports</a>
        <a class="${active === "sites" ? "text-blue-600" : "text-slate-700 hover:text-blue-600"}" href="/sites/">Sites</a>
      </div>
      <div class="flex items-center gap-3">
        <button class="rounded-full border border-slate-300 px-4 py-2 text-xs uppercase tracking-[0.2em]" data-search-open>
          Search
        </button>
        <button class="rounded-full border border-slate-300 px-4 py-2 text-xs uppercase tracking-[0.2em]">RSS</button>
      </div>
    </nav>
  </header>
`;
```

Prepend `${renderNavbar("reports")}` or `${renderNavbar("sites")}` to each page body, and remove the inline search input from `homeBody`.

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/build.test.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/build.mjs tests/build.test.mjs
git commit -m "feat: add navbar search trigger"
```

---

### Task 3: Modal search behavior

**Files:**
- Modify: `assets/search.js`

**Step 1: Write the failing test**

Skip (manual verification for DOM behavior).

**Step 2: Run test to verify it fails**

Skip.

**Step 3: Write minimal implementation**

Update `assets/search.js` to:
- Open modal on `[data-search-open]`
- Close on `[data-search-close]`, overlay click, and Escape key
- Set `body[data-modal-open="true"]` when open
- Render default latest 20 when query is empty

Suggested additions:
```js
const modal = document.querySelector("[data-search-modal]");
const overlay = document.querySelector("[data-search-overlay]");
const closeBtn = document.querySelector("[data-search-close]");
const openBtns = document.querySelectorAll("[data-search-open]");

const openModal = () => {
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.dataset.modalOpen = "true";
  input?.focus();
  update();
};

const closeModal = () => {
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  delete document.body.dataset.modalOpen;
};

openBtns.forEach((btn) => btn.addEventListener("click", openModal));
closeBtn?.addEventListener("click", closeModal);
overlay?.addEventListener("click", closeModal);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});
```

Ensure the default list uses the latest 20 (already in place):
```js
const DEFAULT_LIMIT = 20;
```

**Step 4: Run test to verify it passes**

Skip.

**Step 5: Commit**

```bash
git add assets/search.js
git commit -m "feat: open search in modal"
```

---

### Task 4: Manual QA

**Files:**
- Modify: none

**Step 1: Run build**

```bash
npm run build
```

**Step 2: Verify behavior**

- Open `public/index.html`
- Click Search button → modal opens centered
- Typing filters results and clicking a result navigates
- Escape or Close dismisses the modal

**Step 3: Commit**

Skip.
