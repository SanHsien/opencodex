---
title: 同步資料夾中的支出帳本被拒絕
description: 當 opencodex 狀態目錄位於 iCloud Drive 或其他同步資料夾內時，為什麼請求會以「Spend-ledger storage could not be opened safely」失敗，以及如何修正。
---

部分 macOS 使用者看到請求間歇性地以 HTTP 502 與下列訊息失敗，而同一個工作階段中的其他請求卻成功：

```text
Provider unreachable: Spend-ledger storage could not be opened safely.
```

目前的版本會指出是哪個檔案、哪項檢查拒絕了它，例如：

```text
Spend-ledger storage could not be opened safely (journal: extra-hard-link).
```

## 這項檢查是什麼

opencodex 在狀態目錄（預設 `~/.opencodex`，或 `OPENCODEX_HOME`）中保存支出帳本：一個日誌檔 `spend-ledger.jsonl`，以及一個
鹽值檔 `spend-ledger.salt`。每次寫入前，它會檢查每個檔案都是屬於你的一般檔案、不是符號連結，且恰好只有一個目錄項目。
第二個 hard link 代表磁碟區上其他地方的另一個名稱可以看到或修改同樣的位元組，所以 opencodex 會拒絕，而不是透過它寫入。
這項檢查刻意保持嚴格。

| 訊息中的條件 | 意義 |
| --- | --- |
| `extra-hard-link` | 另一個目錄項目指向同一個檔案。 |
| `symbolic-link` | 帳本檔案是符號連結。 |
| `not-regular-file` | 帳本路徑上放的不是一般檔案。 |
| `foreign-owner` | 檔案屬於不同的使用者。 |
| `invalid-salt` | 鹽值檔存在，但內容不是有效的鹽值。 |

訊息中的角色是 `journal`、`journal-compaction`（壓縮日誌時寫入的暫存檔）或 `salt`。

## 為什麼同步資料夾會觸發它

macOS 的同步服務，包括開啟「桌面與文件資料夾」的 iCloud Drive，以及 OneDrive、Dropbox、Google Drive 等 File Provider
用戶端，在暫存或上傳變更時，可能會短暫地對檔案保留第二個連結。如果狀態目錄位於這類資料夾內，日誌在一次普通寫入之後可能
有一瞬間有兩個連結。恰好落在那個時刻的請求會被拒絕，下一個請求可能就成功了。同步穩定後檔案又回到一個連結，所以事後檢查
不會看到任何異常。

啟動時，當狀態目錄解析到 iCloud Drive（`~/Library/Mobile Documents`）、File Provider 資料夾（`~/Library/CloudStorage`），
或在 iCloud 桌面與文件同步看似開啟時解析到桌面或文件資料夾內，opencodex 現在會發出警告。這個警告僅供參考。偵測只讀取
資料夾配置，兩個方向都可能判斷錯誤。

## 修正

請讓狀態目錄保持在同步資料夾之外。預設的 `~/.opencodex` 不會被同步。

1. 停止 opencodex。
2. 把狀態目錄移動或複製到未同步的位置，例如 `~/.opencodex-trial`。
3. 把 `OPENCODEX_HOME` 設為該位置，或取消設定以使用預設值，然後重新啟動 opencodex。

不要為了讓錯誤消失而刪除日誌、放寬它的權限，或移除這項檢查。日誌保存著你記錄下來的支出，而這項檢查正是避免它被寫入
透過意外連結的原因。

如果訊息指出的條件不是 `extra-hard-link`，或狀態目錄不在同步資料夾內，請連同完整的拒絕訊息開一個 issue。訊息中不含路徑、
帳號或請求內容。
