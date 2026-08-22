# 上游維護

## Remote

- Fork：`origin` → `https://github.com/SanHsien/opencodex.git`
- 原作者：`upstream` → `https://github.com/lidge-jun/opencodex.git`
- 追蹤分支：`main`（發版線）。上游另有 `dev`（PR 整合）與 `preview`（prerelease），需要時再 `git fetch upstream dev`。

## 檢查新提交

```powershell
git fetch upstream main
bun tools/check-upstream-updates.ts --strict
```

工具以 `tools/upstream_baseline.json` 的 `reviewed_through` 為起點，列出所有未審查提交。
有新提交或檢查失敗時，`--strict` 回傳非零；排程 workflow 也會因此明確失敗。

## 審查清冊

每次只做一次批次審查：

1. 讀 commit 主旨與變更檔案。
2. 判斷是否與 Windows gate、fork 文件、workflow guard 或測試衝突。
3. 可直接同步的提交用 merge；只需要部分修正時 cherry-pick 或最小重做。
4. 跑 `pwsh -NoProfile -File tools\dev_check.ps1`。產品檔有改再跑 `bun run typecheck` 與 `bun run test`。
5. 在 `docs/fork/DECISIONS.md` 記錄採用／略過理由。
6. 驗證完成後才把 baseline 推進到已審查的完整 40 字元 SHA。

Baseline 代表「已審查」，不代表「全部已合併」。

帳號池、provider、routing 的產品修正通常直接同步。workflow 變更必須核對官方-repo-only guard 是否仍在。

## 2026-08-22：fork 起點

本 fork 自上游 `main` `6ae83b1f189c353935d4977bb01227484fbdb52b`
（`release: v2.31.0`）建立。此 SHA 設為第一個 `reviewed_through`。
之後的上游 commit 才需要進入審查清冊。
