# 路線圖

> 本 repo 後續工作的單一真相源。做完一項，就在同一個 commit 刪掉那一列；新工作只加在這裡。
> 現況段的數字是 2026-10-29 依 `main` `12c5057c3882` 查的快照，開工前先重查 GitHub。

## 現況

`opencodex` 是 `lidge-jun/opencodex` 的 Windows-only 維護 fork（本機 provider proxy＋ChatGPT／Codex 帳號池），產品基底為上游 `v2.93.0`（`package.json` 為 2.94.0、整合 tag 為 v2.93.0）加 fork overlay（`FORK.md`、`tools/upstream_baseline.json`）。最近 release 是 v2.93.0（2026-10-27）。
健康（歷史快照）：open PR 0、Dependabot 與 code scanning 告警 0，CodeQL、Fork maintenance、Upstream check 曾於 2026-10-29 查為 success；issues 在 GitHub 上已停用，open issue 數是「未查到」，不是 0。2026-11-02 複查 Cross-platform CI：最新 schedule run 41354967821 failure（Windows shard 2、7），shard 9 success；此快照不包含後續修正的 schedule 驗收。與上游「No common ancestor」是 2026-09-27 刻意壓縮歷史的結果，不是缺陷（`FORK.md`「分支與 remote」）。
上游分類（2026-11-03）：15 筆新 closed-unmerged PR 已逐筆判定，PR 水位 8086；無新 platform issue，issue 水位仍為 7860。strict 仍因 209 筆未審 commit exit 1；最新上游 stable 為 v2.96.0，產品整合仍停在 v2.93.0。分類列保留待完整驗收。
獨立整合區段（2026-11-03）：`42549ba1b` 的 Runcrate 目錄資料與英／繁中說明已採用；`f94e95ce5` 的 structural tool turns 判 defer，須補完整 diff 與安全邊界審查。產品整合 tag 與 commit scalar 水位保持原值，整版 stable 驗收尚未達標。
安全告警：2026-10-31 查 Dependabot 0（#10、#11、#12 已由 `f314d92c5` 修復並關閉）。

分類清冊（2026-11-03；fork 基準 `d8b305993`，上游 tag `684ad75d2`）：205 筆僅完成分類盤點；樣板理由已改標「只分類、未審」。reviewed 水位為 `88aaa754`（2026-10-28），產品 integrated 為 v2.93.0；完整 stable 整合與逐筆 fork 證據仍有缺口。

`86b72a689` 的 bigint file identity 已擴展到 86 個 caller、`95cfa30ec` 長路徑修正已採用（2026-11-03，基準 `d8b305993199`）；更廣的 caller 測試與 main 比對後無新增失敗，其餘既有失敗與完整 stable 整合仍待處理，逐案證據見 REVIEW.md 2026-11-03 段。

## 近期：可以直接動手

| 項目 | 為什麼 | 驗收方式 | 建議執行者 | 證據 |
| --- | --- | --- | --- | --- |
| 釐清 bigint identity 對既有持久化值的影響 | `src/lib/file-identity.ts` 的 `identityStats()` 以 `Number(xNs)/1e6` 算 `mtimeMs`，與一般 `statSync().mtimeMs` 的浮點尾數不同；`src/codex/shim-migration.ts` 的 migration journal 存 `mtimeMs`，舊版寫入、新版續做時 `same()` 會判不同而拒絕（fail-closed，只在中斷中的 migration 跨版升級時發生）；`src/routing/history/ingest.ts` 的 `sourceMtimeMs` 會多觸發一次 reindex；持久化 identity 改存十進位字串後，降版會被舊版拒絕 | 決定 journal 比對用同一來源的時間值或容許精度差，加跨版續做的回歸測試；在 docs/fork/DECISIONS.md 記錄降版不相容 | Codex | `src/lib/file-identity.ts`；`src/codex/shim-migration.ts:15,30`；`src/routing/history/ingest.ts:87` |
| 查明夜間 `Cross-platform CI` 的 Windows shard 紅燈 | 已完成本機分類與測試修正：shard 2 的 job 名單過期、shard 7 的故障注入過期；`stall-timeout` 全過；shard 9 是 npm 子程序逾時，後續 schedule 已綠。push 不跑完整 Windows shards，不能作為對照綠燈 | 逐項分類與本機修正已完成；以修正後 schedule 的九個 Windows shards 與 aggregate `ci` success，達標才刪列 | 維護者 | `docs/fork/DECISIONS.md` 2026-11-02 條目；`REVIEW.md` 本機證據；run 41354967821 |
| PR 水位改用 closedAt 或逐筆清單 | `reviewed_pr_through` 是單一數字，上游目前仍 open 的 53 筆 PR（編號 7795–8086）日後若未合併就關閉，永遠不會被列出（`collectUnmergedPullRequests`） | 基準推進時仍 open、之後未合併關閉的 PR 仍會被回報；附回歸測試 | Codex | `tools/check-upstream-updates.ts:239-263` |
| 整合上游下一個 stable 版（`v2.93.0` 之後）：逐筆 fork 審查與重放 | 分類盤點尚缺 fork 檔案:行號與觸發條件，產品基底為 v2.93.0 | 依序處理：① #8019 全域 identity 補審（含 6c86d0fad、51030653f） ② 小而獨立的 `2f7f1d113`、`f4eef7b23` 下一輪可直接採用並先紅後綠 ③ `8eb970d9d` native Messages stream 提前結束誤記 200 ④ `e04aae068`／`ba880dfae`／`007dbfd89` 多帳號 session／device／installation ID 隔離 ⑤ `67bdeb03a` canonical forward 的 safety_identifier 400 ⑥ #7810 fixture `fb22d055e`、#7808 路徑 `07161c5b9` ⑦ ACL memo `c7f3928a2` ⑧ EOF／CR 配套 `d42b9b1b2` ⑨ `f94e95ce5` durable principal／HMAC scope／ingress；每筆完整 diff、fork 證據與聚焦測試，安全邊界逐檔判定；全版 tag diff 與 Windows-only 重放驗收後才推 integrated，逐筆證據完整的連續前綴才推 reviewed | Codex | `docs/fork/UPSTREAM.md` 205 筆分類清冊；`REVIEW.md` 2026-11-03 精度／路徑驗收 |

## 中期：等條件成立再做

| 項目 | 觸發條件 | 驗收方式 | 建議執行者 | 證據 |
| --- | --- | --- | --- | --- |
| 整合上游下一個 stable 版（`v2.93.0` 之後） | 上游出現更新的 stable tag（查：`gh release list --repo lidge-jun/opencodex --limit 5`） | 依 `docs/fork/UPSTREAM.md` 的 tag diff 重放法（單一 parent、不 merge 上游）；先套 Windows-only 刪除清單；`tools/upstream_baseline.json` 的 `integrated_tag`／`integrated_through` 推進；`dev_check.ps1`、`bun test tests/ci-workflows/fork-hygiene.test.ts` 綠；`Upstream check` workflow success；安全邊界檔案逐檔判定寫進 `docs/fork/DECISIONS.md` | Claude Opus | `docs/fork/UPSTREAM.md:1116`（Windows-only 刪除清單）、`:1066`（上次整合紀錄）；`FORK.md` 分支與 remote；從 `15b38cb0e` 接續逐筆判定；另補審 defer 的 `f94e95ce5` 全部 diff、持久 principal／簽章 scope 與 ingress 回歸；完成整個可追溯區段後才推進 scalar 水位 |
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
