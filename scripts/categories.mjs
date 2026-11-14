// Category definitions + a small keyword classifier.
// Each skill gets one primary category and up to 3 tags (secondary categories).
// Keywords are matched as whole words (a trailing * means "prefix").

export const CATEGORIES = [
  {
    id: 'documents', name: 'Documents & Office', icon: '📄',
    desc: 'Word, PDF, PowerPoint, Excel and other files',
    keywords: ['docx', 'pdf', 'pptx', 'xlsx', 'excel', 'word document', 'powerpoint', 'spreadsheet*', 'slide*', 'presentation*', 'document*', 'office', 'csv', 'markdown', 'latex', 'invoice*', 'resume', 'form*', 'ocr', 'google docs', 'google sheets'],
  },
  {
    id: 'development', name: 'Software Development', icon: '💻',
    desc: 'Coding, refactoring, Git, APIs and languages',
    keywords: ['code', 'coding', 'programming', 'developer*', 'refactor*', 'git', 'github', 'pull request*', 'commit*', 'api', 'sdk', 'typescript', 'javascript', 'python', 'rust', 'golang', 'java', 'kotlin', 'swift', 'react', 'nextjs', 'next.js', 'vue', 'svelte', 'node', 'backend', 'database*', 'debug*', 'code review', 'architecture', 'cli', 'library', 'framework*', 'mobile', 'ios', 'android', 'flutter', 'django', 'fastapi', 'rails', 'laravel', 'dotnet', 'c#', 'cpp', 'web app*', 'tdd', 'lint*'],
  },
  {
    id: 'testing', name: 'Testing & QA', icon: '🧪',
    desc: 'Unit, end-to-end and browser testing',
    keywords: ['test', 'tests', 'testing', 'playwright', 'cypress', 'selenium', 'qa', 'e2e', 'jest', 'pytest', 'vitest', 'unit test*', 'test-driven', 'coverage', 'webapp testing', 'browser automation', 'puppeteer'],
  },
  {
    id: 'design', name: 'Design & Frontend', icon: '🎨',
    desc: 'UI, UX, CSS, brand and visual design',
    keywords: ['design*', 'ui', 'ux', 'css', 'tailwind', 'frontend', 'front-end', 'figma', 'brand*', 'theme*', 'typography', 'color*', 'layout', 'landing page*', 'website*', 'component*', 'shadcn', 'accessibility', 'a11y', 'canvas', 'icon*', 'logo*', 'style guide'],
  },
  {
    id: 'ai-agents', name: 'AI, Agents & MCP', icon: '🤖',
    desc: 'Prompting, agents, MCP servers and building skills',
    keywords: ['llm*', 'agent*', 'agentic', 'prompt*', 'mcp', 'model context protocol', 'claude', 'anthropic', 'openai', 'gpt', 'gemini', 'rag', 'embedding*', 'fine-tun*', 'subagent*', 'skill creator', 'skill-creator', 'create skills', 'ai', 'machine learning', 'ml', 'hugging face', 'huggingface', 'transformers', 'eval*', 'memory', 'context engineering'],
  },
  {
    id: 'data', name: 'Data & Analytics', icon: '📊',
    desc: 'SQL, analysis, charts and dashboards',
    keywords: ['data', 'dataset*', 'analytics', 'analysis', 'analyz*', 'analys*', 'sql', 'postgres*', 'mysql', 'bigquery', 'snowflake', 'pandas', 'chart*', 'visuali*', 'dashboard*', 'statistic*', 'metrics', 'jupyter', 'notebook*', 'etl', 'dbt', 'scraping', 'scrape*'],
  },
  {
    id: 'devops', name: 'DevOps & Cloud', icon: '☁️',
    desc: 'Deploy, CI/CD, containers and infrastructure',
    keywords: ['devops', 'deploy*', 'ci', 'cd', 'ci/cd', 'docker*', 'kubernetes', 'k8s', 'helm', 'terraform', 'aws', 'azure', 'gcp', 'cloud*', 'serverless', 'vercel', 'netlify', 'cloudflare', 'infrastructure', 'monitoring', 'observability', 'logging', 'sre', 'linux', 'nginx', 'github actions', 'pipeline*'],
  },
  {
    id: 'security', name: 'Security', icon: '🔒',
    desc: 'Audits, pentesting and secure coding',
    keywords: ['security', 'secure', 'vulnerabilit*', 'pentest*', 'penetration', 'owasp', 'threat*', 'malware', 'forensic*', 'exploit*', 'cve', 'audit*', 'auth*', 'encryption', 'secrets', 'compliance', 'ctf', 'red team', 'blue team', 'siem'],
  },
  {
    id: 'writing', name: 'Writing & Content', icon: '✍️',
    desc: 'Docs, blogs, editing and communication',
    keywords: ['writ*', 'blog*', 'article*', 'copywrit*', 'content', 'edit*', 'proofread*', 'grammar', 'tone', 'storytelling', 'documentation', 'readme', 'newsletter*', 'email*', 'communication*', 'translat*', 'summar*', 'essay*', 'technical writing', 'changelog*', 'release notes'],
  },
  {
    id: 'marketing', name: 'Marketing & Sales', icon: '📣',
    desc: 'SEO, ads, social media and growth',
    keywords: ['marketing', 'seo', 'ads', 'advertis*', 'campaign*', 'social media', 'twitter', 'linkedin', 'instagram', 'tiktok', 'youtube', 'growth', 'sales', 'lead*', 'crm', 'outreach', 'conversion', 'funnel', 'brand voice', 'competitor*', 'market research', 'customer*', 'gtm', 'go-to-market'],
  },
  {
    id: 'productivity', name: 'Productivity & Business', icon: '⚡',
    desc: 'Planning, meetings, notes and workflows',
    keywords: ['productivity', 'workflow*', 'automat*', 'task*', 'todo', 'project management', 'planning', 'plan', 'meeting*', 'notes', 'notion', 'obsidian', 'slack', 'calendar', 'jira', 'linear', 'okr*', 'strategy', 'business', 'startup', 'product manag*', 'prd', 'roadmap', 'hr', 'recruit*', 'hiring', 'brainstorm*', 'internal comms', 'operations'],
  },
  {
    id: 'media', name: 'Media & Creative', icon: '🎬',
    desc: 'Images, video, audio, music and art',
    keywords: ['image*', 'video*', 'audio', 'music', 'sound', 'podcast*', 'animation*', 'animate*', 'gif*', 'photo*', 'art', 'artistic', 'generative art', 'algorithmic art', 'illustration*', '3d', 'three.js', 'threejs', 'game*', 'remotion', 'ffmpeg', 'svg', 'drawing', 'creative', 'meme*', 'voice*', 'tts', 'speech'],
  },
  {
    id: 'research', name: 'Research & Learning', icon: '🔬',
    desc: 'Research, science, education and knowledge',
    keywords: ['research*', 'paper*', 'academic', 'scientific', 'science', 'scholar*', 'citation*', 'literature', 'arxiv', 'pubmed', 'learn*', 'education*', 'teach*', 'tutor*', 'study', 'quiz*', 'biology', 'chemistry', 'physics', 'math*', 'bioinformatics', 'genomic*', 'knowledge', 'wiki*', 'web search', 'deep research', 'fact-check*'],
  },
  {
    id: 'finance-legal', name: 'Finance & Legal', icon: '⚖️',
    desc: 'Accounting, investing, contracts and policy',
    keywords: ['financ*', 'accounting', 'invest*', 'stock*', 'trading', 'crypto*', 'blockchain', 'tax*', 'budget*', 'bookkeeping', 'legal', 'law', 'contract*', 'nda', 'policy', 'policies', 'regulat*', 'gdpr', 'terms of service', 'insurance', 'banking', 'payment*', 'stripe'],
  },
  {
    id: 'other', name: 'Other & Fun', icon: '✨',
    desc: 'Everything else worth a look',
    keywords: [],
  },
];

export function compile(keyword) {
  const prefix = keyword.endsWith('*');
  const kw = (prefix ? keyword.slice(0, -1) : keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s_-]+');
  return new RegExp(`(?:^|[^a-z0-9])${kw}${prefix ? '' : '(?![a-z0-9])'}`, 'i');
}

const COMPILED = CATEGORIES.filter(c => c.keywords.length).map(c => ({
  id: c.id,
  rules: c.keywords.map(k => ({ re: compile(k), weight: k.includes(' ') ? 1.5 : 1 })),
}));

/** Returns { category, tags } for a skill. */
export function classify({ name = '', description = '', path = '', repo = '' }) {
  const fields = [
    { text: name.replace(/[-_]/g, ' '), weight: 3 },
    { text: description, weight: 1 },
    { text: path.replace(/[\/_-]/g, ' '), weight: 1 },
    { text: repo.replace(/[\/_-]/g, ' '), weight: 0.3 },
  ];
  const scores = COMPILED.map(c => {
    let score = 0;
    for (const { re, weight } of c.rules) {
      for (const f of fields) if (re.test(f.text)) score += weight * f.weight;
    }
    return { id: c.id, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  // "ai-agents" fires on almost everything ("claude", "agent"), so demote it
  // unless it clearly dominates.
  if (scores.length > 1 && scores[0].id === 'ai-agents' && scores[1].score >= scores[0].score * 0.6) {
    [scores[0], scores[1]] = [scores[1], scores[0]];
  }

  if (!scores.length) return { category: 'other', tags: [] };
  const top = scores[0];
  const tags = scores.slice(1, 4).filter(s => s.score >= top.score * 0.35).map(s => s.id);
  return { category: top.id, tags };
}
