# 路線圖

> 本 repo 後續工作的單一真相源。做完一項，就在同一個 commit 刪掉那一列；新工作只加在這裡。
> 現況段的數字是 2026-10-29 依 `main` `12c5057c3882` 查的快照，開工前先重查 GitHub。

## 現況

`opencodex` 是 `lidge-jun/opencodex` 的 Windows-only 維護 fork（本機 provider proxy＋ChatGPT／Codex 帳號池），產品基底為上游 `v2.93.0`（`package.json` 為 2.94.0、整合 tag 為 v2.93.0）加 fork overlay（`FORK.md`、`tools/upstream_baseline.json`）。最近 release 是 v2.93.0（2026-10-27）。
健康：open PR 0、Dependabot 與 code scanning 告警 0，`main` 上 Cross-platform CI、CodeQL、Fork maintenance、Upstream check 最近一次皆 success（2026-10-29 `gh` 查詢）；issues 在 GitHub 上已停用，open issue 數是「未查到」，不是 0。與上游「No common ancestor」是 2026-09-27 刻意壓縮歷史的結果，不是缺陷（`FORK.md`「分支與 remote」）。
安全告警：2026-10-31 查 Dependabot 0（#10、#11、#12 已由 `f314d92c5` 修復並關閉）。

## 近期：可以直接動手

| 項目 | 為什麼 | 驗收方式 | 建議執行者 | 證據 |
| --- | --- | --- | --- | --- |
| 查明夜間 `Cross-platform CI` 的 Windows shard 紅燈 | 2026-10-29、10-30 兩晚 schedule 都紅（run 40968258056、41137391838），同 commit 的 push 是綠的；失敗含 `tests/ci-workflows/ci-bun-crash-classifier.test.ts`、`tests/lib/stall-timeout.test.ts`（shard 2、7、9） | 逐項分清是環境或真缺陷；修掉或寫明理由；下一次 schedule 的 `Cross-platform CI` success | Antigravity | `gh run view 41137391838 -R SanHsien/opencodex --log-failed` |

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
