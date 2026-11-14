---
title: 貢獻指南
description: opencodex 的開發環境、結構、約定，以及新增 provider 或 adapter 的方法。
---

## 環境搭建

原始碼開發需要 `PATH` 上有 `bun` CLI。發佈到 npm 的套件為使用者內建了自己的 Bun runtime，但這份
checkout 的 script 是透過你本機的 Bun 安裝執行的。

```bash
git clone https://github.com/lidge-jun/opencodex.git
cd opencodex
bun install
bun run setup:hooks  # 移除舊的受管理 pre-push 與 post-merge
bun run dev:proxy    # 開發模式代理 API
bun run dev:gui      # 儀表板 dev 伺服器（另一個終端）
bun run typecheck    # bun check --no-script --noEmit
bun run test        # 完整測試套件（預設）
```

`bun run setup:hooks` 移除未經修改的舊版受管理 `pre-push` 與 `post-merge` 掛鉤，
保留自訂掛鉤。`pre-push` 掛鉤不再是必要項目；`bun run prepush` 仍可作為選用的手動檢查。

`bun run dev` 繼續作為 `bun run dev:proxy` 的別名。儀表板 dev 伺服器使用 `bun run dev:gui`；
`GET /` 提供的打包儀表板由 `bun run build:gui` 建置到 `gui/dist`。

## 建置與測試命令

根 package 是 Bun-native TypeScript，沒有單獨的 server compile 步驟。請使用儲存庫內的 script，
確保本機命令與 CI 一致：

```bash
bun run typecheck                 # 嚴格 TypeScript 檢查
bun run test:changed              # 針對解析出的 dev merge-base 的匯入圖測試
bun run test                      # 完整 tests/ suite
bun test tests/routing/router.test.ts     # 聚焦單個測試檔案
bun run build:gui                 # Vite GUI 建置 + package 準備
bun run privacy:scan              # CI 使用的 credential/privacy 掃描
bun run prepare:package           # 重新整理 package launcher/asset
```

預設執行 `bun run test` 跑完整測試套件。如果相對於工作規模、機器資源或同時使用的工作樹，
完整執行的成本過高，仍必須至少執行實際驗證變更行為的針對性迴歸測試，例如
`bun test tests/<domain>/<name>.test.ts`。說明縮小範圍的原因，並報告確切的命令、結果和未測試範圍。
`bun run test:changed` 可以補充涵蓋範圍，但無法找出所有間接相依性。不存在僅依賴 CI 或完全略過
本機測試的一概豁免。合併前，所有必要的 CI 檢查必須在目前 PR 頂端的確切提交上通過。

測試是按 `src/` 劃分的領域目錄（`tests/<domain>/`）下的 Bun test，對應表在 `scripts/test-layout/layout.json`。`tests/helpers/` 存放共享 fixture，
`tests/e2e-style/` 存放範圍更廣的原生一致性場景。請在對應 subsystem 的現有測試附近加入聚焦的
迴歸測試。

你正在閱讀的文件站點位於 `docs-site/`（Astro + Starlight）：

```bash
cd docs-site && bun install && bun dev
```

## CI / Release / Pages

公開文件釋出到 GitHub Pages：<https://opencodex.me/>。
`.github/workflows/deploy-docs.yml` 會在 `main` push 中 `docs-site/**` 或 workflow 本身發生變化時
執行，建置 `docs-site` 並部署生成的網站。推送文件變更前請執行：

```bash
cd docs-site
bun install --frozen-lockfile
bun run build
```

## CI 與釋出

GitHub Actions 有意只保留必要步驟：

- **Cross-platform CI**（`.github/workflows/ci.yml`）在 pull request 上執行範圍限定的 Linux 檢查；完整的
  Linux、macOS 與 Windows 矩陣則由 `dev` 上帶 `lane=all` 的手動 dispatch 執行。PR 綠燈不是完整平台的釋出
  證據。合併一批 PR 之後，維護者會在 `dev` 上執行一次完整 dispatch，而不是每個 PR 各一次。
- **Release**（`.github/workflows/release.yml`）是手動的 `dev` workflow：它選出具備合格完整 lane 證據的確切
  來源、在建置 checkout 中蓋上版本，並在發佈前檢查 npm 與 GitHub release 歷史。發佈維持關閉，直到維護者完成
  切換檢查並啟用；被中斷的執行由操作者證明的 resume 復原，且絕不重新發佈 npm 版本。目前流程請見
  [`MAINTAINERS.md`](https://github.com/lidge-jun/opencodex/blob/dev/MAINTAINERS.md)。
- **Stale needs-info**（`.github/workflows/stale-needs-info.yml`）在預設分支上每天執行。標記為
  `needs-info`且 14 天沒有活動的 open issue 會收到警告；再過 7 天閒置後會以「not planned」關閉。
  任何更新都會清除這個過時警告。若要讓長期進行中的工作保持開啟，請移除 `needs-info`（例如把
  issue 提升為 `roadmap` 時）。
- **Issue quality**（`.github/workflows/enforce-issue-quality.yml`）會在新建與編輯的 issue 上驗證
  範本結構，套用種類標籤（`bug`、`enhancement`、`provider-compatibility`、`documentation`），並
  從表單的 Area 欄位加上正交的**領域**標籤，輔以簡單的標題／Summary 啟發式判斷：`provider`、
  `account-pool`、`catalog`、`gui`、`cli`、`proxy`、`platform`、`streaming`、`tools`、`install`
  與 `service`。種類／流程標籤保持獨立，所以你可以篩選 `bug` + `account-pool` 而不會混淆這兩個
  維度。請優先使用 Area 下拉選單，而不是自創每個供應商各自的標籤。Area: Documentation 不會再加上
  第二個領域標籤（文件表單本身已經帶有 `documentation`）。維護者可以在該 workflow 進入預設分支後，
  用 workflow_dispatch 的 `backfill_open_areas` 為所有 open issue 重新套用領域標籤。

舊的版本 bump 與提升流程不是新的釋出路徑。在新的發佈閘門尚未解決之前，請勿用它當替代方案。

## 分支

- `dev` — 唯一的整合目標，也是 repository 預設分支。請在此開啟 pull request。
- `main` 與 `preview` 在單一分支模型到位後已被刪除。其已釋出的歷史仍可透過 tag 取得；兩者都不是整合或提升
  目標。

承載 Go 原生版本的 `dev2-go` 分支線已經退役，雙軌 carry 政策也隨之結束。其歷史以唯讀方式發佈在
[lidge-jun/opencodex-go-archive](https://github.com/lidge-jun/opencodex-go-archive)。
`dev` 上的 Bun-native TypeScript 是唯一的 runtime 線。

歡迎 rebase pull request。把過時分支帶到目前 head 是一般貢獻而非噪音 —— 請在描述中註明來源 commit。

## Pull request

- 目標為 **`dev`**，它也是 repository 的預設分支。**`main`** 與 **`preview`** 已隨單一分支
  模型上線而刪除。必填的 **`enforce-target`** 檢查會拒絕以 **`dev`** 以外分支為 base 的請求
  （stacked 子 PR 除外）。
- 撰寫真實的描述：說明變更內容與原因的 **Summary**，加上 **Test plan**（或同等實質內容）。空的
  內文、只有佔位符的文字，以及使用跳脫 `\n` 而非真實換行的描述都會無法通過檢查。
- 若 pull request 變更 `gui/` 下的檔案，請在描述中附上 UI 變更的螢幕截圖；`enforce-target` 會在
  描述編輯時重新執行，直到附上截圖為止。請將圖片拖曳至描述中，不要 commit 到 PR 分支：否則
  squash merge 會將圖片帶入 `dev`。透過命令列上傳的維護者應使用 `pr-assets` 分支，並以 commit SHA
  連結圖片。
- 此 repository 的 workflow 變更使用 **`pull_request_target`**。更新的 enforcement 邏輯只有在
  workflow 提升到 repository 預設分支後才會生效——與 #631 記錄的相同營運注意事項。

## 專案維護者

目前維護者、其職責，以及 review 與 merge 政策記錄在
[`MAINTAINERS.md`](https://github.com/lidge-jun/opencodex/blob/dev/MAINTAINERS.md)。repository 與
安全敏感路徑的 GitHub review 所有權宣告在 `.github/CODEOWNERS`。

貢獻者的 pull request 通常需要維護者核准。擁有 GitHub `maintain` 或 `admin` 權限的現任
維護者，可以明確將一個 PR（包括自己開的）整合進 `dev`，不需要第二位維護者核准。這個決定與精確
head 的驗證必須被記錄；CI、安全性審查與其他維護者尚未解決的反對意見仍然適用。這項例外不會改變
`main`/`preview` 的審查規則，也不允許直接 push、force-push 或刪除分支。

## 約定

- **僅使用 ES Modules**（`import`/`export`）、TypeScript 和 `strict` mode。保持
  `bun run typecheck` 無報錯。
- **每個檔案最多約 500 行** —— 按職責拆分。`web-search/` 和 `vision/` sidecar 是很好的例子：
  小而專注的 module 位於單一 `index.ts` 之後。
- **在邊界處理非同步錯誤** —— sidecar 不會把例外拋進請求路徑，而會降級成合適的 marker。
- **Structure SOT** —— 目前維護者不變數放在 `structure/`；公開使用者流程放在 `docs-site/`；
  規劃與調查記錄放在 `devlog/`。
- **保留 export** —— 其他 module 可能依賴它們。

## 向目錄中新增 provider

所有 provider picker 與 seed 都來自 canonical registry（`src/providers/registry/entries-extended.ts`）：

```ts
{
  id: "my-provider",
  label: "My Provider",
  baseUrl: "https://api.example.com/v1",
  adapter: "openai-chat",
  authKind: "key",
  dashboardUrl: "https://example.com/keys",
  models: ["model-a", "model-b"],
  defaultModel: "model-a",
  noVisionModels: ["model-a"],   // text-only models → vision sidecar describes images
},
```

`src/providers/derive.ts` 會把該條目提供給 `ocx init`、`ocx provider`、儀表板 preset、API-key
登入和 OAuth config seed。`enrichProviderFromCatalog()` 會把模型 metadata 與 capability 分類複製到
儲存的 provider 設定。OAuth protocol 實作仍位於 `src/oauth/`；只有 registry metadata 並不會
自動形成 OAuth flow。

### 權威 preset 所需的證據

registry 條目是一項被維護的承諾：opencodex 會把使用者的 API key 送到這個目的地。因此 preset
需要一手來源證據，而不只是可運作的程式碼路徑。新增或提升 provider 的 pull request 必須在描述中
提供以下全部內容：

- **已文件化的 OpenAI 相容端點。** 附上供應商自己的 chat endpoint API 參考連結；當條目設定
  `liveModels: true` 時，也要附上其認證模型探索端點（通常是 `GET /v1/models`）的連結。通過的
  fixture 測試不能取代它：那只證明我們的程式碼結構，不能證明上游契約。
- **服務條款與營運法人。** 空白或佔位符的法律頁面無法證明誰在營運該端點，或使用者流量依什麼
  條款處理。
- **aggregator 的轉售或路由授權。** 販售 Claude、GPT、Gemini 或其他第三方模型存取的 gateway
  應出示其路由授權。使用者把內建 preset 視為一條受維護的路線，而不是未經驗證的轉售商。
- **具名的維護負責人。** 說明 base URL、認證或目錄契約變更時由誰更新該 preset，以及故障如何
  回報。
- **可引用的驗證日期。** 記錄一手來源與檢查日期，方式與 `src/providers/free-directory.ts` 中的
  `lastVerified` 相同。未經驗證的列卻加上了日期，等於宣稱一份誰都沒產生的 provenance。

歡迎貢獻者新增自己的服務，目前多個 preset 就是這樣來的。請在 pull request 描述中揭露關聯，讓
reviewer 可以衡量；有關聯不代表會被拒絕，也不會降低證據門檻。

當證據不完整時，誠實的歸屬是 `src/providers/free-directory.ts` 的 reference row，而不是
canonical registry。Directory row 帶有明確的 `verification` 等級（`official`、`primary`、
`unverified`）且是惰性的：使用者仍可透過自訂 OpenAI-compatible flow 使用該服務，而 opencodex
不會宣傳一個無法背書的 preset。證據齊全後再把該 row 提升到 registry。

## 新增 adapter

在 `src/adapters/` 中實作 `ProviderAdapter`（參見
[Adapters](/zh-tw/reference/adapters/)），在 `src/adapters/registry.ts` 中註冊它的 factory，並把
輸出橋接成內部 `AdapterEvent`。`src/server/adapter-resolve.ts` 會在委派給 registry 之前選擇
有效的協定。圖像處理請複用 `image.ts`；普通 streaming/tool call 以 `openai-chat.ts` 為參考。
只有 adapter 自己負責 transport retry 時才使用 `fetchResponse`；Cursor 這類真正的雙向 transport
應使用 `runTurn`。在 `tests/` 中新增聚焦測試；如果 factory 屬於 public package API，還要從
`src/index.ts` export。

### 新增相容性宣告

相容性宣告位於 `src/compatibility/` 之下。一個宣告比 adapter 更狹窄：它會指名確切的供應商、
正規化後的上游 base URL、驗證模式、入站協定、上游協定，以及被證實過其行為的模型 id。不要把
一個宣告複製到每個使用相同 adapter 的供應商，或另一個使用相同線路格式的目的地。

請使用其中一種已版本化的判定：`passthrough`、`translated`、`degraded` 或 `unsupported`。每個
非 `passthrough` 的宣告都必須陳述其限制，每個以 fixture 為依據的宣告都必須指名證明它的確切
assertion id。請把不含機密的請求向量加進 `tests/fixtures/compatibility/`，並在一個聚焦測試中
對正式環境的 adapter 執行它。相容性 manifest 是被動資料：一般的路由器、Responses handler 與
伺服器啟動路徑都不得匯入 manifest 目錄，或啟動 Compatibility Lab。

## 在聲稱完成前先驗證

遵循上述測試政策，並針對型別變更執行 `bun run typecheck`，以及受影響範圍所需的其他檢查。
報告命令、結果和未測試範圍，只聲明實際完成的驗證。
