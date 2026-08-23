export interface StatusCodeInfo { label: string; description: string }

type Locale = "en" | "zh-TW";
type LocalizedInfo = Record<Locale, StatusCodeInfo>;

const STATUS_CODES: Record<number, LocalizedInfo> = {
  400: {
    en: { label: "Bad request", description: "The proxy could not understand the request. Check the model, message shape, headers, and JSON body before retrying." },

    "zh-TW": { label: "錯誤請求", description: "代理無法理解該請求。重試前請檢查模型、訊息結構、標頭和 JSON 本文。" },

  },
  401: {
    en: { label: "Unauthorized", description: "Credentials are missing, expired, or invalid. Re-login or refresh the account/provider credentials used by opencodex." },

    "zh-TW": { label: "未授權", description: "憑證缺失、已過期或無效。請重新登入，或重新整理 opencodex 使用的帳號/供應商憑證。" },

  },
  402: {
    en: { label: "Payment required", description: "The upstream provider rejected the request because billing, credits, or plan access is not available. Add credits, update billing, or switch provider." },

    "zh-TW": { label: "需要付款", description: "上游供應商因帳單、額度或方案許可權不可用而拒絕了請求。請儲值、更新帳單資訊或切換供應商。" },

  },
  403: {
    en: { label: "Forbidden", description: "The account is authenticated but not allowed to use this model or operation. Often a plan/subscription gate (e.g. Ollama Cloud Pro), org policy, or model permission — not necessarily a bad API key." },

    "zh-TW": { label: "禁止存取", description: "帳號已認證，但無權使用此模型或操作。常見原因是方案/訂閱限制（例如 Ollama Cloud Pro）、組織策略或模型許可權——不一定是 API 金鑰無效。" },

  },
  404: {
    en: { label: "Not found", description: "The requested route, model, account, or upstream resource was not found. Verify the model name and opencodex provider configuration." },

    "zh-TW": { label: "未找到", description: "找不到請求的路由、模型、帳號或上游資源。請確認模型名稱和 opencodex 供應商配置。" },

  },
  408: {
    en: { label: "Request timeout", description: "The request took too long before the proxy or upstream provider could complete it. Retry with a smaller request or a different provider." },

    "zh-TW": { label: "請求逾時", description: "代理或上游供應商未能在限定時間內完成請求。請縮小請求後重試，或切換供應商。" },

  },
  409: {
    en: { label: "Conflict", description: "The request conflicts with the current account, session, or provider state. Refresh the session or retry after the active operation finishes." },

    "zh-TW": { label: "狀態衝突", description: "請求與當前帳號、會話或供應商狀態衝突。請重新整理會話，或等待當前操作完成後重試。" },

  },
  413: {
    en: { label: "Request too large", description: "The prompt, attachments, or generated payload exceeds a proxy or upstream limit. Reduce tokens, file size, or conversation history." },

    "zh-TW": { label: "請求過大", description: "提示、附件或生成的負載超過了代理或上游限制。請減少 token、檔案大小或對話歷史。" },

  },
  422: {
    en: { label: "Invalid content", description: "The provider accepted the request format but rejected its contents. Check model options, tool definitions, message roles, and unsupported fields." },

    "zh-TW": { label: "內容無效", description: "供應商接受了請求格式，但拒絕了其中的內容。請檢查模型選項、工具定義、訊息角色和不支援的欄位。" },

  },
  424: {
    en: { label: "Provider dependency failed", description: "A required upstream dependency failed while opencodex was routing the request. Retry later or switch to another configured provider." },

    "zh-TW": { label: "供應商依賴失敗", description: "opencodex 路由請求時，必需的上游依賴失敗。請稍後重試，或切換到另一個已配置的供應商。" },

  },
  429: {
    en: { label: "Rate limited", description: "The upstream provider rate or quota limit has been reached. Wait for the quota window to reset or switch account/provider." },

    "zh-TW": { label: "限流", description: "已達到上游供應商的速率或額度限制。請等待額度視窗重設，或切換帳號/供應商。" },

  },
  499: {
    en: { label: "Client closed request", description: "The client disconnected or canceled the request before opencodex finished routing it. Retry if the cancellation was accidental." },

    "zh-TW": { label: "客戶端已取消", description: "opencodex 完成路由前，客戶端已斷開連線或取消請求。如果不是有意取消，請重試。" },

  },
  500: {
    en: { label: "Proxy error", description: "opencodex hit an internal error while handling the request. Retry once, then check proxy logs if it repeats." },

    "zh-TW": { label: "代理錯誤", description: "opencodex 處理請求時發生內部錯誤。請先重試一次；如果重複出現，請檢查代理日誌。" },

  },
  502: {
    en: { label: "Bad upstream response", description: "The upstream provider returned an invalid or failed response through the proxy. Retry or route the request to another provider." },

    "zh-TW": { label: "上游回應錯誤", description: "上游供應商透過代理返回了無效或失敗的回應。請重試，或將請求路由到其他供應商。" },

  },
  503: {
    en: { label: "Provider unavailable", description: "The proxy or upstream provider is temporarily unavailable or overloaded. Wait briefly, then retry or switch provider." },

    "zh-TW": { label: "供應商不可用", description: "代理或上游供應商暫時不可用或過載。請稍後重試，或切換供應商。" },

  },
  504: {
    en: { label: "Upstream timeout", description: "The upstream provider did not respond before the proxy timeout. Retry with a smaller request or choose a faster provider." },

    "zh-TW": { label: "上游逾時", description: "上游供應商未在代理逾時前回應。請縮小請求後重試，或選擇回應更快的供應商。" },

  },
  529: {
    en: { label: "Provider overloaded", description: "The upstream provider is overloaded or capacity-limited. Wait and retry, or switch to another account/provider." },

    "zh-TW": { label: "供應商過載", description: "上游供應商過載或容量受限。請等待後重試，或切換到其他帳號/供應商。" },

  },
};

const GENERIC_STATUS: { client: LocalizedInfo; server: LocalizedInfo } = {
  client: {
    en: { label: "Request error", description: "The proxy or upstream provider rejected the request. Check the request shape, credentials, model name, and provider configuration." },

    "zh-TW": { label: "請求錯誤", description: "代理或上游供應商拒絕了該請求。請檢查請求結構、憑證、模型名稱和供應商配置。" },

  },
  server: {
    en: { label: "Server or upstream error", description: "opencodex or an upstream provider failed while processing the request. Retry later or route the request to another provider." },

    "zh-TW": { label: "伺服器或上游錯誤", description: "opencodex 或上游供應商處理請求時失敗。請稍後重試，或將請求路由到其他供應商。" },

  },
};

function normalizeLocale(locale: string): Locale {
  if (locale === "zh-TW" || locale.toLowerCase().startsWith("zh")) return "zh-TW";
  return "en";
}

export function statusCodeInfo(code: number, locale: string): StatusCodeInfo | null {
  if (code < 400) return null;
  const normalizedLocale = normalizeLocale(locale);
  const info = STATUS_CODES[Math.trunc(code)] ?? (code < 500 ? GENERIC_STATUS.client : GENERIC_STATUS.server);
  return info[normalizedLocale];
}
