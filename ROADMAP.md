# 路線圖

> 本 repo 後續工作的單一真相源。做完一項，就在同一個 commit 刪掉那一列；新工作只加在這裡。
> 現況段的數字是 2026-10-29 依 `main` `12c5057c3882` 查的快照，開工前先重查 GitHub。

## 現況

`opencodex` 是 `lidge-jun/opencodex` 的 Windows-only 維護 fork（本機 provider proxy＋ChatGPT／Codex 帳號池），產品基底為上游 `v2.93.0`（`package.json` 為 2.94.0、整合 tag 為 v2.93.0）加 fork overlay（`FORK.md`、`tools/upstream_baseline.json`）。最近 release 是 v2.93.0（2026-10-27）。
健康：open PR 0、Dependabot 與 code scanning 告警 0，`main` 上 Cross-platform CI、CodeQL、Fork maintenance、Upstream check 最近一次皆 success（2026-10-29 `gh` 查詢）；issues 在 GitHub 上已停用，open issue 數是「未查到」，不是 0。與上游「No common ancestor」是 2026-09-27 刻意壓縮歷史的結果，不是缺陷（`FORK.md`「分支與 remote」）。
安全告警在快照時兩類都是 0，之後可能變動，開工前先重查（見下方「新安全告警」那一列的查法）。上游 2026-10-28T16:37Z 仍有 push，快照之後是否出現未審項目「未查到」，以 `bun tools/check-upstream-updates.ts --strict` 為準。

## 近期：可以直接動手

| 項目 | 為什麼 | 驗收方式 | 建議執行者 | 證據 |
| --- | --- | --- | --- | --- |
| 改寫 `REVIEW.md` 為現況版本 | 現行內容停在 2026-08-27（fork HEAD `8d23124cb`、產品版本 2.31.0、「不要把目前 main 當成已跟上游發版線」），與現況差了 60 多個上游版本，還列出已不存在的 `CLAUDE.md`；接手的人讀到會判斷錯誤 | `REVIEW.md` 的日期、HEAD、產品版本、上游基底與 `tools/upstream_baseline.json`、`package.json` 一致；`pwsh -NoProfile -File tools\dev_check.ps1` 綠；文件連結檢查（`bun tools/check-links.ts`）0 斷鏈 | Claude Sonnet | `REVIEW.md:1-8,34`；`tools/upstream_baseline.json`；`FORK.md` 差異表 |
| 夜間排程解析 `dev` 失敗時不再吞掉 `gh` 的錯誤訊息 | `gh api …/commits/dev` 的 stderr 被丟進 `/dev/null`，網路或權限失敗與「沒有 dev 分支」看起來一樣，會默默改測 main | 非 404 的 `gh` 失敗在日誌印出原錯誤並讓該步驟失敗；404 時仍輸出 `::notice::` 並改測 `GITHUB_SHA`；`bun test tests/ci-workflows/fork-hygiene.test.ts` 與 `ci.yml` 相關測試綠 | Claude Sonnet | `.github/workflows/ci.yml:421`；`docs/fork/DECISIONS.md:631`（決定四）；審查 nit 見接續開發報告（2026-10-2x） |
| 上游檢查器的「PR 清單被截斷」錯誤訊息改精確並補單元測試 | 目前以 `--limit 1000` 查，被截斷時回「未檢查」但訊息文字不精確、沒有單元測試保護；這條護欄擋過 206 筆被當成已審的事故 | 新增測試：清單剛好一整頁且最舊一筆仍新於水位時回 `undefined`，訊息指出是截斷；`bun test` 該檔綠 | Claude Sonnet | `tools/check-upstream-updates.ts:181,196-225`；`docs/fork/DECISIONS.md:616`（決定二）；`tests/ci-workflows/fork-hygiene.test.ts` |
| 繁中 `combos.md` 的 `ocx combo set` 旗標清單補齊與英文頁一致 | 審查員指出 zh-tw 版缺 3 個旗標；zh-TW 是本 fork 兩個保留語系之一 | 英文頁與 `docs-site/src/content/docs/zh-tw/guides/combos.md` 的 `ocx combo set` 旗標逐項對照相同；`docs-zh-tw-parity` 相關測試綠 | Claude Haiku | `docs-site/src/content/docs/zh-tw/guides/combos.md`；接續開發報告（2026-10-2x）審查 nit |

## 中期：等條件成立再做

| 項目 | 觸發條件 | 驗收方式 | 建議執行者 | 證據 |
| --- | --- | --- | --- | --- |
| 整合上游下一個 stable 版（`v2.93.0` 之後） | 上游出現更新的 stable tag（查：`gh release list --repo lidge-jun/opencodex --limit 5`） | 依 `docs/fork/UPSTREAM.md` 的 tag diff 重放法（單一 parent、不 merge 上游）；先套 Windows-only 刪除清單；`tools/upstream_baseline.json` 的 `integrated_tag`／`integrated_through` 推進；`dev_check.ps1`、`bun test tests/ci-workflows/fork-hygiene.test.ts` 綠；`Upstream check` workflow success；安全邊界檔案逐檔判定寫進 `docs/fork/DECISIONS.md` | Claude Opus | `docs/fork/UPSTREAM.md:1116`（Windows-only 刪除清單）、`:1066`（上次整合紀錄）；`FORK.md` 分支與 remote |
| 分類 Upstream check 列出的新 PR／issue | `Upstream check` workflow（`.github/workflows/upstream-check.yml`）轉 failure；failure 代表上游有未審項目，不是工具壞 | 每筆在 `docs/fork/UPSTREAM.md` 與 `DECISIONS.md` 記判定與理由；`reviewed_pr_through`／`reviewed_issue_through` 推進；`bun tools/check-upstream-updates.ts --strict` exit 0。順便複查 Windows 相關上游 issue（`#7771`、`#7808`、`#7810`）是否已有上游修正 | Claude Sonnet | `docs/fork/UPSTREAM.md:1077,1108`；`tools/upstream_baseline.json` |
| 處理新出現的安全告警 | 查詢出現 open 項目：`gh api "repos/SanHsien/opencodex/dependabot/alerts?state=open"`、`gh api "repos/SanHsien/opencodex/code-scanning/alerts?state=open"` | 逐筆修正或附可在程式碼驗證的理由 dismiss，不批量關閉；對照 `docs/fork/DECISIONS.md` 2026-10-28 條目（CodeQL 對「lstat→open→fstat 身分比對」寫法的重複標記已判 false positive）；兩個查詢 state=open 皆無輸出；Cargo.lock 項目由維護者逐筆確認 | Claude Opus | `docs/fork/DECISIONS.md:702-710`；`.github/dependabot.yml` 的 `fleet-waiver: security_fixes` 註解 |
| 重新評估 `fork-release-windows.yml` 是否改鎖 Bun 版本 | 上游對 `#7207`（防毒誤判 bun）得出「Bun 1.4.4 本身被誤判」的結論 | 在 `docs/fork/DECISIONS.md` 新增決定；若改鎖，`fork-release-windows.yml` 以該版 Bun 在 Windows 建出 MSI 並通過 `dev_check.ps1` | Claude Opus | `docs/fork/DECISIONS.md:629`（決定三）；`.github/workflows/fork-release-windows.yml` |
| 停用夜間排程 | 夜間 `Cross-platform CI` 改測 main 之後仍連續紅燈，且失敗原因與本 fork 無關（`docs/fork/DECISIONS.md` 決定四已記此觸發條件） | `ci.yml` 的 `schedule` 在本 fork 不再執行；`DECISIONS.md` 記停用理由與重新啟用條件；下一輪 Actions 沒有新的 schedule 紅燈 | Claude Sonnet | `docs/fork/DECISIONS.md:631`；`.github/workflows/ci.yml:415-430` |

## 刻意不做

| 不做什麼 | 理由 | 什麼情況下重新考慮 |
| --- | --- | --- |
| 推送、PR 或 issue 到上游 `lidge-jun/opencodex`；在本 fork 發 npm 套件或部署 docs-site | fork-only 維護差異不回貢；日常 PR 只能打 `SanHsien/opencodex`（`FORK.md` 開 PR 的硬規則） | 維護者在當次對話明確同意回貢某個上游 bug 修正 |
| 改寫或接回上游歷史、建立 ancestry bridge、對 fork 做 `git merge upstream/main` | 壓縮歷史是 2026-10-06 維護者確認的決定；與上游沒有共同祖先是已知事實，同步一律用 tag diff（`FORK.md`「分支與 remote」） | 維護者明確撤銷該決定 |
| 恢復 macOS／Linux 專屬檔案與 CI，或為它們維護平台分支以外的支援 | 2026-10-28 起只支援 Windows，檔案層級移除並由 `tests/ci-workflows/fork-hygiene.test.ts` 擋回歸（`FORK.md` 差異表） | 維護者改為需要其他平台 |
| 啟用桌面自動更新、`ocx update` 或指向上游 release 的更新路徑 | fork 沒有 npm 套件，registry 只會回上游版本；MSI 未簽署且 updater `endpoints` 為空（`FORK.md` 差異表） | fork 取得簽章憑證與自己的更新通道 |

## 維護方式

fork：直接推 `main`，不開分支與 PR（`FORK.md`）。上游每週一由 `Upstream check` 檢查，紅燈就走上面的分類或整合；整合只在上游出新 stable 時做一次，不跟 dev／preview。Dependabot 只追蹤 workflow 的 actions pin，安全告警逐筆處理。
