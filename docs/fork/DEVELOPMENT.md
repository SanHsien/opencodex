# 開發環境

維護者與 AI 接手用的開發文件。產品用法看 [`README.md`](../../README.md)；上游同步在 [`UPSTREAM.md`](UPSTREAM.md)；決策在 [`DECISIONS.md`](DECISIONS.md)。

## 架構

```text
Codex / Claude Code / Claude Desktop / Grok Build
        │
        ▼
ocx (Bun-native local proxy, default http://localhost:10100)
        │
        ├─ provider adapters（Claude / Gemini / Grok / DeepSeek / Ollama / …）
        ├─ ChatGPT account pool（配額、affinity、failover）
        └─ gui/dist dashboard
```

根目錄 `FORK.md`、`tools/`、`docs/fork/` 是本 fork 的開發與治理骨架。`src/`、`gui/`、`tests/`、`docs-site/` 以上游為準。

## 本機開發（Windows）

需要本機已安裝 [Bun](https://bun.sh)。產品套件會再帶一份 runtime，但貢獻指令用你 PATH 上的 `bun`。

```powershell
git clone https://github.com/SanHsien/opencodex.git
cd opencodex
bun install --frozen-lockfile
pwsh -NoProfile -File tools\dev_check.ps1
```

啟動 dashboard / proxy：

```powershell
bun run src/cli/index.ts start
```

瀏覽器開 http://localhost:10100。帳號池與 provider 都在 GUI 設定；真實 token 只放本機 `~/.opencodex/`，不要進 Git。

## Canonical fork gate

`tools\dev_check.ps1` 會依序：

1. `bun install --frozen-lockfile`（若 `node_modules` 不完整）
2. `bun test tests/fork-hygiene.test.ts`
3. `bun tools/check-links.ts`

這是 fork 文件與 guard 的硬閘門，不是完整產品回歸。

產品行為變更再跑：

```powershell
bun run typecheck
bun run test
```

上游 `ci.yml` 仍會在本 fork 的 `main` 上跑 Linux / Windows / macOS。不要把那條 workflow 加上官方-repo-only guard。

## 不要做的事

- 不要為了 fork 文件去改上游 `CONTRIBUTING.md` / `MAINTAINERS.md`。
- 不要在本 fork 觸發 `release.yml` 真發佈，或 `deploy-docs.yml`。
- 不要提交 API key、ChatGPT token、OAuth、帳號池真實資料。
- 不要把帳號池描述成可以規避 OpenAI / 其他 provider 條款。
- 測試不要打真實第三方帳號；fork 測試只鎖維護骨架。
