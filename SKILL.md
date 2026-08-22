---
name: opencodex
description: 維護 SanHsien/opencodex：lidge-jun/opencodex 的 Windows-first fork。本機 Bun proxy，讓 Codex / Claude Code 使用任意 LLM，並管理 ChatGPT 多帳號 pool。
---

# opencodex

完整維護規則先讀 [`FORK.md`](FORK.md)；產品行為再讀 [`AGENTS.md`](AGENTS.md)。

## 何時使用

使用者要維護 `SanHsien/opencodex` 時使用，例如：

- 本機啟動 `ocx` / dashboard（`localhost:10100`）。
- 審查或同步上游帳號池、provider、routing 變更。
- 修 Windows 開發 gate、fork 文件或 workflow guard。
- 調查 Codex / Claude Code 連到非 OpenAI 模型的行為。

## 核心邊界

- 這是**多帳號 ChatGPT pool** 的那一個 OpenCodex，不是遠端桌面中介，也不是 OpenCode fork。
- 不發 `@bitkyc08/opencodex`，不部署官方 docs-site。
- 不提交 token、cookie、OAuth、帳號池真實憑證。
- 不把帳號池說成可以規避 provider 限額或條款。
- 不翻譯 `README.md`。

## 快速定位

- `src/`：proxy runtime、routing、provider adapters、帳號池
- `gui/`：dashboard
- `tests/`：Bun 測試；fork 骨架在 `tests/fork-hygiene.test.ts`
- `docs-site/`：上游公開文件（本 fork 不部署）
- `docs/fork/`：本 fork 的開發、上游、決策
- `tools/dev_check.ps1`：Windows 本機 fork gate
- `NOTICE.md` / `SECURITY.md`：授權與安全回報

## 驗證

```powershell
bun install --frozen-lockfile
pwsh -NoProfile -File tools\dev_check.ps1
```

產品行為變更再追加 `bun run typecheck` 與 `bun run test`。沒有實機跑過 proxy / 帳號池時，不要宣稱端到端可用。
