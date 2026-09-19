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
bun run dev:proxy    # 開發模式代理 API
bun run dev:gui      # 儀表板 dev 伺服器（另一個終端）
bun run typecheck    # bun x tsc --noEmit
bun run test:changed              # routine import-graph test selection
bun test tests/routing/router.test.ts     # routine focused test
bun run test                      # complete suite (PR-ready / explicit ask)
```

`bun run dev` 繼續作為 `bun run dev:proxy` 的別名。儀表板 dev 伺服器使用 `bun run dev:gui`；
`GET /` 提供的打包儀表板由 `bun run build:gui` 建置到 `gui/dist`。

## 建置與測試命令

根 package 是 Bun-native TypeScript，沒有單獨的 server compile 步驟。請使用儲存庫內的 script，
確保本機命令與 CI 一致：

```bash
bun run typecheck                 # 嚴格 TypeScript 檢查
bun run test:changed              # 針對已解析 dev merge base 的 import-graph 測試
bun run test                      # 完整 tests/ suite（PR-ready／明確要求時）
bun test tests/routing/router.test.ts     # 聚焦單個測試檔案
bun run build:gui                 # Vite GUI 建置 + package 準備
bun run privacy:scan              # CI 使用的 credential/privacy 掃描
bun run prepare:package           # 重新整理 package launcher/asset
```

`test:changed` 會依序選擇第一個存在的比較參照：`upstream/dev`、`origin/dev`，接著是本機的
`dev`。它會回報該參照與精確的 `git merge-base HEAD <ref>` commit，然後把該 merge-base SHA 傳給
Bun。

若某個測試 lane 逾時，執行器會印出它已經擷取到的 stdout 與 stderr，並以
結束碼 124 退出。行程結束後，已擷取的管線有一秒鐘的排空上限，因此一個持續佔用管線的子行程
不會拖住執行器。不完整的擷取會被明確回報，且不算作成功執行，即使直接子行程是以結束碼 0
退出的也一樣。

測試是鏡射 `src/` 結構的領域目錄下的 Bun test：`tests/server/`、`tests/providers/`、
`tests/adapters/openai/`、`tests/cli/` 等等。`scripts/test-layout/layout.json` 是對應表，
`tests/test-layout.test.ts` 會強制執行它，所以新測試必須放進對應的領域目錄，並在對應表中有
一個項目（這個工具測試會告訴你缺了哪一個）。`tests/helpers/` 存放共享 fixture，
`tests/helpers/repo-root.ts` 是測試存取儲存庫檔案的方式；`tests/e2e-style/` 存放範圍更廣的原生
一致性場景。請在你改動的 subsystem 的現有測試附近加入聚焦的迴歸測試（`bun test tests/<domain>`
可執行單一 subsystem）；若改動涉及共享 routing、adapter、config 或 server 行為，還應執行完整
suite。

你正在閱讀的文件站點位於 `docs-site/`（Astro + Starlight）：

```bash
cd docs-site && bun install && bun dev
```

## 文件釋出

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

- **Cross-platform CI**（`.github/workflows/ci.yml`）會在改動 runtime、test、package、script、
  TypeScript 或 workflow 檔案的 pull request 與 `main` push 上執行。Bun matrix 覆蓋 Linux、
  Windows 和 macOS，執行 install、typecheck、test、privacy scan、release-helper build smoke、GUI
  build 和 `ocx help`。另一個三系統 lane 使用 package 內建 runtime，驗證無需單獨安裝 Bun 也能
  完成 npm global install。
- **Release**（`.github/workflows/release.yml`）只能手動執行。它不是第二套完整 CI；dry-run 或
  publish 前，精確的 release commit（`GITHUB_SHA`）必須已有成功的 Cross-platform CI run。
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

釋出請使用 helper：


執行 helper 前，先確定目標發佈版本，並從預設分支執行
`.github/workflows/dev-version-bump.yml`，設定 `intended-version=<version>` 和
`mode=pre-move`。審查產生的 PR 並合併到 `dev`，再提升到 `main` 或 `preview`，
最後執行 helper。如果 `dev` 的版本已高於目標版本，工作流程會回傳
`changed=false`，無需建立版本更新 PR。發佈仍要求對應發佈提交的 CI 全部通過。

```bash
bun run release <version>           # commit/push 版本 bump；publish workflow 預設 dry-run
bun run release --bump minor        # 依 tag 與 npm channel 推導下一個 patch、minor 或 major 版本
bun run release <version> --publish # 確認 CI-gated dry-run 後真正 publish
bun run release:watch               # 觀察最新的 Release workflow run
```

可用 `--bump patch|minor|major` 取代明確版本。較高 core 的 preview tag 建立後，`--bump patch`
會拒絕延續舊的 stable patch 版本線；請把修正納入已開啟的 preview core 中釋出。

## 分支

- `dev` — 唯一的整合目標。請在此開啟 pull request。
- `main` — 僅供釋出。它只能由維護者從 `dev` 提升；請勿對它開啟功能 pull request。
- `preview` — prerelease train。

承載 Go 原生版本的 `dev2-go` 分支線已經退役，雙軌 carry 政策也隨之結束。其歷史以唯讀方式發佈在
[lidge-jun/opencodex-go-archive](https://github.com/lidge-jun/opencodex-go-archive)。
`dev` 上的 Bun-native TypeScript 是唯一的 runtime 線。

歡迎 rebase pull request。把過時分支帶到目前 head 是一般貢獻而非噪音 —— 請在描述中註明來源 commit。

## Pull request

- 目標為 **`dev`**。請勿對 **`main`** 開啟功能或修復 pull request。
- 從目前 **`dev`** tip 建立分支，而不是從 **`main`**。必填的 **`enforce-target`** 檢查會拒絕
  head merge base 位於 **`main`** tip 且分支遠落後於 pull request base 的請求（#644 中出現的
  失敗模式）。
- 撰寫真實的描述：說明變更內容與原因的 **Summary**，加上 **Test plan**（或同等實質內容）。空的
  內文、只有佔位符的文字，以及使用跳脫 `\n` 而非真實換行的描述都會無法通過檢查。
- 若標題或描述提到 `gui`，請在描述中附上 UI 變更的螢幕截圖；`enforce-target` 會在描述編輯時
  重新執行，直到出現截圖為止。
- 此 repository 的 workflow 變更使用 **`pull_request_target`**。更新的 enforcement 邏輯只有在
  workflow 提升到 repository 預設分支後才會生效——與 #631 記錄的相同營運注意事項。

## 專案維護者

目前維護者、其職責，以及 review 與 merge 政策記錄在
[`MAINTAINERS.md`](https://github.com/lidge-jun/opencodex/blob/main/MAINTAINERS.md)。repository 與
安全敏感路徑的 GitHub review 所有權宣告在 `.github/CODEOWNERS`。

貢獻者的 pull request 通常需要維護者核准。擁有 GitHub `maintain` 或 `admin` 權限的現任
維護者，可以明確將一個 PR（包括自己開的）整合進 `dev`，不需要第二位維護者核准。這個決定與精確
head 的驗證必須被記錄；CI、安全性審查與其他維護者尚未解決的反對意見仍然適用。這項例外不會改變
`main`/`preview` 的審查規則，也不允許直接 push、force-push 或刪除分支。

## 約定

- **僅使用 ES Modules**（`import`/`export`）、TypeScript 和 `strict` mode。保持
  `bun x tsc --noEmit` 無報錯。
- **每個檔案最多約 500 行** —— 按職責拆分。`web-search/` 和 `vision/` sidecar 是很好的例子：
  小而專注的 module 位於單一 `index.ts` 之後。
- **在邊界處理非同步錯誤** —— sidecar 不會把例外拋進請求路徑，而會降級成合適的 marker。
- **Structure SOT** —— 目前維護者不變數放在 `structure/`；公開使用者流程放在 `docs-site/`；
  歷史調查/診斷記錄放在 `docs/`。
- **保留 export** —— 其他 module 可能依賴它們。

## 向目錄中新增 provider

所有 provider picker 與 seed 都來自 canonical registry（`src/providers/registry.ts`）：

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

先執行能證明改動的最小命令：型別檢查用 `bun run typecheck`，行為檢查用聚焦的
`bun test tests/<domain>/<name>.test.ts` 或 runtime probe，然後再執行適合影響範圍的更寬 gate。
opencodex 傾向於小而可驗證的 commit，而不是大批次改動。
