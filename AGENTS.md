# 部落格建置

## Rules

- 一律採用 Subagent-Driven 的開發方式，不用詢問使用者。
- 不要建立額外的 git worktree。
- 當你需要變更這個專案目錄中會被 git 追蹤的檔案時，可以直接修改，不需要詢問使用者。

## 開發目標

- 把 blogs 資料夾裡的 markdown 文章轉換成 HTML，並放在 public 資料夾裡。
- public 目錄會以 git subtree 的方式推送到 github 上的 gh-pages 分支，讓 GitHub Pages 來托管這些靜態頁面。
- public 目錄裡面都是 build 生成的檔案，除非你要檢視 build 結果，否則搜尋時請略過。
- 不使用既有的靜態網站生成框架。只使用簡單的 build script 加上 html template 來生成 HTML 頁面。
- 網站畫面風格要簡潔、清爽，並且適合閱讀，符合現代風格。css 使用 tailwindcss。
- 每一個網頁應有共用的選單列以及頁尾。
- 首頁必須自動生成最近的 20 筆文章列表，並且每篇文章的標題、日期、摘要都要顯示出來。
- 部落格主要分成 reports 與 sites 兩大類，這兩大類下面的分類方式則是一樣的。最後一層就是部落格。
- reports 與 sites 頁面要列出所有分類以及整個大類最近的 20 筆文章。
- 部落格之間要有水平的連結，讓使用者可以在不同的部落格之間輕鬆切換。
- 每篇文章的 URL 結構為 /{category}/{subcategory}/{blog-title}
- 要有搜尋功能，使用 javascript fuzzy search 類似的機制實現，不需要後端。
- 搜尋的實踐方式是在每一頁面有搜尋按鈕，點擊後開啟垂直水平置中的對話窗，顯示搜尋輸入框以及結果。
- SEO Friendly，每一頁都要有獨立的 meta title 和 description。
- 部落格詳細頁需要列出 TOC。TOC 在 desktop 環境黏在右側，左邊捲動時必須保持可見。在 mobile 環境則在文章內容的上方，手風琴式展開。
