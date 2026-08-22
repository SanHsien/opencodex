# CLAUDE.md

請先完整閱讀並遵守 [`FORK.md`](FORK.md)。產品規則見上游內容為主的 [`AGENTS.md`](AGENTS.md)；衝突時以 FORK.md 為準。本檔只補充 Claude Code 的最小入口：

- 這是保留上游歷史的 fork；不要移除 `upstream`、原作者或 MIT 授權標示。
- `README.md` 是上游產品說明，不要改寫成本 fork 的維護索引，也不要翻譯成繁中。
- 不要在本 fork 跑 npm publish、不要部署 GitHub Pages、不要把 fork-only 檔案送進上游。
- 修改驗證腳本前，先跑對應測試；提交前跑 `pwsh -NoProfile -File tools\dev_check.ps1`。
- API key、ChatGPT / Codex token、cookie 與帳號資料一律不可提交。
- 帳號池只做路由與韌性，不把它做成規避 provider 條款的工具。
- 使用繁體中文，直接交付可驗證結果，避免冗長背景鋪陳。
