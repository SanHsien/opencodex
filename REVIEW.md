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

2026-11-03 複查（fork 基準 `13e0f0e453fb`）：strict exit 1，明列 209 筆待審 commit、2 筆待審 PR（#7614、#7618）、0 筆新 platform issue；PR 軸完整檢查，沒有撞上限。上游審查尚未完成，不能把本機 fork gate 綠燈視為 strict 綠燈。

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
- `integrated_tag`: `v2.98.0`
- `integrated_through`: `36aa9e8f7933807dc2c873bb93051c7c9c00f4e6`
- `reviewed_through`: `36aa9e8f7933807dc2c873bb93051c7c9c00f4e6`
- `reviewed_date`: `2026-11-08`（依據 Windows 全量 CI run 42424520793）
- `reviewed_issue_through`: 8320（#8317、#8318、#8320 已判定，見 UPSTREAM.md 2026-11-08 issue 軸）
- `reviewed_pr_through`: 8086
- `reviewed_pr_closed_before`: `2026-10-28`（UTC）
- `reviewed_pr_numbers`: 17 筆有逐筆判定的 PR

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
`f94e95ce5` 僅完成 scope 與三個身分／membership 模組初讀，判 defer，沒有套用。（2026-11-05 更新：已完整審查並重放，見 `docs/fork/UPSTREAM.md` 同日節。）
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

## 2026-11-03：分類水位更正與 Windows identity／long-TEMP 驗收

基準 `d8b305993199c8e86670525d686764d6126776a7`。reviewed commit/date 恢復為
`88aaa754566d119b6b8fc898f8fb47602387d82e`／2026-10-28；integrated、PR、issue 水位不變。
107 筆樣板理由先撤銷審查狀態；其中 docs hint 改 skip，三筆已知分類錯誤更正。
205 筆清冊的 SHA 以 `git log --reverse --topo-order --format=%H v2.93.0..v2.96.0`
扣除既有四筆後，比對表格每列第一欄：順序完全相同、無重複、無缺漏；
初次精度／路徑驗收快照的狀態為 skip 42、defer 55、只分類未審 106、adopt 1、部分採用 1（2026-11-04 已改判，見文末同日段）。分類不等於已審查。

紅綠回歸：

- `bun test tests/claude-integration/claude-intercept-proxy-auth.test.ts tests/codex-integration/history-ocx-compaction-long-path.test.ts --timeout=60000`：修正前 exit 1，`18 pass / 2 skip / 1 fail`；將 lstat/fstat 的 ino 注入 2^53 與 2^53+1，舊碼錯誤讀出替換後 credential，預期 null。
- `bun test tests/codex-integration/history-ocx-compaction-long-path.test.ts --timeout=60000`：修正前 exit 1，`0 pass / 1 fail`；路徑超過 260 字元時，傳給 ACL 的參數缺少 namespace prefix。此環境的實體長路徑可成功，故另釘住 ACL 參數，同時實際驗證備份原文及修復後內容。
- `bun test tests/lib/file-identity.test.ts tests/lib/file-identity-callers.test.ts tests/claude-integration/claude-intercept-proxy-auth.test.ts tests/codex-integration/history-ocx-compaction-long-path.test.ts --timeout=60000`：修正後 exit 0，`34 pass / 2 skip / 0 fail`，100 expect calls。共用 helper 的新增大 ID 單元案例再由下方九檔集合驗證。

| 指令 | Exit code | 結尾輸出／範圍 |
| --- | --- | --- |
| `pwsh -NoProfile -File tools/dev_check.ps1` | 0 | `36 pass / 0 fail`、127 expect calls；10 份文件零斷鏈；`WINDOWS DEV CHECK GREEN`。 |
| `bun run typecheck` | 0 | `$ bun x tsc --noEmit`，無診斷。 |
| `bun test tests/config/config-mutation-lock.test.ts tests/codex-integration/codex-catalog-write-audit.test.ts tests/service/service-ownership-state.test.ts tests/lib/bounded-file-read.test.ts tests/codex-integration/history-ocx-compaction-recovery.test.ts tests/test-layout.test.ts tests/test-layout-tooling.test.ts --timeout=60000` | 1 | `162 pass / 4 skip / 2 fail`，1088 expect calls。catalog 實體 symlink 建立遇 Windows EPERM；另 ACL mock 未傳 bigint 選項，後者已修正並聚焦補驗。 |
| `bun test tests/codex-integration/codex-catalog-write-audit.test.ts -t 'Windows audit privacy' --timeout=60000` | 0 | `8 pass / 31 filtered out / 0 fail`，60 expect calls；包含修正後的 ACL ctime 轉換案例。EPERM 案例不在此範圍，仍是未通過。 |
| `bun test tests/lib/file-identity.test.ts tests/config/config-mutation-lock.test.ts tests/providers/command-code-project-context.test.ts tests/clients/desktop-remote-store.test.ts tests/clients/hermes-profiles.test.ts tests/clients/hermes-profile-routes.test.ts tests/oauth/oauth-store-multi.test.ts tests/oauth/oauth-refresh-generic-lock.test.ts tests/oauth/oauth-refresh-lock-multiprocess.test.ts --timeout=60000` | 0 | `199 pass / 5 skip / 0 fail`，1258 expect calls，112.90s。 |
| `bun run test:changed --timeout=60000` | 1 | `git merge-base failed while validating changed mode: exit 1`；壓縮 fork 與 dev 無共同祖先，沒有假裝選測成功。 |
| `bun run structure:check` | 0 | `structure/ SSOT checks passed`。 |
| `bun scripts/file-size-ratchet.ts` | 0 | `file-size ratchet passed`。 |
| `bun tools/check-upstream-updates.ts --strict` | 1 | `209 upstream commit(s) require review.`；無新 closed-unmerged PR 或 platform issue。scalar 不因分類完成而前移。 |

安全邊界自審：bigint 直接來自 stat options，不從 Number 放大；POSIX mode／uid、bounded read、exclusive publication、已持有 descriptor 與釋放前的再次身分檢查保持。long-TEMP 只轉換 ACL 參數，原 memo key 與備份／digest／atomic rename 不變。

初次驗收快照中，`86b72a689` 是部分採用：`rg -n '\.ino\b|\.dev\b|lstatSync|fstatSync' src` 仍能找到
Codex／workspace／CLI／Lab 等需要逐點確認的數值 identity 觀察，包含上游後續 `6c86d0fad`／`51030653f` 範圍（2026-11-04 已補審，見文末同日段）。
不能把指定三個憑證點與上游初始 patch 的修正稱作全 repo identity 驗收完成。
`95cfa30ec` 已採用並有紅綠證據；全版 stable 整合計畫保留，沒有推進 integrated 水位。
完整產品套件未跑：此驗收採聚焦集合，包含 OAuth 跨進程鎖與文件/layout gates；不能把它們稱為完整產品回歸通過。
沒有根目錄 CHANGELOG.md；結果記於此段與 DECISIONS，計畫只記 ROADMAP。

## 2026-11-03：全域 file identity

基準 HEAD：`d8b305993199c8e86670525d686764d6126776a7`。`86b72a689` 的 bigint identity 實作擴展至全部 86 個 caller，全域驗收未完成；未新增採用其他上游 commit，integrated／reviewed／PR／issue 水位保持。

所有 runtime TypeScript identity owner 使用共用 file-identity helper；下表逐一列出基準的 ino／dev 點與實作行號。raw grep 的 provider URL、註解及字串中的 .dev 網域不是 filesystem identity；零 inode 檢查是有效性檢查，不是兩檔相等判定。caller guard 對每個 owner 獨立驗證 helper、numeric metadata 例外清單與新增漏列 caller；Node-only 邊界的 bigint acquisition 另受 guard／專用測試約束。

| Caller | HEAD ino／dev 點（行） | 實作點（行） | 處理結果 |
| --- | --- | --- | --- |
| `src/adapters/codebuddy/mcp-server.ts` | 71, 72 | 72 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/adapters/command-code-project-context.ts` | 195, 201 | 196, 202 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/claude/desktop-3p-library.ts` | 65, 94 | 66, 95 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/claude/desktop-remote-store-io.ts` | 11 | 12 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/claude/intercept/local-ca-files.ts` | 36, 82, 139, 173, 181, 190, 231 | 37, 83, 140, 174, 182, 191, 232 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/claude/intercept/picker-ca-persistence.ts` | 35 | 36 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/claude/intercept/proxy-auth.ts` | 33, 52 | 34, 53 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/cli/update-restart-child.ts` | 26 | 27 | 僅驗證舊協定 numeric metadata 格式；exact fileId 由 update-restart-home 的共用 helper 產生並驗證 |
| `src/cli/update-restart-home.ts` | 29 | 31 | bigint 觀察→fileIdentityKey；Number(dev／ino) 僅保留協定 metadata，不用於授權相等判定 |
| `src/cli/update-restart-service-record.ts` | 23, 74 | 24, 75 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/client/link-tunnel.ts` | 505 | 505, 506 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/client/state.ts` | 47 | 48 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/clients/aside-profiles.ts` | 118, 161 | 119, 162 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/clients/gentle-shell-path.ts` | 53 | 54 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/clients/omo-role-models.ts` | 66 | 67 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/account-store.ts` | 824, 831, 833 | 825, 832, 834 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/catalog/filesystem-evidence.ts` | 63, 201, 224 | 64, 65, 203, 204, 223, 227 | bigint 觀察→storedFileIdentity；volume/fileId、device/inode 既有 evidence schema 維持 decimal string |
| `src/codex/catalog/heal-observation.ts` | 25, 144, 146, 178 | 26, 145, 147, 179 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/catalog/write-audit.ts` | 50, 138 | 51, 139 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/cli-install-provenance.ts` | 522, 525, 526, 547, 548, 552, 553, 816, 827, 877, 881, 882 | 508, 519, 522, 525, 526, 547, 551, 552, 815, 826, 847, 873, 874, 875, 876, 880, 881 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/codex-home-owner.ts` | 63, 72 | 64, 73 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/config-write-lock.ts` | 75, 112, 184, 185, 360 | 76, 113, 185, 186, 361 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/context-compat.ts` | 47 | 47, 48 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/coordinator-doctor.ts` | 69, 70, 77 | 69, 76, 88, 117 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/desktop-compatibility/native-identity.ts` | 13 | 14 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/features.ts` | 1164 | 1164, 1165 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/history-provider.ts` | 299, 386, 746 | 218, 299, 300, 384, 386, 387, 664, 746, 747, 1185, 1237 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/inject/bounded-config-reader.ts` | 41, 59 | 25, 41, 42, 55, 56, 60 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/log-guard/inspect.ts` | 142, 143 | 90, 98, 144 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/log-guard/maintenance.ts` | 139, 142, 159, 160 | 140, 143, 160 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/main-account.ts` | 177, 286, 287 | 177, 178, 287 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/native-main-auth-temp.ts` | 54, 68, 79 | 55, 69, 80 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/native-main-claim.ts` | 91 | 92 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/native-main-lock-file.ts` | 45, 46, 71, 95, 96 | 45, 46, 71, 87, 91, 95, 96, 114 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/native-profile-manager.ts` | 165, 169, 728, 729, 741 | 166, 170, 729, 741 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/native-profile-stage-store.ts` | 85, 89, 105, 106, 234, 255, 264, 275, 301, 302, 323, 324 | 86, 90, 106, 234, 255, 264, 275, 301, 302, 323, 324 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/native-profile-store.ts` | 398, 399 | 399 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/native-residue.ts` | 102, 103 | 103, 111, 127, 149, 449, 500, 504, 594 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/orca-auth-source.ts` | 33, 48 | 19, 29, 33, 34, 48, 49 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/prompt-lock-claim.ts` | 57 | 58 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/prompt-lock-evidence.ts` | 10 | 11 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/shim-fingerprint.ts` | 54, 55, 71, 72 | 41, 52, 55, 56, 72, 169 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/shim-inspect.ts` | 114, 154 | 115, 155 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/shim-migration.ts` | 21, 35, 102 | 20, 22, 30, 35, 36, 71, 98, 101, 103 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/shim-overlay.ts` | 45, 49, 78, 239 | 45, 49, 52, 71, 78, 98, 111, 215, 340 | 共用 helper 比對／decimal string 保存；APFS 持久 ownership 保留只比 inode 的原合約 |
| `src/codex/shim-restore-lock.ts` | 46 | 51, 67, 68, 82, 126, 128, 138, 151 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/shim-state-file.ts` | 66 | 委由 home 驗證 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/shim-windows-refresh.ts` | 22, 32, 39, 61, 79 | 23, 33, 40, 62, 80 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/shim.ts` | 391, 414, 433 | 192, 215, 308, 386, 392, 415, 434, 595 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/codex/transition-state.ts` | 531, 551 | 465, 517, 520, 528, 532, 550, 552 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/config/atomic-write.ts` | 139 | 105, 137, 138, 140 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/config/initialize.ts` | 50 | 51 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/integrations/aside-profile-context.ts` | 80 | 81 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/integrations/droid-settings.ts` | 42 | 43 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/integrations/hermes-profiles.ts` | 151 | 152 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/lab/artifacts/secure-fs.ts` | 99, 163, 164 | 99, 157, 159, 163, 204, 227, 282, 319, 362, 463 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/lab/fabric/scratch.ts` | 53 | 53, 76, 96, 101, 118, 152, 221, 234, 250, 264, 342, 349, 392, 427 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/lab/public/community.ts` | 415 | 415, 416 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/lab/public/file-safety.ts` | 55, 56, 82, 83, 114, 115 | 42, 52, 56, 78, 82, 97, 100, 109, 113 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/lab/public/mutation-lock.ts` | 123, 128 | 110, 124, 129, 214 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/lab/public/private-file.ts` | 171 | 102, 156, 170, 172 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/lib/bounded-file-read.ts` | 148, 154, 172 | 124, 149, 155, 173 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/lib/bun-runtime-preflight.ts` | 49 | 50 | 父程序使用共用 helper；無模組的 probe child 以原生 bigint 再驗 directory，不引入 loader 依賴 |
| `src/lib/gui-pair-intent.ts` | 23, 103, 134, 147, 155 | 24, 104, 135, 148, 156 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/lib/package-tree-integrity.ts` | 107, 108 | 108, 109, 135 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/lib/service-secrets.ts` | 108, 303 | 109, 304 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/lib/spend-pool-alias-validation.ts` | 15 | 16 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/lib/windows-secret-acl.ts` | 161, 174, 175 | 162, 175, 176 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/link/diagnostics.ts` | 108, 128 | 109, 129 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/messaging/remote-files.ts` | 138 | 33, 39, 47, 56, 98, 135, 138, 139 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/oauth/store.ts` | 435, 436, 437, 521 | 436, 437, 438, 522 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/remote-control/workspace-command-runner.ts` | 179 | 165, 178, 180, 193, 199, 243, 317, 356, 371, 379, 389 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/remote-control/workspace-executor.ts` | 179, 222, 263, 264 | 129, 174, 175, 180, 220, 223, 257, 260, 264, 265, 307, 382 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/routing/history/indexer.ts` | 208, 209 | 209 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/routing/history/ingest.ts` | 37, 82, 83, 199 | 38, 83, 84, 200 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/server/live.ts` | 143, 150, 151, 154 | 144, 151, 152, 155 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/server/restart-replacement.ts` | 130 | 131 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/service/desktop-startup.ts` | 73 | 74 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/service/logging.ts` | 12, 21, 40 | 13, 22, 41 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/service/ownership-mutation-lease.mjs` | 85, 96, 97, 99 | 86, 97, 98, 100 | 保留原生 bigint 比對：獨立 Node launcher／updater／lease 不依賴 TypeScript loader；所有 identity stat 明訂 bigint |
| `src/service/state-lock.ts` | 80, 117 | 81, 118 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/update/pnpm-read-policy.mjs` | 24 | 25 | 保留原生 bigint 比對：獨立 Node launcher／updater／lease 不依賴 TypeScript loader；所有 identity stat 明訂 bigint |
| `src/update/transactional-install.mjs` | 220 | 221 | 保留原生 bigint 比對：獨立 Node launcher／updater／lease 不依賴 TypeScript loader；所有 identity stat 明訂 bigint |
| `src/usage/ledger-retention.ts` | 131 | 132 | sameFileIdentity 同時檢查 dev 與 ino；size 仍為 numeric metadata |
| `src/usage/log.ts` | 1379, 1398, 1399, 1410 | 1380, 1381, 1400, 1411 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |
| `src/usage/user-cost-overlay-reconciler.ts` | 50, 229 | 46, 51 | bigint 觀察／共用 helper 比對或 fingerprint；數值 mode／size／time 僅為 metadata |

Windows catalog file symlink 的能力探測僅將 win32 EPERM 判為無權限，並用 skipIf 標記需要權限的案例。junction、hardlink 與不需 file symlink 的案例仍執行；其他建立錯誤拋出，不更動產品語意。

### 本機驗收快照（2026-11-03；基準 d8b305993199）

| 指令 | Exit code | 結尾輸出／範圍 |
| --- | --- | --- |
| `pwsh -NoProfile -File tools/dev_check.ps1` | 0 | WINDOWS DEV CHECK GREEN |
| `bun run typecheck` | 0 | $ bun x tsc --noEmit |
| `bun run privacy:scan` | 0 | Privacy scan passed |
| `bun run structure:check` | 0 | structure/ SSOT checks passed |
| `bun scripts/file-size-ratchet.ts` | 0 | file-size ratchet passed |
| `bun test tests/lib/file-identity.test.ts tests/lib/file-identity-callers.test.ts tests/codex-integration/codex-catalog-write-audit.test.ts tests/codex-integration/codex-filesystem-evidence.test.ts tests/codex-integration/codex-log-guard-inspect.test.ts tests/codex-integration/codex-log-guard-maintenance.test.ts --timeout=60000` | 0 | 185 pass / 1 skip / 0 fail；761 expect calls，6 files。 |
| `bun test tests/lib/file-identity-callers.test.ts --timeout=60000` | 0 | 105 pass / 0 fail；382 expect calls。 |
| `bun run test:changed --timeout=60000` | 1 | git merge-base failed while validating changed mode: exit 1；壓縮 fork 無共同祖先。 |

Catalog path／self-heal／reanchor／scheduler 集合：修正前 147 pass / 2 skip / 23 fail，均在實體 file symlink 建立遇 EPERM；能力探測後與 helper 集合共同驗證 exit 0（166 pass / 26 skip / 0 fail）。Windows 無權限的 skip 有明確能力條件；未變更產品 path 判定。

Workspace 大 ID 行為回歸：使用 HEAD 原始 workspace executor 的 scratch 對照，以基準 executor 重放 `tests/lib/file-identity.test.ts` 的 `workspace rejects` 案例，exit 1，實際錯誤接受替換後 root（ok=true）；`bun test tests/lib/file-identity.test.ts --timeout=60000` exit 0，5 pass / 0 fail。保存身分欄位的 primitive shape 斷言亦有先紅後綠（assertion exit 1 → 0），拒絕 coercion，同時接受精確 decimal string 與安全 legacy integer。

全域驗收未達標：更廣的 caller 消費端測試包含 coordinator/history 的 unsafe-path、既有非 catalog file symlink EPERM、以及 POSIX fixture／Windows shim 案例失敗。coordinator 的單一對照案例以 HEAD 原始 doctor 實作執行仍 exit 1：預期 zero-byte、實際 unsafe，reason 為 the coordinator path is redirected；本次 bigint 修改不是該案例的必要條件。6 個已結束的擴大批次均 exit 1，沒有以 timeout 或中止批次作通過證據。完整產品套件與其餘受影響測試沒有通過證據，故保留 ROADMAP 全域驗收與 stable 整合計畫，86b72a689 仍列部分採用（2026-11-04 已改判，見文末同日段）。

範圍維持全域 exact identity 與 catalog symlink 權限處理；其他 client/CLI 的測試 skip 擴充已撤回，未擴大產品修復。安全邊界自審保留 bounded descriptor read、exclusive publication、POSIX ownership/mode、ACL 與 mutation lock 的既有條件；JSON 身分保存使用 decimal string。

### 指定七個退化的驗收（2026-11-03；基準 d8b305993199）

保留既有 86 個 caller 的 identity 實作；沒有採用其他上游 commit 或推進水位。此區段直接保存驗收摘要，不依賴忽略目錄的報告連結。

| 退化案例 | 根因與修正 |
| --- | --- |
| temporary ACL acl | 目錄替身缺 dev／ino／nanosecond 時間，identityStats 拒收；改以真實 bigint stat 為底，保留模擬 ownership／mode。 |
| temporary ACL error | 同一目錄替身缺欄位；lstat／fstat 亦丟掉 bigint options，改為完整傳遞。 |
| temporary ACL timeout | 同上；修正後仍驗 descriptor 關閉、暫存清除、零 write／sync／rename 與舊檔保留。 |
| post-rename ACL acl | 相同舊 stat 替身讓目錄檢查先失敗，未到發布後 ACL 注入；改為 bigint stat。 |
| post-rename ACL error | 同上；保留單次 rename、不可 rollback／retry、unknown publication 與診斷去敏斷言。 |
| post-rename ACL timeout | 同上；fstat 保留真實 descriptor identity，ownership／mode 使用 bigint。 |
| the diagnostics file keeps only the fixed tunnel fields | 欄位測試把有 1 秒上限的 best-effort flush 當成 drain 完成：平行執行時實際在約 1009ms 讀到空 JSON，直接執行可過。以既有 async principal／icacls runner seam 提供即時成功，仍用真實檔案與 identity，finally 還原 seam／cache。原欄位、過濾、全部 cause 與去重斷言不變。 |

Tunnel 失敗的直接原因是等待外部 Windows ACL 程序超過 flush 上限；沒有證據顯示 bigint 相等判定誤拒同一檔案，也不把這個時間敏感案例說成精度缺陷。產品 flush 上限與 ACL 安全檢查均維持原值。

紅綠使用相同四檔命令：`bun scripts/test.ts tests/codex-integration/messaging-remote-store.test.ts tests/clients/link-tunnel-history.test.ts tests/lib/file-identity.test.ts tests/lib/file-identity-callers.test.ts --timeout=60000`。

| 狀態 | Exit code | 結尾輸出 |
| --- | --- | --- |
| 修正前 | 1 | 115 pass / 10 skip / 7 fail；463 expect calls；132 tests across 4 files。 |
| 修正後 | 0 | 122 pass / 10 skip / 0 fail；471 expect calls；132 tests across 4 files；suite finished in 7.3s。 |

10 個既有 skip 為 messaging 的平台限制，七個指定案例全部實際執行。使用明確檔名，避免 Windows 將 file-identity*.test.ts 原樣交給 Bun 而漏跑 helper 測試。

先前擴大驗收的持久摘要如下；六批均正常結束，exit 1，不當成全套通過證據。派工方提供的乾淨 origin/main 同批比對指出，僅上述七案為新增退化；其餘失敗屬基準既有問題，此分類來自派工交接，未重跑六批。

| 批次（各 20 檔） | Pass | Skip | Fail | Exit code |
| --- | --- | --- | --- | --- |
| CLI／client state | 537 | 4 | 3 | 1 |
| client／link／workspace | 415 | 17 | 11 | 1 |
| account／catalog／history | 949 | 21 | 18 | 1 |
| history／home／native／shim | 590 | 21 | 19 | 1 |
| shim／transition／history | 539 | 11 | 36 | 1 |
| messaging／native profile／config | 277 | 54 | 6 | 1 |

另外一批 20 檔聚焦集合為 433 pass / 22 skip / 0 fail，exit 0。歷史 workspace 大 ID 對照為 0 pass / 1 fail（exit 1，錯誤接受相鄰大 ID root）；helper 修正後 5 pass / 0 fail（exit 0）。primitive shape 斷言從 true !== false（exit 1）到 exit 0，證明拒絕非 primitive coercion。這些是歷史證據；目前四檔綠燈另見上表。先前 source-state checkpoint 的全部 SHA-256 在續接修改前核對一致，包含既有改動與新增檔案。

Stable 整合其餘逐筆審查、全版 tag diff 與 Windows-only 重放仍有驗收缺口；ROADMAP 的整合列保留。

## 2026-11-03：兩筆獨立 Responses 修正驗收

基準：`06aa61fb01e600b1f8b1d42bfad4a997b5e78e79`；Windows、Bun 1.4.4。採用 `2f7f1d113` 的 rejected reasoning toggle 清理、`f4eef7b23` 的正常 EOF 尾列解析。兩筆完整上游 diff、依賴與 fork 檔案／行號判定見 `docs/fork/UPSTREAM.md`；英／繁中產品文件同步。產品整合與 reviewed 水位保持原值。

### 紅綠回歸

先只新增測試，產品碼維持基準，再套用兩筆最小修正。

| 命令 | 紅燈 exit／結尾 | 綠燈證據 |
| --- | --- | --- |
| `bun scripts/test.ts tests/responses/reasoning-effort-summary-default.test.ts` | 1；27 pass／1 fail，62 expect calls；第 131 行 raw reasoning 多出 enabled: true | 下列五檔與 31 檔集合均通過該案 |
| `bun scripts/test.ts tests/web-search/web-search-eof.test.ts` | 1；4 pass／8 fail，13 expect calls；尾列的完成、失敗、文字與 decoded limit 未被處理 | 下列五檔與 31 檔集合均通過全部 12 案 |
| `bun scripts/test.ts tests/responses/reasoning-effort-summary-default.test.ts tests/web-search/web-search-eof.test.ts tests/web-search/web-search-parse.test.ts tests/test-layout.test.ts tests/test-layout-tooling.test.ts` | — | exit 0；113 pass／0 fail，753 expect calls，113 tests across 5 files |

### 閘門與相關覆蓋

| 命令 | Exit code | 結尾輸出 |
| --- | --- | --- |
| `bun scripts/test.ts tests/test-layout.test.ts tests/test-layout-tooling.test.ts`（登錄前基準） | 0 | 29 pass／0 fail；579 expect calls |
| `pwsh -NoProfile -File tools/dev_check.ps1` | 0 | 36 pass／0 fail；10 份文件無斷鏈；WINDOWS DEV CHECK GREEN |
| `bun run typecheck` | 0 | bun x tsc --noEmit；無型別錯誤 |
| `bun run test:changed` | 1 | git merge-base failed while validating changed mode: exit 1；壓縮 fork 與 dev 無共同祖先，沒有執行選測 |
| `bun scripts/test.ts tests/web-search tests/responses/sse-decoder.test.ts tests/responses/responses-reasoning-summary-passthrough.test.ts tests/responses/responses-reasoning-effort-downgrade.test.ts tests/responses/chat-inbound-reasoning-none.test.ts tests/responses/reasoning-effort-summary-default.test.ts --timeout=60000` | 0 | 477 pass／0 fail；1724 expect calls；477 tests across 31 files |
| `bun run structure:check` | 0 | structure/ SSOT checks passed |
| `bun run privacy:scan` | 0 | Privacy scan passed |
| `bun scripts/test.ts tests/ci-workflows/file-size-ratchet.test.ts` | 1 | 8 pass／1 fail；repository 掃描超過預設 5000ms；不是大小超標斷言 |
| `bun scripts/test.ts tests/ci-workflows/file-size-ratchet.test.ts --test-name-pattern='file-size ratchet: repository' --timeout=60000` | 0 | 1 pass／8 filtered out／0 fail；6 expect calls |
| `cd docs-site; bun install --frozen-lockfile` | 0 | Checked 371 installs across 484 packages (no changes) |
| `cd docs-site; bun run build` | 0 | checked 20711 internal links across 147 pages；147 page(s) built；Complete! |

結構文件首次超過 600 行預算，將新增句子合併到既有段落後通過，沒有調高預算或 baseline。ratchet 首次逾時後只重跑失敗的 repository 案例，沿用 repo 的 60000ms 測試預算，八個通過案例不重跑。

此為完整 fork dev check 加明確相關測試覆蓋；沒有執行全產品 `bun run test`。依 `src/AGENTS.md` 的實作期驗證規則，以聚焦檔案及相關 31 檔補足不能運作的 test:changed；不把這些結果視為全產品套件或九個 Windows CI shards 的通過證據。


## 2026-11-03：bigint identity 持久化相容性驗收

基準：`c81a0113cbd42e7a3ca40bbcc363d17b2591cd42`；Windows、Bun 1.4.4。`src/codex/shim-migration.ts` 只對持久化 journal 比對允許 numeric stat／bigint stat 的浮點捨入差；同一次執行中的觀察與復原檢查仍要求時間嚴格相等。精確 dev／ino、mode、size、symlink target 檢查保留。history index 保持可重建投影的 freshness 語意，降版限制見 `docs/fork/DECISIONS.md`。英文／繁中使用說明同步，`structure/runtime.md` 記錄比較合約。

### 先紅後綠與拒絕邊界

`tests/codex-integration/codex-shim-migration-time.test.ts` 使用真實暫存檔、hard link 與 journal；還原式平台／stat 替身讓 Windows 也實際執行 Unix migration 分支。固定奈秒時間同時產生舊 numeric stat 與新 helper 的不同捨入結果；測試不釘依賴版本。安全數字與十進位 identity 各測疏散前／疏散後續做，並確認 native entry 復原且 backup／quarantine／journal 清除。另測 1ms、0.01ms 時間差、inode、unsafe integer、mode、size、symlink target 與非有限時間均拒絕並保留證據。

| 命令／範圍 | Exit code | 結尾／觀察 |
| --- | --- | --- |
| `bun scripts/test.ts tests/codex-integration/codex-shim-migration-time.test.ts --timeout=60000`，以 HEAD 原版 migration 搭配新增測試 | 1 | 8 pass／4 fail；48 expect calls；四個跨版續做案例拒絕，其他八案通過 |
| 同一回歸檔，套用修正後的下列八檔集合 | 見集合 | 12 個回歸案例全部通過；集合的 3 fail 全屬下述既有 cmd 案例 |
| 登錄新測試前的 layout／tooling／回歸三檔集合 | 1 | 37 pass／2 fail；633 expect calls；兩個失敗指出缺少 explicit membership 與 fixture entry，兩處均補齊 |

首次替身以已捨入 numeric inode 建 key，導致 numeric／bigint 觀察分配不同測試 ID；改為兩者均從原生 bigint inode 建 key 後，重新以 HEAD 原版取得上述 8 pass／4 fail，避免把替身缺陷當作產品紅燈。

### 閘門與相關覆蓋

| 命令 | Exit code | 結尾輸出 |
| --- | --- | --- |
| `pwsh -NoProfile -File tools/dev_check.ps1` | 0 | 36 pass／0 fail；127 expect calls；10 份文件、0 份斷鏈；WINDOWS DEV CHECK GREEN |
| `bun run typecheck` | 0 | bun x tsc --noEmit；無型別錯誤 |
| `bun run test:changed` | 1 | git merge-base failed while validating changed mode: exit 1；壓縮 fork 與 dev 無共同祖先，未執行選測 |
| `bun scripts/test.ts tests/codex-integration/codex-shim-migration-time.test.ts tests/codex-integration/codex-shim.test.ts tests/codex-integration/codex-shim-autorestore.test.ts tests/lib/file-identity.test.ts tests/lib/file-identity-callers.test.ts tests/test-layout.test.ts tests/test-layout-tooling.test.ts tests/ci-workflows/file-size-ratchet.test.ts --timeout=60000` | 1 | 262 pass／8 skip／3 fail；1537 expect calls；273 tests across 8 files |
| HEAD 原版 migration：`bun scripts/test.ts tests/codex-integration/codex-shim.test.ts --test-name-pattern='Windows cmd shim restores the caller token' --timeout=60000` | 1 | 0 pass／101 filtered out／3 fail；3 expect calls；同樣在第 1204 行因 cmd 找不到 driver.cmd 失敗 |
| `bun run structure:check` | 0 | structure/ SSOT checks passed |
| `bun run privacy:scan` | 0 | Privacy scan passed |
| `cd docs-site; bun install --frozen-lockfile` | 0 | Checked 371 installs across 484 packages (no changes) |
| `cd docs-site; bun run build` | 0 | checked 20711 internal links across 147 pages；147 page(s) built；Complete! |

八檔集合中的 layout、file-size ratchet、identity、autorestore 與新增回歸均無失敗；三個 cmd 案例以原版 migration 對照仍全部失敗，不歸因於時間容差修正，也沒有改測試以掩蓋。完整 fork dev check 通過，產品測試集合有明確既有失敗，不能視為全產品綠燈。依 `src/AGENTS.md` 的實作期規則，以明列相關檔案補足無共同祖先而不可用的 test:changed，沒有執行全產品套件。原生 Unix 執行未涵蓋；Windows-only fork 驗收的是同一 migration 函式與真實檔案操作在還原式替身下的行為。

## 2026-11-03：closed-unmerged PR 改用關閉截止日與逐筆清單

基準：`13e0f0e453fbd7bce077a825a5bc0eca4f047756`。原逐筆清單方案查全部歷史
closed-unmerged PR，上游 1883 筆超過 1000 筆上限，PR 軸固定回傳未檢查；不能視為完成。
改以 `reviewed_pr_closed_before = 2026-10-28`（UTC）篩選查詢並索取 `closedAt`。
編號 <= 8086 且在截止日前關閉才由歷史覆蓋排除；當天及之後關閉須逐筆登錄才排除。
日期依 `12c5057c3` 與同日審查紀錄決定；11 月 3 日分類的 15 筆保留逐筆清單，
不把它們的分類日期外推成全部 PR 已審截止日。commit／issue／integrated 水位保持原值。

舊 baseline 缺截止日時沿用數字水位；缺逐筆清單視為空清單。新截止日須是有效 UTC 日期，
逐筆清單須是正整數陣列。滿頁仍 fail closed，避免把截斷回應寫成沒有待審。
對真實上游（約 1883 筆 closed-unmerged PR）而言，未加日期篩選的 `is:unmerged` 查詢必定填滿 1000 筆頁面，所以舊路徑一律以「未檢查」（exit 2）結束：安全失敗，既不會灌出大量項目，也不會靜默通過（已讀 `tools/check-upstream-updates.ts` 確認）。

### 回歸與實際查詢

| 命令 | Exit code | 結尾輸出／結果 |
| --- | --- | --- |
| 修正前：`bun test tests/ci-workflows/fork-hygiene.test.ts --test-name-pattern 'upstream checker'` | 1 | 15 pass、2 fail、21 filtered out、45 expect calls |
| 修正後同一命令（含新增日期驗證） | 0 | 18 pass、0 fail、21 filtered out、62 expect calls |
| `pwsh -NoProfile -File tools/dev_check.ps1` | 0 | 39 pass、0 fail、147 expect calls；10 份文件零斷鏈；WINDOWS DEV CHECK GREEN |
| `bun run typecheck` | 0 | bun x tsc --noEmit；無型別錯誤 |
| `bun tools/check-upstream-updates.ts --strict` | 1 | 209 upstream commit(s) require review；2 pull request(s) still to triage；No new platform issues since #7860 |

紅燈一是截止日前關閉的 #498 被錯報；二是真實 baseline 缺截止日，不能保證 PR 查詢不永久滿頁。
綠燈包含 #499 截止後關閉仍報、#498 截止前不報、截止日當天包含、已審與 merged PR 不報、
舊 baseline 相容路徑、日期／逐筆清單驗證與滿頁拒絕。性質測試使用真實 baseline，
以超過上限的歷史資料模擬回應，檢查實際 query 日期篩選與 `closedAt` 欄位，並確認結果可完整列舉。

實際 strict 列出 #7614、#7618，PR 軸已檢查且未截斷；兩筆仍待分類，沒有加入已審清單。
exit 1 是待審項目紅燈，不是工具失敗（exit 2）。查詢只讀取上游，沒有修改遠端資料。
變更限 fork 工具與文件；完整 fork gate 與型別檢查涵蓋本項，大型產品 runtime／GUI／跨平台套件未執行。

## 2026-11-04：#8019 identity 補審與 Messages clean-EOF 驗收

基準 `14964e312`；Windows、Bun 1.4.4。判定與逐檔證據在 `docs/fork/UPSTREAM.md`、`DECISIONS.md` 同日節。沒有 commit／push，水位不動。

環境根因：此桌面環境的 `%LOCALAPPDATA%\OpenCodex` 被 MSIX 虛擬化到 `Packages\Claude_*\LocalCache\Local`，`realpathSync.native` 與 coordinator 路徑不同，`samePathIdentity` 判 redirected；coordinator-doctor／transition-state／residue 部分／home-owner-lifecycle 在此環境整檔紅（與本次改動無關）。暫時繞過該比對（已還原，`git diff` 對 `user-identity.ts` 為空）後 `codex-coordinator-doctor`＋`codex-transition-state` 為 35 pass／1 skip／0 fail，含新增案例。

| 指令 | 結果 |
| --- | --- |
| `bun test tests/claude-integration/messages-native-clean-eof.test.ts tests/claude-integration/claude-messages-endpoint.test.ts --timeout=60000`（僅加測試） | exit 1，77 pass／27 fail |
| 同上（套用 src 後） | exit 0，104 pass／0 fail |
| Messages 相關 11 檔（passthrough、messages-native、outbound、devin-output-order、rate-limit-headers、anthropic-eof-tolerance、direct-encoders-messages、sse-unspaced、request-log-generation-window、test-layout×2） | exit 0，414 pass／0 fail |
| identity 集合 A（22 檔，含 file-identity、bounded-file-read、shim 各檔、provenance、history、home-owner、oauth、layout） | 651 pass／30 skip／8 fail；8 fail 皆環境：symlink EPERM×4（home-owner）、MSIX×4 |
| identity 集合 B（18 檔） | 466 pass／18 skip／3 fail；3 fail 為既有 `Windows cmd shim restores the caller token`（REVIEW 前段已記基準同樣失敗） |
| `bun test tests/lib/file-identity.test.ts`（基準源碼＋新測試） | 8 pass／4 fail（statTimeMs×2、次毫秒×2）；套用後 12 pass／0 fail |
| `bun test tests/codex-integration/codex-shim-migration-time.test.ts` | 16 pass／0 fail；停用容差突變後新案例 2 fail |
| `bun run typecheck`、`bun scripts/file-size-ratchet.ts` | exit 0、exit 0 |
| `bun run structure:check` | 新測試未追蹤時 exit 1（檢查讀 git index）；`git add -N` 後 exit 0，已還原 index |

未執行：`tools\dev_check.ps1`、`privacy:scan`、docs-site 建置、完整產品套件。

## 2026-11-05：ACL memo／CR 分隔重放驗收

基準 `6f7bfbe46999df18c43af8e7bcee50b651d2419d`；Windows、Bun 1.4.4。完整 diff 與逐檔判定見 `docs/fork/UPSTREAM.md`、`DECISIONS.md` 同日節。採用 `c7f3928a2`、`d42b9b1b2`；未擴大至 `f94e95ce5`，baseline 所有水位不變。

紅綠流程：先只寫上游回歸，runtime 保持 HEAD；取得下表 red 後，才適配 atomic writer 與 parser。所有表中的 `bun test <file>` 都是各檔獨立行程、加 `--timeout=60000`、stdin 導向 `/dev/null`（Git Bash；Python runner 使用等價 DEVNULL）。新斷言釘住行為與時間界線，不依賴套件版本。

| 指令 | Exit code | 結尾輸出／判定 |
| --- | --- | --- |
| `bun test tests/windows/windows-atomic-write-acl-rearm.test.ts --timeout=60000`（HEAD runtime＋新測試） | 1 | 7 pass、16 fail、111 expect calls；後續 write 被 timeout memo 拒絕、re-arm／cleanup／retained-child admission 失敗 |
| 同上（修正 runtime） | 0 | 23 pass、0 fail、221 expect calls |
| `bun test tests/web-search/web-search-eof.test.ts --timeout=60000`（HEAD runtime＋新測試） | 1 | 17 pass、6 fail、25 expect calls；CR／mixed 文字與引用、失敗訊息、terminal 即時取消失敗 |
| 同上（修正 runtime） | 0 | 23 pass、0 fail、27 expect calls |
| `bun test tests/server/config.test.ts --timeout=60000` | 0 | 193 pass、6 skip、0 fail、918 expect calls |
| `bun test tests/windows/windows-secret-acl.test.ts --timeout=60000` | 0 | 173 pass、0 fail、869 expect calls |
| `bun test tests/windows/windows-atomic-replace.test.ts --timeout=60000` | 0 | 12 pass、0 fail、27 expect calls |
| `bun test tests/web-search/web-search-parse.test.ts --timeout=60000` | 0 | 44 pass、0 fail、97 expect calls |
| `bun test tests/test-layout.test.ts --timeout=60000` | 0 | 2 pass、0 fail、3 expect calls |
| `bun test tests/test-layout-tooling.test.ts --timeout=60000` | 0 | 27 pass、0 fail、576 expect calls |
| `bun test tests/ci-workflows/fork-hygiene.test.ts --timeout=60000` | 0 | 39 pass、0 fail、147 expect calls |
| `pwsh -NoProfile -File tools/dev_check.ps1` | 0 | Fork hygiene 39 pass／0 fail；10 份文件零斷鏈；WINDOWS DEV CHECK GREEN |
| `bun run typecheck` | 0 | bun x tsc --noEmit；無型別錯誤 |
| `bun run privacy:scan` | 0 | Privacy scan passed |
| `bun run structure:check` | 0 | structure/ SSOT checks passed |
| `bun scripts/file-size-ratchet.ts` | 0 | file-size ratchet passed |
| `cd docs-site; bun install --frozen-lockfile` | 0 | Checked 371 installs across 484 packages (no changes) |
| `cd docs-site; bun run build` | 0 | 149 pages；20907 internal links checked；Complete! |
| `bun run test:changed` | 1 | git merge-base failed while validating changed mode: exit 1；選測前停止，沒有測試結果 |

驗證限制：`--changed=dev` 依 `scripts/test.ts:337` 選到 `upstream/dev`（`0c32c8132`）；壓縮歷史 fork 與該 ref 無共同祖先，`test:changed` 無法建立比較基準；`git merge-base HEAD upstream/dev` 也為 exit 1，與工作樹內容無關。不改分支、不接回上游歷史、不將它稱為通過。以單檔 focused regression 覆蓋兩個直接修改的 runtime 模組、既有 ACL／atomic／parser 與 source-oracle layout，另跑完整 fork dev check；未跑完整產品套件（atomic writer 為廣泛共用 leaf，完整產品回歸與跨平台證據不由這組 focused tests 代表）。

config 測試首次等待 user test lock：owner PID 57096 在同時查得為 `DismHost.exe`，等待者是該測試的 `bun.exe` PID 59308。只停止該等待者，之後各檔順序執行並明設 `OCX_TEST_NO_QUEUE=1`，未更動現有 lock、其他行程或 home／ACL guard。此設定也用於其餘既有測試與 dev check，僅略過測試排隊。沒有把 symlink EPERM 或 MSIX coordinator 失敗列為例外；相關結果沒有新增失敗。

## 2026-11-05：additional_tools 與工具回放權限驗收（`d9e0c057881`）

基準 `688b04a0e3a00a417e0b7492b8d682ed07d1b174`；Windows、Bun 1.4.4。上游完整 45 檔 diff 已讀，逐檔採用／改寫／不適用見 `docs/fork/DECISIONS.md`；`UPSTREAM.md` 同日節記錄來源。英文／繁中 provider 說明同步；ROADMAP 近期列只移除這筆，完整 stable 與 MSIX 複驗仍保留。`tools/upstream_baseline.json` 所有水位不變。

紅綠方式：先加回歸測試及供測試建構輸入的獨立 `item-provenance.ts` helper，其餘 adapter／server runtime 保持 HEAD；取得 behavioral assertion failure 後才重放 runtime。下列每個測試檔都是獨立 `bun test <file> --timeout=60000` 行程，stdin 用 Python `subprocess.DEVNULL`（與 `/dev/null` 等價），沒有共用 Bun module cache。明設 `OCX_TEST_NO_QUEUE=1` 僅略過測試排隊，沒有停用 sandbox、ACL 或 home guard。每個測試 batch 上限 240 秒，實際最長 management 約 98 秒。

| HEAD runtime＋新測試 | 結果 | 修正後結果 |
| --- | --- | --- |
| `tests/providers/xai/xai-loaded-tool-provenance.test.ts` | exit 1：6 pass／15 fail；歷史 discovery 混入 live catalog、兩回合 hosted-call authority 不符 | exit 0：21 pass／0 fail |
| `tests/adapters/routed-agent-messages.test.ts` | exit 1：42 pass／1 fail；替換 message 丟失 provenance | exit 0：43 pass／0 fail |
| `tests/responses/openai-responses-passthrough.test.ts` | exit 1：182 pass／3 fail；xAI wrapper 未提升至 tools | exit 0：185 pass／0 fail |
| `tests/providers/zed-hosted-provider.test.ts` | exit 1：28 pass／1 fail；replayed wrapper 移除後 current discovery 未正確提升 | exit 0：29 pass／0 fail |
| `tests/server/server-xai-responses-streaming.test.ts` | exit 1：5 pass／1 fail；實際送出的 input 仍有 wrapper | exit 0：6 pass／0 fail |
| `tests/server/management-provider-compat-carry.test.ts` | 兩個 assertion failure：carry roster 不符、PATCH true 應 200 實為 400；red 探測 90 秒上限先到，整檔 incomplete，不作完整 red suite 統計 | exit 0：23 pass／0 fail（整檔約 98 秒） |

新增 `xai-additional-tools` 涵蓋官方 host／lookalike、forward opt-in、custom gateway、schema boolean、歷史去重、reasoning／configuration_update 刪除與 raw input 不變。`xai-replay-provenance` 涵蓋 task／orphan／synthetic／bridge 替換及重排後 guard。symbol 不進 JSON，亦未加入 durable principal 或 HMAC scope。

| 單檔命令（每列皆加 `--timeout=60000`） | Exit code | 結尾輸出 |
| --- | --- | --- |
| `bun test tests/adapters/routed-agent-messages.test.ts` | 0 | 43 pass；0 fail；144 expect() calls |
| `bun test tests/providers/zed-hosted-provider.test.ts` | 0 | 29 pass；0 fail；106 expect() calls |
| `bun test tests/responses/openai-responses-passthrough.test.ts` | 0 | 185 pass；0 fail；682 expect() calls |
| `bun test tests/server/management-provider-compat-carry.test.ts` | 0 | 23 pass；0 fail；160 expect() calls |
| `bun test tests/server/server-xai-responses-streaming.test.ts` | 0 | 6 pass；0 fail；61 expect() calls |
| `bun test tests/providers/xai/xai-loaded-tool-provenance.test.ts` | 0 | 21 pass；0 fail；72 expect() calls |
| `bun test tests/providers/xai/xai-replay-provenance.test.ts` | 0 | 10 pass；0 fail；35 expect() calls |
| `bun test tests/providers/xai/xai-additional-tools.test.ts` | 0 | 23 pass；0 fail；56 expect() calls |
| `bun test tests/responses/custom-tool-compat.test.ts` | 0 | 33 pass；0 fail；89 expect() calls |
| `bun test tests/responses/namespace-tool-compat.test.ts` | 0 | 49 pass；0 fail；152 expect() calls |
| `bun test tests/responses/responses-custom-tool-historical-replay.test.ts` | 0 | 5 pass；0 fail；22 expect() calls |
| `bun test tests/responses/responses-undeclared-tool-guard.test.ts` | 0 | 101 pass；0 fail；252 expect() calls |
| `bun test tests/responses/responses-undeclared-tool-guard-inbound.test.ts` | 0 | 11 pass；0 fail；50 expect() calls |
| `bun test tests/providers/xai/xai-web-search.test.ts` | 0 | 14 pass；0 fail；36 expect() calls |
| `bun test tests/providers/xai/xai-web-search-compat.test.ts` | 0 | 6 pass；0 fail；19 expect() calls |
| `bun test tests/providers/opencode-go-grok46-responses.test.ts` | 0 | 42 pass；0 fail；104 expect() calls |
| `bun test tests/providers/model-rename-migration.test.ts` | 0 | 51 pass；0 fail；248 expect() calls |
| `bun test tests/responses/responses-muse-tool-choice.test.ts` | 0 | 8 pass；0 fail；33 expect() calls |
| `bun test tests/test-layout.test.ts` | 0 | 2 pass；0 fail；3 expect() calls |
| `bun test tests/test-layout-tooling.test.ts` | 0 | 27 pass；0 fail；576 expect() calls |
| `bun test tests/server/data-plane-admission-identity.test.ts` | 0 | 28 pass；0 fail；73 expect() calls |

共 8 個改動測試檔 340 pass／0 fail，10 個相關檔 320 pass／0 fail；layout／admission 另計。structure gate 透過 git index 辨識新檔。

### 既有 Windows 環境失敗的乾淨 HEAD 對照

以 `git archive HEAD` 在 gitignored scratch 匯出乾淨 `688b04a0e`，共用原有 node_modules；沒有切分支、重寫工作樹或修改產品碼。下列兩個測試及 `coordinator-doctor.ts`、`user-identity.ts`、`codex-home-owner.ts` 均逐 byte 等於 HEAD git blobs。

| 命令（皆含 `--timeout=60000 --test-name-pattern '<名稱>'`） | 工作樹 | 乾淨 HEAD |
| --- | --- | --- |
| `bun test tests/codex-integration/codex-home-owner.test.ts`；名稱 `symlinked journal, directory journal and owner file are not authority` | exit 1：0 pass／1 fail／11 filtered out；file symlink EPERM | 同樣 exit 1：0 pass／1 fail／11 filtered out；相同 EPERM |
| `bun test tests/codex-integration/codex-coordinator-doctor.test.ts`；名稱 `doctor classifies and explicitly backs up a stable zero-byte coordinator` | exit 1：0 pass／1 fail／7 filtered out；預期 zero-byte，實際 unsafe | 同樣 exit 1：0 pass／1 fail／7 filtered out；相同 unsafe |

對 HEAD 的 doctor 案例另加一次可還原 diagnostic 輸出，reason 是 `the coordinator path is redirected`，與既有 MSIX 虛擬化環境限制相同；輸出後還原測試且再次核對 HEAD bytes。未略過、改綠或放寬這兩項，也沒有把它們算入通過數。

### 閘門與限制

| 命令 | Exit code | 結尾輸出／結果 |
| --- | --- | --- |
| `bun run typecheck` | 0 | bun x tsc --noEmit；無型別錯誤 |
| `bun run structure:check` | 0 | structure/ SSOT checks passed |
| `bun test tests/ci-workflows/fork-hygiene.test.ts --timeout=60000` | 0 | 39 pass／0 fail／147 expect calls |
| `bun scripts/file-size-ratchet.ts` | 0 | file-size ratchet passed；英文 provider 頁初次 2000 行被拒後，以原段落重排降至 1998 行，未提高 baseline |
| `cd docs-site; bun install --frozen-lockfile` | 0 | Checked 371 installs across 484 packages (no changes) |
| `cd docs-site; bun run build` | 0 | 149 pages；20907 internal links checked；Complete! |
| `bun run test:changed` | 1 | git merge-base failed while validating changed mode: exit 1；選測前停止 |
| `bun run privacy:scan` | 0 | Privacy scan passed |
| `pwsh -NoProfile -File tools/dev_check.ps1` | 0 | fork hygiene 39 pass／0 fail；10 份文件零斷鏈；WINDOWS DEV CHECK GREEN |

`test:changed` 在壓縮歷史 fork 無共同祖先的限制仍存在；沒有繞過 ancestry 或將失敗描述成通過。依 `src/AGENTS.md` 的實作期規則與資源例外，用明列的 18 個工具／adapter／API／guard 測試及 layout／admission 補足選測，再跑完整 fork dev check。完整產品套件、非虛擬化 Windows coordinator 與跨平台 CI 不由這些 focused results 代表；完整 stable 整合計畫仍保留。

文字完整性：所有 40 個改動檔案無 NUL／Unicode 控制字元（TAB／CR／LF 除外），原有檔案換行格式保持；`git diff --check` exit 0。

## 2026-11-07：夜間 Windows shard 2/11 逾時（`cli-start-owner-absence`）暖機與子行程界限驗證

基準 HEAD：`abca9cb0d6d79558ecbe7fe0094985e22b55f9f5`（detached HEAD）；本輪修改一份測試與維護文件（`ROADMAP.md`、`docs/fork/DECISIONS.md`、本節），沒有暫存、提交、推送、觸發 workflow 或改產品碼。分類、對照與再次發生時的讀法見 `docs/fork/DECISIONS.md` 2026-11-07 條目。

遠端事實（唯讀 `gh run view`）：紅燈 run [42309802238](https://github.com/SanHsien/opencodex/actions/runs/42309802238) 只有 `windows 2/11` failure；同一 HEAD 的前一晚 run [42130890278](https://github.com/SanHsien/opencodex/actions/runs/42130890278) 11 個 Windows shard 與 aggregate `ci` 全 success，這同時是 2026-11-02／03 修正（`91a176f94`、`eea76a63b`，皆為 `abca9cb0d` 的祖先）的遠端驗收。

| 指令 | exit code | 結尾輸出／結果 |
| --- | --- | --- |
| 暫時注入：子行程在 `modules-loaded` 後停 60s、界限改 3s，`bun test tests/cli/cli-start-owner-absence.test.ts -t "for start"` | 1 | `child killed at the 3000ms deadline; exit=null elapsedMs=3048` 與 `[owner-absence-child] modules-loaded at 1317ms`；舊寫法同情境只有 `Received: 143`。注入已還原 |
| `CI=true bun test tests/cli/cli-start-owner-absence.test.ts --timeout 60000`（修正後） | 0 | `8 pass / 0 fail`，90 expect calls；暖機 `elapsedMs=3055 loaded=5/5` |
| 同檔修正前（本機，無 CI） | 0 | `8 pass / 0 fail`，25.1s；本機無法重現紅燈，修正前後都是綠 |
| `bun run test -- tests/cli/cli-start-owner-absence.test.ts`（repo 的測試入口） | 0 | `8 pass / 0 fail`，`suite finished in 15.6s (exit 0)` |
| `CI=true bun test` 同檔加 `cold-spawn-warmup`、`warmup-registration`、`ci-watchdog`、`test-layout`、`test-layout-tooling`、`structure-ssot`、`fork-hygiene`（共 8 檔，`--timeout 60000`） | 0 | `171 pass / 0 fail`，1013 expect calls |
| `bun run typecheck` | 0 | `No type errors in 2,305 files` |
| `bun scripts/file-size-ratchet.ts` | 0 | `file-size ratchet passed` |
| `bun run structure:check` | 0 | `structure/ SSOT checks passed` |
| `bun run privacy:scan` | 0 | `Privacy scan passed` |
| `pwsh -NoProfile -File tools/dev_check.ps1` | 0 | fork hygiene 39 pass／0 fail；10 份文件零斷鏈；`WINDOWS DEV CHECK GREEN` |

沒有先紅後綠的修正前紅燈：這次沒有找到可在本機重現的缺陷，紅燈只存在於 run 42309802238 的日誌；修正的是「卡住時看不到哪一段」與「第一個子行程付模組圖冷載入」兩件事，不宣稱已消除該次暫停，也不宣稱遠端已驗證。遠端驗收要等下一次 schedule 的 11 個 Windows shard 與 aggregate `ci` 全部 success；再次紅燈就讀失敗訊息裡的階段行。

驗證範圍：未執行全部 `.test.ts` 產品套件。本輪只動一份測試檔與文件，沒有產品碼變更；該檔的跨檔依賴（暖機 helper、版面清單、結構與 fork 衛生守衛、型別）已聚焦覆蓋，完整 Windows 11 分片覆蓋留給 CI，不宣稱已通過。

暫時的量測用改動（`src/config/process-state.ts` 的計時記錄、測試檔的 `--preload` 與 60s 停頓）都已還原，`git status --porcelain` 只剩本輪四個檔案與既有未追蹤的 `Microsoft/`。

## 2026-11-07：手動 Cross-platform CI `windows 7/11` 的 `main-quota-provenance` 首案例紅燈；診斷輸出補強

基準 HEAD：`2c6d8fa4af0e29f4b15c1e1b819d68a7094bafed`（detached HEAD）；本輪修改一份測試（`tests/codex-integration/main-quota-provenance.test.ts`）與維護文件（`ROADMAP.md`、`docs/fork/DECISIONS.md`、本節），沒有暫存、提交、推送、觸發 workflow 或改產品碼。分類與再次紅燈的讀法見 `docs/fork/DECISIONS.md` 2026-11-07 第一條。

遠端事實（唯讀 `gh run view`）：紅燈 run [42376149161](https://github.com/SanHsien/opencodex/actions/runs/42376149161)（`workflow_dispatch`）只有 `windows 7/11` failure，失敗在 `main-quota-provenance.test.ts:415`，案例為迴圈第一個 `verified replacement`；批次總計 `85 pass / 1 fail`。同一 HEAD 的 Upstream check run [42376151305](https://github.com/SanHsien/opencodex/actions/runs/42376151305) failure 的內容是 56 筆待審 commit、0 筆待審 closed-unmerged PR、5 筆新 platform issue（#8246、#8260、#8262、#8280、#8281），本輪只記計數、不審查。

| 指令 | exit code | 結尾輸出／結果 |
| --- | --- | --- |
| `CI=true bun test tests/codex-integration/main-quota-provenance.test.ts`（修改前，連跑 3 次） | 0, 0, 0 | 每次 `38 pass / 0 fail`；重現不到 |
| 同上加 `TZ=UTC` | 0 | `38 pass / 0 fail` |
| 同上同時 8 個程序並行 | 0 ×8 | 每個 `0 fail` |
| 暫時注入：`openClaimDatabase` 在 `OCX_TMP_INJECT_CLAIM_FAIL` 下丟 `EPERM`；`HEAD` 版測試 `-t "verified replacement"` | 1 | `Expected: true / Received: false`，沒有任何原因欄位（與遠端紅燈的輸出相同）。注入已還原 |
| 同一注入；修改後的測試 `-t "verified replacement"` | 1 | 失敗物件列出 `"failure": "CodexAuthContextError"`、`"code": "NATIVE_MAIN_CLAIM_UNAVAILABLE"` 與 stderr 的注入行。注入已還原 |
| `CI=true bun test tests/codex-integration/main-quota-provenance.test.ts`（修改後，無注入） | 0 | `38 pass / 0 fail`，235 expect calls |
| `bun run typecheck` | 0 | `No type errors in 2,305 files` |
| `pwsh -NoProfile -File tools/dev_check.ps1` | 0 | `WINDOWS DEV CHECK GREEN`，10 份文件零斷鏈 |

沒有先紅後綠的產品修正：遠端紅燈本機重現不到，注入實驗只證明失敗形狀與診斷輸出，不證明 CI 上發生的是同一個原因，也沒有宣稱已消除該次失敗。測試斷言沒有放寬（`exitCode` 與 `selected` 仍是精確比對），沒有加重試，產品碼無差異（`git diff --stat` 只有測試與三份文件）。

驗證範圍：未執行全部 `.test.ts` 產品套件。本輪只動一份測試檔的失敗輸出，與文件；該檔本身與型別、dev_check 已跑，完整 Windows 11 分片覆蓋留給 CI，不宣稱已通過。對手動 run 42378131276（同 HEAD 重跑）的結果本輪未取得完成狀態，不在此作為證據。

## 2026-11-07：上游 commit 軸前 49 筆與 5 筆 platform issue 的採用驗證

基準：`origin/main` `fa81b4d4f`（detached HEAD）。本輪採用 37 筆上游 commit（含 `7b51475` 的 src／tests／字串部分；另提前採用 3 筆相依，見 `docs/fork/UPSTREAM.md` 2026-11-07 節），延後 8、不適用 2、不另採 2。沒有暫存、提交、推送、觸發 workflow，也沒有停止或重啟 `127.0.0.1:10100` 的 live proxy。驗證用的暫存索引是獨立檔案（`GIT_INDEX_FILE`），不影響 repo 的索引。

先紅後綠（每批先只套測試端，確認新測試失敗，再套來源端）：

| 批次 | 先紅 | 後綠 |
| --- | --- | --- |
| A（`ad6a80e`、`b9ddb31`、`68a8f60`、`b855356`、`723b2aa`、`13d2184`、`3b23d46`、`3dc4060`、`62578b5`、`650cbc6`） | 263 pass／41 fail | 與 B 合併後 664 pass／1 fail（`kiro-adapter` 的「never borrows」，單檔 106 pass／0 fail，兩次） |
| B（`911443e`、`cd8d26d`） | 121 pass／4 fail（缺模組） | 同上 |
| C（`c43a86b`） | 446 pass／24 fail | 546 pass／15 fail：7 個 `doctor.test.ts` 端到端案例在未修改的 HEAD 版 `doctor.ts` 與測試下同樣 5 秒逾時（對照已做，80 pass／7 fail）；其餘 8 個是 POSIX `/bin/sh` 與原生 home fixture，由 `8f43924`、`2c8b397`、`92e8f87` 修掉後 `service-definition-escaping`、`service-pinned-homes`、`service` 三檔 0 fail |
| D（`af3f8f8`、`bc11b07`、`fdad3da`、`72e80d2`） | 158 pass／13 fail | 547 pass／7 fail，加 `5001aa5`、`63ff32a`、`7ea41c3` 後 133 pass／39 skip／1 fail（`oauth-store-multi` manifest 填滿案例預設 5 秒逾時，`--timeout 120000` 下 1 pass） |
| E（`d0c8151`、`f202b2d`、`708cd06`、`092b496`、`a0d4b40`、`b19daa4`、`b4cc5e8`、`250ef01`，加 `6b3044f`） | 379 pass／97 fail | 566 pass／0 fail，exit 0；`gui/tests/quota-summary.test.ts` 8 pass |
| F（`f1d1a32`、`540100d`、`3924f21`、`cdb64a9`、`ebeb1dc`） | 98 pass／14 fail | 173 pass／22 skip／7 fail；`--timeout 120000` 下 `cli-sync-expect-link` 30 pass／0 fail，`client-link-connect` 剩 2 案（見下） |
| G（`7b51475` 的 `src/`、`tests/`、字串） | `client-link-connect` 與 `client-machine-listener` 77 pass／5 fail（新增的 identity pin 兩案、readiness 一案，加兩個既有失敗） | 80 pass／2 fail（兩個既有失敗，見 C、D） |
| H（bigint 身分：`tests/lib/file-identity-callers.test.ts` scopes 加 `orphan-token-recovery`） | 以上游 `7b514759e` 版 `orphan-token-recovery.ts` 跑：29 pass／1 fail（該 scope 回 `numeric stat`） | 以 fork 版（`lstatFileIdentity`／`fstatFileIdentity`＋`sameFileIdentity`）跑：全過；`client-link-connect`＋`client-machine-listener`＋identity 三檔 110 pass／2 fail（同 C、D 的前身） |

以下為 A–F 完成當時（尚未含 G、H 與 D 的 skip）的合併程序一次性結果：全部 77 個被動到的測試檔加 `test-layout`、`test-layout-tooling`、`fork-hygiene`、`structure-ssot`，單一程序、`--timeout 90000`：2478 tests／80 files，2393 pass、81 skip、4 fail，822 秒。4 個失敗的歸因：

1. `structure/ SSOT`：`scripts/structure-ssot.ts` 以 `git ls-files` 判斷檔案存在，新檔案未暫存時回「this tree does not have」。以暫存索引（含新檔案）重跑 `bun run structure:check` exit 0。**提交者必須暫存新檔案**。
2. `client-link-connect`「orphan recovery preserves an unsafe symlink token」：`EPERM: operation not permitted, symlink`，此帳號沒有建立 symlink 的權限，環境限制，不是產品行為。
3. `client-link-connect`「link disconnect restores the prior catalog…」：單獨跑 1 pass（12.98 秒，主機負載高）；合併程序內失敗，未判定根因，列為待觀察。
4. `kiro-adapter`「an account with no stored Kiro metadata never borrows…」：合併程序內失敗、單檔 106 pass，疑似跨檔環境殘留；專案實際以分片逐檔隔離執行，未判定根因，列為待觀察。

閘門：

| 指令 | exit code | 結果 |
| --- | --- | --- |
| `bun run typecheck` | 0 | `No type errors in 2,315 files` |
| `pwsh -NoProfile -File tools/dev_check.ps1`（暫存索引含新檔案） | 0 | `WINDOWS DEV CHECK GREEN`，10 份文件零斷鏈 |
| `bun run privacy:scan`、`bun run structure:check`、`bun run docs:clients:check`（同上） | 0, 0, 0 | passed |
| `bun test tests/ci-workflows/file-size-ratchet.test.ts` | 0 | 9 pass |
| `bun tools/check-upstream-updates.ts`（修改前） | 0 | 56 commit、0 PR、5 issue |
| 同上（修改後） | 0 | 56 commit、0 PR、0 issue，`Triaged through #8281` |
| `bun tools/check-upstream-updates.ts --strict` | 1 | 56 commit（前後相同；commit 軸水位不能中途推進，見 `DECISIONS.md` 2026-11-07 決定一） |

水位實測：把 `reviewed_through` 暫設為 `ebeb1dc8a` 時，檢查工具回報 205 筆待審（上游以 ours merge 併回 main，範圍運算 `reviewed_through..upstream/main` 把更早的 main 線 release merge 全列回來），故已還原為 `cab7eb7d0`。

未驗證：Rust 診斷測試（`a98a6bf`）與 `Cargo.lock`（`b7e01c1`）因本機沒有 `cargo` 未驗證，兩者皆延後；整版 Windows 11 分片 CI 沒有跑，GitHub Actions 上的結果以提交後的 run 為準。

補充（同日第二輪修正後）：

- **合併程序失敗清單不完整**：上面 4 個失敗只是那一次執行印出的；審查者另回報 `tests/server/anthropic2-management.test.ts:109` 在合併程序失敗，本輪未獨立重現。**`tests/server` 與 `tests/providers` 的全量執行沒有跑完**，只跑了被動到的檔案，所以「其餘全過」不能宣稱。專案實際以分片逐檔隔離，該清單只能當作待追蹤線索（`ROADMAP.md` 中期「釐清只在合併程序失敗的測試」）。
- **C（既有不穩對照）**：`client-link-connect`「link disconnect restores the prior catalog …」。乾淨基底（`git archive fa81b4d4f`，junction 共用 `node_modules`）3 次：1 pass、2 fail；移植後 3 次：1 pass、2 fail；失敗皆為 `Config mutation already in progress` 後接 `EBUSY … rm ocx-client-link-contract-*`，單案約 12–14 秒。結論：不是移植造成。同檔整檔執行時，其後的「cancellation during catalog download …」與「a new link enrollment succeeds after explicitly preserving the orphan token」偶爾跟著失敗，錯誤同為 `Config mutation already in progress`／`EBUSY`（上一案留下的鎖與暫存樹連鎖），兩案單獨跑皆 1 pass。
- **D**：symlink 案例改用能力探測（win32 且 `EPERM` 才 skip，hardlink 案例照跑）：`-t "unsafe"` 為 1 pass／1 skip。
- **B**：`orphan-token-recovery.ts` 改 bigint 身分，細節與 red／green 見表 H 與 `DECISIONS.md` 決定七。

## 2026-11-08：`v2.97.0..v2.98.0` 全版 tag diff 重放的本機驗證（本機驗證未完成；遠端 Windows 全量 CI 已全綠，水位已推進，見下方「CI 後續修正」）

範圍：868 個上游變更檔（採用 551、已等價 197、適配 85、不適用 35），判定在 `docs/fork/DECISIONS.md` 與 `docs/fork/UPSTREAM.md` 同日節，清冊 `docs/fork/upstream-v2.97.0-v2.98.0-files.tsv`。`tools/upstream_baseline.json` 當時維持 `v2.97.0`／`cab7eb7d0`，之後已在遠端 CI 全綠後推進（見「CI 後續修正」與 DECISIONS 2026-11-08（續））。本節只記實際跑過的與沒跑完的。

**審查後修正（兩輪審查：處理與安全）**：
- `gui/classic/src/pages/usage-companion-panel.tsx` 的安裝連結指向上游 releases，改 `SanHsien/opencodex`；`gui/src/pages/usage-companion-sections.tsx` 與 classic 的 `opencodex.me/guides/macos-menu-bar/`（頁面已在 Windows-only 刪除清單）改 `guides/desktop-app/`。
- 守衛看不到 `gui/classic/src`：`tools/fork-hygiene-guards.ts` 的 `HANGUL_ROOTS` 與 `tests/ci-workflows/fork-hygiene.test.ts` 的「不連上游 releases」掃描根加入 `gui/classic/src`。**紅**：加入根、未修內容時 `fork-hygiene` 2 fail（classic 的上游 releases 連結 1 處、Hangul 11 行：`Models.tsx` 1、`styles.css` 10）；**綠**：連結改 SanHsien、Hangul 註解改英文後 39 pass／0 fail。
- `gui/classic/src/main.tsx`：上游是 `if (isTray) installApiAuthFetch();`，fork 自 `87ddc1cd3` 起無條件呼叫（`gui/src/main.tsx`），classic 改回無條件，不當成可接受差異。
- zh-TW 文件：補 `guides/web-dashboard.md`「經典儀表板」與 `reference/configuration/providers.md`「Mistral：每個請求的圖片數量」兩節；取上游新繁中段落後有三處英文路徑連結，改為 `/zh-tw/...`。`docs-zh-tw-parity`、`docs-link-targets` 13 pass／0 fail。
- 水位相關敘述全部還原（`FORK.md`、本檔表頭、DECISIONS 決定一、UPSTREAM 水位段、ROADMAP 現況），版號 2.98.0 保留；ROADMAP 恢復「整合上游下一個 stable 版（`v2.98.0` 之後）」常設列，並以「驗收 `v2.98.0` 重放的 Windows 全量 CI，通過後推進水位」列取代原驗收列。

**隔離過的六組（上游 #8262）**：逐組結論在 DECISIONS 決定九。fork 側修了兩組：overflow 矩陣切片 timeout（30000 → `COLD_SPAWN_BUDGET_MS`，取樣切片 `translated-fold rows 1-64` 1 pass，未修時 12 切片逾時）、`messages-sse-continuation` 冷啟動（紅 7 pass／1 fail → 綠 8 pass／0 fail）。其餘四組沒有 skip：`desktop-compatibility-build-probe`、`codex-cli-windows-plan`、`main-quota-provenance` 三檔合跑 76 pass／1 fail（失敗案是 `native 8.3 spellings…`，在 `git archive a13d292e9` 基底同樣失敗）；`client-link-stop` 39 pass／15 fail，基底相同名單。

**各群組實際結果**（每組一個新程序；repo 的使用者層級測試鎖使同一使用者的測試程序無法並行，7 程序並行時多數被鎖擋住直到 timeout，所以後來改循序）：

| 群組 | 結果 |
| --- | --- |
| 新增的 25 個非 overflow 測試檔（`tests/claude-integration`、`tests/server`、`tests/lib`、`tests/responses`、`tests/usage` 內新檔） | 615 pass／0 fail |
| `tests/claude-integration/messages-sse-continuation.test.ts` | 8 pass／0 fail |
| overflow 矩陣取樣切片（`translated-fold rows 1-64`） | 1 pass／0 fail；**其餘切片沒跑** |
| 解除 quarantine 的 5 檔 | 見上段（76 pass／1 既有失敗；`client-link-stop` 39 pass／15 既有失敗） |
| `tests/ci-workflows`（scratch index 下） | 1392 pass／3 fail：`build-release-changelog` 與 `test-runner` 兩案是 `GIT_INDEX_FILE` 環境變數干擾暫存 repo，去掉後兩檔 126 pass／0 fail；`packaged keyring native binding … symlinked wrapper` 是此帳號沒有建立 symlink 的權限（環境，未在基底驗證） |
| 安全重點（`tests/cli/cli-native-profile`、`tests/clients/*shim*`、`tests/codex-integration/{codex-shim,native-profile-*}`、`tests/lib/file-identity-callers`、local-management、update-async-routes，22 檔合跑） | 469 pass／12 fail；12 案全在 `codex-shim.test.ts`，該檔單獨跑 96 pass／0 fail，基底 96 pass／0 fail（合併程序殘留，ROADMAP 既有「只在合併程序失敗的測試」列的同型現象） |
| `gui`（`bun test`）／`gui` 建置 | 3831 pass／0 fail（classic 修改前）；建置見下 |
| `service-status-json.test.ts` | 17 pass／1 fail，基底相同（本機真實 schtasks `opencodex-proxy`，DECISIONS 決定十） |
| `fork-hygiene`＋`structure-ssot`、`docs-zh-tw-parity`＋`docs-link-targets`＋`docs-developer-role-policy` | 39 pass／0 fail、13 pass／0 fail |
| Rust | `cargo check --lib --locked` exit 0；`cargo test --locked`（`windows-version-control`）16 pass |

**沒跑完（無通過計數，不能當綠燈）**：`tests/claude-integration` 其餘約 117 個既有檔、`tests/routing`＋`tests/web-search`（106 檔，240 秒上限逾時）、`tests/usage`＋`tests/update`＋`tests/service`（420 秒上限逾時）、overflow 矩陣其餘切片（每切片約 33 秒、共 6 個 lane）。這些要在 CI 或乾淨主機以 fresh-process 分批重跑。

**既有失敗（非本次引入，基底相同）**：`client-link-stop` 15 案、`codex-cli-windows-plan`「native 8.3 spellings…」、`service-status-json` 1 案；`client-link-connect` 另有既有不穩（DECISIONS 2026-11-07 決定九）。

**順手更正**：2026-11-07 記「本機沒有 `cargo`」不成立（DECISIONS 2026-11-08 決定四）；`ROADMAP.md` 舊列「fork 沒有 web-search 可用性探測」不成立（決定八）。

**CI 後續修正（遠端 Windows 全量 run 42403141711，`ca6480ed6`）**：11 個 Windows shard 中 4、10 失敗、2、11 被 30 分鐘 job 上限取消。
- shard 10（`routing-policy-surface-parity`「no-eligible policies retain their trace but not their profile id on every wire」）與 shard 4（`messages-overflow-collectors`「local-envelope: origin/dev rows 1-63」，`Expected: true / Received: false`）同一根因，在 `src/server/claude-messages.ts` 的 no-eligible 分支：固定句寫進了沒有輸出的 `legacy`，輸出的 `localError.message` 仍是上游句，overflow 判定又改讀固定句。修法與理由見 DECISIONS 決定十一。沒有放寬任何斷言。**綠**：以 CI 相同旗標（`bun test --isolate --timeout 60000`，Bun 1.4.4）跑這兩個檔，21 pass／0 fail。（不帶 `--timeout 60000` 時，本機預設 5 秒會使 surface-parity 的 afterEach 逾時，與修正無關；CI 的批次腳本一律帶 60000。）
- shard 2、11 取消：不是測試失敗，是 Windows 權重表缺 v2.98.0 新增的 75 個檔案，負載集中；表由 run 42403141711 的 job log 重新量測。證據與殘留風險見 DECISIONS 決定十二。
- 後續兩輪：shard 4 因 30 分鐘上限被取消（無失敗案例）、shard 10 的 `cli-start-journal-order` 冷啟動逾時。處理為 12 片 shard 與該案例預算改由 `OWNER_WAIT_MS` 推導（`3 * OWNER_WAIT_MS`），見 DECISIONS 決定十二再補記；斷言與 30 分鐘上限不變。
- 修復 commit（2026-11-08）：`b34464034`（no-eligible 固定句與首輪權重表）、`689c2d11f`（envelope writer 計數 30 → 31）、`15a0686b0`（兩 run 平均的權重表）、`73c0a8ec4`（12 片 shard 與冷啟動預算）、`7de8aac44`（審查後修正：預算改回 `OWNER_WAIT_MS`、片數與來源敘述更正）。遠端 Windows 全量 CI run 42424520793（`7de8aac44`）12 個 shard 與 aggregate `ci` 全 success。水位推進的 commit 就是本 commit（`docs(upstream): integrate v2.98.0 — advance watermarks`，hash 以推上去後的 `main` 為準）。

## 2026-11-09：`v2.98.0..v2.99.0` 全版 tag diff 重放的本機驗證（分支 `ci/tagdiff-v2.99.0`；遠端結果見下方「CI 後續修正」）

範圍：410 個上游變更檔（已等價 1、採用 330、適配 42、不適用 37），判定在 `docs/fork/DECISIONS.md` 與 `docs/fork/UPSTREAM.md` 同日節，清冊 `docs/fork/upstream-v2.98.0-v2.99.0-files.tsv`。所有指令以 BelowNormal 優先權、fresh process 執行（同一使用者的測試鎖使程序無法並行，所以循序）。

| 指令 | 結果 |
| --- | --- |
| `bun run typecheck` | exit 0，2,334 個檔案 0 錯誤 |
| `bun run structure:check`、`bun run privacy:scan`、`bun run docs:clients:check`、`bun scripts/file-size-ratchet.ts` | 皆 exit 0（第一次 privacy 與 ratchet 紅：自己新增的測試把 git 作者信箱寫成字面值、`UPSTREAM.md` 2123 行與 `responses-pool-401-refresh.test.ts` 剛好 2000 行；處理見 DECISIONS 決定四與 UPSTREAM 衝突表，修後重跑為綠） |
| 新增的 11 個測試檔（`bun test --isolate --timeout 60000`） | 110 pass／0 fail |
| 版面、hygiene、結構、邊界（`test-layout*`、`file-size-ratchet`、`structure-ssot`、`fork-hygiene`、`docs-zh-tw-parity`、`docs-link-targets`、`docs-developer-role-policy`、`core-lab-boundary`） | 178 pass／0 fail。第一次 `docs-zh-tw-parity` 紅 2 案（`messaging.md` 段落 5／6、fence 18／20），補譯新段後轉綠 |
| `fork-hygiene` 單檔（含新增的 3 個 stable-tags 測試） | 42 pass／0 fail |
| `tools/dev_check.ps1` | `WINDOWS DEV CHECK GREEN`，exit 0 |
| 衝突與關鍵檔：`messages-error-contracts`、`responses-pool-401-refresh`、`web-search-anthropic`、launcher 三檔、`client-machine-listener`、`routing-policy-surface-parity`（8 檔合跑） | 320 pass／2 fail。兩案是計時型：`responses-pool-401-refresh`「a post-refresh credit hold in the pacing queue does not announce a replay send」（18.4 秒）與 `web-search-anthropic`「synchronous empty chunks cannot starve the bounded EOF probe」（5.0 秒），同時有 cargo 編譯在跑。單檔重跑：前者 75 pass／0 fail，後者 53 pass／0 fail。**已修，`039a3aeed`（2026-11-21）**，見同日節 |
| `cargo check --lib --locked`（`TAURI_CONFIG` 清空 `externalBin`／`resources`）、`cargo test --lib --locked traffic_lights` | exit 0；3 案過。證明 `traffic_lights.rs` 在 Windows 可編譯（`#[cfg_attr(not(target_os = "macos"), allow(dead_code))]`） |
| `bun tools/check-upstream-updates.ts --strict`（新的 stable-tags 模式，水位尚在 `v2.98.0`） | 28 筆待審 commit、PR 軸 1 筆（#8252）、issue 軸 0 筆，exit 1；與整合前審查的 28 筆一致 |

**沒跑**：`tests/` 其餘約 2,600 個既有檔的完整分批（由 Windows 12 片 CI 負責）；`gui` 的 `bun test` 與 `vite build`（`gui/` 依賴已安裝，沒有在這個分支跑）。這些不能當綠燈。

**CI 後續修正（遠端 Windows 全量，分支 `ci/tagdiff-v2.99.0`）**：逐 run 結果與根因在 `docs/fork/UPSTREAM.md` 同日節的 CI 表與 `DECISIONS.md` 決定六、七。摘要：首輪 run 42627438708 只有 `gates`（GUI 測試的十一語系清單，`d01c71cd6`）與 `windows 5/12`（`update-mutation-guard`，`595ee1e27` 遺留的審查列，`df6a0ad47`）兩處紅燈；修後 run 42631654245 的 12 個 Windows shard、`keyring windows`、`gates` 與 aggregate `ci` 全 success；權重表刷新後 run 42637255094 為 success（12 個 Windows shard 與 aggregate `ci` 全 success，最長一片 26.9 分鐘）。GUI 完整測試（`cd gui && bun test --isolate tests`）在修正後本機 4020 pass／0 fail（上方「沒跑」一句中的 GUI 部分以此取代；`vite build` 仍未在本機跑，遠端 `gates` 的 GUI 步驟已覆蓋）。

**水位推進後的 strict 檢查**：`bun tools/check-upstream-updates.ts --strict` exit 0：「stable release tags above `v2.99.0`」、`Reviewed through: 6676629`、`No new upstream commits`，PR 軸「No untriaged closed-unmerged pull requests」（23 筆 `reviewed_pr_numbers`），issue 軸「Triaged through #8336」、沒有新 `platform` issue。推進前同一指令為 exit 1、28 筆待審 commit 與 1 筆待審 PR（#8252）。

## 2026-11-14：`v2.99.0..v2.100.2` 全版 tag diff 重放的本機驗證（分支 `ci/tagdiff-v2.100.2`；遠端 CI 尚未觸發）

範圍：1236 個上游變更檔（重放 commit `133061f40`：採用 948、適配 144、不適用 144、已等價 0），判定在 `docs/fork/UPSTREAM.md`「2026-11-14（續二）」節，清冊 `docs/fork/upstream-v2.99.0-v2.100.2-files.tsv`。所有測試在沙盒家目錄（`HOME`／`USERPROFILE`／`LOCALAPPDATA`／`APPDATA`／`TEMP` 指向 repo 外的暫存家目錄，`tests/preload.ts` 另外沙盒化應用程式家目錄）以 fresh process 分批執行，每批有逾時。**沒有**啟停或重裝真實服務、排程工作、`ocx.exe`、msiexec。

「環境性」一欄的判定依據：同一個測試在乾淨的 `refs/upstream-tags/v2.100.2`（暫時 worktree）或 `origin/main`（暫時 worktree）上得到相同結果。兩個暫時 worktree 用 `mklink /J` 借用整合樹的 `node_modules`，驗完已移除。

| 項目 | 結果 | 環境性失敗與基準 |
| --- | --- | --- |
| `tsc --noEmit`（2456 個檔案） | exit 0 | `bun run typecheck` 本身無法執行：`bun check` 的 bin 重新對應失敗（`bun install --ignore-scripts` 沒跑 `bun` 套件的 postinstall），改直接呼叫 `node_modules/typescript/bin/tsc` |
| `structure-ssot`、`privacy-scan`、`generate-ocx-skill-surface --check`、`file-size-ratchet`、`release-version-sources check 2.100.2` | 全部 exit 0 | — |
| `tools/dev_check.ps1` | `WINDOWS DEV CHECK GREEN`（11 份文件 0 斷鏈） | — |
| `tests/update`（65 檔，`--timeout 60000`） | 1298 pass、57 skip、4 fail | 4 案都是 `update-tree-ownership` 的 `symlinkSync` `EPERM`（本機沒有建立 symlink 的權限）；乾淨 `v2.100.2` 同樣失敗 |
| `tests/lib/file-identity-callers.test.ts` ＋ `tests/lab`（56 檔） | 合跑 552 pass、2 fail；單檔跑 `lab-automation-ingwannu-regressions` 3 pass、`file-identity-callers` 37 pass | 兩案：`CL-08 same-root successor`（合跑時負載造成，單檔過）與 `lab-activation.test.ts` 的 `beforeEach/afterEach hook` 逾時 14.9 秒（單檔跑也紅）。乾淨 `v2.100.2` 同樣組合同樣兩案，`lab-activation` 單檔同樣紅 |
| `tests/test-layout*.test.ts` | 29 pass、0 fail | — |
| `tests/service`、`tests/windows`、`cli/uninstall`、`cli/cli-resolve`（99 檔） | 2109 pass、20 fail | 19 案（`service-status-json` 1、`stop-deferred-teardown` R6 8、`stop-restoration-preflight` 1、`stop-restore-history-ownership` R7 9）在乾淨 `v2.100.2` 上跑同四個檔案得到一模一樣的 19 案失敗（見下方「執行環境與真實 LOCALAPPDATA」）。第 20 案 `windows-codex-cli-job-store` 的 `realpath LOCALAPPDATA\Temp` `ENOENT` 是沙盒家目錄少建一個 `AppData\Local\Temp`，補建後該檔 21 pass／0 fail |
| `desktop-telemetry-installer`、`client-fingerprint`（2 檔） | 36 pass、0 fail | — |
| 遙測（`usage-telemetry*` 含 fork 政策測試、`cli-telemetry*`、`server-telemetry*`、`telemetry-live-save`、`desktop-telemetry-installer`、`docs-telemetry-*`；18 檔） | 172 pass、3 fail | 3 案都是 `symlinkSync` `EPERM`（`cli-telemetry` 的 deferral 標記、`usage-telemetry-client` 的 D2 與 `writeTelemetryState` 兩案）；它們檢驗的是「不跟隨 symlink」，**本機未驗證**，要靠遠端 CI。`usage-telemetry-fork-policy` 6 案全過 |
| `tests/ci-workflows`（89 檔，`--timeout 60000`） | 1433 pass、5 fail | `bundledBunPath`、兩個 typecheck fixture 案、`keyring-smoke` symlink 案：乾淨 `v2.100.2` 同樣失敗；`doctor-gui-if-changed` 的 native npx 案：`origin/main` 同樣失敗（`bun run doctor` 同一個 bin 重新對應錯誤）。第一次整個目錄跑 6 案紅，多出的 `cold-spawn-warmup`（72.9 秒）是同時有 cargo 編譯的負載造成，單檔 7.8 秒 20 pass，靜止時整個目錄重跑為上列 5 案 |
| GUI：`bun run lint`、`bun run build` | exit 0 | — |
| GUI：`bun ../scripts/test-with-pinned-bun.ts --isolate tests`（`bun run test` 同義，但同樣受 bin 重新對應影響故直接呼叫） | 4346 pass、0 fail（417 檔） | — |
| docs-site：`bun run build` | 165 頁、23326 條內部連結檢查通過 | — |
| docs-site：`bun audit` | exit 1：`astro@7.3.3`（`@astrojs/starlight > @astrojs/mdx > astro`）2 筆（low、moderate），修正在 7.4.5 之後 | `origin/main` 的 `docs-site/bun.lock` 同樣 2 筆，**不是這次重放造成**；上游這輪沒有升 `astro`。是否升級另案處理（要先看 48 小時規則） |
| Rust `desktop/src-tauri`：`cargo test --lib`、`cargo clippy --lib --all-targets -- -D warnings`（`binaries/`、`resources/` 放空的建置輸入，跑完已刪） | 252 pass、2 fail；clippy 乾淨 | 2 案是 `login_registration` 的 `migration_rewrites_only_this_copys_own_enabled_entry`、`shared_fixture_matches_startup_safety`（macOS plist 與 uid 501 的 fixture）；乾淨 `v2.100.2` 同樣兩案，該檔在 fork 與上游此範圍內都沒有變動。fork 的 CI 沒有跑 `desktop/src-tauri` 的 cargo test |
| Rust `native/remote-workspace-helper`：test、clippy `-D warnings` | 全過 | — |
| Rust `native/ocx-child`：`cargo test --locked` | 其餘測試（含單元與 conformance）過、4 案 fail（`relay_and_lifecycle`：`failed to spawn detached ocx-child serve`，存取被拒）；`cargo clippy -D warnings` 紅（`platform.rs:606` `type_complexity`，工具鏈 1.98.1） | `native/` 與 `v2.100.2` 逐位元相同（`git diff` 空）；fork 的 CI 沒有跑 `ocx-child`。未與 `v2.100.2` 實跑對照 |

### 回歸（已修）

| 問題 | commit |
| --- | --- |
| `doctor-gui-if-changed.ts`、`lint-gui-if-changed.ts` 的 fallback 範圍被上游改成 `origin/dev`，fork 沒有 `dev` | `2c6f0bcd7` |
| zh-tw 兩頁的頁內錨點、`cli-telemetry` D12 讀已刪的 README 譯本 | `2e69d8d9e` |

run `43582644150`（`ce988fe85`）的 CI 問題回註：`link-child-update-contract` 的 CLI fixture 補傳既有測試閘門；`main-quota-provenance` 的 exit／timeout 診斷移除原始 stderr，保留允許清單欄位與原斷言。正式 `verified replacement` 並未失敗，同名紅燈來自診斷測試的刻意注入，不能據此認定實際 ACL 故障。逐項原因與修正見 `docs/fork/UPSTREAM.md`「2026-11-14（續二）」的「CI 後續修正」表。

### 執行環境與真實 `%LOCALAPPDATA%\OpenCodex\Runtime`

service 與 lab 相關測試（`stop-restore-writer-runner.ts` 等）會在**真實**的 `C:\Users\<帳號>\AppData\Local\OpenCodex\Runtime\v1\<SID>\` 底下建立以沙盒路徑雜湊命名的鎖檔（`native-write-locks`、`catalog-write-locks`、`history-write-locks`、`bun-test-locks`）。這是上游的設計，不是環境變數造成的：`src/codex/user-identity.ts` 的 `resolveWindowsRuntimeRoot` 用 `SHGetKnownFolderPath` 與行程 token 的 SID 決定路徑，註解明寫「never USERPROFILE or LOCALAPPDATA」，所以把 `LOCALAPPDATA` 指到沙盒**不會**改變它（失敗訊息裡的 `EBUSY` 路徑就是真實路徑）。這一輪從 17:00 起的唯讀檢查（沒有修改或刪除任何東西）：`native-write-locks` 約 60 個 0 位元組 `.sqlite`（17:11–17:17，加 17:44 的 4 個）、`catalog-write-locks` 約 40 個 4096 位元組 `.sqlite`（17:43–17:45）、`bun-test-locks` 一個鎖目錄（17:43，被中止的批次留下，可能是 stale）；`history-write-locks` 自 05:32 起沒有變動。該資料夾本來就有 10 月 28 日起歷次測試累積的檔案（native 4425、catalog 12489、history 504 個），沒有辦法從時間戳區分哪些屬於真實應用程式。fixture 的 `finally` 只 `rmSync` 自己雜湊的那個檔案（19 案 `EBUSY` 就是這步失敗）。**未完成**：在這個前提下沒有重跑 service 那一批，也沒有跑目錄級的全面掃描（計畫外，已中止）。

### 沒跑

- `tests/` 其餘約 2,600 個既有檔的完整分批（由遠端 12 片 Windows CI 負責）；本機只跑了上表列出的目錄。這不能當綠燈。
- 3 案 symlink 測試與 19 案 service 鎖測試在本機不可驗證，要看遠端 CI。
- `bun tools/check-upstream-updates.ts --strict` 沒有重跑（水位沒動，結果仍是整合前的 exit 1）。
- 3.4 的實機檢查（MSI 升級、桌面接管對話框、`ocx telemetry status --json`、wrapper 迴圈）：**未驗證**，等 MSI 建出並由維護者授權。

## 2026-11-14：`v2.99.0..v2.100.2` 全版 tag diff 重放的遠端 CI 結果與水位推進（分支 `ci/tagdiff-v2.100.2`）

上一節（本機驗證）當時遠端 CI 尚未觸發；本節補遠端結果。判定與修正細節在 `docs/fork/UPSTREAM.md`「CI 後續修正」表與 `docs/fork/DECISIONS.md` 2026-11-14（續）決定八。

| Run | HEAD | 結果 |
| --- | --- | --- |
| `43582644150`（`Cross-platform CI`，`workflow_dispatch` lane=all） | `ce988fe85` | failure：Windows 5/12 的 `link-child-update-contract`、Windows 12/12 的 `main-quota-provenance` 兩案；`8c220aad6` 修正 |
| `43587187450`（同上） | `8c220aad6` | success：12 個 Windows shard、`keyring windows`、`gates`、aggregate `ci` 全部 success（`windows native-main claim diagnostic` 依設計 skipped） |

**未驗證**：`Fork maintenance`、`Catalog async contracts` 沒有對此分支觸發，結果未查；`service-lifecycle` 的本機 lane 因為會寫真實的 `%LOCALAPPDATA%\OpenCodex\Runtime`（上一節），沒有重跑；`3.4` 實機檢查（MSI 升級、桌面接管對話框、`ocx telemetry status --json`、wrapper 迴圈）仍是**未驗證**，等 MSI 建出並由維護者授權。

Windows 各片耗時（run `43587187450`，job 起訖分鐘）：1/12 20.0、2/12 22.5、3/12 23.3、4/12 25.1、5/12 24.7、6/12 21.2、7/12 24.2、8/12 26.3、9/12 23.6、10/12 19.4、11/12 23.1、12/12 28.1（上限 30）。權重表以該 run 的 12 份 job log 刷新（`61a0582c0`，3033 檔）；刷新後的耗時尚未量。

shim 鎖回收（上游 `#8317`、`f3657d3f3`）的驗收：`bun test tests/codex-integration/codex-shim-windows-revision.test.ts tests/codex-integration/codex-shim-autorestore.test.ts`（31 pass、2 skip、0 fail）與 `codex-shim.test.ts`、`codex-shim-runtime-preflight.test.ts`（113 pass、8 skip、0 fail）；其中含「an aged lock whose owner records all name dead pids is reclaimed」與「an aged lock held by a live restore owner is never reclaimed」。對應的 `ROADMAP.md` 列已刪。

### `bun tools/check-upstream-updates.ts --strict`（水位推進後，exit **1**）

exit 1 的唯一原因是 commit 軸：`v2.100.3`（2026-11-14，`873ec9b3b`，與 `v2.100.2` 相差 170 筆）在本輪開工當天出現，整合目標刻意維持 `v2.100.2`（`DECISIONS.md` 2026-11-14 決定三）。PR 軸與 issue 軸都已清空。要 exit 0 只能等整合 `v2.100.3`；沒有為了讓它綠而調整水位或工具。170 列 commit 表在此略去（逐列內容與 `v2.100.2..v2.100.3` 的 `git log` 相同），其餘輸出原樣：

```text
# Upstream review report

- Upstream: `https://github.com/lidge-jun/opencodex.git` (stable release tags above `v2.100.2`)
- Reviewed through: `61147ec`
- Last review date: 2026-11-14

## Result

170 upstream commit(s) require review.

| Commit | Date | Subject | Files |
| --- | --- | --- | --- |
(170 rows omitted)

Review each commit, record adopt/skip decisions in `docs/fork/DECISIONS.md`,
then advance `tools/upstream_baseline.json` only after verification.

## Upstream pull requests closed without merging

Exact triage list: 26 PR(s) in `reviewed_pr_numbers`.
Legacy coverage: PRs <= #8086 closed before 2026-10-28 (UTC).

No untriaged closed-unmerged pull requests. Merged pull requests arrive with releases.

## Upstream platform issues

Triaged through `#8545`.

No new `platform` issues since that number.
```


## 2026-11-14：v2.100.3 的 wrapper 殘留處理

前述完整移除留下 wrapper 檔案的修正，現與上游 checked stop 接線整合。殘留清理保留具名失敗與三種拒絕條件，但不自行終止行程；可讀 wrapper 仍在時要求先執行 `ocx stop`／`ocx service stop`。WinSW ownership 在任何刪除前確認，原 locked-file 案例注入 owned 證據以對應此契約。14 分片取代 12 分片，既有量測權重保留，新測試以 tag 的權重作種子。


## 2026-11-15：繁中錨點與 React Doctor 啟動器回註

繁中頁面的內部連結須使用翻譯後標題產生的 slug。安裝、桌面、整合、Remote Link、子代理介面、生命週期、帳號與兩份設定參考中的 14 筆連結已改用既有繁中段落的錨點；目標段落均存在，無須新增段落或修改英文頁。

2026-11-14 表列的 React Doctor native npx 啟動案例，其 255 發生於 `bun run doctor` 選到 `node_modules/.bin/bun.exe` 後無法 remap，早於 npx 啟動。`doctor-gui-if-changed.ts` 在 HEAD 與 v2.100.3 都可遇到同一錯誤；fork 的 `run-react-doctor.ts` 與 GUI doctor scripts 相對 HEAD 沒有差異。這是本機 Bun 套件啟動器問題，並非 v2.100.3 重放回歸；保留缺少 npx 時略過掃描的處理及原測試斷言。


## 2026-11-15：`v2.100.2..v2.100.3` 遠端 CI 結果與水位推進

分支 `ci/tagdiff-v2.100.3`；逐檔清冊共 1684 檔（採用 1247、適配 156、不適用 281、已等價 0）。

| Run | HEAD | 結果 |
| --- | --- | --- |
| [43617213956](https://github.com/SanHsien/opencodex/actions/runs/43617213956) | `9a3cc8dbb` 的修正前版本 | failure：gates locale parser、Windows 13/14 ocx-child filter、14/14 已刪語系、3/14 GET `/api/storage` totals、11/14 unsafe Windows ledger 第二次 plan，共五項。 |
| [43638705529](https://github.com/SanHsien/opencodex/actions/runs/43638705529) | `9a3cc8dbbb6f849d27afbe5617d944c7c87a0690` | success：14 片 Windows 全量 CI 全綠。前三項由此 HEAD 修正，後兩項與上游 tag 相同，重跑通過，判為暫時性。 |

### 問題回註

- locale parser：移除漏讀同行 key 的行首錨點，保留 en／zh-TW 集合相等斷言。
- ocx-child：補回 `remote_helper` 的 crate 與 conformance fixture 兩條 filter，維持既有 job 與權限。
- weekly conflict：測試只讀 en／zh-TW，保留 placeholder 與翻譯斷言。
- GET `/api/storage` 與 unsafe ledger：run `43638705529` 對應案例通過；不修改測試、產品、拒絕順序或逾時。前者兩次 inventory 間的寫入來源、後者第二次 plan 的 toolchain authority／identity 拒絕位置未確定，再次發生時依 `UPSTREAM.md` 表取證。
- `main-quota-provenance`、`codex-launcher-diagnostics`、`codex-native-residue` 對應檔案在本輪 Windows CI 通過；偶發重審條件與非虛擬化維護者終端驗收分別保留於 `ROADMAP.md`。

### 權重與水位

以 run `43638705529` 的 14 份 Windows job log 執行 `scripts/ci/test-durations.ts refresh --table scripts/ci/test-durations.windows.tsv`，3258 檔均有量測值。各片 job 起訖耗時（分鐘）：1:20.5、2:25.9、3:26.5、4:28.8、5:24.1、6:25.1、7:20.4、8:26.3、9:22.0、10:15.4、11:20.6、12:21.7、13:26.1、14:18.5；最長片 28.8 分鐘，離 30 分鐘上限約 1.2 分鐘。這些是刷新前的實測，刷新後耗時由下一次正常全量 CI 觀察。

水位推進到 `refs/upstream-tags/v2.100.3`（`873ec9b3b8ddf63f06738748d9132d779abefb42`），日期 2026-11-15。PR 清單維持 26 筆，issue 水位維持 8545；依據為 `70e0ee262` 判定、170 筆 commit 審查、逐檔清冊及本節綠燈 run。

**D2 實機問題回註（2026-11-15）**：維護者回報一般權限 Windows 11 連續兩次 `ocx service stop` 回 unknown、exit 1；排程 Ready，但 wrapper 與 port 10100 代理仍在執行。CLI 現在列出清理後的 `partA.reason` 與 `detail`，適用 stop 與服務移除。回報中的 `the stop could not be verified` 對應 Part A 最後的驗證分支，根因已由下方只讀診斷確定為 1 秒 task 狀態讀取。上游 tag `v2.100.3` 的 checked-stop 核心、live deps、行程證據與 CLI 接線均與整合基底相同；D2 原有差異在殘留清理及刪除前探測，本次另修正非英文狀態解析。服務停止與移除的完整驗收仍由 `ROADMAP.md` D2 列追蹤。

**D2 根因與修正回註（2026-11-15）**：只讀診斷確認 registration=present、winsw=nonexistent、行程清單可讀。taskState 的 1000 ms 預算中，schtasks 於 50 ms 回傳繁中「就緒」，英文解析器未辨識而轉入 PowerShell；冷啟動 982 ms 超過剩餘 949 ms，產生 unknown。已修正 `parseTaskCsvState` 的已知語系完整字串比對，保留未知文字的備援、fail-closed 與原預算。這是與上游 v2.100.3 相同的缺陷，已列入 `docs/fork/UPSTREAM.md`；D2 實機驗收列繼續保留。

`Fork maintenance`、`Catalog async contracts` 的本輪結果未查；水位推進後的 `bun tools/check-upstream-updates.ts --strict` 結果亦未取得，不宣稱 exit 0。


## 2026-11-15：D2 行程證據編碼與 MSI 靜默升級問題回註

**MSI 自動重新開機問題回註**：升級流程已改為在 InstallValidate 前，以安裝者身分呼叫已安裝舊版 `[INSTALLDIR]ocx.exe service stop`，先走 checked stop 阻止 wrapper 再次啟動代理；失敗不阻斷安裝、不改用強制終止。停止與原有 InstallFinalize 後恢復動作同時涵蓋 major upgrade 及同產品 repair／reinstall，排除解除安裝。兩者 Directory 均為 TARGETDIR。新增 `REBOOT=ReallySuppress` 預設；若檔案仍占用而回 3010，須人工安排重新開機，再確認 `/healthz` 新版本。停止後安裝失敗時不自動恢復服務。這補齊前次只有恢復動作、無法阻止 wrapper 在替換期間重啟的缺口；D2 保留此順序、無自動重新開機及新版本的實機驗收。

D2 前一筆狀態解析修正之外，實機再次出現 exit 1，這次原因為 `evidence-unreadable`／`the process list could not be read`。兩個含非 ASCII 命令列的行程讓 PowerShell 5.1 產出的 CP950 JSON 被當成 UTF-8；snapshot 已固定 UTF-8，無法讀取仍拒絕停止。上游 v2.100.3 有同一段未指定編碼的查詢，屬上游缺陷。

MSI 的 `/qn` 紀錄確認 Restart Manager 關閉 wrapper；排程「就緒」、上次結果 267014、150 秒無 listener。2026-11-14 `/qb` 的 wrapper 存活紀錄不能代表這條路徑。已補上升級完成後恢復既有啟用根排程的 WiX 動作，排除一般安裝與解除安裝，保持安裝者權限與 Restart Manager 的檔案替換。上游 WiX 也沒有此恢復動作，屬上游安裝流程缺口；不處理未受排程管理的 runtime。原 #8246 列要求的方案判斷與實作已完成，實機升級驗收併入保留的 ROADMAP D2 列。

### src/ stdout 編碼盤點

| 讀取點 | 處理 |
|---|---|
| `service/windows-process-evidence.ts`、`service/windows-guarded-manager.ts` | 行程命令列、名稱、WinSW 路徑 JSON 明定 UTF-8；讀取與解析失敗維持 null。 |
| `service/windows-checked-stop-live.ts` | schtasks／sc 既有位元組語系解碼保留；Get-ScheduledTask 備援明定 UTF-8，仍解析固定 enum。 |
| `config/process-state.ts`、`codex/app-server-processes.ts` | 命令列／擁有者字串查詢明定 UTF-8；原生 UTF-16 讀法不變。 |
| `codex/desktop-app/windows.ts`、`codex/desktop-compatibility/installed-build.ts` | 安裝路徑、行程路徑與套件證明明定 UTF-8；原有命令列 Base64 保留。 |
| `lib/winsw.ts` | sc qc 的非 ASCII 帳號名稱改讀 buffer，再用 decodeWindowsTextBytes（輸出中的路徑也保留原字）；status 固定識別字與 SCM 數字狀態不變。 |
| Schedule PID 備援、`service/windows-ops.ts`、`codex/prompt-lock-owner.ts`、`codex/native-profile-processes.ts` | 分別只解析 sc 固定欄位與數字、PrincipalSource enum、ticks、行程數；不以本地化文字判斷身分。 |
| `service/windows-scheduler.ts`、`tray/windows.ts`、`lib/windows-user-principal.ts` | 既有 buffer／UTF-16／語系解碼；SID 為 ASCII。 |
| `codex/user-identity.ts`、`service/desktop-recovery-process.ts`、`link/remote-windows.ts` | 已使用 Base64 或明定 UTF-8。 |
| `claude/intercept/local-ca-windows.ts`、`claude/intercept/picker-trust-windows.ts`、`lib/windows-owner-acl.ts`、`codex/desktop-compatibility/windows-{certificate-trust,key-protection,package-command}.ts` | 機器可讀輸出只有 SID、整數、布林、Base64、固定標記或受限 ASCII 套件識別字；非 ASCII 輸入不直接作為輸出識別依據。 |
| `lib/win-exec.ts`、`service/managing-cli.ts`、CLI 版本探測、`server/port-reclaim.ts`、`server/windows-tcp-drop.ts` | cmd 版本探測只取版本數字；netstat 只取通訊協定、位址與 PID，既有固定字碼頁或位元組解碼保留。其他 shell 啟動點不解析 stdout，或從獨立結果檔讀取。 |

CP950 固件含「功」（尾位元組 0x5c），防止把損壞 JSON 當成空行程表，也防止 UTF-8 生產端設定被移除。PowerShell 測試以固件函式取代 CIM，MSI 分支測試以函式取代排程 cmdlet，均不接觸真實行程或排程。

既有安裝測試改為直接禁止遙測 fragment 與 component group，不再禁止所有 WiX 擴充；新增的服務恢復 fragment 不會連回遙測頁。

**CI 遙測斷言回註**：`b49441160` 只同步了 `desktop-telemetry-installer.test.ts`，漏掉 `usage-telemetry-fork-policy.test.ts` 的重複限制；run `43687623401` 因 `wix/service-recovery.wxs` 存在而失敗。後者現改為禁止遙測 fragment 與 component group，並檢查連結的 fragment／自訂模板不得包含遙測安裝頁或 component group。遙測預設關閉、不詢問、不送出的斷言維持不變。

## 2026-11-15：ensure 遞迴與 ACL 放大問題回註

內部 Codex 呼叫補上 `OCX_SHIM_BYPASS=1`；原先一併加入的設定目錄 ACL 合規跳過路徑已撤回，見下方 2026-11-16 回註。原版 shim 的分流原本存在，自訂 shim 遺漏與上游內部呼叫缺少防線是兩個不同原因。

服務安裝仍採 required hardening；跨行程無同樹工作所有權證據，不能把 timeout 當成可安全等待或成功。spill 已有啟動及定期清理，751 個項目的實體分類仍需釐清，保留 ROADMAP 的 D2 驗收列並加入分類項目。根因、程式碼依據與未增加跨行程鎖的理由見 `docs/fork/DECISIONS.md` 同日「阻斷 Codex shim 遞迴」。

## 2026-11-15：D2 uninstall 預期與服務 ACL 逾時問題回註

**第 4 項預期更正**：`service uninstall` 先 `windowsServiceRemovalStop`，才進入 `uninstallServiceDetailed`。前者與上游 `refs/upstream-tags/v2.100.3` 相同；WMI 建立的 wrapper 若是已驗明代理的祖先，符合映像、路徑及建立時間證據，沒有排程仍是 bound。停止 wrapper、正常關閉代理、確認 port 後清掉三檔，是符合設計的結果。原 D2 的「執行中就 failed、留檔、不終止」只適用後段 `removeWindowsServiceWrapperResidue`；不適用已經 checked stop 的整個命令。無已驗明代理或其他合法血緣時，wrapper 是 unbound，仍不終止並拒絕移除。先前 wrapper 殘留處理與 D2 回註依此限定解讀；中英生命週期文件及結構文件已明列兩階段。

## 2026-11-16：撤回 ACL 合規跳過方案回註

前節服務 ACL 問題改回原有 hardening：設定目錄讀取、config mutation lock、Windows service mutation lock 與服務 token 發布不再先做合規讀取。`5f5b69f53` 的合規 memo 同時撤回；原有 lifecycle lock 驗證保留。先前為合規讀取新增的 async owner-ACL fixture 注入、選項斷言與 native-main teardown 調整，均恢復至 `10c8bfa79^`；shim bypass、MSI 與 D2 bound／unbound wrapper 測試保留。

run `43720865406` 與 `43726376154` 各有六片約 30 分鐘後取消；每個新目錄約 1.3 秒的 PowerShell 嚴格讀取成本仍在，合規 memo 未使方案成立。兩輪全部分片耗時與撤回理由見 `docs/fork/DECISIONS.md` 2026-11-16 條目。這次撤回不代表實機 ACL 逾時已解決：維護者機器約一半 `ocx service stop`／`uninstall`／`install` 因 `ACL hardening timed out` 失敗，根因未定，ROADMAP 記錄量測 icacls、檔案占用與目錄項目數的調查方向。D2 第 4 項的更正與 MSI 停止服務、防止自動重開機及目錄修正保持有效。

## 2026-11-16：v2.100.7 D2 實機驗收回註

一般權限繁中 Windows 11，`v2.100.7`（tag 指向 `8242077f5`，MSI sha256 與 release 相符）。

| 項目 | 結果 |
| --- | --- |
| `/qn` major upgrade | `msiexec /i … /qn REBOOT=ReallySuppress /l*v` exit 0，24 秒，未重新開機；升級前服務在跑，升級後自動恢復為 2.100.7，排程 Running。 |
| 第 3 項 `ocx service stop` | exit 0（39 秒）。 |
| 第 4 項 unbound／bound wrapper | 刪除排程、`ocx stop` 後以 WMI `Win32_Process Create` 啟動 wrapper，代理為其子行程；`ocx service uninstall` exit 0，wrapper 與代理在 33–36 秒內結束，三個 wrapper 檔刪除。符合 2026-11-15「釐清 D2 移除語意」更正後的預期。 |
| 第 5 項 install → stop → uninstall | stop exit 0（28.7 秒，wrapper 與代理停止、排程 Ready、三檔保留）；uninstall exit 0（31.8 秒，排程與三檔清除）。 |

**仍未解決**：Codex 執行中時兩次 ACL hardening 逾時（`service install`：`/remove:g`、`elapsedMs` 8083、`budgetMs` 8072；`service stop`：`/remove:g`、`elapsedMs` 581、`budgetMs` 424），以及一次 ensure 在 stop 後搶先拉起代理造成的 `Port 10100 could not be confirmed free after the stop`。兩者分別列入 `ROADMAP.md` 中期表；MSI 例外路徑（停止失敗、3010、無排程）仍待實機條件。

## 2026-11-17：v2.100.9 服務操作期間自動啟動閘門實機驗收未通過回註

一般權限繁中 Windows 11，`v2.100.9`（tag `6ec30d463`）。install→stop→uninstall 輪流 7 輪共 21 次，背景每 20 秒新起一個 `codex exec`，每次服務操作開始 3 秒後另跑一次 `ocx.exe ensure`（模擬 Codex shim）。install 7/7、stop 7/7、uninstall 5/7；兩次 uninstall 回 `The proxy answers on port 10100 again after the stop; it is being respawned.`，另有兩次 `ocx ensure` 因 `another process owns the runtime mutation lease` 直接 exit 1。21 次都沒有出現閘門的等待訊息。

**根因**：`6ec30d463` 只在 `ocx codex`／`ocx claude`／minimax／opencode 的自動啟動加了閘門，Windows Codex shim 每次執行的 `ocx ensure`（`dispatch.ts` 的 ensure → `handleEnsure`）沒有。修正見 `docs/fork/DECISIONS.md` 2026-11-17「`ocx ensure` 也走服務操作閘門」；`Port … could not be confirmed free` 與 ACL 逾時本輪 0 次。

## 2026-11-17：v2.100.10 服務操作期間自動啟動閘門實機重驗未通過回註

`v2.100.10`（tag `f9c574aba`），同一支腳本 21 次：install 7/7、stop 7/7、uninstall 6/7（一次 `… it is being respawned.`）；7 次 shim `ocx ensure` 以 `another process owns the runtime mutation lease` exit 1；等待訊息 0 次。

**根因（實測）**：以同樣的無等待 `BEGIN IMMEDIATE` 每 0.2 秒取樣服務鎖，`ocx service stop／uninstall／install` 開頭 11.0–12.4 秒都是 idle，之後才 busy。服務指令在取鎖前先做 Desktop 監管檢查（兩次 PowerShell 各約 1.2 秒）與鎖目錄、鎖檔的 ACL hardening（icacls＋身分查詢），負載下合計約 11 秒；閘門在這段時間看到 idle 就放行，而 install／uninstall 這段已經握著 runtime ownership lease。修正見 `docs/fork/DECISIONS.md` 2026-11-17「服務指令一開始就取鎖；ensure 遇 lease 改為等候」。

## 2026-11-17：v2.100.11 服務操作期間自動啟動閘門實機重驗回註

`v2.100.11`（tag `f01dee005`），同一支腳本在負載下 21 次（每 20 秒新起一個 `codex exec`，共 40 次全部回 OK）：服務指令 21/21 exit 0；respawned 0、port 未釋放 0、ACL 逾時 0；ensure 撞 runtime lease 0。lockprobe：服務鎖在指令開始後 0.6–1.0 秒轉為 busy（`v2.100.10` 為 11–12 秒）。21 次 ensure 都印出等候訊息，耗時 25–62 秒。

**新症狀**：4 次 ensure（2 次 stop、2 次 uninstall 之後）等完後起的 `ocx start` 沒在時限內變 healthy，印 `❌ Proxy did not become healthy after starting.`，exit 1（耗時 29.0–40.3 秒）。被起的子行程輸出原本被丟棄，查不出原因；`ocx ensure` 改為把子行程輸出寫到設定目錄的 `ensure-start.log`，失敗時印出子行程結束碼、存活時間與最後幾行，見 `ROADMAP.md`。

## 2026-11-17：v2.100.12 ensure 失敗取證回註

`v2.100.12`（tag `640eb720f`），同條件 21 次：服務指令 21/21 exit 0，respawned、port 未釋放、ACL 逾時皆 0；ensure 4 次 exit 1（08-stop、09-uninstall、11-stop、12-uninstall）。新加的診斷顯示：ensure 所起的 `ocx start` 在 3.8–6.8 秒後以 `OWNERSHIP_MUTATION_LEASE_BUSY` exit 1（`handleStart → bindAndPublishStartOwnership` 或 `recoverStartStateUnderOwnershipLease`），持有者是另一個同時被起、後來成功的代理；`ensure-start.log` 同時有兩筆不同父行程的 spawn。

**根因**：服務操作結束時，多個等候中的 ensure 同時醒來各起一個 `ocx start`；輸掉 lease 的子行程結束後，它的 ensure 依「子行程已結束只再等 8 秒」放棄，而贏的代理尚未 healthy。修正見 `docs/fork/DECISIONS.md` 2026-11-17「另一個啟動持有 lease 時 ensure 等到上限」。

## 2026-11-18：v2.100.13 並行 ensure 驗收回註

`v2.100.13`（tag `9b2bde58d`，MSI 以 `/qn REBOOT=ReallySuppress` 安裝，exit 0、未重開機），以 `v2.100.12` 的 gate-test 在負載下跑 21 次（同時 40 次 `codex exec`，全部回 OK）：服務指令 21/21 exit 0；respawned、port 未釋放、ACL 逾時皆 0；ensure 21/21 exit 0，耗時 28.8–57.0 秒，21 次都印出等候訊息。升級後 `ensure-start.log` 有 27 次 spawn，其中 13 次子行程撞 `OWNERSHIP_MUTATION_LEASE_BUSY`，沒有一次讓 ensure 誤報失敗；`another ocx start held the runtime ownership lease` 0 次。第 17–20 次負載迴圈已結束，後段的並行壓力比前段低。結論：`v2.100.12` 的 4/21 誤報已修正，`ROADMAP.md` 對應列已刪。

## 2026-11-18：Codex 獨立覆核 v2.100.12–13（ensure、ctime-only 用量快取）

Codex（gpt-6.1-sol，唯讀）覆核 ensure 並行修正與「只有 ctime 變動不重建用量快取」。每條發現都先自己讀程式碼確認，再決定修或不修。

- **已修，`06fc263c5`（2026-11-18）**：
  1. 原本只靠輪詢 lease 檔判斷競爭。贏方持有 lease 的時間短於一次輪詢間隔時會漏看，輸方 ensure 等 8 秒就誤報失敗。現在子行程結束後，會在本次 spawn 的 log 段落裡找 busy 碼，有就算競爭。
  2. 寫 header 失敗時沒關 log fd；`spawn` 同步拋錯時 fd 洩漏；失敗報告可能顯示別的 ensure 的錯誤。三項都已修。
  3. ensure 重試時，gate 每次都重新拿到完整 90 秒。現在只給剩餘的時間。實際上限是 gate 等待（≤90 秒）加上 readiness（40 秒）。
  4. 篩選彙總的 unchanged 分支在 await 之後沒有重查價格與時區。
  5. 未換行尾段被同大小改寫時，會沿用舊的「沒有無效列」診斷。現在驗證時看到 invalid 或 oversized 列就重建。
- **已接受的限制，不修**：
  - 64 KiB digest 視窗之前的同大小改寫偵測不到。
  - lease 殘留加上 PID 被重用時，會誤認成另一個 start，結果是多等一段時間、診斷文字不準。
  - 兩個 ensure 同時截斷 log 時，其中一個的 header 可能被清掉，那一方就只靠輪詢判斷競爭。

## 2026-11-21：計時型 flaky 測試修正回註

修正 commit：`039a3aeed`（2026-11-21）。

`ROADMAP.md`「追蹤整合後殘留的計時型 flaky 測試」的五個檔。每案先在負載下重現，再改測試，再用同樣負載重跑。負載是本機 24 執行緒旁邊開 N 個 `bun` 忙迴圈行程，同一檔連跑；根目錄測試帶 CI 的 `--timeout 60000`，gui 測試照 CI 不帶（Bun 預設 5 秒）。本機只有 Bun 1.4.5（`testRunnerBun` 釘 1.4.4）。產品碼只把 `COPY_FEEDBACK_MS` 改成 export，行為不變。

| 測試 | 計時假設 | 修前 | 修後 | 修法 |
| --- | --- | --- | --- | --- |
| `responses-pool-401-refresh`「a post-refresh credit hold in the pacing queue does not announce a replay send」 | 用牆鐘的 2 秒 pacing 間隔，假設 refresh 加 replay 準備在 2 秒內完成，replay 才會進佇列被看到；另以 500 次 `Bun.sleep(1)` 輪詢 | 8/8 失敗（24 個忙迴圈），`queued` 收到 0；refresh 的 ACL hardening 本身就超過 2 秒 | 0/8 | 新 helper `tests/helpers/manual-pacing-clock.ts`：pacing 時鐘只在測試推進時前進，replay 一定排隊；以 pacing 排定喚醒計時器的事件確認「已排隊」，取代輪詢 |
| `web-search-anthropic`「synchronous empty chunks cannot starve the bounded EOF probe」 | 一個 5 秒看門狗同時涵蓋子行程冷啟動、模組載入與 probe 本身 | 5/8 失敗（24 個忙迴圈），看門狗在子行程印出任何東西前就殺掉它 | 0/8 | 子行程載入 parser 後先印就緒標記；冷啟動用 `COLD_SPAWN_BUDGET_MS`，probe 自己的期限從就緒起算，用 `INTERNAL_DEADLINE_MS` |
| gui `login-url-block` | (1) 第一個案例的 5 秒內含第一次 `import("react-dom/client")`；(2) 「keeps the latest feedback…」用真實 200＋2400 毫秒等待，檢查點只在第二次點擊的 2500 毫秒視窗內 100 毫秒 | 單檔 24、72 個忙迴圈各 0/8 重現不出；6 份同時跑加 48 個忙迴圈 5/24 失敗：4 次 (1) 逾時（6.6–10.3 秒，其中一次連帶下一案失敗），1 次 (2) 的「Copied」已消失 | 0/24（同樣 6 份＋48） | (1) react-dom/client 改在 `beforeEach` 載入（DOM globals 已就位），hook 用新的 `DOM_RENDER_BUDGET_MS`；(2) 只接管 `COPY_FEEDBACK_MS` 那個計時器，改用測試推進的時鐘，並補驗第二次的視窗確實會結束 |
| gui `models-empty-provider` | 「Models page combines…」整頁情境是 CPU 密集的 `act()` 序列，閒置 0.8 秒，被 Bun 預設 5 秒限制；「Cursor discovery failure…」綁真的 HTTP/2 listener | 5/8 失敗（24 個忙迴圈）：5 次都是整頁情境逾時，逾時後它繼續跑撞到已拆的 globals，其中 1 次連帶「a poll that resolves after a forced refresh…」失敗；另 1 次 Cursor 案也 5.7 秒逾時 | 0/8 | 整頁情境用 `DOM_RENDER_BUDGET_MS`，Cursor 案用既有的 `SERVER_BUDGET_MS` |
| gui `usage-custom-range`「America/Santiago midnight DST…」 | 子行程 `bun test` 的 `spawnSync` 固定 12 秒，要涵蓋冷啟動與載入整個測試檔模組圖 | 6/6 失敗（24 個忙迴圈），子行程只印出 banner 就被殺 | 0/6 | spawn 逾時改 `COLD_SPAWN_BUDGET_MS`（此檔唯一的子行程），子行程自己案例的 10 秒期限不變 |

**ablation（確認測試沒有因此變空）**：把 `passthrough-dispatch.ts` 的 replay 通知移到 `replayGuard` 前面，pacing 案失敗（`dispatchSignals` 收到 1）；拿掉 `anthropic-executor.ts` probe 迴圈裡的 `setTimeout(0)` 讓步，EOF 案在 probe 期限（約 15.9 秒）失敗，`timedOut` 為 `"probe"`；拿掉 `use-copy-feedback.ts` 的 `clearTimer()` 與世代檢查，login 案在「Copied」斷言失敗。三處都已還原。

**其他驗證**：`bun scripts/file-size-ratchet.ts`、`bun run privacy:scan`、`bun run structure:check`、`bun run lint:gui` 皆 exit 0；`bun test --isolate --timeout 60000` 跑 `responses-pool-401-refresh`、`web-search-anthropic`、`test-layout`、`test-layout-tooling` 共 157 pass／0 fail；`cd gui && bun x tsc -b` exit 0。`bun run typecheck` 在 Bun 1.4.5 不能跑（`bun check` 不存在）；改用 CI 的 `bun x tsc --noEmit`，只有 `src/providers/cc-switch-import-source.ts` 兩個既有錯誤（`Database.function`，這次沒動）。
**沒做完**：ROADMAP 驗收的「滿載下全量 gui 三次無失敗」。24 個忙迴圈下的第一次全量 `cd gui && bun test --isolate tests` 跑約 13 分鐘、只到 `codex-account-pool-*` 就中止：`claude-toggle-race` 一案超過 Bun 預設 5 秒（7.5 秒），同檔 7 案撞上測試自己 2 秒的 `waitFor`，另 2 案跟著失敗。這些不在原列五檔內、還沒分析，已改列在 `ROADMAP.md`。無負載的全量 gui 結果：`cd gui && bun test --isolate tests` 4506 pass／3 fail（427 檔，853 秒），三案都不是這次動到的檔，單檔各重跑兩次全過：`codex-account-pool-target-switch`（第 247 行斷言）、`remote-workspace`（5.9 秒逾時）、`switch-rule`（5.0 秒逾時）。同樣列進 `ROADMAP.md`。

## 2026-11-21（續）：gui 全量在負載下的其他計時型失敗

修正 commit：`c9720bdf2`（2026-11-21）。

`ROADMAP.md`「追蹤 gui 全量測試在負載下的其他計時型失敗」列的四個檔，加上負載全量新冒出的九案（第一次八案、第二次的 `form-controls-rule`）。方法同上節：每案先在負載下重現（單檔連跑，或負載下的全量；單檔重現不出的，另以注入把同一機制放大到每次都失敗），再改測試，再用同樣負載重跑。gui 測試照 CI 用 Bun 預設 5 秒。負載是本機 i7-13700F（24 執行緒）旁邊開 N 個 `bun` 忙迴圈行程。**產品碼沒有改**；每案都做了 ablation（暫時拿掉它保護的產品行為、確認測試變紅、還原）。

| 測試 | 計時假設 | 修前 | 修後 | 修法 | ablation |
| --- | --- | --- | --- | --- | --- |
| `claude-toggle-race`（11 案） | (1) 第一案的 5 秒內含第一次 `import("../src/App")`；(2) 自己的 `waitFor` 固定 2 秒，等於在量整個 App 掛載多快；(3) 部分 `waitFor` 的 predicate 在開關還沒出現時直接拋錯 | 24 個忙迴圈 4/6 失敗：第一案逾時（5.1–14.5 秒）後繼續跑；有兩次各 7 案撞上 2 秒 `waitFor`；其餘是開關還沒出現就拋「switch not found」 | 24 個忙迴圈 0/6 | App 模組圖改在 `beforeEach` 載入（happy-dom globals 已就位），hook 用新的 `APP_MODULE_GRAPH_BUDGET_MS`；每案掛整個 App，用 `DOM_RENDER_BUDGET_MS`。`waitFor` 仍在 act() tick 間輪詢：頁面只在 act 裡前進，沒有「開關出現」的事件可等；期限改 `INTERNAL_DEADLINE_MS`，predicate 拋錯算「還沒好」，逾時訊息帶最後一個錯誤 | 拿掉 `use-claude-connection.ts` 的 `if (inFlight.current) return;`，第一案在 PUT 次數斷言失敗；拿掉 `ClaudeCode.tsx` `toggleFirstParty` 的 `firstPartyInFlight` 檢查，「CLI first-party waits for one PUT…」失敗 |
| `codex-account-pool-target-switch`（13 案） | (1) 第一案的 5 秒內含第一次 `import("react-dom/client")`；(2) `switchTarget` 在 act 外 render 後只等一個 `setTimeout(0)`，假設那時新 target 已 commit | (1) 24 個忙迴圈 0/6 重現不出；48 個忙迴圈加 6 份同時跑 3/24 失敗，都是第一案逾時（5.2–7.0 秒）連帶後面各案。(2) 負載下沒自然重現；在 switch 前排一個 8 毫秒的 React Scheduler 工作，3/3 在原第 247 行 `expect(ids()).toEqual([])` 失敗、`ids()` 仍是 `["b2"]`：Scheduler 用完 5 毫秒切片就讓出，render 落到測試的計時器之後 | 48＋6 份 0/24；注入 8 毫秒工作 0/3 | (1) react-dom/client 改在 `beforeEach` 載入，hook 用 `DOM_RENDER_BUDGET_MS`；(2) `switchTarget` 改等新 target 的 commit（Probe 的 layout effect，**事件驅動**），之後保留一個 `setTimeout(0)` 讓被放行的舊讀取的 microtask 跑完 | `useCodexAccountPool.ts` 的 `loadIsCurrent` 改成只比 seed key：修前修後都在同一個斷言（round trip 案）失敗，「an old visit's read…」也失敗 |
| `remote-workspace`「Remote Workspace route gates…」 | 該案 5 秒內含第一次 `import("../src/App")` | 24 個忙迴圈 4/6 失敗：該案逾時（5.0–6.7 秒）後繼續跑，後面 9 案跟著失敗 | 24 個忙迴圈 0/6 | 同一組模組在 `beforeEach` 先載一次（各案自己的 `import()` 變成快取命中），hook 用 `APP_MODULE_GRAPH_BUDGET_MS` | `App.tsx` `RemoteWorkspaceRoute` 的 `if (!available)` 改成永遠 false，該案失敗 |
| `switch-rule`「every role=switch control uses…」 | 讀並用 TypeScript 解析 263 個 `src/**/*.tsx`（閒置約 0.5 秒），受 Bun 預設 5 秒限制 | 24 個忙迴圈 5/6 逾時 | 先給 30 秒，24 個忙迴圈仍 1/6 逾時（30.0 秒）；改 Windows 90 秒 | 新的 `SOURCE_SCAN_BUDGET_MS` | `ClaudeDesktopPicker.tsx` 開關的 class `toggle` 改 `knob`，在 offender 斷言失敗 |
| `codex-account-pool-behaviour`「subscribing never fabricates a server read」 | 預設帳號有 credential、沒 quota，pool 會在 350／900／2000 毫秒排補抓 quota 的重讀；測試假設訂閱到明確 `load()` 之間不會撞上 | 負載全量 1 次：訂閱者收到兩筆讀取；單檔 24 個忙迴圈 0/6；在訂閱後插 400 毫秒，2/2 同樣失敗 | 插 400 毫秒仍 2/2 通過 | 這案只管訂閱，帳號改成沒有 credential，背後就不會排重讀 | 讓 `subscribeLoadObserver` 訂閱時用上次的讀取呼叫 `acceptActiveRead`，在第一個 `toEqual([])` 失敗 |
| `connect-pairing`「App mounts the relay pairing form…」 | 這案自己先裝 App 匯入時要讀的 globals 與 meta，再第一次 `import("../src/App")`，都在 5 秒內；另有 1、1、5 秒的牆鐘期限 | 負載全量 1 次：5.0 秒逾時，沒跑完的步驟在下一個檔的 globals 上報錯（403≠401） | 見下方全量 | 案例本身用 `APP_MODULE_GRAPH_BUDGET_MS`（不能移到 hook，見檔內註解）；三個期限改 `INTERNAL_DEADLINE_MS` | 拿掉 `api.ts` `sessionHeaders()` 加 machine-session header 那行，在 header 斷言失敗 |
| `models-price-editor`「GET and PUT receipts reject extra keys…」 | 一案跑十輪整頁開啟／編輯／儲存／重讀，CPU 密集的 act() 序列 | 負載全量 1 次 5.0 秒逾時 | 見下方全量 | `DOM_RENDER_BUDGET_MS` | `model-price-cost.ts` 的 `hasKeys` 不再比 key 數（允許多餘 key），該案失敗 |
| `host-visibility`「a polling subscriber skips its interval…」 | 恢復可見後等 50 毫秒再數，要剛好只多 1 次；輪詢間隔 150 毫秒 | 負載全量 1 次：數到 3 次（預期 2） | 見下方全量 | 改記每次抓取的時間，斷言補抓之後的下一次至少隔 100 毫秒：負載只會把間隔拉長，連發（burst）會讓下一次緊跟在後 | 把 `client-resource.ts` 恢復時的補抓改成連發 3 次：新斷言量到間隔 0.75 毫秒而失敗（舊斷言也失敗） |
| `control-size-rule`、`professional-rules`（v2 原始碼 regex 掃描）、`form-controls-rule`（JSX 標籤掃描）、`text-encoding-hygiene`（UTF-8／亂碼掃描）、`rounded-full-radius`（真的 Tailwind 編譯 `theme.css`） | 讀整個原始碼樹或編譯真實原始碼，受 5 秒限制 | 負載全量各 1 次超過 5 秒（5.0–6.1 秒；同步掃描的 `form-controls-rule` 10.4 秒，runner 中斷不了） | 見下方全量 | `SOURCE_SCAN_BUDGET_MS` | 在 `src/components/ui-v2/` 暫放一個含 `h-8 cursor-pointer`、`animate-pulse`、U+FFFD 的檔，三個掃描各自失敗；暫放含原生 `<select>` 的 `src/zz-ablation.tsx`，`form-controls-rule` 失敗；`theme.css` 的 `--radius-full` 改回 `calc(infinity * 1px)`，Tailwind 案失敗。暫放檔都已刪、`theme.css` 已還原 |

**新預算的依據**（`tests/helpers/test-budget.ts`）：`APP_MODULE_GRAPH_BUDGET_MS`（Windows 90 秒、其他 30 秒）給第一次載入 App 模組圖的那一步。閒置 0.6 秒；24 個忙迴圈下六次是 0.6、0.6、10.0、18.4、25.5、26.9 秒，48 個是 27–57 秒，`DOM_RENDER_BUDGET_MS` 的 30 秒不夠。`SOURCE_SCAN_BUDGET_MS` 同樣 Windows 90 秒。有一段約 12 分鐘，這類讀大量檔案的工作（App 載入、原始碼掃描）一起變慢，之後恢復；同樣的讀檔加解析當獨立腳本跑、旁邊一樣 24 個忙迴圈，只要 0.5–0.7 秒。變慢的原因沒有查到。

**其他驗證**：`bun scripts/privacy-scan.ts`、`pwsh -NoProfile -File tools\dev_check.ps1`、`bun scripts/file-size-ratchet.ts`、`bun run lint:gui`、`cd gui && bun x tsc -b` 皆 exit 0；閒置下十二個改過的檔合跑 201 pass／0 fail。

**全量驗收：沒達成。** 都是 `cd gui && bun test --isolate tests`、旁邊 24 個忙迴圈：

- 第 1 次（只修了前四檔時）：4501 pass／8 fail（1726 秒）。八案就是上表後五列，前四檔都沒失敗。這次中途我在旁邊另跑了重現，負載比 24 個忙迴圈重。
- 第 2 次（八案修好之後）：4506 pass／3 fail（1713 秒）。改過的十二個檔都沒失敗。三案：`form-controls-rule`（10.4 秒，之後補上 `SOURCE_SCAN_BUDGET_MS`，見上表）；`page-loading-contract`「every migrated surface subscribes through the shared resource layer」（5.0 秒）；`provider-icons-native`「native provider marks > each file is painted the same way and exists」（9.2 秒）。
- 第 3 次在第 2 次失敗後就停掉，沒跑完；忙迴圈與測試行程都已結束，行程清單確認為 0。

後兩案沒改：`page-loading-contract` 那案只讀 13 個檔，`provider-icons-native` 那案對 86 個圖示各做一次 `existsSync` 與一段 regex，都是在本機一段「讀檔整體變慢」的期間超過 5 秒；那段期間連 `grep` 掃 `gui/tests` 都超過 120 秒。這比較像環境（例如防毒即時掃描或磁碟 I/O），不是測試的計時假設；再對這種工作量的測試加預算，等於在量那個環境。原因沒查到：Defender 的排除清單要系統管理員權限才能看。已寫進 `ROADMAP.md`。
