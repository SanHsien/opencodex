---
title: Codex Log Guard 回收
description: 以有邊界的漸進式 vacuum，手動從 Codex 診斷日誌 SQLite 儲存中回收可用頁面。
---

回收（Reclaim）是 Codex Log Guard 的手動空間回收階段。它只有在資料庫與執行環
境通過與 Log Guard 保護相同的安全檢查時，才會壓實 Codex 的權威
`logs_2.sqlite` 資料庫。

回收**絕不會自動排程**，也絕不會只因為開啟了 Storage 頁面就執行。儀表板在送
出這個變更請求之前，需要明確的 Compact 動作，以及第二次確認。

## 回收做了什麼

OpenCodex 會執行一段有邊界的離線維護程序：

1. 透過 Codex 有效的 `sqlite_home` 解析出權威的 `logs_2.sqlite`；
2. 驗證檔案身分與已知的 Codex 日誌結構描述；
3. 驗證程序列舉成功，且沒有任何受支援的 Codex 寫入程序正在執行；
4. 取得專用的跨程序 Log Guard 鎖；
5. 在持有該鎖的期間再次執行 Codex 程序檢查；
6. 以不建立新檔的方式開啟既有資料庫的讀寫模式，並證明能立即取得 SQLite 寫入
   權；
7. 要求 `PRAGMA auto_vacuum` 必須已經是 `INCREMENTAL`；
8. 在維護前執行 `PRAGMA quick_check`；
9. 執行一次完整的 WAL checkpoint，並拒絕忙碌或未完成的 checkpoint；
10. 執行有邊界的 `PRAGMA incremental_vacuum(N)` 批次，每批之後都做
    checkpoint；
11. 在維護之後再次執行 `PRAGMA quick_check`；並且
12. 回報維護前後的資料庫、WAL、頁數、可用清單與可回收位元組等指標。

預設的批次目標約為 **8 MiB 的 SQLite 頁面**。單次執行最多回收約 **256 MiB
的頁面**，另外還有一個有限的疊代上限。若仍有更多可用頁面剩下，結果會回報為
部分完成，你可以之後再次呼叫 Compact。

位元組上限會依資料庫實際的 SQLite 頁面大小換算成頁數。它們限制的是處理過的
邏輯 SQLite 頁面數量，而不是對 SSD／NAND 寫入量的任何宣稱。

## 安全保證

回收刻意**不會**：

- 執行完整的 `VACUUM`；
- 更動既有 Codex 資料庫的 `auto_vacuum` 模式；
- 直接刪除、截斷、重新命名或以其他方式操作 Codex 的 `-wal`／`-shm` 檔案；
- 刪除診斷資料列；
- 修改 Log Guard 保護觸發器或不相關的使用者觸發器；
- 在偵測到 Codex 處於活躍狀態時執行；
- 在程序列舉結果不確定時繼續進行；
- 在未知的未來日誌結構描述上繼續進行；或
- 在 SQLite 完整性檢查失敗後繼續進行。

忙碌中的 Log Guard 鎖、忙碌中的 SQLite 寫入者，或忙碌中的初始 checkpoint，都
會被回報為明確拒絕，而不是在背景重試。如果爭用情況是在某個 incremental-
vacuum 批次已經提交之後才出現，OpenCodex 會把已完成的工作回報為一次成功的
部分結果，並附上 `stopReason: "busy"`，而不是宣稱什麼都沒改變。

## CLI

先檢視可回收的空間：

```bash
ocx storage codex-logs status
```

執行一次有邊界的維護：

```bash
ocx storage codex-logs compact
```

要取得機器可讀的前後指標：

```bash
ocx storage codex-logs compact --json
```

如果結果回報還有更多可回收空間，除非你明確想再跑一次有邊界的維護，否則就到
此為止。OpenCodex 不會無限迴圈，也不會替你排程後續的維護。

## 管理 API

壓實只以一個變更端點的形式公開：

```text
POST /api/storage/codex-logs/compact
```

沒有對應的 GET 別名。成功的回應會帶有一個 `report` 物件，內含前後量測值、
回收的頁數、實體主資料庫大小變化、疊代次數、完成度、停止原因與完整性狀態。

常見的拒絕狀態包括：

- `codex_running`
- `process_enumeration_failed`
- `busy`
- `unsupported_schema`
- `auto_vacuum_not_incremental`
- `unsafe_path`
- `integrity_check_failed`
- `database_error`

完整性失敗會註明它發生在維護動作之前還是之後。`busy` 拒絕代表爭用是在任何
vacuum 批次提交之前就被偵測到；成功回報中的 `stopReason: "busy"` 則代表至少
有一個批次已經提交，後續的 checkpoint 爭用才讓這次維護停下。

## 理解結果

`pagesReclaimed` 與 `logicalBytesReclaimed` 描述的是這次維護過程中移除的
SQLite 可用清單頁面。`physicalDatabaseBytesReclaimed` 回報的則是維護
checkpoint 之後，主資料庫檔案觀察到的實際縮減量。

這些數字可能不同。SQLite／WAL／檔案系統的行為代表回收邏輯頁面，並不保證會有
完全相同幅度的實體檔案立即縮減，這些指標都不應被解讀為 NAND 寫入量、SSD 耗
損或已消耗／已節省的 TBW。

`complete: true` 代表觀察到的可用清單已經歸零。部分完成的結果，在每次執行的
頁面預算或有限疊代上限使維護結束時，使用 `stopReason: "page_budget"`；在
SQLite 不再縮減可用清單時，使用 `stopReason: "no_progress"`；在已提交的回收
之後出現 checkpoint 爭用時，使用 `stopReason: "busy"`。這三種都是有邊界的結
果；沒有一種會導致自動重試。
