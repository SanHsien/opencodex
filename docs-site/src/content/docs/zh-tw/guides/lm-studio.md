---
title: LM Studio 嚴格聊天模板
description: 為 LM Studio Chat 模型設定單一開頭 system 訊息。
---

**LM Studio (local)** 預設組合會為 `openai-chat` 轉接器啟用 `singleLeadingSystemMessage: true`。
這會把僅含文字的 system／developer 指示合併成一則開頭的 system 訊息，各則之間以空行分隔。
它支援自訂模型 ID，包含量化與檢查點後綴，不需要依賴以模型名稱判斷相容性的選擇器。

對於已存在、經過改名或自訂的 LM Studio 供應商，請在供應商編輯器中明確加入這個布林值。
儲存的值與供應商名稱、主機名稱與連接埠無關。目的地不變的儲存會保留未提供的設定；
會取代目的地的 POST 則必須重新送出該值。PATCH 接受布林值或 `null`（用來清除覆寫）。
在標準的 LM Studio 供應商上清除該值，會還原預設組合的預設值。

若模板可接受依時間順序排列的指示訊息，可設定 `singleLeadingSystemMessage: false` 以停用合併。
其他預設組合維持各自的預設值。`foldDeveloperRoleToSystem` 仍然只控制 developer 角色；
啟用單一訊息相容模式時，其優先順序高於該角色選項，也高於依模型名稱判斷的後置指示因應做法。

把較後面的指示提到前面，會改變它們在時間順序上的作用範圍，並可能使提示詞快取前綴失效。
轉換後的請求會保留 IR 的指示順序：先是基礎 system 提示詞，其後是時間軸上的 developer 指示。
Responses 解析器已經把輸入的 system 項目收進基礎提示詞，因此它們相對於 developer 項目的原始位置無法復原。
直接的 Chat 直通會保留 system／developer 訊息原本的相對順序。兩條路徑都只正規化送出的副本，
並讓使用者訊息與工具配對維持原順序。

直接 Chat 中非文字的 system／developer 部分會明確失敗，而不是被無聲丟棄。
轉換後的 developer 文件，其檔案部分會留在時間軸上原有位置、與使用者相容的訊息中，文字則併入開頭的 system 訊息。
Developer 的圖片／音訊訊息仍沿用原有的使用者相容對應。設定這個旗標不需要執行 LM Studio；
實際提供服務的模型，其模板仍決定它接受哪些其他傳輸格式功能。
