// Best-guess detection of "does this skill need an outside account / API key?"
// Reads the SKILL.md text and returns { services: [...names], generic: bool }.
// It's a heuristic: it looks at what the instructions say, not at helper scripts.

const NICE = {
  ALPHAVANTAGE: 'Alpha Vantage', ABUSEIPDB: 'AbuseIPDB', VIRUSTOTAL: 'VirusTotal', SHODAN: 'Shodan', COINGECKO: 'CoinGecko',
  BAMBOOHR: 'BambooHR', N8N: 'n8n', DEEPL: 'DeepL', KLAVIYO: 'Klaviyo', ALGOLIA: 'Algolia', CEREBRAS: 'Cerebras', RUNPOD: 'RunPod',
  OPENAI: 'OpenAI', OPENALEX: 'OpenAlex', ZAI: 'Z.AI', Z_AI: 'Z.AI', SEMANTIC_SCHOLAR: 'Semantic Scholar', S2: 'Semantic Scholar',
  BRIGHT_DATA: 'Bright Data', BRIGHTDATA: 'Bright Data', MIXPANEL: 'Mixpanel', APOLLO: 'Apollo', PAPERCLIP: 'Paperclip', ELEVENLABS: 'ElevenLabs', GITHUB: 'GitHub', GH: 'GitHub', HF: 'Hugging Face', HUGGINGFACE: 'Hugging Face',
  HUGGING_FACE: 'Hugging Face', GEMINI: 'Google Gemini', GOOGLE: 'Google', GOOGLE_CLOUD: 'Google Cloud', GOOGLE_MAPS: 'Google Maps',
  AWS: 'AWS', AZURE: 'Azure', AZURE_OPENAI: 'Azure OpenAI', OPENROUTER: 'OpenRouter', SERPAPI: 'SerpAPI', SERPER: 'Serper',
  NOTION: 'Notion', SLACK: 'Slack', STRIPE: 'Stripe', SUPABASE: 'Supabase', FAL: 'fal.ai', FAL_KEY: 'fal.ai', XAI: 'xAI',
  PERPLEXITY: 'Perplexity', TAVILY: 'Tavily', EXA: 'Exa', BRAVE: 'Brave Search', BRAVE_SEARCH: 'Brave Search', LINEAR: 'Linear',
  JIRA: 'Jira', ATLASSIAN: 'Atlassian', FIGMA: 'Figma', VERCEL: 'Vercel', CLOUDFLARE: 'Cloudflare', REPLICATE: 'Replicate',
  DEEPGRAM: 'Deepgram', ASSEMBLYAI: 'AssemblyAI', RESEND: 'Resend', SENDGRID: 'SendGrid', TWILIO: 'Twilio', HUBSPOT: 'HubSpot',
  SHOPIFY: 'Shopify', AIRTABLE: 'Airtable', FIRECRAWL: 'Firecrawl', APIFY: 'Apify', POSTHOG: 'PostHog', SENTRY: 'Sentry',
  DATADOG: 'Datadog', MISTRAL: 'Mistral', GROQ: 'Groq', COHERE: 'Cohere', PINECONE: 'Pinecone', NVIDIA: 'NVIDIA',
  TOGETHER: 'Together AI', DEEPSEEK: 'DeepSeek', RUNWAY: 'Runway', HEYGEN: 'HeyGen', LUMA: 'Luma', MIDJOURNEY: 'Midjourney',
  STABILITY: 'Stability AI', VOYAGE: 'Voyage AI', JINA: 'Jina AI', BROWSERBASE: 'Browserbase', E2B: 'E2B', MODAL: 'Modal',
  NEON: 'Neon', MONGODB: 'MongoDB', TELEGRAM: 'Telegram', DISCORD: 'Discord', TWITTER: 'X (Twitter)', X: 'X (Twitter)',
  YOUTUBE: 'YouTube', SPOTIFY: 'Spotify', ZAPIER: 'Zapier', MAILCHIMP: 'Mailchimp', ALPHA_VANTAGE: 'Alpha Vantage',
  POLYGON: 'Polygon.io', FINNHUB: 'Finnhub', NEWSAPI: 'NewsAPI', WEATHER: 'Weather API', OPENWEATHER: 'OpenWeather',
  CONTEXT7: 'Context7', COMPOSIO: 'Composio', LANGSMITH: 'LangSmith', WANDB: 'Weights & Biases', KAGGLE: 'Kaggle',
  ASANA: 'Asana', CLICKUP: 'ClickUp', TODOIST: 'Todoist', CALENDLY: 'Calendly', INTERCOM: 'Intercom', ZENDESK: 'Zendesk',
  SALESFORCE: 'Salesforce', GITLAB: 'GitLab', DIGITALOCEAN: 'DigitalOcean', NETLIFY: 'Netlify', RAILWAY: 'Railway',
  KIMI: 'Kimi', MOONSHOT: 'Moonshot', DASHSCOPE: 'DashScope (Alibaba)', QWEN: 'Qwen', ZHIPU: 'Zhipu', VOLCENGINE: 'Volcengine',
};

// Env-var prefixes that are not a third-party service (or are Claude itself).
const IGNORE_PREFIX = new Set(['ANTHROPIC', 'CLAUDE', 'YOUR', 'MY', 'EXAMPLE', 'SOME', 'TEST', 'FAKE', 'DUMMY', 'SECRET', 'AUTH',
  'ACCESS', 'BEARER', 'JWT', 'SESSION', 'CSRF', 'CLIENT', 'APP', 'SERVICE', 'PRIVATE', 'PUBLIC', 'REFRESH', 'ID', 'USER', 'ADMIN',
  'NODE', 'NPM', 'API', 'X_API', 'NEXT_PUBLIC', 'VITE', 'REACT_APP', 'DB', 'DATABASE', 'ENCRYPTION', 'SIGNING', 'WEBHOOK', 'MASTER',
  'ROOT', 'LOCAL', 'DEV', 'PROD', 'STAGING', 'OLD', 'NEW', 'PERSONAL', 'BOT', 'CUSTOM', 'OTHER', 'PROVIDER', 'LLM', 'MODEL', 'MCP',
  'CI', 'GITHUB_ACTIONS', 'RUNNER', 'COOKIE', 'HMAC', 'OAUTH', 'SSH', 'GPG', 'PASSWORD', 'TOKEN', 'KEY']);

// Capitalized words that can precede "API key" without being a service name.
const NOT_SERVICE = new Set(['your', 'the', 'an', 'a', 'any', 'valid', 'own', 'anthropic', 'claude', 'this', 'that', 'its', 'their',
  'my', 'our', 'no', 'set', 'get', 'add', 'use', 'using', 'provide', 'store', 'export', 'required', 'optional', 'personal', 'public',
  'private', 'secret', 'rest', 'http', 'new', 'same', 'default', 'test', 'live', 'production', 'admin', 'service', 'free', 'paid',
  'each', 'every', 'with', 'without', 'and', 'or', 'for', 'if', 'when', 'llm', 'model', 'provider', 'third', 'party', 'external',
  'environment', 'env', 'invalid', 'missing', 'expired', 'wrong', 'bad', 'incorrect', 'correct', 'real', 'actual', 'secure',
  'separate', 'single', 'dedicated', 'master', 'standard', 'unique', 'temporary', 'user', 'client', 'agent', 'data', 'ai', 'cli', 'note', 'tip', 'important', 'warning', 'requires', 'require', 'needs', 'need', 'one', 'api', 'mcp', 'json']);

const ENV_RE = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*?)_(API_KEY|APIKEY|API_TOKEN|ACCESS_TOKEN|AUTH_TOKEN|SECRET_KEY|API_SECRET|TOKEN|KEY)\b/g;
// Bare *_KEY / *_TOKEN / *_SECRET_KEY are too common in ordinary code (PRIMARY_KEY, CACHE_KEY,
// DJANGO_SECRET_KEY…), so for those only known service prefixes count.
const STRONG_SUFFIX = new Set(['API_KEY', 'APIKEY', 'API_TOKEN', 'API_SECRET']);
const NAMED_RE = /\b([A-Z][A-Za-z0-9.]{1,24}(?: [A-Z][A-Za-z0-9.]{1,24})?) API[ -]?(?:key|token)s?\b/g;
const GENERIC_RES = [
  /\b(?:requires?|needs?|you(?:'ll| will)? need|obtain|get your|set your|export your|provide your|paste your|add your|with your own|bring your own)\s+(?:an?\s+|your\s+|the\s+)?(?:own\s+)?(?:[\w.-]+\s+){0,2}api[ _-]?(?:key|token)s?\b/i,
  /\bapi[ _-]?(?:key|token)\s+(?:is\s+)?required\b/i,
  /\bsign up (?:for|at) (?:an? )?(?:free )?(?:account|[\w.-]+\.(?:com|ai|io|dev|co))\b/i,
  /\bprocess\.env\.API_KEY\b|\bos\.environ\[["']API_KEY["']\]/,
];

const SIGNUP_RE = /\bsign[ -]?up\b(?: for (?:an? )?(?:free )?(?:account|key))?(?: at|:| on| here)?\s*[(<\[]?(?:https?:\/\/)?(?:www\.|app\.|dashboard\.|console\.|platform\.)?([a-z0-9-]{2,30})\.(?:com|ai|io|dev|co|app|so|sh|net|org)\b/gi;

// Accounts nearly every user of these skills already has; not worth a warning badge.
const FREE_EVERYWHERE = new Set(['github', 'git']);
// Signs that keys only unlock extras (higher limits, optional features).
const OPTIONAL_RE = /\bno (?:api[ _-]?keys?|credentials|account|auth(?:entication)?|sign[ -]?up) (?:is |are )?(?:required|needed)|\bapi[ _-]?keys? (?:is |are )?optional|\boptional(?:ly)?[^.\n]{0,40}api[ _-]?(?:key|token)|\bfor higher (?:rate )?limits|\braise rate limits|\bworks without (?:an? )?(?:api[ _-]?)?key/i;

const titleCase = s => {
  const parts = s.split('_');
  if (parts.length === 1 && s.length <= 4) return s; // acronyms: NCBI, FRED
  return parts.map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
};
// Services that always need an account even when the text says "no API key needed"
// (they connect through OAuth instead).
const ACCOUNT_ALWAYS = new Set(['Composio']);

export function detectRequirements(text) {
  const body = String(text || '').slice(0, 200_000);
  const services = new Map(); // lower -> display

  const add = name => {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, ''); // "Alpha Vantage" == "AlphaVantage"
    if (FREE_EVERYWHERE.has(key)) return;
    if (!services.has(key) && services.size < 6) services.set(key, name);
  };

  for (const m of body.matchAll(ENV_RE)) {
    const prefix = m[1];
    if (IGNORE_PREFIX.has(prefix) || prefix.length < 2) continue;
    if (/^(ANTHROPIC|CLAUDE)/.test(prefix)) continue;
    const first = prefix.split('_')[0];
    const segs = prefix.split('_');
    const known = NICE[prefix] || NICE[first] || segs.map(x => NICE[x]).find(Boolean);
    if (known) { add(known); continue; }
    if (!STRONG_SUFFIX.has(m[2]) || first.length < 3) continue;
    if (segs.some(x => IGNORE_PREFIX.has(x) || /^(TEST|CONFIG|LOCAL|CUSTOM|DEFAULT|PROXY|WORKFLOW|GATEWAY|PRO|REVIEW)$/.test(x))) continue;
    if ([...services.keys()].some(k => k.startsWith(first.toLowerCase()))) continue;
    add(titleCase(segs.length > 2 ? first : prefix));
  }
  for (const m of body.matchAll(NAMED_RE)) {
    const words = m[1].split(' ').filter(w => !NOT_SERVICE.has(w.toLowerCase()) && !/(ing|ed)$/i.test(w));
    if (!words.length) continue;
    const name = words.join(' ').replace(/\.$/, '');
    const upper = name.toUpperCase().replace(/[ .]/g, '_');
    const known = NICE[upper] || NICE[upper.replace(/_/g, '')] || words.map(w => NICE[w.toUpperCase().replace(/\./g, '')]).find(Boolean);
    // Plain capitalized words ("Verify API key", "Invalid API key") are usually not brands;
    // accept unknown names only when they look like one (OpenAlex, AssemblyAI, VirusTotal).
    if (known) add(known);
    else if (words.length === 1 && /^[A-Z][a-z]+[A-Z]/.test(name)) add(name);
  }
  if (/\bRube MCP\b|\bcomposio\b/i.test(body)) add('Composio');
  for (const m of body.matchAll(SIGNUP_RE)) {
    const dom = m[1].toLowerCase();
    if (['github', 'anthropic', 'claude', 'example', 'localhost'].includes(dom)) continue;
    add(NICE[dom.toUpperCase()] || dom.charAt(0).toUpperCase() + dom.slice(1));
  }

  const generic = GENERIC_RES.some(re => re.test(body));
  const optional = OPTIONAL_RE.test(body);
  return { services: [...services.values()], generic, optional };
}

/** True when the detected keys look optional (extras / higher limits only). */
export const isOptional = req => !!req?.optional;

/**
 * Final per-skill answer: { needs: [names] | ['API key'] | [], optional: bool }.
 * Security skills talk *about* keys a lot, so only named services count for them.
 */
export function needsFor(req, category, files) {
  let services = req?.services || [];
  let generic = !!req?.generic;
  if (category === 'security') { generic = false; services = services.filter(s => s !== 'API key'); }
  if ((files || []).some(f => /(^|\/)\.env(\.(example|sample|template))?$/i.test(f))) generic = true;
  const needs = services.length ? services.slice(0, 4) : generic ? ['API key'] : [];
  return { needs, optional: needs.length > 0 && !!req?.optional && !needs.some(n => ACCOUNT_ALWAYS.has(n)) };
}
