# Repository review（Windows-first）

- Review date: 2026-10-30
- Fork HEAD: `992c49b40f77ab19c108955a6fc1a7767132c7e8`
- 上游 `main`：`88aaa754566d119b6b8fc898f8fb47602387d82e`（整合 tag 為 `v2.93.0`，見 [`tools/upstream_baseline.json`](tools/upstream_baseline.json)）
- 本線產品版本：`package.json` 為 `2.94.0`（整合 tag 為 `v2.93.0`）
- Primary environment: Windows 11、PowerShell、Bun 1.4.4
- Status: overlay 可用；Windows-only 檔案層級移除完成；更新路徑只認本 fork releases；本機 dev check 全綠

## 結論

這條 fork 適合作為 Windows 本機使用與追蹤上游的維護線。產品仍是本機 provider proxy，含 ChatGPT / Codex **account pool**。

產品基底為上游 `v2.93.0`（`88aaa754566d119b6b8fc898f8fb47602387d82e`），於 2026-10-27 透過 tag diff 重放完成整合（`package.json` 為 2.94.0、整合 tag 為 v2.93.0）。本線刻意維持壓縮歷史，與上游沒有共同祖先，同步一律採取 tag 間的 diff 套到 `main` 並以單一 parent commit 提交，絕不執行 `git merge upstream/main`，亦不建立 ancestry bridge。

2026-10-27 起已切斷通往上游的更新路徑（`src/update/fork-source.mjs` 封鎖所有 registry 自更新），release 下載與說明導向 `SanHsien/opencodex`；2026-10-28 起已完成 Windows-only 檔案層級精簡，徹底移除 macOS 與 Linux 專屬目錄、打包腳本、CI jobs 與專用測試，共用程式碼內的平台分支則予保留以維持同步相容性。

## 現況優先架構與防線

| 領域 | 狀態 | 說明與護欄 |
|---|---|---|
| 上游整合 | 已整合至 `v2.93.0` | 依 `docs/fork/UPSTREAM.md` tag diff 重放法整合，單一 parent 接 `main`，不帶入上游歷史。`tools/upstream_baseline.json` 水位釘在 `88aaa75`。 |
| 平台精簡 | Windows-only | 2026-10-28 檔案層級移除 105 個 macOS/Linux 專屬檔案（`app/`、`docker/`、安裝腳本、非 Windows CI jobs 與測試）。`tests/ci-workflows/fork-hygiene.test.ts` 防回歸。 |
| 更新路徑 | 隔離上游 release | `src/update/fork-source.mjs` 封閉 registry 路徑（見 `src/update/fork-source.mjs:22`，`selfUpdateAllowed` 只有在測試環境旗標下才是 true），下載改指 `SanHsien/opencodex`，桌面 updater endpoints 為空。 |
| 語系與文字 | en + zh-TW | 僅保留英文與繁體中文，其餘語系剔除；`src/`、`gui/src/`、`scripts/`、`desktop/`、`bin/` 嚴格禁止 Hangul（韓文），僅允許少量逐行 allowlist。 |
| 安全告警 | Dependabot 3 筆 `zip` 已修（本次提交，2026-10-31），關閉狀態以推送後查詢為準；CodeQL 0 | 2026-10-28 曾把 57 筆 CodeQL 與 5 筆 Dependabot 警示逐筆判定（20 筆修正、42 筆 dismiss），Dependabot 自動安全修正維持關閉（`fleet-waiver: security_fixes`）。 |

## 這條線現在有什麼

相對上游穩定版 `v2.93.0` 的維護差異：

| 類別 | 內容 |
|---|---|
| Overlay | [`FORK.md`](FORK.md)、[`NOTICE.md`](NOTICE.md)、[`SKILL.md`](SKILL.md)、[`REVIEW.md`](REVIEW.md)、[`SECURITY.md`](SECURITY.md)、[`AGENTS.md`](AGENTS.md)（開頭 overlay）、[`ROADMAP.md`](ROADMAP.md)、[`docs/fork/`](docs/fork/)、[`tools/`](tools/)、workflow guards、CodeQL、Dependabot（只追 github-actions） |
| 語系 | `README.md` 繁中主檔、`README.en.md` 英文；GUI / docs-site 語系只留 en + zh-TW；Hangul 嚴格檢查護欄 |
| 平台精簡 | 檔案層級移除 macOS／Linux 專用檔案（`app/`、`docker/`、`Dockerfile`、非 Windows 打包安裝腳本、非 Windows CI jobs 與專屬測試）；保留共用 source 內部平台分支 |
| 更新與發布 | `src/update/fork-source.mjs` 封閉 npm 自更新；release 導向 `SanHsien/opencodex`；新增 `fork-release-windows.yml` 於 tag 時建置未簽章 MSI |
| 安全加固 | `readBoundedRegularFile` 單次 open 描述子驗證型別與大小、NTFS dev/ino 比對（bigint）、錯誤訊息 redact 與換行防護 |
| 歷史 | 刻意維持壓縮歷史，與上游無共同祖先；同步一律採 tag diff 重放（單一 parent，不 merge 上游） |

沒有改帳號池語意，沒有回貢，沒有在本 fork 發 npm。

## 上游版本追蹤與整合現況

`tools/upstream_baseline.json` 記錄當前審查水位：
- `integrated_tag`: `v2.93.0`
- `integrated_through`: `88aaa754566d119b6b8fc898f8fb47602387d82e`
- `reviewed_through`: `88aaa754566d119b6b8fc898f8fb47602387d82e`
- `reviewed_date`: `2026-10-28`
- `reviewed_issue_through`: 7860
- `reviewed_pr_through`: 7794

每週一由 `.github/workflows/upstream-check.yml` 排程執行 `tools/check-upstream-updates.ts`，未審查的 commit、未合併關閉的 PR 與 `platform` issue 會自動回報。上游後續釋出更新的 stable tag 時，依 [`docs/fork/UPSTREAM.md`](docs/fork/UPSTREAM.md) 的重放程序整合。

## 刻意不做

依本 repo 治理規則（見 [`FORK.md`](FORK.md) 與 [`ROADMAP.md`](ROADMAP.md)）：

| 不做什麼 | 理由 | 什麼情況下重新考慮 |
|---|---|---|
| 推送、PR 或 issue 到上游 `lidge-jun/opencodex`；在本 fork 發 npm 套件或部署 docs-site | fork-only 維護差異不回貢；日常 PR 只能打 `SanHsien/opencodex`（`FORK.md` 開 PR 的硬規則） | 維護者在當次對話明確同意回貢某個上游 bug 修正 |
| 改寫或接回上游歷史、建立 ancestry bridge、對 fork 做 `git merge upstream/main` | 壓縮歷史是 2026-10-06 維護者確認的決定；與上游沒有共同祖先是已知事實，同步一律用 tag diff（`FORK.md`「分支與 remote」） | 維護者明確撤銷該決定 |
| 恢復 macOS／Linux 專屬檔案與 CI，或為它們維護平台分支以外的支援 | 2026-10-28 起只支援 Windows，檔案層級移除並由 `tests/ci-workflows/fork-hygiene.test.ts` 擋回歸（`FORK.md` 差異表） | 維護者改為需要其他平台 |
| 啟用桌面自動更新、`ocx update` 或指向上游 release 的更新路徑 | fork 沒有 npm 套件，registry 只會回上游版本；MSI 未簽署且 updater `endpoints` 為空（`FORK.md` 差異表） | fork 取得簽章憑證與自己的更新通道 |

## 本輪實證

### 本機（Windows 11，Bun 1.4.4，PowerShell）

```text
pwsh -NoProfile -File tools\dev_check.ps1
==> Fork hygiene tests
bun test v1.4.4 (38afee6c8)
tests\ci-workflows\fork-hygiene.test.ts:
 36 pass
 0 fail
 127 expect() calls
Ran 36 tests across 1 file. [43.52s]
==> Check fork Markdown links
OK   AGENTS.md
OK   AGENTS_INSTALL.md
OK   FORK.md
OK   NOTICE.md
OK   REVIEW.md
OK   SECURITY.md
OK   SKILL.md
OK   docs/fork/DECISIONS.md
OK   docs/fork/DEVELOPMENT.md
OK   docs/fork/UPSTREAM.md

共 10 份文件，0 份有斷掉的相對連結。
WINDOWS DEV CHECK GREEN
```

### GitHub（`SanHsien/opencodex`）現況

- 工作流程：Cross-platform CI、CodeQL、Fork maintenance 最近一次為 success；Upstream check 最近一次為 failure（HEAD `992c49b40`，run 40915907816）。
- 安全告警：Dependabot 3 筆 `zip`（#10 critical、#11 high、#12 medium，2026-10-29T16:53 隨 HEAD 的 push 產生）已修：`tauri-plugin-updater` 關閉 `zip` feature，`desktop/src-tauri/Cargo.lock` 不再含 `zip`（本次提交，2026-10-31）；關閉狀態以推送後 `gh api "repos/SanHsien/opencodex/dependabot/alerts?state=open"` 為準。CodeQL 0 筆（57 筆 CodeQL 與 5 筆 Dependabot 已在 2026-10-28 逐筆完成修復或依據程式碼事實 dismiss）。
- PR 與分支：open PR 0 筆；維護作業直接推送 `origin/main`。

## 下一步

依據 [`ROADMAP.md`](ROADMAP.md)：

1. 整合上游下一個 stable 版（`v2.93.0` 之後）：等上游出現更新的 stable tag，依 [`docs/fork/UPSTREAM.md`](docs/fork/UPSTREAM.md) 重放 overlay 並推進 baseline。
2. 分類 Upstream check 列出的新 PR／issue：當每週一排程檢查出現未審項目時，於 [`docs/fork/UPSTREAM.md`](docs/fork/UPSTREAM.md) 與 [`docs/fork/DECISIONS.md`](docs/fork/DECISIONS.md) 記錄判定並推進水位。
3. 監控與處理新安全告警：若 Dependabot 或 CodeQL 出現新 open 項目，逐筆判定修正或 dismiss。
4. 重新評估 `fork-release-windows.yml` 是否改鎖 Bun 版本（若上游針對 `#7207` 確認 Bun 1.4.4 誤判結論）。

逐項紀錄見 [`docs/fork/UPSTREAM.md`](docs/fork/UPSTREAM.md)、[`docs/fork/DECISIONS.md`](docs/fork/DECISIONS.md)、[`docs/fork/DEVELOPMENT.md`](docs/fork/DEVELOPMENT.md)。
