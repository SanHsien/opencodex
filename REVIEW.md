# Repository review（Windows-first）

- Review date: 2026-08-27
- Fork HEAD: `8d23124cb6e97472a5c9240b5015bc676ac29eb3`
- 上游 `main`：`80fff9a7f47332a4445df2b26ea175053fa55b0b`（`v2.34.0`，本日 +0900 發版）
- 本線產品版本：`package.json` 仍為 `2.31.0`
- Primary environment: Windows 11、PowerShell、Bun 1.4.0
- Status: overlay 可用；`#2557` 已最小移植；**不要**把目前 `main` 當成已跟上游發版線

## 結論

這條 fork 適合作為 Windows 本機使用與追蹤上游的維護線。產品仍是本機 provider proxy，含 ChatGPT / Codex **account pool**。

它**不再**對齊上游 `main`。fork 起點是 `v2.31.0`；五天內上游已發 `2.32.0`、`2.32.1`、`2.33.0`、`2.34.0`。本輪把這段發版線當一批審查完，**決定暫不合併**。原因不是「還沒看」，而是合併方式已被 2026-08-23 的歷史壓縮切斷：本線與上游沒有共同祖先。

本線最痛的產品缺口原本是自己種的：為修 Windows model picker 而引用的 `--restart-desktop-app`，在上游 `#2557` 已被證明會產生無效 PowerShell。**2026-08-28 已把這支修正最小移植進來**（換行串陳述、探針失敗回 `process_probe_failed`）。完整跟上 `v2.34.0` 仍要另做 overlay 重放。

## 本輪優先發現

| ID | 嚴重度 | 發現 |
|---|---|---|
| R-01 | P0 | `--restart-desktop-app` 的 `#2557`：**2026-08-28 已修**。探針改 `.join("\n")`，失敗回 `process_probe_failed`，測試會檢查腳本不是空白串接。 |
| R-02 | P0 | `893b50779` 把歷史壓成**無父提交**。`git merge-base HEAD upstream/main` 為空。下次同步禁止 `git merge upstream/main`；應在 `v2.34.0` 上重放 overlay。 |
| R-03 | P1 | 上游 `main` 領先本線三個穩定版。選擇性引用的三支修正在上游都已進 `main`，本線那幾份檔案已過期（含 `#2557`）。 |
| R-04 | P1 | 壓縮歷史與後續 `FORK.md` 連結那兩次 push **沒跑** Cross-platform CI。最後一次產品 CI 綠燈是 squash 前的 `32626456343`（2026-08-23，bound-appends）。 |
| R-05 | P2 | 週一 `upstream-check` 在 2.32 登陸前跑過所以仍綠。下一次排程才會因未審 commit 轉紅；本輪已把水位推到 `80fff9a7f`，避免重複喊同一批。 |

## 這條線現在有什麼

相對上游 `v2.31.0` 的維護差異：

| 類 | 內容 |
|---|---|
| Overlay | `FORK.md`、`NOTICE.md`、`CLAUDE.md`、`SKILL.md`、`REVIEW.md`、`docs/fork/`、`tools/`、workflow guard、CodeQL、Dependabot（只看 github-actions） |
| 語系 | `README.md` 繁中、`README.en.md` 英文；GUI / docs-site 只留 en + zh-TW |
| 產品引用 | `#2292` 桌面 app 重啟；`#2395` usage 增量讀取上限；`#2398` 前半 abort 時結束 body |
| 歷史 | 2026-08-23 壓成單一 orphan commit，再加一筆治理 repo 連結 |

沒有改帳號池語意，沒有回貢，沒有在本 fork 發 npm。

## 上游 2.32–2.34（本輪批次）

`bun tools/check-upstream-updates.ts` 列出 **514** 筆 `6ae83b1f..upstream/main`。first-parent 發版線只有 7 筆：

| 時間（+0900） | 版本 |
|---|---|
| 2026-08-24 19:00 | `v2.32.0` |
| 2026-08-25 10:37 | `v2.32.1` |
| 2026-08-25 20:25 | `v2.33.0` |
| 2026-08-27 22:06 | `v2.34.0`（tag 已存在；`package.json` 為 2.34.0） |

本輪**沒有**把 514 筆逐檔讀完。讀了發版線、本線已改過的檔案、workflow 清單，以及 `platform` issue 增量。

### 已引用、現在應改吃上游版

| 來源 | 本線狀態 | 上游 |
|---|---|---|
| `#2292` / `a3bbcdb0` 桌面 app 重啟 | 仍在本線，且仍有 `#2557` | 已進 `main`，並含 PowerShell 修正 |
| `#2395` usage 增量讀取上限 | 仍在本線 | 已進 `main`，後續還有更多 usage 記憶體修正 |
| `#2398` 前半 abort-cancel body | 仍在本線 | 已進 `main`；後半 `readDisplaySafeErrorText` 本線仍未引 |

### 同步時要處理、現在不預先移植

- 新 workflow：`cleanup-closed-pr-branches.yml`（排程、`contents: write`、會刪關閉 PR 的 branch）。本 fork 必須加官方-repo-only guard，否則個人 fork 的 branch 可能被刪。
- 語系：上游仍有 fr/ja/ko/ru/tr/zh-cn。合併會把刪掉的語系救回來，必須再刪一次。
- Windows 已在上游關閉、本線還沒拿到的：`#2605`（大份 Codex SQLite 擋 proxy thread）、`#2459`（npm 重裝留下混版模組）、`#2499`（catalog probe 延遲）等。等重放 overlay 時一起進來，不單挑移植。
- 仍 open 的 `platform`：`#2718`（re-auth / catalog）、`#2701`／`#2696`（launchd，macOS）、`#2697`（CLI 對 management API 失敗仍 exit 0）。後三條不是本線現在會痛的 Windows 路徑。

### 明確不跟

- 上游 `dev` 上未進 `main` 的 open PR（今日最新如 `#2767`、`#2764` 仍是 draft）。
- 把 fork 當第二個官方 docs / npm 站。
- 為了「跟上」而 `merge --allow-unrelated-histories`。那會把兩棵不相關的樹糊在一起，衝突不可審。

## 刻意不修（本輪）

| ID | 項目 | 理由 |
|---|---|---|
| U-01 | 立刻重放 overlay 到 `v2.34.0` | 審查任務到寫下結論為止。重放是下一步，要單獨做、單獨驗證。 |
| U-02 | 整份吃上游 `desktop-app-restart.ts` | 2026-08-28 已最小移植 `#2557`。完整檔等 `v2.34.0` 重放。 |
| U-03 | 完整 `bun run test` / `bun run typecheck` | 本輪只跑 fork gate 與已引用檔案的焦點測試。產品 CI 以 GitHub 最後一次綠燈為準，且那次在 squash 之前。 |
| U-04 | 真實 ChatGPT 多帳號 smoke | 沒有用真實帳號跑 pool。 |

## 本輪實證

### 本機（Windows 11，Bun 1.4.0）

```text
pwsh -NoProfile -File tools\dev_check.ps1
→ fork-hygiene 18 pass / 0 fail
→ check-links：11 份文件，0 斷連結
→ WINDOWS DEV CHECK GREEN

bun tools/check-upstream-updates.ts
→ 514 upstream commit(s) require review
→ reviewed through 6ae83b1（審查當時；本輪結束後水位改為 80fff9a7f）

bun test tests/desktop-app-restart.test.ts
→ 16 pass（mock exec；看不到 #2557）

bun test tests/bounded-body.test.ts
→ 全過（含 abort 時結束 body 那條）

bun test tests/api-usage.test.ts（與上述檔案一起跑）
→ 14 條 GET /api/usage 在 5s 超時（啟動真實 proxy 後請求沒回來）
→ 不把這 14 條寫成「#2395 引入的回歸」：GitHub Cross-platform CI 在 2026-08-23 對同一批引用是綠的；本機超時可能是活 proxy + 本機帳本，未單獨重現。
```

### GitHub（`SanHsien/opencodex`）

- 官方治理 workflow（stale、orphan cleanup）因 repo guard 被 skip：符合設計。
- Fork maintenance / CodeQL / React Doctor：squash 後 tip `8d23124cb` 綠燈。
- Cross-platform CI：最後綠燈 `32626456343`（bound-appends）。squash 與後續文件 commit 沒有留下 ci.yml run。
- 週一 Upstream check（`32688033102`，2026-08-24 03:53 UTC）成功：當時 `v2.32.0` 尚未進 `main`（當日 10:00 UTC 才發）。

### 尚未宣稱範圍

- **沒有**本機跑完整 `bun run test`。
- **沒有**對 squash 後的 tree 跑產品 CI。
- **沒有**用真實 ChatGPT 多帳號做 pool 端到端 smoke。
- **不宣稱**本 fork 會發自己的 npm 套件。
- **不宣稱** `ocx sync --restart-desktop-app` 在本線可用。

## 下一步

1. 在 `upstream/main` 的 `v2.34.0` 上重放 overlay（文件、語系刪除、workflow guard、CodeQL、fork tools），不要 merge 無共同祖先的歷史。
2. 重放時採用上游其餘已演進的 `bounded-body.ts` / `usage/log.ts`；`desktop-app-restart.ts` 的 `#2557` 已在本線。
3. 給 `cleanup-closed-pr-branches.yml` 加上 `github.repository == 'lidge-jun/opencodex'`。
4. 重放後跑 `tools\dev_check.ps1`、`bun run typecheck`，並確認 Cross-platform CI 真的對新 tip 排隊。

逐項紀錄見 [`docs/fork/UPSTREAM.md`](docs/fork/UPSTREAM.md)、[`docs/fork/DECISIONS.md`](docs/fork/DECISIONS.md)。
