---
title: 在 OS 金鑰圈中儲存金鑰
description: 在 macOS Keychain、Windows 認證管理員或 Linux Secret Service 中儲存供應商 API 金鑰與 Vertex 憑證。
---

對於 Vertex，專用的 API 金鑰池輸入（`POST /api/providers/keys`）在供應商建立之後，接受完整的 GCP
`service_account` 或 `authorized_user` 憑證 JSON。
供應商的建立／編輯表單與 `ocx provider add --api-key` 會在儲存之前拒絕憑證 JSON：
請先不帶金鑰建立供應商，再透過它的金鑰池加入 JSON。請貼上 JSON 的內容，而不是 Windows、Unix 或相對檔案路徑。
以逗號或空白分隔的多個 JSON 物件，會各自儲存為獨立的金鑰池項目；第一個成為使用中項目。
設定檔中只會有 `gcp-sa:<account>` 參照，絕不含憑證 JSON。
混合 JSON 與一般金鑰的大量貼上會整批拒絕；請分開加入一般金鑰。
儲存失敗時設定維持不變，並回報固定的錯誤訊息，不會回顯憑證內容。
空的標記帳號無效，也不會退回使用主機憑證。
請貼上一個憑證物件或一連串物件，不要加外層陣列或引號字串。格式錯誤的憑證文字會被拒絕。
若所選的已儲存憑證被移除或變得無法讀取，即使 Vertex 先前已為該憑證快取了存取權杖，仍會拒絕該請求。
移除金鑰或供應商，或用 `ocx provider add --force` 取代供應商時，會在設定儲存之後刪除不再被參照的 GCP 憑證；
被其他供應商參照的憑證則會保留。若 OS 儲存區的清理失敗，會以警告要求手動檢查，並不會復原已提交的設定移除。
一般的金鑰圈儲存／還原操作，會讓 GCP 標記與 JSON 留在 OS 儲存區。
透過 `keychain:` 別名還原憑證 JSON 會被拒絕，清理時也會保留任一種標記寫法仍在參照的帳號。
把含有 GCP JSON 的 `keychain:` 別名當作 API 金鑰使用，同樣會被拒絕；請改選其 `gcp-sa:` 參照來做 Vertex 驗證。
一般 API 金鑰必須是純權杖文字：JSON 物件、陣列與加引號的 JSON 字串，
在一般金鑰解析與還原時都會被拒絕，包含夾帶跳脫憑證文字的包裝。
憑證寫入與標記持久化共用清理交易鎖，因此並行的移除不會在讀回與標記提交之間刪掉已儲存的 JSON。

預設情況下，供應商的 `apiKey` 與 `apiKeyPool` 存放在 `config.json`（權限 0600，原子寫入）。
若你想讓金鑰內容不留在檔案裡，可以把它移進 OS 認證儲存區：

```bash
ocx provider keychain deepseek status    # 儲存位置：file | env | keychain，以及金鑰圈是否有回應
ocx provider keychain deepseek store     # 把使用中的金鑰與金鑰池移進 OS 金鑰圈
ocx provider keychain deepseek restore   # 還原明文並刪除金鑰圈項目
```

同樣的操作也可透過 `GET`／`POST /api/providers/keychain` 進行。執行 `store` 之後，`config.json` 內是
`"apiKey": "keychain:deepseek"`（金鑰池項目為 `keychain:deepseek/<id>`），祕密內容則存放在
macOS Keychain、Windows 認證管理員或 Linux Secret Service 的 `opencodex.provider-api-key.v1` 服務之下。
因此 `config.json` 的備份只含參照。金鑰輪替與容錯切換照常運作：金鑰池項目以參照比對，所以輪替絕不會把明文寫回。

在動到設定之前，`store` 會寫入並讀回每個項目；若金鑰圈無法使用或讀回的內容不符，
它會以 503 拒絕，並讓檔案保持原狀。在請求時，若參照讀不到，就不會得到任何憑證，每把金鑰只發出一次警告——
依設計不提供明文後備。

不建議啟用的情況：以無頭服務（systemd、launchd、工作排程器）或容器執行的代理，通常沒有已解鎖的金鑰圈工作階段，
請求會以封閉式失敗收場。此時請改在服務環境中使用 `${ENV_VAR}` 參照。環境變數參照不會被 `store` 動到。
