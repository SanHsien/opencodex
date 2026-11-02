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
| 安全告警 | Dependabot 0（3 筆 `zip` 已修並關閉：`f314d92c5`，2026-10-31）；CodeQL 0 | 2026-10-28 曾把 57 筆 CodeQL 與 5 筆 Dependabot 警示逐筆判定（20 筆修正、42 筆 dismiss），Dependabot 自動安全修正維持關閉（`fleet-waiver: security_fixes`）。 |

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
- 安全告警：Dependabot 3 筆 `zip`（#10 critical、#11 high、#12 medium，2026-10-29T16:53 隨 HEAD 的 push 產生）已修：`tauri-plugin-updater` 關閉 `zip` feature，`desktop/src-tauri/Cargo.lock` 不再含 `zip`（`f314d92c5`，2026-10-31）；2026-10-31 查 #10、#11、#12 皆為 fixed。CodeQL 0 筆（57 筆 CodeQL 與 5 筆 Dependabot 已在 2026-10-28 逐筆完成修復或依據程式碼事實 dismiss）。
- PR 與分支：open PR 0 筆；維護作業直接推送 `origin/main`。

## 下一步

依據 [`ROADMAP.md`](ROADMAP.md)：

1. 整合上游下一個 stable 版（`v2.93.0` 之後）：等上游出現更新的 stable tag，依 [`docs/fork/UPSTREAM.md`](docs/fork/UPSTREAM.md) 重放 overlay 並推進 baseline。
2. 分類 Upstream check 列出的新 PR／issue：當每週一排程檢查出現未審項目時，於 [`docs/fork/UPSTREAM.md`](docs/fork/UPSTREAM.md) 與 [`docs/fork/DECISIONS.md`](docs/fork/DECISIONS.md) 記錄判定並推進水位。
3. 監控與處理新安全告警：若 Dependabot 或 CodeQL 出現新 open 項目，逐筆判定修正或 dismiss。
4. 重新評估 `fork-release-windows.yml` 是否改鎖 Bun 版本（若上游針對 `#7207` 確認 Bun 1.4.4 誤判結論）。

逐項紀錄見 [`docs/fork/UPSTREAM.md`](docs/fork/UPSTREAM.md)、[`docs/fork/DECISIONS.md`](docs/fork/DECISIONS.md)、[`docs/fork/DEVELOPMENT.md`](docs/fork/DEVELOPMENT.md)。


## 2026-11-02：夜間 Windows CI 本機修正驗證

基準 HEAD：`888f2d075f5fc08a594aa80196025be90a96f7b6`（detached HEAD）；本輪僅修改兩份測試與維護文件，沒有暫存、提交、推送或變更 workflow／產品碼。分類與保留排程的理由見 `docs/fork/DECISIONS.md` 同日條目。最新 schedule [41354967821](https://github.com/SanHsien/opencodex/actions/runs/41354967821) 的 shard 2、7 failure、9 success；尚未包含本機修正，路線圖保留待遠端驗收列。

| 指令 | exit code | 結尾輸出／結果 |
| --- | --- | --- |
| `bun run test -- tests/ci-workflows/ci-bun-crash-classifier.test.ts tests/lib/stall-timeout.test.ts tests/server/codex-agent-role-routes.test.ts`（修正前） | 1 | `26 pass / 1 fail / 1 error`；job 名單 TypeError、`denied = 0`。 |
| `bun run test -- --timeout 60000 tests/ci-workflows/ci-bun-crash-classifier.test.ts tests/lib/stall-timeout.test.ts tests/server/codex-agent-role-routes.test.ts tests/codex-integration/codex-cli-update-plan.test.ts`（修正後） | 0 | `88 pass / 1 skip / 0 fail`，505 expect calls，89 tests across 4 files。 |
| `bun run test -- --timeout 60000 tests/server/codex-agent-role-routes.test.ts`（補上原檔不變斷言後） | 0 | `17 pass / 0 fail`，134 expect calls。 |
| `bun run typecheck` | 0 | `$ bun x tsc --noEmit`，無診斷。 |
| `pwsh -NoProfile -File tools/dev_check.ps1` | 0 | `36 pass / 0 fail`、10 份文件連結零錯誤、`WINDOWS DEV CHECK GREEN`。 |
| `bun run privacy:scan` | 0 | `Privacy scan passed`；回註後的 `REVIEW.md` 另以同一 `scanText` 掃描。 |
| `bun scripts/file-size-ratchet.ts` | 0 | `file-size ratchet passed`。 |

先紅後綠沿用兩個既有失敗案例，不新增鏡像測試。最終修正驗證共同 classifier、不得重試成綠燈、角色寫入失敗的 500／固定錯誤碼／路徑遮蔽與原檔保持不變。npm 子程序使用既有 15s／30s 上限，Bun test timeout 與 CI 同為 60s；未改上限或加重試。一次額外的 npm 單檔診斷未帶 `--timeout`，exit 1、`55 pass / 1 skip / 1 fail`，觸發本機 Bun 預設 5s test timeout，不能把此不同條件當成夜間子程序逾時的根因。

驗證範圍：完整 fork gate 依 `tools/dev_check.ps1` 執行；未執行全部 2622 份 `.test.ts` 產品套件。本輪僅修測試契約，相關四檔已聚焦覆蓋；完整套件採 fresh-process batches、每批最高 600s 與整輪最高 120 分鐘，對兩份測試修正成本不成比例。完整 Windows 九分片覆蓋與修正後 schedule 成功仍留待 CI，不宣稱已通過。

原始本機日誌在 gitignored `.tmp/windows-nightly/`（`baseline.log`、`focused-green.log`、`role-final.log`、`npm-baseline.log`、`dev-check.log`、`typecheck.log`、`privacy.log`）；歷史 Actions 失敗日誌以 run ID 命名保存在同處。

## 2026-11-03：Upstream PR／issue 分類驗收（未完成整列）

基準 HEAD：`91a176f94bb20c3059ba6f870a0d8958b4b11abb`，detached HEAD；開工 `git status --porcelain` 與 `git diff --stat` 皆空，沒有未提交半成品。逐筆判定與 Windows issue 複查已同步寫入 `docs/fork/UPSTREAM.md`、`docs/fork/DECISIONS.md`，PR 水位 7794 → 8086，issue 無新增所以維持 7860。

| 指令 | exit code | 結尾輸出／結果 |
| --- | --- | --- |
| `bun tools/check-upstream-updates.ts --strict --output .tmp/upstream-triage/before.md` | 1 | 209 upstream commits、15 closed-unmerged PR、0 新 platform issue。 |
| `bun tools/check-upstream-updates.ts --strict --output .tmp/upstream-triage/after.md` | 1 | `209 upstream commit(s) require review.`；PR `None since that number.`、issue `No new platform issues since that number.` |
| `pwsh -NoProfile -File tools/dev_check.ps1` | 1 | `35 pass / 1 fail`、127 expect calls；`product code outside the allowlist contains no Hangul` 超過既有 60000ms（77556.77ms），未輸出內容違規；gate 在該步停止。 |
| `bun test tests/ci-workflows/fork-hygiene.test.ts -t 'product code outside the allowlist contains no Hangul'` | 0 | 僅重跑失敗案例：`1 pass / 35 filtered out / 0 fail`，2 expect calls，1.71s。未改 timeout 或測試。 |
| `bun tools/check-links.ts` | 0 | 補跑 gate 尚未執行的連結步驟：10 份文件，0 份有斷掉的相對連結。 |
| `git diff --check` | 0 | 無輸出。 |

完整 fork gate 曾執行但首次逾時，不宣稱原指令 exit 0；其 35 個通過案例不重跑，唯一失敗案例與剩餘連結步驟已補驗通過。本輪只有維護紀錄與 baseline JSON，不是產品 bug 修正，先紅後綠回歸測試不適用；strict 的 1 → 1 也不是 bug 紅綠測試。未跑完整產品套件或 typecheck：沒有 TypeScript、產品行為或測試策略變更；完整產品套件對此分類工作成本不成比例，未將既有歷史結果算作本輪通過。

尚未達到整列驗收：209 筆 commit 未審，不能推進 `reviewed_through` 或把 strict 變綠；`ROADMAP.md` 原列保留。是否另開 commit 審查或 stable 整合工作，由維護者決定。本輪沒有改變原有 strict 失敗規則。

本機原始報告與日誌：gitignored `.tmp/upstream-triage/` 的 `before.md`、`after.md`、`before.log`、`after.log`、`dev-check.log`、`hangul-recheck.log`、`links.log`、`privacy.log`。GitHub PR 本文與留言快照亦留於同處，不納入提交。

隱私補驗：`bun run privacy:scan` exit 0，結尾 `Privacy scan passed`（在 240 秒整輪上限前完成，沒有終止或重跑）。五個修改檔另直接呼叫同一 `scanText`，exit 0、`Changed-file privacy scan: 5 files, 0 findings`；本段回註後僅重驗 `REVIEW.md`。最終對帳驗證 15 筆 PR 在兩份文件皆存在，PR 水位等於本輪最大號碼，commit／產品整合／issue 水位保持原值；exit 0。`git diff --check` 無輸出。無新增產品或測試檔案，沒有需要同步的中英雙語產品頁面；根目錄沒有 `CHANGELOG.md`，本次維護結果記於此處與兩份 fork 紀錄。


## 2026-11-03：#7781 獨立整合區段驗證

基準 HEAD：`f24f0532c23f29332447ce842f893af085a14227`；驗證對象為在此基準套用上游 `dd8bf1d65` 五檔修正，連同英／繁中說明及 fork 判定紀錄的工作樹。產品整合 tag 保持 v2.93.0；#7795 版本開線已具備，判 skip。其餘 207 筆 commit 的計畫只追在 `ROADMAP.md`。

| 指令 | Exit code | 結尾輸出／證據 |
| --- | --- | --- |
| `bun test tests/claude-integration/claude-intercept-acl-barrier.test.ts --test-name-pattern 'settled first-party rollback'`（只套測試、未套產品修正） | 1 | 0 pass、1 fail；`rollbackDesktopFirstPartySettled is not a function`，證明舊產品不具備新合約。 |
| `bun test tests/claude-integration/claude-intercept-acl-barrier.test.ts`（套產品修正後） | 0 | 30 pass、0 fail、173 expect() calls；涵蓋 timeout 不執行回復、unexpected error 繼續拋出與成功回復。 |
| `bun run typecheck` | 0 | `bun x tsc --noEmit`，無型別錯誤。 |
| `bun run structure:check` | 0 | `structure/ SSOT checks passed`。 |
| `pwsh -NoProfile -File tools/dev_check.ps1` | 0 | fork-hygiene 36 pass、0 fail；10 份文件、0 份斷鏈；`WINDOWS DEV CHECK GREEN`。fork-hygiene 的顯示耗時含等待整套測試鎖。 |
| `bun install --frozen-lockfile`、`bun run build`（`docs-site/`） | 0、0 | 147 pages、20705 internal links；`[build] Complete!`。 |
| `bun tools/check-upstream-updates.ts --strict --output .tmp/upstream-review-report.md` | 1 | `209 upstream commit(s) require review.`；沒有新 PR／platform issue。scalar 水位保持，理由見 `docs/fork/UPSTREAM.md` 同日區段。 |
| `bun run test` | 255（人工中止，incomplete） | 前三批 exit 0：298＋262＋398＝958 pass、0 fail，48 檔，共 510.5 秒；第 4 批中止，完整 2622 檔／162 批及串行 lane 並未跑完。結尾為 `error: script "test" exited with code 255`。 |

完整套件採 repo 的資源例外：僅前三批就耗時 510.5 秒，相較五檔獨立修正成本不成比例，故保留已通過批次，採用聚焦回歸與 fork gate。沒有把中止改稱成功，也沒有縮短測試器的 600 秒單批／120 分鐘整體時限。廣域產品測試覆蓋仍有限制，不能據此宣稱 stable 整版驗收完成。

逐檔安全審查：ACL barrier 沒有被繞過；timeout 回傳 false 而不回復，非 timeout 錯誤仍拋出；CLI／management apply 與 native toggle 三個呼叫點保留既有 mode persistence、changed 判斷、權限與 transition 邊界。其餘 fork overlay 未重放。原作者 trailer 由上游 commit 取得並保留在採用程式碼的提交訊息。


## 2026-11-03：Runcrate 獨立整合區段驗證

基準 HEAD：`08346538259d94acab39fa42a6ce55540bac5f62`。採用上游 `42549ba1b`
的目錄資料與獨立測試，補英／繁中說明、structure 合約及 fork 判定紀錄。
`f94e95ce5` 僅完成 scope 與三個身分／membership 模組初讀，判 defer，沒有套用。
完整 stable 整合尚未成立，baseline 各水位保持原值；路線圖保留整版驗收與補審範圍。

| 指令 | Exit code | 結尾輸出／證據 |
| --- | --- | --- |
| `bun test tests/test-layout.test.ts tests/test-layout-tooling.test.ts --timeout=60000`（修改配置前） | 0 | `29 pass / 0 fail`，579 expect calls。 |
| `bun test tests/providers/free-directory-runcrate.test.ts --timeout=60000`（僅加測試、產品修正前） | 1 | `0 pass / 1 fail`；目錄查詢為 undefined，`toMatchObject` 要求 non-null object。 |
| `bun test tests/providers/free-directory-runcrate.test.ts tests/providers/provider-registry-parity.test.ts tests/test-layout.test.ts tests/test-layout-tooling.test.ts --timeout=60000`（產品修正後） | 0 | `94 pass / 0 fail`，3421 expect calls，4 檔。 |
| `bun run typecheck` | 0 | `$ bun x tsc --noEmit`，無型別診斷。 |
| `bun run structure:check`（修正文件後） | 0 | `structure/ SSOT checks passed`。 |
| `bun scripts/file-size-ratchet.ts`（修正文件後） | 0 | `file-size ratchet passed`。 |
| `pwsh -NoProfile -File tools/dev_check.ps1` | 0 | `36 pass / 0 fail`，10 份文件零斷鏈，`WINDOWS DEV CHECK GREEN`；605.74s 含等待完整套件的 user lock。 |
| `bun install --frozen-lockfile`、`bun run build`（`docs-site/`） | 0、0 | 371 installs／484 packages，no changes；最終建置 147 pages、20711 internal links，`[build] Complete!`。 |
| `bun run privacy:scan` | 0 | `Privacy scan passed`；回註與新檔另外以相同 `scanText` 覆蓋。 |
| `bun tools/check-upstream-updates.ts --strict --output .tmp/stable-runcrate/upstream.md` | 1 | `209 upstream commit(s) require review.`；無新 closed-unmerged PR／platform issue。不將兩筆獨立判定當成 scalar 已推進。 |
| `bun run test -- --timeout=60000`，`OCX_TEST_FULL_SUITE_TIMEOUT_SECONDS=600` | 124（incomplete） | 2623 檔／163 fresh-process batches；前三批 exit 0，298＋262＋398＝958 pass、0 fail、48 檔，耗時 137.3＋41.5＋284.2＝463.0s。第 4 批使用剩餘 136s 後逾時，`no retry because the full-suite deadline is exhausted`，`error: script "test" exited with code 124`。 |

完整產品套件採 repo 的資源例外：此變更只有一份目錄資料來源，過往相同完整套件前三批
已耗 510.5 秒；為此獨立區段預先設定具名 600 秒整體資源預算，單批設定仍為 600 秒，
每個 test timeout 為 60000ms，最後一批受剩餘整體預算約束。這不是 assertion failure，
也不是完整通過；保留前三批證據，不重跑。聚焦測試已覆蓋新目錄、canonical registry
隔離及 layout 登錄；其餘完整產品套件與 stable 整版驗收沒有由此取得通過證據。

實作時兩項文件檢查曾為紅：structure 初稿 606 行超過 600 行，且引用 index 尚未收錄的新測試；
改為既有責任表的一列，600 行並移除該引用。file-size 初稿英文 providers 頁 2006 行，
縮至 2000 行仍被門檻拒絕，最終將相同段落整理為 1999 行通過；未提高任何 baseline。
文件建置在最後排版固定後重新執行。新測試驗日期格式而非硬編快照日期，沒有套件版本斷言。
沒有根目錄 `CHANGELOG.md`，維護結果記錄於此與 fork 判定文件。

原始日誌：gitignored `.tmp/stable-runcrate/`（`layout-before.log`、`red.log`、`green.log`、
`typecheck.log`、`structure-final.log`、`ratchet-final.log`、`dev-check.log`、`docs-install.log`、
`docs-build-settled.log`、`privacy.log`、`upstream.log`、`full.log`）；最終工作樹與新檔 hash
清冊為同目錄的 `evidence.json`。上游作者與共同作者 trailer 保留在採用提交訊息。
