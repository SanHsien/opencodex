---
title: Codex Log Guard
description: 在不暴露日誌內容的前提下，檢視並明確減少 Codex 診斷日誌的持久化寫入。
---

OpenCodex 可以檢視 Codex 的持久診斷日誌資料庫，並在你選擇加入時，減少 Codex
持久化寫入的診斷資料列。檢視功能維持唯讀；保護功能是一次明確的變更，除非已知
的 Codex 日誌結構描述存在、且 Codex 已停止，否則會被拒絕。

## Inspect 會回報什麼

OpenCodex 用 Codex 既有的優先順序，解析出 Codex 有效的 `sqlite_home`，並檢視
該處權威的 `logs_2.sqlite` 資料庫。編號較高或舊版的 `logs_N.sqlite` 檔案，絕
不會被替代成可變更的目標。

Storage 檢視畫面會回報：

- 主資料庫、WAL 與 SHM 檔案的大小；
- 日誌資料列總數，以及以 `TRACE` 等級儲存的比例；
- 依資料列數量排序、最大的日誌目標分桶，使用排名標籤而非目標名稱；
- 之後可能可回收的 SQLite 可用清單空間；以及
- 觀察到的結構描述，是否與目前已知的 Codex 日誌結構描述相容。

若 `sqlite_home` 在 `CODEX_HOME` 之外，這個診斷資料庫會被分開顯示。它的位元
組數不會被悄悄併入既有的 `CODEX_HOME` 儲存總量。

在產生這些診斷資料時，OpenCodex 不會選取或暴露 `feedback_log_body`。日誌等
級會被縮減成固定的已知等級集合再加上 `OTHER`，而目標名稱不會被序列化。

## Protect 模式

保護功能**預設關閉**。啟用它會在 Codex 權威的 `logs_2.sqlite` 資料庫中安裝
一個由 OpenCodex 擁有的 `BEFORE INSERT` 觸發器。OpenCodex 絕不會用它保留的
名稱去取代一個未知的觸發器，只會移除 SQL 與 OpenCodex 擁有版本相符的觸發器。

有兩種模式可選：

- **Compatibility**（`compat`）是建議使用的模式。它把目前的 Log Guard v1
  規則集，釘選在目前 Codex 已經在它的持久 SQLite 日誌槽中過濾或降級的高流量
  目標上。不相關的 `TRACE` 資料列會被保留。
- **Quiet**（`quiet`）會抑制每一筆新的 `TRACE` 資料列，同時保留 `DEBUG`、
  `INFO`、`WARN` 與 `ERROR` 資料列。

保護功能減少的是抵達持久 SQLite 儲存的資料列。它**不會**消除 Codex 較早的追
蹤工作：在觸發器忽略某一列之前，事件仍然可以被格式化、排入佇列、分組進交
易，並被 Codex 自己的裁剪邏輯納入考慮。請把 Protect 當成持久寫入流失量的防
護罩，而不是一個能關閉 Codex 內部診斷產生的開關。

Log Guard 只過濾已持久化的本機 SQLite 日誌資料列。它不會改變 Codex 的診斷處
理、[轉接器傳輸](/reference/adapters/)、供應商酬載、串流語意、驗證、路由、
配額或帳號狀態。

### 安全檢查

在 Protect、Disable 或 Repair 變更這個外部資料庫之前，OpenCodex 會：

1. 解析出確切的權威 `logs_2.sqlite` 路徑；
2. 驗證該路徑是一個一般、非 symlink 的檔案，且已知結構描述完全相符；
3. 驗證程序列舉成功，且沒有任何受支援的 Codex 寫入程序在執行；
4. 取得一個專用的跨程序 Log Guard 鎖；
5. 在取得該鎖之後，再重複一次 Codex 程序檢查；
6. 以不建立新檔的方式開啟讀寫模式的資料庫，並在不忙碌等待的情況下取得
   SQLite 的 `BEGIN IMMEDIATE`；
7. 只變更由 OpenCodex 擁有的 Log Guard 觸發器，並在提交前讀回結果；並且
8. 在仍持有 Log Guard 鎖的期間，把請求的模式持久化進 OpenCodex 設定。

若程序列舉結果不確定、資料庫忙碌、結構描述未知，或某個保留的觸發器名稱屬於
不同的 SQL 內容，這次變更就會失敗封閉。OpenCodex 不會自動終止 Codex。

## 漂移與修復

請求的保護模式，儲存在 OpenCodex 設定中，與 Codex 的日誌資料庫分開存放。這
點很重要，因為 Codex 的一次遷移可能會重建 `logs` 資料表，而 SQLite 會在一個
資料表被替換時，把附掛在上面的觸發器一併丟棄。

當已儲存的模式是 `compat` 或 `quiet`，但對應的自有觸發器已經觀察不到時，
Log Guard 會回報**已漂移**。`ocx doctor` 會回報這個漂移，但絕不會自動修復
它。

修復是明確動作：

```bash
ocx storage codex-logs repair
```

OpenCodex 刻意不在每次啟動時都重新建立保護。只有在累積了足夠的實地證據，證
明這麼做在各種 Codex 遷移下都安全之後，之後的版本才會重新考慮自動修復。

## CLI

讀取狀態：

```bash
ocx storage codex-logs status
ocx storage codex-logs status --json
ocx doctor
```

啟用建議的相容性政策：

```bash
ocx storage codex-logs protect
```

明確選擇 quiet 模式：

```bash
ocx storage codex-logs protect --mode quiet
```

停用 OpenCodex 保護，或修復漂移：

```bash
ocx storage codex-logs unprotect
ocx storage codex-logs repair
```

替 Log Guard 指令加上 `--json` 以取得機器可讀輸出。權威的指令語法與 JSON 行
為見[CLI 參考](/reference/cli/)。

既有的指令維持不變：

```bash
ocx storage --json
```

它的回應帶有與 Storage 頁面相同的 Codex 日誌狀態。

## 管理 API

狀態可在這裡取得：

```text
GET /api/storage/codex-logs
```

明確的變更動作使用：

```text
POST /api/storage/codex-logs/protect
POST /api/storage/codex-logs/unprotect
POST /api/storage/codex-logs/repair
```

Protect 的請求主體是 `{"mode":"compat"}` 或 `{"mode":"quiet"}`。
`GET /api/storage` 也把這份報告包含為 `codexLogs`，讓儀表板能從一次快照請
求，同時刷新一般的儲存分類與 Codex 日誌診斷。

## 唯讀快照語意

狀態檢視會以 SQLite 的 `immutable=1` 開啟唯讀資料庫。這能防止一次診斷讀取行
為建立或更新 `-wal` 或 `-shm` 附屬檔案。

這裡有個重要的取捨：SQL 聚合結果與觀察到的觸發器中繼資料，描述的是最後一次
做過 checkpoint 的資料庫快照。若 Codex 正在寫入，即時的 WAL 可能含有比這份
不可變快照更新的資料列或結構描述頁面。一次成功的變更回應，使用的是 OpenCodex
在它自己的寫入交易內驗證過的觸發器狀態；之後的一次唯讀狀態請求，可能會暫時
落後，直到 SQLite 對那些結構描述頁面做完 checkpoint 為止。

OpenCodex 會分開回報 WAL 檔案大小，並且**不會**把這個結果標示為 SSD 寫入速
率、NAND 寫入量，或磁碟耗損／TBW 消耗量。

## 相容性狀態

已知的結構描述，會把檢視與保護都回報為支援。缺失、無法讀取，或未知的未來結
構描述，仍可以被檢視為中繼資料，但在可變更操作上會回報為不支援。

一個未知的結構描述不會被用猜的方式視為相容。這讓一個較新的 Codex 版本仍然可
以被觀察，同時防止 Log Guard 把一個未經審查的資料庫版面配置，當成可以安全變
更的東西。

## 回收仍然是分開的

Protect 不會執行 vacuum 或壓實 SQLite。之後的**Reclaim**階段，會加入一套明
確的、離線的、有邊界的漸進式 vacuum 流程，並附帶 checkpoint 與完整性檢查。

Protect 絕不會執行 `VACUUM`，絕不會直接截斷或刪除 Codex 的 WAL，也絕不會執
行排程性的空間回收。
