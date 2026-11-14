---
title: 驗證自訂遠端閘道
description: 從探索到有界限的 completion，逐步檢查自訂 Chat Completions 閘道。
---

註冊閘道之前，請向其營運者取得經授權的 Chat Completions base URL、API 金鑰與支援的模型 ID。
例如 `https://api.example.com/v1` 只是佔位符，不是可用的端點。若代理尚未執行就先啟動，接著在
儀表板選擇 **Custom**，命名為 `my-gateway`，選擇 `openai-chat`，並在表單中填入經授權的 URL 與金鑰。
儲存時不要把金鑰放進指令或共用範例。已儲存的 provider 還不能證明探索或推論可以運作。

在 [Remote Link](/zh-tw/guides/remote-link/) 的 Child 上，provider 來自 Home：Child 的儀表板
會拒絕 provider 變更，請求由 Home 的 provider 處理。請改在 Home 上註冊並驗證閘道。

分開檢查各個邊界；若本機埠號與預設不同，請使用實際設定的埠號：

```sh
curl -fsS http://127.0.0.1:10100/healthz
ocx ready
ocx provider test my-gateway
ocx models live --provider my-gateway --json
```

健康與就緒檢查描述的是代理本身，並不證明上游能產生文字。沒有 `--model` 的 provider 測試只檢查
探索，不檢查推論。`applicable: false` 可能代表靜態目錄沒有即時探索端點，這不等於推論測試成功。
公開的模型清單也不一定會驗證金鑰。若探索失敗或沒有任何模型出現，請在選擇模型之前先檢查 URL、
憑證、上游存取與 provider 設定。

閘道可以在沒有模型清單端點的情況下提供 completion。若其營運者提供了支援的原始 ID，請在既有的
provider 上設定 `liveModels: false` 與 `models: ["vendor/model"]`，保留其他欄位，並把範例 ID 換成
提供的值。請參閱[靜態模型目錄](/zh-tw/reference/configuration/providers/#static-model-allowlists)。

直接編輯 `config.json` 之前，先儲存工作並等待進行中的請求完成；停止代理可能中斷它們。請透過代理的
擁有者停止它：從系統匣結束 OpenCodex Desktop、服務安裝使用 `ocx service stop`，或對未受監管的代理
執行 `ocx stop`。確認已停止後再編輯並儲存檔案，且不要同時執行其他設定寫入者。再透過同一個擁有者
啟動：重新開啟 Desktop、執行 `ocx service start`，或以原本的啟動選項（若有指定則包含 `--port`）
重新執行 `ocx start`。前景啟動時請讓它留在原終端機，並從另一個終端機執行 `ocx sync` 與其餘檢查，
然後再次檢視即時目錄。或者，也可以用下方需確認成本的 completion 指令直接測試提供的原始 ID；該測試
不需要目錄列。

在即時目錄中檢視實際的 `id`、`namespaced`、`disabled` 與 `initialSelectionPending` 欄位。初始選取
可能讓模型保持關閉或待定，請參閱[初始模型選取](/zh-tw/reference/configuration/providers/#initial-model-selection)。
啟用某一列之前請先處理待定的初始選取。對可見性指令，請把 provider 名稱與該列的**原始 `id`** 組合，
並保留 ID 內的斜線：

```sh
ocx models enable 'my-gateway/<raw-upstream-id>'
```

例如原始 `id` 為 `vendor/model` 時，選擇器是 `my-gateway/vendor/model`。面向用戶端的 `namespaced`
slug 可能是 `my-gateway/vendor-model`；改用編碼後的 slug 可能讓原始的停用項目保留下來。啟用一個
模型不會停用其他模型。若只想讓此閘道的這個模型可見，請用相同格式的原始 `id` 停用其他已啟用的
閘道列，然後再次檢視清單：

```sh
ocx models disable 'my-gateway/<other-raw-upstream-id>'
ocx models live --provider my-gateway --json
```

確認目標列是 `disabled: false`，其他預期排除的列都已停用。裸的原生模型 ID 可能選到不同的路由。請使用
確切的值，而不是顯示名稱或猜測的推理後綴：後綴可能是獨立的上游模型 ID，而推理強度是另一項設定。
細節請見 [CLI 參考](/zh-tw/reference/cli/providers-accounts/)。

必要時執行 `ocx sync` 更新用戶端目錄，再確認模型出現在 Codex 模型選單中。執行中的用戶端可能保留較舊
的記憶體內清單。請保留進行中的工作；若選單仍是舊的，完全結束並重新開啟 Codex。或者在明確同意後使用
[`ocx system codex-restart --yes`](/zh-tw/reference/cli/agents/)：它可能中斷工作階段並丟棄未儲存的
草稿、選取或待處理的核准提示。除了上述直接編輯設定檔的情況，重新啟動用戶端或代理不是預設的復原步驟。

若要在支援的金鑰認證遠端設定上驗證一次實際的 completion，請原樣傳入該列或閘道營運者提供的
**原始上游 `id`**，不要加上 provider 前綴：

```sh
ocx provider test my-gateway --model '<raw-upstream-id>'
```

這會送出一個有界限的請求，消耗配額，也可能產生費用。請在同意該成本後才確認預設為否的提示；非互動
或 JSON 使用需要 `--yes`。`applicable: false` 的 completion 結果不會送出 completion，即使指令以零結束
也不算通過。在把成功的測試算作通過之前，請確認回報的 wire model 與預期的上游 ID 相符；別名可能解析成
不同的模型，在 JSON 輸出中對應 `wireModel`。成功的文字 completion 並不能證明工具呼叫、結構化輸出、
接續行為或模型的實際身分；上游回報的身分只是中繼資料。後續的相容性問題，請以經過清理的 fixture
另外重現受影響的協定。
