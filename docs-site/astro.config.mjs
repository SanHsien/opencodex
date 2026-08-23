// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Canonical GitHub Pages custom domain. The site is served at the domain root,
// so Starlight must not emit the former /opencodex project-site prefix.
const SITE_URL = "https://opencodex.me";

// NOTE: the WebSite / SoftwareApplication JSON-LD deliberately does NOT live here.
// Google only reads site-name markup from the home page of a site, and a global
// `head` entry would replay one `#website` entity (with the root `url`) on every
// docs page and every locale. Duplicated, conflicting WebSite objects are exactly
// what makes Google fall back to the domain ("opencodex.me") for the site name.
// The markup is emitted once per locale home page from `src/components/SiteJsonLd.astro`.

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "ignore",
  // lightningcss merges animation-timeline into the `animation` shorthand,
  // which Chrome cannot parse — the scroll-driven animations die silently.
  vite: { build: { cssMinify: "esbuild" } },
  integrations: [
    starlight({
      title: "opencodex",
      description:
        "Universal provider proxy for OpenAI Codex & Claude Code — use any LLM with Codex CLI, App, SDK, and Claude Code.",
      tagline: "Use any LLM with OpenAI Codex and Claude Code.",
      logo: {
        light: "./src/assets/logo-light.png",
        dark: "./src/assets/logo-dark.png",
        replacesTitle: false,
      },
      favicon: "/favicon.ico",
      customCss: [
        "@fontsource-variable/geist",
        "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css",
        "./src/styles/custom.css",
      ],
      components: {
        Header: "./src/components/Header.astro",
        PageTitle: "./src/components/PageTitle.astro",
      },
      head: [
        // Google favicon guidelines: PNG at a multiple of 48px, exposed via rel="icon".
        { tag: "link", attrs: { rel: "icon", type: "image/png", sizes: "192x192", href: "/favicon.png" } },
        { tag: "meta", attrs: { property: "og:image", content: `${SITE_URL}/og.png` } },
        { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
        { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
        { tag: "meta", attrs: { name: "twitter:image", content: `${SITE_URL}/og.png` } },
        { tag: "meta", attrs: { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#ffffff" } },
        { tag: "meta", attrs: { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#212121" } },
      ],
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/lidge-jun/opencodex" },
      ],
      editLink: {
        baseUrl: "https://github.com/lidge-jun/opencodex/edit/main/docs-site/",
      },
      lastUpdated: true,
      // English at the site root; Traditional Chinese under /zh-tw.
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        "zh-tw": { label: "繁體中文", lang: "zh-TW" },
      },
      sidebar: [
        {
          label: "Getting Started",
          translations: { "zh-TW": "開始使用" },
          items: [
            { label: "Installation", translations: { "zh-TW": "安裝" }, slug: "getting-started/installation" },
            { label: "Quickstart", translations: { "zh-TW": "快速入門" }, slug: "getting-started/quickstart" },
            { label: "How It Works", translations: { "zh-TW": "運作原理" }, slug: "getting-started/how-it-works" },
            { label: "Agent Quickstart", translations: { "zh-TW": "Agent 快速上手" }, slug: "getting-started/for-agents" },
          ],
        },
        {
          label: "Guides",
          translations: { "zh-TW": "指南" },
          items: [
            { label: "Providers", translations: { "zh-TW": "供應商" }, slug: "guides/providers" },
            { label: "Factory Droid Bridge", slug: "guides/factory-droid" },
            { label: "Model Routing", translations: { "zh-TW": "模型路由" }, slug: "guides/model-routing" },
            { label: "Codex Integration", translations: { "zh-TW": "Codex 整合" }, slug: "guides/codex-integration" },
            { label: "Codex App Model Picker", translations: { "zh-TW": "Codex App 模型選擇器" }, slug: "guides/codex-app-models" },
            { label: "Model Ordering", translations: { "zh-TW": "模型排序" }, slug: "guides/model-ordering" },
            { label: "Combos", translations: { "zh-TW": "組合" }, slug: "guides/combos" },
            { label: "Claude Code", translations: { "zh-TW": "Claude Code" }, slug: "guides/claude-code" },
            { label: "Grok Build", translations: { "zh-TW": "Grok Build" }, slug: "guides/grok-build" },
            { label: "opencode", translations: { "zh-TW": "opencode" }, slug: "guides/opencode" },
            { label: "Pi", translations: { "zh-TW": "Pi" }, slug: "guides/pi" },
            { label: "Integrations", translations: { "zh-TW": "整合" }, slug: "guides/integrations" },
            { label: "MiniMax clients", translations: { "zh-TW": "MiniMax 客戶端" }, slug: "guides/minimax" },
            { label: "Sidecars: Web Search & Vision", translations: { "zh-TW": "邊車：網路搜尋與視覺" }, slug: "guides/sidecars" },
            { label: "Image Bridge", translations: { "zh-TW": "圖像橋接" }, slug: "guides/image-bridge" },
            { label: "Video Bridge", translations: { "zh-TW": "影片橋接" }, slug: "guides/video-bridge" },
            { label: "Web Dashboard", translations: { "zh-TW": "網頁儀表板" }, slug: "guides/web-dashboard" },
            { label: "Sub-agent Surface", translations: { "zh-TW": "子代理介面" }, slug: "guides/sub-agent-surface" },
          ],
        },
        {
          label: "Benchmarks",
          translations: { "zh-TW": "基準測試" },
          collapsed: true,
          items: [
            { label: "Overview", translations: { "zh-TW": "概覽" }, slug: "benchmarks" },
            { label: "Coding", translations: { "zh-TW": "程式設計" }, slug: "benchmarks/coding" },
            { label: "Frontend", translations: { "zh-TW": "前端" }, slug: "benchmarks/frontend" },
            { label: "Terminal", translations: { "zh-TW": "終端" }, slug: "benchmarks/terminal" },
            { label: "Security", translations: { "zh-TW": "安全" }, slug: "benchmarks/security" },
            { label: "Intelligence", translations: { "zh-TW": "智慧" }, slug: "benchmarks/intelligence" },
          ],
        },
        {
          label: "Reference",
          translations: { "zh-TW": "參考" },
          items: [
            {
              label: "CLI",
              translations: { "zh-TW": "命令列" },
              items: [
                { label: "Overview", translations: { "zh-TW": "概覽" }, slug: "reference/cli" },
                { label: "Lifecycle & Service", translations: { "zh-TW": "生命週期與服務" }, slug: "reference/cli/lifecycle" },
                { label: "Providers, Accounts & Models", translations: { "zh-TW": "供應商、帳號與模型" }, slug: "reference/cli/providers-accounts" },
                { label: "Agents, Routing & Integrations", translations: { "zh-TW": "代理、路由與整合" }, slug: "reference/cli/agents" },
              ],
            },
            {
              label: "Configuration",
              translations: { "zh-TW": "設定" },
              items: [
                { label: "Overview", translations: { "zh-TW": "概覽" }, slug: "reference/configuration" },
                { label: "Providers", translations: { "zh-TW": "供應商" }, slug: "reference/configuration/providers" },
                { label: "Routing", translations: { "zh-TW": "路由" }, slug: "reference/configuration/routing" },
                { label: "Agents", translations: { "zh-TW": "代理" }, slug: "reference/configuration/agents" },
                { label: "Server & Runtime", translations: { "zh-TW": "伺服器與執行階段" }, slug: "reference/configuration/server" },
              ],
            },
            { label: "Adapters", translations: { "zh-TW": "適配器" }, slug: "reference/adapters" },
            { label: "Architecture", translations: { "zh-TW": "架構" }, slug: "reference/architecture" },
            { label: "Proxy API Formats", translations: { "zh-TW": "代理 API 格式" }, slug: "reference/proxy-formats" },
            { label: "Management API", translations: { "zh-TW": "管理 API" }, slug: "reference/management-api" },
          ],
        },
        {
          label: "Troubleshooting",
          translations: { "zh-TW": "疑難排解" },
          collapsed: true,
          items: [
            { label: "Windows Memory Growth", translations: { "zh-TW": "Windows 記憶體增長" }, slug: "troubleshooting/windows-memory" },
            { label: "Disk Usage from Temp Files", translations: { "zh-TW": "暫存檔磁碟用量" }, slug: "troubleshooting/disk-usage-temp-files" },
          ],
        },
        { label: "Contributing", translations: { "zh-TW": "貢獻" }, slug: "contributing" },
      ],
    }),
  ],
});
