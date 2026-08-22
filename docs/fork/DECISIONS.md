# 維護決策

## 2026-08-22：fork 可管理多帳號的 lidge-jun/opencodex

**決定**：fork [`lidge-jun/opencodex`](https://github.com/lidge-jun/opencodex)，保留 MIT 授權與完整歷史，預設分支維持 `main`。本線聚焦 Windows 開發 gate、fork CI、危險 workflow 隔離，以及逐筆審查的上游追蹤。產品 README 不翻譯。

**理由**：要的是「可管理多帳號」的那一個。此專案在 dashboard 管理 ChatGPT / Codex account pool（配額、affinity、failover），並把任意 LLM 接到 Codex / Claude Code。GitHub 上另有遠端桌面中介與 OpenCode 改名專案，名稱相近但不是這個。fork 當下 HEAD 為 `6ae83b1f189c353935d4977bb01227484fbdb52b`（`release: v2.31.0`）。

**限制**：

- 不把 fork 包裝成原創專案，不移除原作者與 MIT 標示。
- `README.md` 保持上游英文產品說明。
- `CONTRIBUTING.md`、`MAINTAINERS.md`、`SECURITY.md`、`src/`、`gui/`、`docs-site/` 以上游為準。
- 上游更新必須逐筆審查。
- 本 fork 不發 npm、不部署 GitHub Pages。
- 帳號池只做路由與韌性，不拿來規避 provider 條款。
- 日常 PR 只打 `SanHsien/opencodex`。對上游開 PR 必須維護者這次對話明確同意回貢。

## 2026-08-22：禁止裸跑 gh pr create

**決定**：本 fork 開 PR 一律 `gh pr create --repo SanHsien/opencodex`。建完核對 URL owner。對上游開 PR 的唯一例外是維護者明確同意回貢。

**理由**：2026-08-22 裸跑 `gh pr create` 把維護骨架打進 `lidge-jun/opencodex#2373`。GitHub CLI 在有 `upstream` 的 fork clone 上預設 target 是母 repo。已關閉該 PR。禁止再犯。

## 2026-08-22：隔離會在 fork 上造成傷害或噪音的上游 workflow

**決定**：下列 workflow 加上 `github.repository == 'lidge-jun/opencodex'`，只在官方 repo 跑：

- `release.yml`（npm Trusted Publishing）
- `deploy-docs.yml`（GitHub Pages）
- `service-lifecycle.yml`
- issue / PR 治理：`enforce-issue-quality.yml`、`enforce-pr-target.yml`、`issue-triage.yml`、`pr-hygiene.yml`、`pr-labeler.yml`、`stale-needs-info.yml`、`cleanup-orphaned-workflows.yml`

**保留在本 fork 跑**：`ci.yml`（產品回歸）、`react-doctor.yml`、`issue-quality-tests.yml`。

**理由**：`release.yml` 在 fork 上若被手動觸發，有機會對 npm 做 Trusted Publishing。`enforce-pr-target` 會把 PR 逼去上游的 `dev` 線，與本 fork 的 `main` 工作流衝突。治理 bot 在個人 fork 沒有對應的 Copilot / CodeRabbit 設定，只會製造失敗與亂關 issue。

## 2026-08-22：本 fork 日常走 main，不跟上游的 dev PR 政策

**決定**：SanHsien 維護線以 `main` 為整合分支。只有維護者在這次對話明確同意回貢時，才對 `lidge-jun/opencodex` 的 `dev` 開 PR。

**理由**：上游 `main` 是 release 線、`dev` 是 PR 整合線。fork 若同時模仿兩條線，Windows gate 與上游同步都會加倍。clone 時已用 `--default-branch-only` 對齊 `main`。

## 2026-08-22：Dependabot 不啟用 npm

**決定**：不幫上游的 `bun.lock` / `package.json` 開 npm Dependabot。fork-owned workflow 的 action pin 用 CodeQL / checkout SHA，之後若要自動升，只開 `github-actions`。

**理由**：上游幾乎每天發版。對 lockfile 開 Dependabot 會與上游 merge 持續衝突。
