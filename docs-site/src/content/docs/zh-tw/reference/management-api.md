---
title: 管理 API
description: opencodex 控制平面的認證、錯誤與端點參考。
---

管理 API 是 opencodex 的控制平面。`http://localhost:10100` 的儀表板是它的一個客戶端；無頭的 `ocx` 供應商、模型、組合、帳號、設定、診斷與生命週期指令也是客戶端。API 僅在代理執行時可用。

使用[網頁儀表板](/guides/web-dashboard/)作為互動式客戶端，或在建構自動化時使用此參考。持久值最終遵循[設定](/reference/configuration/)。

## 認證模型

管理 API 有自己的管理憑證，獨立於 data-plane API 金鑰。在啟動時，opencodex 依此順序解析它：

1. `OPENCODEX_ADMIN_AUTH_TOKEN`，設定時。
2. 強化秘密檔案中生成的 `ocx_admin_*` token。

檔案支援的 token 僅在其目錄與檔案權限或 ACL 已被強化後才被接受。若無法保證，管理認證 fail closed 且 API 回傳 503，直到提供環境 token 或修復檔案狀態。

以任一形式發送管理 token：

```http
X-OpenCodex-API-Key: <admin-token>
```

```http
Authorization: Bearer <admin-token>
```

:::caution
管理 token 必須與每個 data-plane 憑證不同。啟動時拒絕與代理許可金鑰衝突的管理憑證。請勿將管理 token 放入 Codex、Claude Code 或其他模型客戶端；它授權控制平面的變更。
:::

### 回送儀表板 session

在回送綁定上，儀表板 bootstrap 可接收短期的 `ocx_session_*` 憑證。每個 session 持續五分鐘並綁定到精確的儀表板來源。安全請求必須符合該來源。不安全方法還需要瀏覽器 `Origin` 與 session 的 CSRF token。

Session 簽發在需要 data-plane 認證時停用，這包含遠端綁定。遠端操作者必須以原始管理 token 認證；不簽發回送式 GUI session。

## 常見錯誤

下方所有端點列繼承這些邊界錯誤。「Notable errors」欄列出額外的路由專屬結果，而非重複此表。

| 狀態 | 型別或代碼 | 意義 |
| --- | --- | --- |
| 401 | `opencodex admin token required` | 管理 token 或 GUI session 缺失、無效、過期、來源不符或缺少 CSRF 證據 |
| 403 | `cross-origin request blocked` | 請求來源在管理允許清單之外 |
| 404 | `not_found` | 無管理路由符合該方法與路徑 |
| 413 | `request body too large` | POST、PUT 或 PATCH body 超過 2 MiB 管理限制 |
| 503 | `management API unavailable` | 管理憑證初始化或強化不可用 |
| 503 | `oauth_mutation_busy` | 另一個 OAuth 憑證變更持有寫入器；回應包含 `Retry-After: 1` |
| 503 | `catalog_busy` | 目錄收集已達容量；回應包含 `Retry-After: 1` |

## 端點矩陣

### 代理與客戶端設定

| 方法與路徑 | 用途 | Notable errors |
| --- | --- | --- |
| `GET, PUT /api/v2` | 讀取或變更原生多代理 v2 模式與執行緒設定 | 400 無效設定；502 轉換或持久化失敗 |
| `GET, PUT /api/injection-model` | 讀取或設定注入的子代理模型、effort、prompt 與 guidance 設定 | 400 無效模型、effort 或 body |
| `GET, PUT /api/effort-caps` | 讀取或設定全域與子代理 reasoning-effort 上限 | 400 無效階梯值 |
| `GET, PUT /api/subagent-models` | 讀取或排序向子代理廣告的模型 | 400 無效清單或超過五個模型 |
| `GET, PUT /api/subagent-model-fallback` | 讀取或設定有序的 fallback 鏈與輪詢間隔 | 400 無效清單或輪詢間隔 |
| `GET /api/grok` | 讀取 Grok 受管設定狀態與候選模型 | 400 狀態讀取失敗 |
| `PUT /api/grok/selection` | 持久化排除的 Grok 模型 | 400 無效或過大選擇 |
| `POST /api/grok/apply` | 透過受管同步套用持久化的 Grok 設定 | 409 `grok_apply_busy`；400/500 套用失敗 |
| `GET /api/grok/reset-coupons?accountId=...` | 讀取活躍或指定 xAI 帳號剩餘的 Grok 計費重置 token 與有效期間 | 400 缺失帳號；401 未認證；502 上游 gRPC-Web 錯誤 |
| `POST /api/grok/reset-coupons/consume` | 兌換一個合格的 reset coupon。請求主體為 `{ accountId?, tokenId?, operationId? }`。選用的 `operationId`（UUIDv4）可讓兌換具備冪等性：重複相同 id 會重播持久化結果，而不會重複兌換。 | 400 無效的 JSON/UUID；401 未認證；409 `identity_mismatch`；502 上游錯誤；503 ledger 容量 |
| `GET, PUT /api/claude-desktop` | 讀取或持久化 Claude Desktop 路由／原生設定檔 | 400 無效或不可用指派 |
| `POST /api/claude-desktop/apply` | 將儲存的設定檔寫入 Claude Desktop 的受管設定 | 400/500 寫入失敗 |
| `GET /api/claude-desktop/status` | 檢查已儲存 vs 已套用設定檔與 Desktop 健康 | 400 狀態讀取失敗 |
| `GET, PUT /api/claude-code` | 讀取或更新 Claude Code 閘道、auth-mode、model-map、context、agent 與 sidecar 設定 | 400 無效欄位或結構 |

儀表板從 **Providers > xAI Grok > Accounts** 驅動這兩條 coupon 路徑：每個已登入帳號列都帶有票券徽章，顯示剩餘的 reset coupon 數量，徽章會開啟對話框，列出有效期間並兌換最接近到期的 reset coupon。該對話框會送出由客戶端鑄造的 `operationId`，並在逾時後停止送出而不重試，因為日誌記錄仍為開啟的兌換會再次執行。`ocx account grok-reset-coupons` 仍是終端機等價指令。

關於模型名冊與加密 worker-task 行為背後的概念，請見[子代理介面](/guides/sub-agent-surface/)。

### 用戶端整合復原日誌

| 方法與路徑 | 用途 | 主要錯誤 |
| --- | --- | --- |
| `GET /api/client-integrations/journal?client=...` | 列出復原操作，也可限定為單一用戶端。每一項都包含由伺服器計算的 `deletable` 欄位。 | 400 用戶端無效 |
| `DELETE /api/client-integrations/journal?opId=...` | 停用一筆較舊的復原操作，並在可能時刪除其快照。成功回應中的 `snapshotRemoved: false` 表示清理工作已保留，等待維護重試。 | 400 缺少 `opId`；404 操作不存在或已停用；409 該用戶端的最新操作 |

刪除操作會附加墓碑記錄，而不會重寫日誌。伺服器會保護每個用戶端的最新操作，
以保留目前的復原點。對於 Aside，保護是逐 profile 進行的，日誌列包含 `profileId`。

### Aside profile controls

搭配相容且執行中的 proxy 使用下列專屬路徑。`{profileId}` 是設定檔清單回傳的、已註冊的
非負整數帳號 ID；它不是瀏覽器路徑。

| 方法與路徑 | 用途 | Notable errors |
| --- | --- | --- |
| `GET /api/client-integrations/aside/profiles` | 列出 `profiles[]`、期望的 `enabledCount`/`allEnabled`、實際的 `appliedCount` 與 `total` | 探索不可用時，HTTP 200 可能包含一個空的、不安全的彙總並附帶 `error` |
| `PUT /api/client-integrations/aside/profiles` | 設定每個已註冊設定檔的期望狀態並套用；body 為 `{ "enabled": true }`，啟用時可選擇附加 `overwriteConflict` | 400 無效 body；409 操作忙碌；500 偏好儲存失敗；207 逐設定檔拒絕 |
| `GET /api/client-integrations/aside/profiles/{profileId}` | 讀取一個設定檔期望的 `enabled` 與實際整合狀態 | 400 無效 ID；404 未註冊的設定檔 |
| `PUT /api/client-integrations/aside/profiles/{profileId}` | 用與批次 PUT 相同的 body 變更一個設定檔，其餘設定檔的偏好不受影響 | 400 無效 body/ID；404 未知設定檔；409 忙碌或拒絕；500 儲存／寫入失敗 |
| `GET /api/client-integrations/aside/profiles/journal` | 列出所有已註冊 Aside 設定檔的歷史 | 每列包含 `profileId`、快照可用性、`undoable` 與 `deletable` |
| `GET /api/client-integrations/aside/profiles/{profileId}/journal` | 列出一個設定檔的歷史，包含相符的舊版操作 | 400 無效 ID；404 未知設定檔 |
| `DELETE /api/client-integrations/aside/profiles/journal?opId=...` | 停用一筆較舊的操作，從歷史中解析其設定檔 | 400 缺少 ID；404 缺失操作；409 該設定檔的最新操作 |
| `DELETE /api/client-integrations/aside/profiles/{profileId}/journal?opId=...` | 停用屬於所選設定檔的一筆較舊操作 | 相同的刪除錯誤；操作不能指向其他設定檔 |
| `POST /api/client-integrations/aside/profiles/{profileId}/restore` | 用 `{ "opId": "..." }` 復原一個操作；可選的 `confirmDrift: true` 允許取代之後的編輯 | 404 缺失操作/設定檔；409 忙碌、不符或需要確認漂移；410 快照已過期；500 儲存／寫入失敗 |
| `POST /api/client-integrations/aside/sync` | 透過伺服器的變更擁有者重新整理已啟用的設定檔；body 為 `{}` | 400 非空 body/設定檔選擇器；409 忙碌；207 逐設定檔拒絕 |

批次 PUT 回傳 `{ ok, clientId, changed, state, message, results }`；每個結果都標明其
`profileId` 並回報寫入結果。Sync 回傳 `{ ok, clientId, results }`，附帶逐設定檔的重新整理
結果。兩者在所有回傳的嘗試都成功時回傳 HTTP 200，在任何嘗試被拒絕時回傳 HTTP 207 並附帶
`ok: false`。HTTP 207 是一種部分結果的封套，即使每個嘗試過的設定檔都被拒絕也一樣：請檢查
每個結果，而不是把 2xx 回應當成完全成功。成功的 no-op 可能有 `changed: false`；sync 不會
嘗試已停用的設定檔。單一設定檔的寫入與復原，成功時回傳 HTTP 200，拒絕時回傳對應的錯誤
狀態。

明確的變更會在寫入檔案之前先儲存期望的偏好。偏好儲存失敗會讓設定檔檔案維持不變。之後的
檔案拒絕會保留已儲存的意圖與成功的同層寫入；重試前請先檢查受影響的設定檔。復原未完成時，
拒絕回應可能包含 `snapshotPath` 與 `residual: true`。復原也會協調目標設定檔的期望狀態，
因此下一次 sync 不會逆轉 Undo。刪除回傳 `snapshotRemoved`；`false` 表示快照清理仍需要
維護。

舊版的 `GET, PUT /api/client-integrations/aside` 別名仍然可用。新用戶端應使用上方的專屬
路徑，這樣較舊的 proxy 就不會忽略設定檔選擇器。CLI 指令與 proxy 升級、重新啟動、重試序列
請見 [Aside profile controls](/guides/integrations/#aside-profile-controls)。

### Remote Workspace

需要 Hub 模式，且 Hub process 上要設定 `OCX_REMOTE_WORKSPACE_ENABLED=1`。停用狀態可讀取；
變更操作在未初始化 workspace 服務時會拒絕。

| 方法與路徑 | 用途 | Notable errors |
| --- | --- | --- |
| `GET /api/remote-workspace` | 讀取已配對的電腦、目前能力、Hub runtime 與 session 快照 | Hub 角色或明確 opt-in 缺席時回報停用狀態 |
| `POST /api/remote-workspace/pairing` | 建立十分鐘、一次性的 Executor 加入碼 | 僅限 GUI session；429 配對容量 |
| `GET /api/remote-workspace/runtimes` | 讀取 Hub 上 Codex、Claude Code 與 Pi 的可用性 | — |
| `GET, POST /api/remote-workspace/sessions` | 列出 session，或啟動一個綁定裝置、root、runtime 與存取模式的 session | POST 僅限 GUI session；409 離線／不可用／目標無效 |
| `POST /api/remote-workspace/sessions/{id}/prompt` | 延續已綁定的模型 session | 僅限 GUI session；409 有進行中的回合、Executor 離線或恢復失敗 |
| `DELETE /api/remote-workspace/sessions/{id}` | 停止模型 runtime 與加密的 Executor session | 僅限 GUI session；404 未知 session |
| `DELETE /api/remote-workspace/devices/{id}` | 撤銷一台電腦並停止其 session | 僅限 GUI session；404 未知裝置 |

Executor 加入會在 `POST /remote-workspace/pair` 交換一次性代碼，然後以 bearer 認證的外連
WebSocket 開啟 `/remote-workspace/agent`。這兩個機器端點不具備一般管理 API 的權限。bearer
範圍限定於裝置，每個工作 session 都會加上一次已簽章的 E2EE handshake。同一個核心層級觀察
到的對端十次配對碼失敗，會在固定十分鐘視窗剩餘時間內回傳帶 `Retry-After` 的 `429`。
Tailscale Serve 用戶端共用管理監聽器的迴路對端桶；身分標頭不會用於節流，因為本機直接
process 可以偽造它。終端使用者流程與信任邊界見 [Remote Workspace](/guides/remote-workspace/)。

Session 快照包含 `resumable`。只有在所選 coding-agent runtime 具備持久化歷史後，它才會
變成 true；值得注意的是，一個全新的 Claude Code session 在其第一個 prompt 完成之前都會
維持 false。

### 組合

| 方法與路徑 | 用途 | Notable errors |
| --- | --- | --- |
| `GET /api/combos` | 列出正規化的組合及其公開模型 id | 目錄工作可回傳 `catalog_busy` |
| `PUT /api/combos` | 建立、取代或重新命名一個組合 | 400 無效 id、目標、設定、重新命名或普通碰撞；409 Codex 帳號命名空間碰撞 |
| `DELETE /api/combos?id=...` | 刪除一個組合並清除其選擇／冷卻狀態 | 400 缺失 id；404 未知組合 |

關於目標策略、冷卻、別名與路由失敗，請見[組合](/guides/combos/)。

### 設定、啟動、同步與更新

| 方法與路徑 | 用途 | Notable errors |
| --- | --- | --- |
| `GET /api/config` | 回傳遮罩後、管理安全的設定 DTO | — |
| `PUT /api/config` | 停用的全設定取代防護 | 405；請改用聚焦端點 |
| `GET, PUT /api/settings` | 讀取 runtime/啟動設定或更新自動啟動、串流模式、app 擁有記憶體預算與 `codexAccountPickerEnabled` | 400 無效或空更新 |
| `GET /api/startup-health` | 讀取快取的服務／shim 啟動健康 | — |
| `POST /api/startup-action` | 安裝或修復服務或 Codex shim | 400 無效動作；500 動作失敗 |
| `GET, POST /api/windows-tray` | 讀取 Windows tray 狀態或安裝／啟動／停止／解除安裝它 | 400 不支援平台／動作；500 操作失敗 |
| `GET /api/diagnostics/project-config` | 讀取快取的專案設定警告 | — |
| `POST /api/sync` | 將目前模型目錄同步到 Codex | 500 同步失敗 |
| `GET /api/update/check` | 檢查 `latest` 或 `preview` 更新頻道 | 400 無效 tag |
| `POST /api/update/run` | 啟動更新工作，可選擇接著重啟 | 400 無效 body；工作專屬衝突／錯誤狀態 |
| `GET /api/update/status` | 依 id 輪詢更新工作 | 404 未知工作 |
| `GET, PUT /api/sidecar-settings` | 讀取或更新網頁搜尋與視覺 sidecar 模型／backend 設定 | 400 無效結構、backend 或限制 |
| `GET, PUT /api/shadow-call-settings` | 讀取或更新 shadow-call 攔截設定 | 400 無效結構或值 |

### 日誌、用量與儲存

`GET /api/logs` 接受來自前一次回應、選用的不透明 `cursor`。回應封套保留 `logs`、`total`、
`generatedAt` 與 `timeZone`，並加入 `cursor` 與 `reset`。沒有 cursor 時回傳完整的過濾視窗。
有效且未變動的前綴只會回傳新增的列；編輯、逐出、查詢變更或重新啟動後，`reset: true` 會取代
用戶端視窗。無效的 cursor 回傳 HTTP 400，附帶 `error.code: "invalid_cursor"`。認證方式不變。
儀表板對較舊的伺服器會退回完整快照。這會為穩定視窗減少回應位元組數；伺服器端的投影仍受限於
目前的視窗大小。

| 方法與路徑 | 用途 | Notable errors |
| --- | --- | --- |
| `GET /api/logs` | 查詢過濾的記憶體內請求日誌 | — |
| `GET, PUT /api/debug` | 讀取除錯旗標；設定、清除或重置擷取類別 | 400 無效或空更新 |
| `GET /api/debug/logs` | 讀取有界的供應商／除錯日誌項目 | — |
| `GET /api/debug/usage-logs` | 讀取有界的 usage-debug 項目 | — |
| `GET /api/debug/injection-logs` | 讀取有界的 guidance-injection 除錯項目 | — |
| `GET /api/claude/inbound-debug` | 讀取 Claude inbound 除錯狀態與項目 | — |
| `GET /api/usage` | 把用量帳本掃描成可讀取列的精簡彙總，再遞增式地折入已驗證的新增內容；依預設或包含式的自訂視窗與用戶端介面摘要，並附帶以穩定、不含 PII 的日誌標籤區分的 Codex `accounts` 細分 | 400 無效的自訂邊界；若儲存無法讀取則回傳 `error: "read_failed"` 摘要 |
| `GET /api/storage` | 依 bucket 掃描 Codex 儲存用量 | 掃描失敗時回傳 `error: "scan_failed"` payload |
| `POST /api/storage/cleanup/preview` | 預覽已封存 session 清理並回傳綁定摘要 | 400 `invalid_json` 或 `invalid_percent` |
| `POST /api/storage/cleanup` | 隔離或永久移除預覽的已封存集合 | 400 無效輸入；409 過時／忙碌／被參照狀態；500 檔案系統／資料庫失敗 |
| `GET /api/storage/trash` | 列出隔離的清理項目 | 500 `trash_list_failed` |
| `POST /api/storage/trash/restore` | 還原一個隔離項目 | 400 無效 id；404 缺失 trash；409 忙碌／目的地衝突；500 還原失敗 |
| `GET /api/storage/trash/restore/test-stream` | 僅測試的還原串流 hook | 測試 hook 關閉時 404 `not_available` |
| `GET, PUT /api/storage/cleanup-policy` | 讀取或更新排程清理政策與工作狀態 | 400 無效政策 |
| `POST /api/storage/cleanup-policy/run` | 啟動手動清理政策執行 | 409 `already_running`；500 `cleanup_failed` |
| `GET /api/storage/cleanup-policy/test-stream` | 僅測試的政策串流 hook | 不可用時 404 `not_found` |

如果某行超過現有解析器的大小限制，`GET /api/usage` 和 `GET /api/keys` 會保留可讀取行的彙總，並在回應層級加入 `usageIncomplete: true` 和 `usageIncompleteReason: "oversized_rows"`。快取和增量附加會保留此診斷，即使結果為空或沒有篩選符合項目；重建時會重新計算。不會縮短供應商、模型或 API 金鑰識別碼來容納該行。沒有此標記不代表所有記錄均有效。它與 `historyTruncated`、`entriesTruncated` 及 token 測量覆蓋率相互獨立。

`usage.jsonl` 中新的 xAI attempt 包含一個請求時的 `credentialSource`：解析後為
Grok CLI OAuth transport 時是 `grok-oauth`，公開 xAI API key transport 時是 `xai-api-key`。
這個固定標籤不含任何憑證或帳號識別碼。它屬於 `attempts` 中的每一個項目，因此組合的彙總
token 總量不應被歸屬到它最終使用的 provider。自訂目的地與歷史列會省略這個欄位；使用者不應
從目前設定、模型名稱或傳入的 API key 推斷訂閱用量。這份日誌回報的是用量，不是訂閱帳單金額。

`GET /api/usage` 在冷啟動時，會從頭讀取 `~/.opencodex/usage.jsonl` 直到目前的
帳本快照。它以固定 1 MiB 的區塊處理，並保留精簡的彙總狀態，而不是每一筆正規化的請求列。
之後的重新整理會驗證前一個行邊界，只折入新增的完整列。並行呼叫端共用同一次重新整理。範圍
與介面條件會套用在可讀取列的彙總上，因此舊有的讀取位元組視窗與已解析列數上限，都不會讓
7 天、30 天或全歷史總量遺漏較早的檔案前綴。為了與有界限的舊版讀取器相容，
`managementUsageMaxReadBytes` 仍會被接受，但變更它已不再擴大或縮小這個端點所摘要的歷史
範圍。

同時傳入 `since` 與 `until` 可選擇一個包含式的自訂區間。兩者都接受整數 Unix
epoch **毫秒**，或帶有明確時區的完整 ISO 日期時間。無效的日期、負數或超出範圍的值、顛倒的
邊界，以及只給單一邊界，都會被拒絕。自訂邊界會覆寫 `range`；為了相容性，回應仍保留預設的
`range` 欄位，並加入 `customWindow: true`、精確的 `since` 與 `until`。`generatedAt` 仍是
報告產生的時間。

自訂視窗會在按日彙總之前，逐筆過濾帳本項目，包括不完整的第一天與最後一天。它們
保留 `surface`、`provider`、`model` 與 `apiKeyId` 過濾，且絕不會重用或覆寫未過濾的預設摘要。
每日圖表仍上限為 366 個本機日曆天；總量涵蓋整個請求的區間。快照視窗欄位描述的是時間過濾
之前掃描到的帳本，因此可能超出請求的邊界。

Usage 頁面接受本機日期/時間輸入。所選的結束分鐘會包含整分鐘直到 `:59.999`。
選擇預設值或清除自訂視窗會恢復預設行為。這項功能新增的是精確的範圍選擇與既有的成本估算；
不會新增以小時為單位的圖表分桶，也不會新增離線報表。

Runtime 帳本是只能附加的。取代或截斷它，或變更本機定價／時區輸入，都會觸發
完整重建。若在 proxy 執行期間手動就地編輯較舊的列，請在依賴新總量之前重新啟動 proxy（或
取代檔案）；漸進式的重新整理只會驗證附加邊界，不會驗證先前每個已彙總的位元組。

為了讓較舊的用戶端能消費相同的 wire 形狀，回應仍包含 `historyTruncated`、
`truncatedPrefixBytes`、`entriesTruncated` 與 `entriesDropped`。成功的整份帳本掃描會分別
回報 `false`、`0`、`false` 與 `0`。這些是舊版相容性欄位，不代表這個端點只讀取了設定大小的
尾端。

對 `GET /api/usage?range=30d&surface=codex` 而言，`accounts` 每個觀察到的 Codex
帳號池標籤各有一列。每列回報 `accountLogLabel`、token 總量、`usageCoverageRatio`，以及依
目前設定的顯示定價計算的選用 `estimatedCostUsd`。使用者設定的 `modelCosts` overlay 優先於
內附的已驗證目錄與價格退路，歷史用量會依摘要讀取當下生效的定價重新估算。這是一個等同 API
計費的估算值，不是訂閱扣款金額。新的 main-pool 請求使用保留的 `main` 標籤；舊版裸露的
`openai` 列仍留在一個含糊的分類中，不會依目前設定重新指派。

手動模型價格也可以從 **Models → Price** 編輯。手動定價徽章會在目錄重新載入後
保留。價格儲存在 `providers.<name>.modelCosts` 中，並在目錄同步後保留。明確設為全零的使用者
費率代表已知為零的估算值；**Reset to automatic** 會移除該 override，恢復一般的目錄退路。
這些數字始終只是顯示用的估算值，不是帳單。

`GET /api/providers/{provider}/model-costs` 回傳 `{ provider, modelCosts }`，內含
以精確上游模型 ID 為鍵、經淨化的四項費率條目。同一路由上的 `PUT` 接受
`{ modelId, cost }`，其中 `cost` 是 `{ input, output, cacheRead, cacheWrite }`，或 `null`
表示重置。四項費率都必須是 0 到 1,000,000 之間的有限數字，單位為每百萬 token 的美元。未知
欄位與格式錯誤的費率會被拒絕。一次寫入會保留其他模型的 override，並回傳
`{ ok: true, provider, modelId, cost }`；重置則回傳 `cost: null`。

```bash
ocx models price ollama/custom-model --json
ocx models set-price ollama/custom-model --input 0.50 --output 1.50
ocx models set-price ollama/custom-model --input 0 --output 0
ocx models set-price ollama/custom-model --auto
```

省略的 CLI cache-read/cache-write 費率預設為零。請用 `--cache-read` 與
`--cache-write` 明確設定它們。provider 名稱仍是精確的設定身分；帳號顯示標籤不是可編輯的
provider 名稱。

`models`、`providers` 及 `days[].models` 中的列也帶有 `cacheHitRate`：表示由供應商提示快取提供的輸入權杖比例，並限制在 `[0, 1]`。當供應商未回報快取遙測資料，或該列沒有輸入權杖時，其值為 `null`，絕不會是 `0`；因為「沒有快取資料」與「確實為 0% 的命中率」是不同事實，若圖表將兩者呈現為相同狀態，便會造成誤導。

:::caution
儲存清理端點可移動或永久移除已封存的 session 資料。請務必先預覽並提交回傳的摘要。在可能需要復原時偏好隔離。
:::

清理復原清單以原子方式發布，若替換在發布前失敗，會保留先前完整的紀錄。這不會
逆轉永久清除：當一筆已記錄的 session 沒有留存的 rollout 檔案時，復原仍可能失敗。

### 模型與目錄

| 方法與路徑 | 用途 | Notable errors |
| --- | --- | --- |
| `GET /api/catalog` | 回傳已安裝的 Codex 目錄文件。遠端用戶端應優先使用 data-plane 的 `GET /v1/catalog`，它仍需要一般的 data-plane 憑證，但不需要 admin token。 | 404 目錄未找到 |
| `GET /api/models` | 回傳儀表板／CLI 模型列 | 收集飽和時 `catalog_busy` |
| `GET /api/client-config?client=...` | 為任何受支援的檔案整合建構唯讀用戶端設定 | 400 不支援客戶端；503 目錄不可用 |
| `PUT /api/disabled-models` | 取代共享的 disabled-model 清單 | 400 無效 JSON |
| `PUT /api/model-visibility` | 原子地變更供應商或模型層級可見性 | 400 無效供應商、scope、目標或 body; 409 `initial_model_selection_pending` (重新整理模型清單後再試。) |
| `GET, POST /api/custom-models` | 列出自訂模型或新增一個 | 400 無效欄位；404 供應商缺失；409 重複模型 |
| `PUT, DELETE /api/custom-models/{id}` | 編輯或刪除一個自訂模型 | 400 無效 id/欄位；404 未找到；409 重複模型 |
| `GET, PUT /api/selected-models` | 讀取供應商允許清單與可用性，或取代一個允許清單 | 400 缺失供應商/body；404 未知供應商; PUT 409 `initial_model_selection_pending` |
| `GET, PUT /api/model-presets` | 讀取預設資訊或選擇 preset/all/custom 模式 | 400 模式無效或不支援該預設；404 未知供應商; PUT 409 `initial_model_selection_pending` |

手動模型會取代 Models 儀表板中 provider 與 model ID 相同的列。OpenAI 手動列保留 `openai/<model>`，並支援與其他路由模型相同的可見性控制。刪除手動列後，不含帳戶限定符的原生列會恢復。含帳戶限定符的原生列仍獨立保留。原生路由與帳戶權限不變。非原生 OpenAI 可見性目標必須符合已設定的手動模型。

尚未確認可靠的初始模型清單時，有效的 `PUT /api/selected-models` 和 `PUT /api/model-presets` 請求也會回傳 HTTP 409 和代碼 `initial_model_selection_pending`。請使用 `GET /api/models` 等方式更新模型清單，成功後再重試。

成功寫入 `/api/disabled-models`、`/api/model-visibility`、`/api/selected-models`
與 `/api/model-presets` 的可見性／選擇變更，在該重新整理路徑執行時，會在 `catalogRefresh`
與 `clientIntegrations` 中回報後續結果。HTTP 200 與 `ok: true` 確認的是選擇已儲存；它們不
保證每個用戶端目錄都已更新。請檢查 `clientIntegrations[]` 中的 `ok: false`、`client`、
選用的 Aside `profileId` 與拒絕 `reason`；復原細節也可能包含 `refusalReason`、
`snapshotPath` 與 `residual`。Models 頁面會保留已儲存的選擇，並顯示一個獨立的用戶端重新
整理警告。請先檢查 Integrations 並解決回報的問題，再重試 `ocx sync`。較舊伺服器缺少結果
欄位，不代表復原成功。

### OAuth 帳號、供應商金鑰與 data-plane 金鑰

| 方法與路徑 | 用途 | Notable errors |
| --- | --- | --- |
| `GET /api/oauth/providers` | 列出有公開 OAuth 登入流程的供應商 | — |
| `GET /api/key-providers` | 列出透過 API-key 登入設定的供應商 | — |
| `POST /api/oauth/login` | 啟動 OAuth 登入或帳號新增流程 | 400 未知／無效供應商；`oauth_mutation_busy` |
| `POST /api/oauth/login/code` | 提交手動 callback URL 或授權碼 | 400 無效供應商／碼；`oauth_mutation_busy` |
| `POST /api/oauth/login/cancel` | 取消公開進行中的 OAuth 流程 | 400 未知供應商 |
| `GET /api/oauth/status` | 輪詢一個供應商的 OAuth 流程 | 400 未知供應商 |
| `POST /api/oauth/logout` | 移除所選的供應商憑證 | 400 未知供應商；`oauth_mutation_busy` |
| `GET, DELETE /api/oauth/accounts` | 列出遮罩帳號或移除一個帳號 | 400 無效供應商/id；404 帳號缺失；`oauth_mutation_busy` |
| `PUT /api/oauth/accounts/active` | 選擇現用 OAuth 帳號 | 400 無效供應商／帳號；`oauth_mutation_busy` |
| `GET, PUT, PATCH /api/pool/settings` | 讀取或更新任何種類（codex、anthropic、generic）的池政策；三種種類都以相同鍵回答，並在 `supported` 中宣告該種類支援哪些鍵 | 400 未知供應商、該種類不支援的欄位，或無效值 |
| `GET, PUT, PATCH /api/oauth/accounts/pool` | Anthropic 與 generic OAuth 供應商的舊版逐池政策；已被 `/api/pool/settings` 取代，為既有用戶端保留 | 400 codex 或 api-key 供應商，或無效政策 |
| `POST /api/oauth/accounts/clear-cooldown` | 清除一個 OAuth 帳號的 runtime 冷卻 | 400 無效供應商／帳號 |
| `PUT /api/oauth/accounts/alias` | 設定或清除 OAuth 帳號別名 | 400 無效供應商／帳號／別名 |
| `GET, POST, DELETE /api/providers/keys` | 列出遮罩供應商金鑰、新增／啟用一個或移除一個 | 400 無效輸入；404 供應商／金鑰缺失 |
| `PUT /api/providers/keys/active` | 選擇供應商的現用金鑰 | 400 無效輸入；404 供應商／金鑰缺失 |
| `PUT /api/providers/keys/alias` | 設定或清除供應商金鑰別名 | 400 無效輸入；404 供應商／金鑰缺失 |
| `GET, POST, PATCH, DELETE /api/keys` | 列出、建立、編輯或刪除 data-plane 許可金鑰 | 400 無效 body/id；404 金鑰缺失 |

憑證清單回應被刻意遮罩。OAuth access token 與完整的供應商 API 金鑰不回傳給儀表板客戶端。

### 供應商

| 方法與路徑 | 用途 | Notable errors |
| --- | --- | --- |
| `GET /api/providers` | 列出遮罩後的供應商設定與探索狀態 | — |
| `POST /api/providers` | 新增或取代一個已驗證的供應商並可選擇設為預設 | 400 無效／危險目的地或設定；409 命名空間碰撞 |
| `PATCH /api/providers?name=...` | 更新允許的供應商欄位、enabled/default 狀態或 OpenAI 帳號模式 | 400 無效欄位或轉換；404 未知供應商 |
| `DELETE /api/providers?name=...` | 刪除供應商，在可能時重新指派預設 | 404 未知供應商；409 `last_provider`；409 `provider_has_dependent_combos` |
| `POST /api/providers/test?name=...` | 執行有界的即時供應商連線／模型探索探測 | 404 未知供應商；失敗通常以 `ok: false` 證據回傳 |
| `GET /api/provider-quotas` | 讀取供應商配額報告；`refresh=1` 強制重新整理 | — |
| `GET /api/quota-resets` | 列出最近偵測到的配額視窗重置，以及偵測功能是否啟用；`limit=<n>` 限制筆數上限 | 400 無效的 `limit` |
| `GET, PUT /api/provider-context-caps` | 讀取或更新全域、所有供應商或單一供應商的 context 上限 | 400 無效請求；404 未知供應商 |
| `GET /api/provider-presets` | 回傳從 runtime registry 衍生的 GUI 供應商預設 | — |

上下文上限回應包含 `caps`（目前生效的上限）和 `values`（停用後仍保留的最後選擇值）。
啟用供應商的上限時，若未指定 `value`，便會恢復其選擇值；首次啟用時使用全域 `contextCapValue`。
OpenAI 也遵循此規則：開關不會選擇特殊的 922k 模式。生效中的上限會限制每個原生視窗；支援長上下文
的模型只能擴展到該模型支援的上限。
`{ "value": 600000, "setAll": true }` 會修改全域值，並且只更新已啟用的上限；上限已停用的供應商會
保留自己的選擇值，供之後啟用時恢復。不帶 `value` 的 `{ "setAll": true }` 會以目前全域值啟用所有
已設定供應商的上限，並取代儲存的選擇值。停用不會清除選擇值，重新載入後仍保留，但不會將其套用為限制。

`provider_has_dependent_combos` 是安全屏障：在刪除其供應商前，先移除或編輯相依的組合。

### 側邊欄與同意約束動作

| 方法與路徑 | 用途 | Notable errors |
| --- | --- | --- |
| `GET /api/github/star` | 透過使用者的 `gh` session 讀取 repository 加星狀態 | 狀態專屬的固定結果代碼 |
| `POST /api/github/star` | 僅從已認證的人類動作為 repository 加星 | 403 `agent_consent_required`，針對無儀表板 session 證據的 agent 驅動呼叫者 |
| `GET /api/update/badge` | 讀取便宜的側邊欄更新徽章狀態 | — |

:::caution
管理認證證明對代理的存取權；它不證明花費使用者身分的同意。agent 絕不能繞過 `agent_consent_required`。使用者必須選擇是否為 repository 加星。
:::

### 系統生命週期

| 方法與路徑 | 用途 | Notable errors |
| --- | --- | --- |
| `GET /api/system/memory` | 回傳純量的 process、heap、串流、回應狀態、看門狗與活躍回合指標。回應狀態診斷包含溢寫狀態、連續失敗次數、固定且不洩漏隱私的失敗分類，以及最後一次失敗／成功的時間戳記。`spillLastWriteFailureOrigin` 是 `retry_returned_timeout`、`timeout_memo_refusal` 或 null；累計的 `spillAclRetryReturnedTimeouts` 與 `spillAclTimeoutMemoRefusals` 計算終止失敗的發布次數。process-local 語義見 [Windows 溢寫診斷](/troubleshooting/windows-memory/)。絕不回傳原始錯誤與路徑。 | — |
| `POST /api/system/restart` | 在不移除客戶端注入的情況下開始感知排空的行程重啟 | 回傳 202；重複呼叫回報既有的排空 |
| `POST /api/stop` | 停止服務、還原原生 Codex、移除受管 Grok 注入並排空代理 | 409 服務擁有權衝突；當 Windows 工作排程器包裝程序可能重新啟動 proxy 且呼叫端不是 `ocx stop` 時回傳 409 `respawnable_service`（不會做任何變更）；當這個 proxy 本身就是已安裝的 launchd/systemd 服務時回傳 409 `self_unload_service`，因為從服務內部停止管理器，會在原生 Codex 被還原之前就結束該 process——請改執行 `ocx stop`（不會做任何變更）；已安裝的管理器拒絕停止時回傳 409；無法讀取工作排程器狀態時回傳 409 `service_state_unknown`（不會做任何變更；修復查詢後重試） |
| `GET /api/system/codex-app-server` | 回報執行中的 Codex app-server 是否早於目前的模型目錄 | — |
| `POST /api/system/codex-restart` | 重新整理目錄，然後重新啟動過期的 Codex app-server，並完全結束並重新啟動 Codex 桌面應用程式，讓模型選擇器重新載入。當 proxy 本身就在 Codex app 內執行時，桌面重啟會被拒絕而不是被交接。 | 有目標存活時，回傳 200 並附帶 `code: partially_stopped` |

### Codex 認證委派

`GET /api/settings` 會回報生效中的 `codexAccountPickerEnabled` 布林值。帶有這個
嚴格布林值的 `PUT`，在啟用一個空 map 時會初始化隱私安全的帳號選擇器，在停用或重新啟用時
保留既有的選擇器標籤，會先持久化，然後只在生效中的選擇器可見性有變動時，才要求一次有界的
目錄收斂。成功的回應包含 `catalogRefreshPending`：`false` 表示目錄提交已完成（或不需要重新
整理），`true` 則表示設定已儲存，但應使用 `POST /api/sync` 重試目錄重新整理。持久化或選擇器
分配失敗時，會回滾記憶體中的設定，且不會執行收斂。

根管理分派器將每個 `/api/codex-auth/*` 請求委派給 Codex 帳號管理員。其路由為：

| 方法與路徑 | 用途 | Notable errors |
| --- | --- | --- |
| `GET, POST, DELETE /api/codex-auth/accounts` | 列出／重新整理或刪除 Codex 帳號。POST 僅保留為已停用的相容 endpoint；成功的 DELETE 回應包含 `catalogRefreshPending`。 | POST 一律回傳 403 `manual_import_disabled`；DELETE 輸入無效時回傳 400 |
| `PUT /api/codex-auth/accounts/alias` | 設定或清除帳號別名 | 400 無效帳號／別名 |
| `PUT /api/codex-auth/accounts/pause` | 暫停或恢復一個帳號 | 400 無效帳號／狀態；404 缺失帳號 |
| `PUT /api/codex-auth/accounts/pause-exhausted` | 暫停配額耗盡的帳號 | 變更鎖失敗變為 503 |
| 帶 `codexQuotaAutoRefresh: { id, window, enabled }` 的 `PUT /api/settings` | 為一個帳號啟用或停用 5 小時或每週的自動視窗啟用 | 400 無效 id/window/狀態；404 缺失帳號；409 視窗不可用 |
| `POST /api/codex-auth/accounts/clear-cooldown` | 清除一個或所有帳號的 runtime 冷卻 | 400 無效 id |
| `GET, PUT /api/codex-auth/active` | 讀取或選擇現用帳號 | 400 無效或缺失帳號；409 暫停／舊列衝突 |
| `PUT /api/codex-auth/auto-switch` | 設定自動帳號切換的配額閾值 | 400 無效閾值 |
| `PUT, PATCH /api/codex-auth/pool-strategy` | 更新 Codex 帳號池選擇策略 | 400 無效策略／設定 |
| `PUT /api/codex-auth/failover` | 設定帳號容錯移轉閾值 | 400 無效閾值 |
| `GET /api/codex-auth/quota` | 依帳號讀取快取配額狀態 | — |
| `GET /api/codex-auth/reset-credits` | 檢查帳號的 reset-credit 資格 | 400 缺失帳號 id；上游狀態 passthrough；500 查詢失敗 |
| `POST /api/codex-auth/reset-credits/consume` | 消耗一個合格的 reset credit。選用的 `operationId`（UUIDv4）可讓兌換具備冪等性：相同 id 會重播同一筆持久化結果，而不會再消耗一個 credit。 | 400 缺失帳號 id 或無效的 `operationId`；若該 id 屬於其他帳號則 409 `identity_mismatch`；上游狀態 passthrough；503 `server_busy`、`capacity` 或 `unavailable`；500 消耗失敗 |
| `POST /api/codex-auth/login` | 啟動 Codex 登入或重新認證 | 400 無效請求；衝突／忙碌登入狀態 |
| `POST /api/codex-auth/login/code` | 為 Codex 登入流程提交手動碼 | 400 無效流程／碼 |
| `POST /api/codex-auth/login/cancel` | 取消 Codex 登入流程 | — |
| `GET /api/codex-auth/login-status` | 輪詢流程或帳號登入狀態。已完成的新帳號流程只有在需要復原時，才會包含 `catalogRefreshPending: true`。 | 未知流程回報 `expired`；無活躍流程回報 `idle` |

對於 reset-credit 的消耗，若同一個實體帳號有一個尚未完成的操作，而此時提交了
另一個不同的 `operationId`，它會以別名的身分加入該操作。其重試會使用原始的上游請求 ID，
並在同一個身分下記錄結果，因此之後用原始 ID 或已知別名發出的請求，會重播已儲存的結果，
而不會再發出一次消耗請求。結算之後提交一個先前未見過的 ID，會開始一次新的明確兌換；重試
既有動作的用戶端應保留它原本的 ID。

確認完成一次手動 `reset` 後，OpenCodex 會檢查同一個帳號的最新用量，並可以立即協調它符合
資格的、既有的共用 reset 衍生冷卻。已暫停的帳號、需要重新認證的帳號，以及已被進行中探測
擁有的冷卻，都排除在這項復原之外；它們的冷卻會被保留。在 reset 之前就開始的用量、不完整或
已耗盡的用量、帳號變更，以及更新的配額失敗，都不符合資格。較舊的 main-account 用量回應
不能取代較新已發佈的觀測結果。若用量需要憑證重新整理，復原就需要那次重新整理已確認的
lineage；外部替換的憑證，不會僅因屬於同一個帳號就符合資格。明確的 `Retry-After`、Reserve
冷卻、暫停設定、pin 與已選定的帳號都會被保留。`already_redeemed` 與持久化重播不能證明是一次
新的 reset，也不會獲得這項復原行為。

在確認的 `reset` 或 `already_redeemed` 之後，失敗或忙碌的用量重新整理，不會把
已完成的消耗變成錯誤：回應仍會是 HTTP 200，附帶其消耗 `code`，在沒有取得最新計數時省略
`remaining`。這個回應確認的是消耗結果，而不是該帳號現在可路由。請重新整理用量以檢查
可用性；不要為了重試一次失敗的用量重新整理而再消耗一個 credit。

若新的帳號設定列已儲存，但憑證設定無法完成，OAuth 的 `login-status` 會回報
`status: "error"`，附帶 `code: "codex_credential_persistence_failed"`、`accountId`、
`needsReauth: true`，以及選用的 `catalogRefreshPending: true`；儲存錯誤的細節不會外露。
該帳號列仍會保留：請先重新認證或刪除它，再重試建立帳號。

此委派家族下的設定寫入器或憑證重新整理鎖逾時回傳 HTTP 503 並附帶代碼 `CONFIG_MUTATION_LOCK_UNAVAILABLE`。客戶端應稍後重試，而非將該回應視為永久帳號失敗。

帳號的建立與刪除，會在目錄收斂之前就提交憑證／設定。失敗或延遲的目錄嘗試，絕不會
回滾這個持久化的帳號變更，也絕不會揭露內部的 provider、帳號、路徑或憑證細節；用戶端只會
收到完成與否的布林值。刪除一個帳號會保留其選擇器綁定，因此在該帳號缺席期間，精確路由會
顯式失敗；若之後同一個帳號 id 再次被加入，同一個選擇器就會被還原。

## 選擇客戶端

對於普通管理，[網頁儀表板](/guides/web-dashboard/)提供最安全的引導工作流程。對於無頭主機與自動化，請使用對應的 `ocx` 指令：它們呼叫此相同的即時 API，並在代理不可達或操作失敗時回傳非零結果。直接 HTTP 對需要上述精確端點契約的整合最為有用。

## 遠端工作階段與資料金鑰輪替

`POST /api/keys/rotate {id}` 開始十分鐘重疊期，且只回傳一次新金鑰。`POST /api/keys/rotate/commit {id,rotationId}` 提交，`DELETE /api/keys/rotate {id,rotationId}` 中止。全部都需要管理驗證，資料金鑰不能呼叫。`POST /api/session/logout` 需要目前的 `gui-session`、相符的 Origin 與 CSRF。Admin token 會收到 403，永遠不能建立使用者同意工作階段。
