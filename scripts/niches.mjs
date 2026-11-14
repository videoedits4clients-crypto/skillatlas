// Niches: specific jobs people come looking for ("video editing", "SEO", "resume").
// Finer than categories, and a skill can sit in several niches at once.
// Keywords are whole words; a trailing * means "prefix". To add a niche, add an entry here.

import { compile } from './categories.mjs';

export const NICHES = [
  { id: 'video-editing', icon: '🎞️', name: 'Video editing', desc: 'Cut, caption and produce videos',
    keywords: ['video edit*', 'video production', 'remotion', 'ffmpeg', 'reel*', 'youtube shorts', 'short-form video*', 'subtitle*', 'b-roll', 'motion graphic*', 'davinci', 'premiere', 'after effects', 'capcut', 'storyboard*', 'video generat*', 'screen record*', 'explainer video*', 'talking head', 'video clip*', 'video script*'] },
  { id: 'social-media', icon: '📱', name: 'Instagram & social media', desc: 'Posts, carousels and growth',
    keywords: ['instagram', 'tiktok', 'social media', 'linkedin post*', 'twitter', 'tweet*', 'x post*', 'carousel*', 'facebook', 'pinterest', 'influencer*', 'hashtag*', 'content calendar', 'viral', 'reddit', 'threads post*'] },
  { id: 'youtube', icon: '▶️', name: 'YouTube', desc: 'Scripts, thumbnails and channel growth',
    keywords: ['youtube', 'thumbnail*', 'youtuber*'] },
  { id: 'seo', icon: '🔎', name: 'SEO', desc: 'Rank higher in search',
    keywords: ['seo', 'keyword research', 'backlink*', 'search engine optimi*', 'serp', 'schema markup', 'generative engine optimi*', 'aeo', 'search console', 'on-page', 'link building'] },
  { id: 'copywriting', icon: '✒️', name: 'Copywriting & ads', desc: 'Ad copy, sales pages and headlines',
    keywords: ['copywrit*', 'ad copy', 'google ads', 'facebook ads', 'meta ads', 'ppc', 'sales page*', 'landing page copy', 'ad creative*', 'paid ads', 'advertis*', 'value proposition*'] },
  { id: 'email', icon: '📧', name: 'Email & newsletters', desc: 'Write, send and manage email',
    keywords: ['email*', 'newsletter*', 'cold outreach', 'gmail', 'outlook', 'mailchimp', 'inbox', 'drip campaign*'] },
  { id: 'blogging', icon: '📝', name: 'Blogging & articles', desc: 'Long-form writing and publishing',
    keywords: ['blog*', 'article writ*', 'ghostwrit*', 'substack', 'wordpress', 'long-form', 'content writ*', 'editorial calendar'] },
  { id: 'resume', icon: '💼', name: 'Resume & job hunting', desc: 'CVs, cover letters and interviews',
    nameKeywords: ['resume*'],
    keywords: ['resume writ*', 'resume build*', 'resume review*', 'resume tailor*', 'resumes', 'your resume', 'cv', 'curriculum vitae', 'cover letter*', 'job search', 'job application*', 'interview prep*', 'job hunt*', 'linkedin profile', 'career coach*', 'mock interview*', 'job interview*'] },
  { id: 'ecommerce', icon: '🛒', name: 'E-commerce', desc: 'Stores, listings and products',
    keywords: ['shopify', 'e-commerce', 'ecommerce', 'amazon listing*', 'product listing*', 'woocommerce', 'dropship*', 'etsy', 'product description*', 'online store*', 'amazon seller*'] },
  { id: 'trading', icon: '📈', name: 'Trading & crypto', desc: 'Markets, portfolios and web3',
    keywords: ['trading', 'trader*', 'cryptocurrenc*', 'crypto trading', 'crypto market*', 'crypto wallet*', 'token swap*', 'onchain', 'on-chain', 'stock market', 'stocks', 'stock analysis', 'stock price*', 'defi', 'solana', 'ethereum', 'bitcoin', 'forex', 'backtest*', 'web3', 'smart contract*', 'blockchain', 'investment research', 'equity research', 'options trading'] },
  { id: 'finance', icon: '💰', name: 'Accounting & finance', desc: 'Books, budgets and financial models',
    keywords: ['accounting', 'bookkeeping', 'invoice*', 'tax', 'taxes', 'budgeting', 'personal budget*', 'financial model*', 'financial statement*', 'expense*', 'payroll', 'financial analysis', 'valuation', 'dcf'] },
  { id: 'legal', icon: '⚖️', name: 'Legal & contracts', desc: 'Contracts, policies and compliance',
    keywords: ['legal', 'contract review*', 'contract draft*', 'contract analy*', 'contract negotiat*', 'legal document*', 'case law', 'attorney*', 'nda', 'lawyer*', 'law firm*', 'gdpr', 'privacy policy', 'terms of service', 'patent*', 'litigation', 'legal research', 'regulatory'] },
  { id: 'game-dev', icon: '🎮', name: 'Game development', desc: 'Unity, Unreal, Godot and more',
    keywords: ['game dev*', 'unity', 'unreal', 'godot', 'roblox', 'game design', 'gameplay', 'pygame', 'phaser', 'minecraft', 'game engine*', 'game jam'] },
  { id: 'academic', icon: '🎓', name: 'Academic & research papers', desc: 'Papers, citations and literature',
    keywords: ['thesis', 'dissertation', 'citation*', 'literature review*', 'academic', 'research paper*', 'peer review', 'arxiv', 'latex', 'scientific writing', 'manuscript*', 'scholarly', 'pubmed', 'systematic review*'] },
  { id: 'study', icon: '📚', name: 'Studying & teaching', desc: 'Lessons, quizzes and tutoring',
    keywords: ['flashcard*', 'quiz*', 'tutor', 'tutors', 'tutoring', 'lesson plan*', 'curriculum', 'exam prep*', 'homework', 'course creat*', 'teaching', 'study guide*', 'language learning', 'students', 'educator*'] },
  { id: 'scraping', icon: '🕷️', name: 'Web scraping', desc: 'Collect data from websites',
    keywords: ['scrap*', 'crawl*', 'apify', 'firecrawl', 'data extract*', 'web data'] },
  { id: 'audio', icon: '🎙️', name: 'Podcast, voice & music', desc: 'Audio, speech and songs',
    keywords: ['podcast*', 'text-to-speech', 'tts', 'voiceover*', 'voice clon*', 'transcri*', 'music', 'song*', 'lyrics', 'audio edit*', 'speech-to-text', 'narration', 'elevenlabs', 'suno'] },
  { id: 'image', icon: '🖼️', name: 'Image generation & editing', desc: 'Make and edit pictures',
    keywords: ['image generat*', 'image edit*', 'photo edit*', 'midjourney', 'stable diffusion', 'dall-e', 'logo', 'logos', 'logo design*', 'illustration*', 'background remov*', 'comfyui', 'nano banana', 'text-to-image', 'ai image*', 'image prompt*', 'infographic*', 'poster', 'posters'] },
  { id: 'presentations', icon: '📊', name: 'Slides & presentations', desc: 'Decks and pitch slides',
    keywords: ['pptx', 'powerpoint', 'slide*', 'presentation*', 'pitch deck*', 'keynote', 'google slides'] },
  { id: 'spreadsheets', icon: '📗', name: 'Excel & spreadsheets', desc: 'Sheets, formulas and reports',
    keywords: ['excel', 'xlsx', 'spreadsheet*', 'google sheets', 'pivot table*', 'csv'] },
  { id: 'pdf-docs', icon: '📕', name: 'PDF & Word documents', desc: 'Read, fill and create documents',
    keywords: ['pdf*', 'docx', 'word document*', 'ocr', 'form fill*', 'google docs'] },
  { id: 'ui-design', icon: '🎨', name: 'UI/UX & web design', desc: 'Interfaces that look good',
    keywords: ['ui design', 'ux', 'ui/ux', 'figma', 'landing page*', 'design system*', 'tailwind', 'frontend design', 'wireframe*', 'mockup*', 'shadcn', 'web design', 'user interface*'] },
  { id: 'web-apps', icon: '🌐', name: 'Websites & apps', desc: 'Build sites and mobile apps',
    keywords: ['next.js', 'nextjs', 'react', 'vue', 'svelte', 'web app*', 'full-stack', 'webflow', 'mobile app*', 'react native', 'flutter', 'ios app*', 'android app*', 'swiftui', 'website build*'] },
  { id: 'automation', icon: '⚙️', name: 'Workflow automation', desc: 'n8n, Zapier and app automations',
    nameKeywords: ['automation', 'automations'],
    keywords: ['n8n', 'zapier', 'make.com', 'workflow automation', 'ifttt', 'rube mcp', 'composio', 'task automation', 'browser automation', 'automation workflow*'] },
  { id: 'notes', icon: '🗒️', name: 'Notes & knowledge', desc: 'Obsidian, Notion and second brains',
    keywords: ['obsidian', 'notion', 'second brain', 'note-taking', 'knowledge base*', 'zettelkasten', 'logseq', 'pkm', 'meeting notes', 'personal knowledge'] },
  { id: 'project-mgmt', icon: '📋', name: 'Project & product management', desc: 'Plans, PRDs and roadmaps',
    keywords: ['jira', 'linear issue*', 'linear ticket*', 'linear app', 'asana', 'trello', 'project manag*', 'product manag*', 'prd', 'roadmap*', 'sprint*', 'user stor*', 'okr*', 'standup*', 'backlog'] },
  { id: 'sales-support', icon: '🎧', name: 'Sales & customer support', desc: 'Leads, CRM and helpdesk',
    keywords: ['crm', 'sales', 'lead gen*', 'customer support', 'helpdesk', 'zendesk', 'intercom', 'hubspot', 'salesforce', 'prospect*', 'cold call*', 'customer success', 'support ticket*'] },
  { id: 'hr', icon: '🧑‍💼', name: 'HR & recruiting', desc: 'Hiring, onboarding and reviews',
    keywords: ['recruit*', 'hiring', 'employee onboarding', 'performance review*', 'job description*', 'job candidate*', 'candidate screen*', 'human resources', 'hr', 'talent acquisition', 'employee handbook*', 'employee review*'] },
  { id: 'data-analysis', icon: '📉', name: 'Data analysis & dashboards', desc: 'SQL, charts and insights',
    keywords: ['data analys*', 'dashboard*', 'sql quer*', 'sql analys*', 'pandas', 'data visuali*', 'tableau', 'power bi', 'business intelligence', 'exploratory data'] },
  { id: 'code-review', icon: '🔍', name: 'Code review & debugging', desc: 'Find bugs and clean up code',
    keywords: ['code review*', 'debug*', 'refactor*', 'pull request*', 'pr review*', 'bug fix*', 'root cause', 'code quality'] },
  { id: 'agent-building', icon: '🔌', name: 'MCP & agent building', desc: 'Build skills, agents and MCP servers',
    keywords: ['mcp server*', 'model context protocol', 'agent sdk', 'subagent*', 'skill creat*', 'prompt engineer*', 'claude code hook*', 'build agents', 'multi-agent', 'agent orchestrat*', 'writing skills'] },
  { id: 'three-d', icon: '🧊', name: '3D & CAD', desc: 'Blender, three.js and 3D printing',
    keywords: ['blender', '3d model*', 'cad', 'three.js', 'threejs', '3d print*', 'openscad', 'webgl', '3d scene*'] },
  { id: 'science', icon: '🧬', name: 'Biology & chemistry', desc: 'Lab, genomics and drug discovery',
    keywords: ['bioinformatics', 'genomic*', 'protein*', 'chemistry', 'molecul*', 'drug discovery', 'single-cell', 'rna-seq', 'clinical trial*', 'biolog*'] },
  { id: 'health', icon: '🩺', name: 'Health & fitness', desc: 'Wellness, nutrition and medical',
    keywords: ['fitness', 'workout*', 'nutrition', 'meal plan*', 'medical', 'clinical', 'mental health', 'healthcare', 'patient*', 'wellness'] },
];

// nameKeywords: words too ambiguous to trust in a description ("resume a run", "automation"),
// so they only count when they appear in the skill's name or folder.
const COMPILED = NICHES.map(n => ({ id: n.id, res: n.keywords.map(compile), nameRes: (n.nameKeywords || []).map(compile) }));
const HEAD = 170; // the first sentence or two of a description says what the skill is *for*

/** Returns up to 3 niche ids for a skill, strongest first. */
export function classifyNiches({ name = '', description = '', path = '' }) {
  const nameText = (name + ' ' + path.split('/').slice(-2).join(' ')).replace(/[\/_-]+/g, ' ');
  const head = description.slice(0, HEAD);
  const rest = description.slice(HEAD);
  const out = [];
  for (const n of COMPILED) {
    let score = 0;
    for (const re of n.nameRes) if (re.test(nameText)) score += 3;
    for (const re of n.res) {
      if (re.test(nameText)) score += 3;
      else if (re.test(head)) score += 1.5;
      else if (re.test(rest)) score += 0.75;
    }
    // In: named for it, mentioned up front, or mentioned twice later on.
    if (score >= 1.5) out.push({ id: n.id, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.id);
}
