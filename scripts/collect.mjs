#!/usr/bin/env node
// Skill collector — discovers SKILL.md files on GitHub and writes site/data/skills.json.
//
//   GITHUB_TOKEN=xxx node scripts/collect.mjs
//
// Pipeline:
//   1. Gather candidate repos: seed list + GitHub topic/keyword search + links in awesome lists
//   2. Fetch repo metadata in batches via GraphQL (stars, branch, license, fork/archived)
//   3. Keep the best repos, fetch each repo's git tree, find every SKILL.md
//   4. Read each SKILL.md's frontmatter (cached by blob SHA so re-runs are cheap)
//   5. Classify, de-duplicate, and write the JSON the website reads

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, classify } from './categories.mjs';
import { detectRequirements, needsFor } from './requirements.mjs';
import { NICHES, classifyNiches } from './niches.mjs';

// Bump when the per-file data extracted from SKILL.md changes, so cached entries are re-read.
const CACHE_VERSION = 3;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = JSON.parse(await readFile(join(ROOT, 'config/sources.json'), 'utf8'));
const OUT_FILE = join(ROOT, 'site/data/skills.json');
const STATE_FILE = join(ROOT, 'cache/state.json');
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const L = CONFIG.limits;

if (!TOKEN) {
  console.error('GITHUB_TOKEN is required (GitHub search and GraphQL need authentication).');
  process.exit(1);
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let apiCalls = 0;
const API_VERSION = '2026-03-10';
let sunsetWarned = false;

// ---------- HTTP helpers ----------

async function gh(url, { method = 'GET', body, raw = false, tries = 4 } = {}) {
  const full = url.startsWith('http') ? url : `https://api.github.com${url}`;
  for (let attempt = 1; attempt <= tries; attempt++) {
    if (!raw) apiCalls++;
    let res;
    try {
      res = await fetch(full, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: raw ? {} : {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
          // Pinned REST API version. GitHub supports each version for 24+ months after the next
          // one ships; the collector logs a warning (below) when this one gets a sunset date.
          'X-GitHub-Api-Version': API_VERSION,
          'User-Agent': 'skill-directory-collector',
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      if (attempt === tries) throw e;
      await sleep(1000 * attempt);
      continue;
    }
    if (!raw && !sunsetWarned && res.headers.get('sunset')) {
      sunsetWarned = true;
      log(`::warning::GitHub API version ${API_VERSION} stops working on ${res.headers.get('sunset')}. Update API_VERSION in scripts/collect.mjs (see docs.github.com/rest/about-the-rest-api/breaking-changes).`);
    }
    if (res.ok) return raw ? res.text() : res.json();
    if (res.status === 404 || res.status === 409 || res.status === 451) return null; // missing / empty / blocked
    const remaining = res.headers.get('x-ratelimit-remaining');
    if ((res.status === 403 || res.status === 429) && attempt < tries) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
      let wait = retryAfter ? retryAfter * 1000 : remaining === '0' && reset ? reset - Date.now() + 1000 : 5000 * attempt;
      wait = Math.min(Math.max(wait, 1000), 120_000);
      log(`rate limited (${res.status}) on ${full.slice(0, 90)} — waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    if (res.status >= 500 && attempt < tries) { await sleep(2000 * attempt); continue; }
    log(`HTTP ${res.status} for ${full.slice(0, 120)}`);
    return null;
  }
  return null;
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx], idx); } catch (e) { log('worker error:', e.message); out[idx] = null; }
    }
  }));
  return out;
}

// ---------- Frontmatter ----------

export function parseFrontmatter(text) {
  const m = /^﻿?\s*---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const result = {};
  if (!m) return result;
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const km = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!km) continue;
    const key = km[1].toLowerCase();
    let val = km[2].trim();
    const cont = [];
    while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === '')) {
      cont.push(lines[++i]);
    }
    if (/^[|>][+-]?$/.test(val)) {
      const folded = val.startsWith('>');
      const body = cont.map(l => l.trim());
      val = folded ? body.filter(Boolean).join(' ') : body.join('\n').trim();
    } else if (cont.length && !val) {
      // nested map / list — keep a flat string for lists of scalars
      const items = cont.map(l => l.trim()).filter(l => l.startsWith('- ')).map(l => l.slice(2).trim());
      val = items.length ? items.join(', ') : '';
    } else if (cont.length) {
      val = [val, ...cont.map(l => l.trim())].filter(Boolean).join(' ');
    }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
      if (km[2].trim().startsWith('"')) val = val.replace(/\\"/g, '"').replace(/\\n/g, ' ');
      else val = val.replace(/''/g, "'");
    }
    result[key] = val;
  }
  return result;
}

const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);
const humanize = s => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ---------- 1. Candidate discovery ----------

const REPO_RE = /github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})/g;
const NOT_REPOS = new Set(['topics', 'orgs', 'apps', 'features', 'marketplace', 'sponsors', 'settings', 'login', 'about', 'collections', 'trending', 'search', 'site', 'pricing', 'enterprise', 'readme']);

const fillDates = q => q.replace(/\{d(\d+)\}/g, (_, n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10));

async function discoverCandidates() {
  const candidates = new Map(); // "owner/repo" lower -> { full, sources:Set }
  const add = (full, source) => {
    full = full.replace(/\.git$/, '').replace(/[.)\]]+$/, '');
    const [owner, name] = full.split('/');
    if (!owner || !name || NOT_REPOS.has(owner.toLowerCase())) return;
    const key = full.toLowerCase();
    if (!candidates.has(key)) candidates.set(key, { full, sources: new Set() });
    candidates.get(key).sources.add(source);
  };

  for (const r of CONFIG.seedRepos) add(r, 'seed');

  for (const { q, pages } of CONFIG.searchQueries) {
    for (let page = 1; page <= pages; page++) {
      const query = fillDates(q) + (/\bstars:/.test(q) ? '' : ` stars:>=${L.minStars}`) + ' fork:false';
      const data = await gh(`/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=100&page=${page}`);
      if (!data?.items?.length) break;
      data.items.forEach(it => add(it.full_name, 'search'));
      if (data.items.length < 100) break;
      await sleep(2200); // search API: 30 req/min
    }
    log(`search "${q}" → ${candidates.size} candidates so far`);
  }

  for (const list of CONFIG.awesomeLists) {
    const readme = await gh(`/repos/${list}/readme`);
    if (!readme?.content) continue;
    const text = Buffer.from(readme.content, 'base64').toString('utf8');
    add(list, 'awesome');
    for (const m of text.matchAll(REPO_RE)) add(`${m[1]}/${m[2]}`, 'awesome');
    log(`awesome list ${list} → ${candidates.size} candidates so far`);
  }

  const blocked = new Set(CONFIG.blockedRepos.map(r => r.toLowerCase()));
  return [...candidates.values()].filter(c => !blocked.has(c.full.toLowerCase()));
}

// ---------- 2. Repo metadata (GraphQL, batched) ----------

const REPO_FIELDS = `nameWithOwner url description stargazerCount forkCount isFork isArchived isPrivate pushedAt createdAt
  homepageUrl licenseInfo { spdxId } defaultBranchRef { name } owner { login avatarUrl }
  repositoryTopics(first: 8) { nodes { topic { name } } }`;

async function fetchRepoMeta(candidates) {
  const batches = [];
  for (let i = 0; i < candidates.length; i += 40) batches.push(candidates.slice(i, i + 40));
  const meta = new Map();
  await pool(batches, 3, async batch => {
    const q = 'query {' + batch.map((c, i) => {
      const [o, n] = c.full.split('/');
      return `r${i}: repository(owner: ${JSON.stringify(o)}, name: ${JSON.stringify(n)}) { ${REPO_FIELDS} }`;
    }).join('\n') + '}';
    let res;
    for (let attempt = 1; attempt <= 3; attempt++) {
      res = await gh('/graphql', { method: 'POST', body: { query: q } });
      if (res?.data && !res.errors?.some(e => /RATE_LIMIT|TIMEOUT/i.test(e.type || ''))) break;
      log(`GraphQL batch failed (attempt ${attempt}) — retrying`);
      await sleep(5000 * attempt);
    }
    batch.forEach((c, i) => {
      const r = res?.data?.[`r${i}`];
      if (r && !r.isPrivate) meta.set(r.nameWithOwner.toLowerCase(), { ...r, sources: c.sources });
    });
  });
  return meta;
}

// ---------- 3/4. Trees + SKILL.md ----------

// Folders that hold test data, not skills meant for people to install.
const TEST_PATH = /(^|\/)(tests?|__tests__|evals?|fixtures?|testdata|test[-_]data|mocks?|benchmarks?|e2e|snapshots?|specs?|golden)\//i;
const HOSTILE_NAME = /(^|\/)[^\/]*(malicious|exfiltrat|backdoor|supply-chain-attack|prompt-injection-sample)[^\/]*(\/|$)/i;
const SKIP_PATH = /(^|\/)(node_modules|\.git|vendor|dist|build|__pycache__|\.venv|site-packages)\//i;

let treeCalls = 0;

// Returns { marketplace, skills } for a repo, or null if it can't be read.
// The repo's file listing is cached by its last-push time, so a repo that hasn't changed
// costs zero API calls on later runs. That is what makes frequent runs affordable.
async function scanRepo(repo, shaCache, scanCache) {
  const id = repo.nameWithOwner;
  const branch = repo.defaultBranchRef?.name;
  if (!branch) return null;

  let listing = scanCache[id];
  const fresh = listing && listing.pushedAt === repo.pushedAt && listing.branch === branch && !process.env.FULL;
  if (!fresh) {
    treeCalls++;
    const tree = await gh(`/repos/${id}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    if (tree?.tree) {
      const blobs = tree.tree.filter(t => t.type === 'blob');
      const skillFiles = blobs
        .filter(t => /(^|\/)skill\.md$/i.test(t.path) && !SKIP_PATH.test(t.path))
        .sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path))
        .slice(0, L.maxSkillsPerRepo);
      listing = {
        pushedAt: repo.pushedAt,
        branch,
        marketplace: blobs.some(t => t.path === '.claude-plugin/marketplace.json'),
        skills: skillFiles.map(file => {
          const dir = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
          const prefix = dir ? dir + '/' : '';
          const all = dir ? blobs.filter(b => b.path.startsWith(prefix)) : [file];
          return { dir, file: file.path, sha: file.sha, fileCount: all.length, files: all.length <= L.maxFilesPerSkill ? all.map(b => b.path.slice(prefix.length)) : null };
        }),
      };
      scanCache[id] = listing;
    } else if (!listing) {
      return null; // unreadable and nothing cached
    } // else: unreadable right now, fall back to the older cached listing
  }

  const skills = await pool(listing.skills, 12, async sk => {
    let fm = shaCache[sk.sha];
    if (!fm || fm.v !== CACHE_VERSION) {
      const url = `https://raw.githubusercontent.com/${id}/${encodeURIComponent(listing.branch)}/${sk.file.split('/').map(encodeURIComponent).join('/')}`;
      const text = await gh(url, { raw: true });
      if (text == null) return null;
      const parsed = parseFrontmatter(text);
      fm = {
        name: clean(parsed.name),
        description: truncate(clean(parsed.description), L.maxDescriptionChars),
        license: clean(parsed.license).slice(0, 60),
        bytes: text.length,
        req: detectRequirements(text),
        v: CACHE_VERSION,
      };
      shaCache[sk.sha] = fm;
    }
    return { ...sk, fm };
  });
  return { marketplace: listing.marketplace, skills: skills.filter(Boolean) };
}

// ---------- main ----------

async function main() {
  const started = Date.now();
  await mkdir(dirname(OUT_FILE), { recursive: true });
  await mkdir(dirname(STATE_FILE), { recursive: true });

  const state = existsSync(STATE_FILE)
    ? JSON.parse(await readFile(STATE_FILE, 'utf8'))
    : { shaCache: {}, firstSeen: {}, starHistory: {} };
  state.lastSeen ||= {};
  // The day tracking began. Skills first seen on that day are the starting catalogue, not "new".
  state.since ||= Object.values(state.firstSeen).sort()[0]?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  let maxTrendDays = 0;
  const usedShas = new Set();

  // Last published output: used as a fallback when a repo can't be scanned this run
  // (network blip, rate limit), and as a baseline for the sanity check below.
  const FILES_FILE = join(dirname(OUT_FILE), 'files.json');
  const prevOut = existsSync(OUT_FILE) ? JSON.parse(await readFile(OUT_FILE, 'utf8')) : null;
  const prevFiles = existsSync(FILES_FILE) ? JSON.parse(await readFile(FILES_FILE, 'utf8')) : {};
  const prevByRepo = new Map();
  for (const s of prevOut?.skills || []) {
    if (!prevByRepo.has(s.repo)) prevByRepo.set(s.repo, []);
    prevByRepo.get(s.repo).push(s);
  }
  const prevRepoMap = new Map((prevOut?.repos || []).map(r => [r.id, r]));
  let failedScans = 0;

  const candidates = await discoverCandidates();
  log(`${candidates.length} candidate repos`);

  const meta = await fetchRepoMeta(candidates);
  const official = new Set(CONFIG.officialOwners.map(o => o.toLowerCase()));
  const seeds = new Set(CONFIG.seedRepos.map(r => r.toLowerCase()));
  // Which repos get scanned. Three lanes, so the site isn't only "whoever has the most stars":
  //   popular: the most-starred repos
  //   rising:  young repos gaining stars fastest (stars per day since creation)
  //   gem:     small, still-maintained repos, picked across star bands so tiny ones get in too
  const DAY = 864e5;
  const eligible = [...meta.values()].filter(r => !r.isFork && r.defaultBranchRef);
  const byStars = (a, b) => b.stargazerCount - a.stargazerCount;
  const ageDays = r => Math.max(3, (Date.now() - Date.parse(r.createdAt)) / DAY);
  const velocity = r => r.stargazerCount / ageDays(r);
  const active = (r, days) => !r.isArchived && Date.now() - Date.parse(r.pushedAt) < days * DAY;
  const picked = new Map();
  const pick = (list, n, lane) => {
    let c = 0;
    for (const r of list) {
      if (c >= n) break;
      if (picked.has(r.nameWithOwner)) continue;
      picked.set(r.nameWithOwner, Object.assign(r, { lane }));
      c++;
    }
    return c;
  };
  pick(eligible.filter(r => seeds.has(r.nameWithOwner.toLowerCase())), Infinity, 'popular');
  pick(eligible.filter(r => r.stargazerCount >= L.minStars).sort(byStars), L.popularRepos, 'popular');
  const popularCutoff = Math.min(...[...picked.values()].filter(r => !seeds.has(r.nameWithOwner.toLowerCase())).map(r => r.stargazerCount));
  const nRising = pick(eligible.filter(r => r.stargazerCount >= L.risingMinStars && ageDays(r) <= L.risingMaxAgeDays && active(r, 30))
    .sort((a, b) => velocity(b) - velocity(a)), L.risingRepos, 'rising');
  let nGems = 0;
  for (const [lo, hi, n] of L.gemBands) {
    nGems += pick(eligible.filter(r => r.stargazerCount >= lo && r.stargazerCount < hi && active(r, L.gemPushedWithinDays)).sort(byStars), n, 'gem');
  }
  const repos = [...picked.values()];
  state.scanCache ||= {};
  log(`scanning ${repos.length} repos (of ${meta.size} with metadata): ${repos.length - nRising - nGems} popular (cutoff ★${popularCutoff}), ${nRising} rising, ${nGems} gems`);

  const scans = await pool(repos, 6, async (r, i) => {
    const res = await scanRepo(r, state.shaCache, state.scanCache);
    if ((i + 1) % 50 === 0) log(`  scanned ${i + 1}/${repos.length}`);
    return res;
  });

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const outRepos = [];
  let skills = [];
  // Repos already in the catalogue before this run (first run: whatever the last output had).
  state.knownRepos ||= Object.fromEntries((prevOut?.repos || []).map(r => [r.id, today]));
  const knownBefore = new Set(Object.keys(state.knownRepos));

  repos.forEach((r, i) => {
    const id = r.nameWithOwner;
    let scan = scans[i];
    const prevSkills = prevByRepo.get(id);
    if (!scan) {
      failedScans++;
      if (!prevSkills) return;
      log(`  could not scan ${id} — keeping its ${prevSkills.length} skills from last run`);
      scan = { marketplace: prevRepoMap.get(id)?.marketplace || false, skills: null };
    } else if (!scan.skills.length) return;
    const ownerOfficial = official.has(r.owner.login.toLowerCase());
    const wasKnown = knownBefore.has(id);
    const freshRepo = Date.now() - Date.parse(r.createdAt) < 14 * 864e5;
    state.knownRepos[id] = today;

    // star history (one point per day) → 7-day trend
    const hist = (state.starHistory[id] ||= []);
    if (hist.at(-1)?.[0] === today) hist[hist.length - 1] = [today, r.stargazerCount];
    else hist.push([today, r.stargazerCount]);
    while (hist.length > 30) hist.shift();
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const base = hist.find(([d]) => d >= weekAgo) || hist[0];
    const trend = r.stargazerCount - base[1];
    const trendDays = Math.round((Date.parse(today) - Date.parse(base[0])) / 864e5);
    if (trendDays > maxTrendDays) maxTrendDays = trendDays;

    outRepos.push({
      id,
      url: r.url,
      description: truncate(clean(r.description), 300),
      stars: r.stargazerCount,
      trend,
      trendDays,
      branch: r.defaultBranchRef.name,
      pushedAt: r.pushedAt,
      createdAt: r.createdAt,
      lane: r.lane,
      license: r.licenseInfo?.spdxId && r.licenseInfo.spdxId !== 'NOASSERTION' ? r.licenseInfo.spdxId : null,
      avatar: r.owner.avatarUrl,
      official: ownerOfficial,
      archived: r.isArchived,
      marketplace: scan.marketplace,
      topics: r.repositoryTopics.nodes.map(n => n.topic.name),
      homepage: r.homepageUrl || null,
    });

    if (scan.skills === null) {
      for (const p of prevSkills) {
        const sid = p.repo + (p.path ? '/' + p.path : '');
        state.lastSeen[sid] = today;
        state.firstSeen[sid] ||= p.firstSeen;
        skills.push({
          id: sid, name: p.name, title: humanize(p.name), description: p.description, repo: id, path: p.path,
          file: p.file || (p.path ? p.path + '/' : '') + 'SKILL.md', category: p.category, tags: p.tags || [],
          license: p.license || null, files: prevFiles[sid] ?? null, fileCount: p.fileCount,
          needs: p.needs || [], needsOptional: !!p.needsOptional,
          firstSeen: state.firstSeen[sid], stars: r.stargazerCount, official: ownerOfficial,
        });
      }
      return;
    }

    for (const s of scan.skills) {
      usedShas.add(s.sha);
      const folder = s.dir.split('/').pop() || r.nameWithOwner.split('/')[1];
      const name = s.fm.name || folder;
      const skillId = `${id}/${s.dir}`.replace(/\/$/, '');
      // "New" means new to the world, not new to us: when a repo enters the catalogue for the
      // first time, its existing skills get the baseline date unless the repo itself is fresh.
      state.firstSeen[skillId] ||= (!wasKnown && !freshRepo) ? state.since : now;
      state.lastSeen[skillId] = today;
      const { category, tags } = classify({ name, description: s.fm.description, path: s.dir, repo: id });
      const { needs, optional } = needsFor(s.fm.req, category, s.files);
      skills.push({
        id: skillId,
        name,
        title: humanize(name),
        description: s.fm.description,
        repo: id,
        path: s.dir,
        file: s.file,
        category,
        tags,
        license: s.fm.license || null,
        files: s.files,
        needs,
        needsOptional: optional,
        fileCount: s.fileCount,
        firstSeen: state.firstSeen[skillId],
        stars: r.stargazerCount,
        official: ownerOfficial,
      });
    }
  });

  // Leave out anything that isn't a real, installable skill:
  //  - test / eval / fixture folders. Security-scanner repos keep deliberately malicious sample
  //    skills there, and we must never offer those for download.
  //  - folders whose name says the sample is hostile.
  const before = skills.length;
  skills = skills.filter(s => !TEST_PATH.test(s.path + '/') && !HOSTILE_NAME.test(s.path));
  // One skill per folder (some folders hold both SKILL.md and skill.md).
  const perFolder = new Map();
  for (const s of skills) {
    const kept = perFolder.get(s.id);
    const exact = x => /(^|\/)SKILL\.md$/.test(x.file); // prefer the canonical upper-case file name
    if (!kept || (exact(s) && !exact(kept))) perFolder.set(s.id, s);
  }
  skills = [...perFolder.values()];
  log(`left out ${before - skills.length} test/fixture/duplicate-folder skills`);

  // De-duplicate copies of the same skill across repos (keep the most-starred source).
  const seen = new Map();
  skills.sort((a, b) => Number(b.official) - Number(a.official) || b.stars - a.stars);
  skills = skills.filter(s => {
    const key = s.name.toLowerCase() + '|' + s.description.toLowerCase().slice(0, 120);
    if (seen.has(key)) { seen.get(key).copies++; return false; }
    s.copies = 0;
    seen.set(key, s);
    return true;
  });
  // Drop template / placeholder skills with no usable description.
  skills = skills.filter(s => s.description && s.description.length >= 12 && !/^(todo|tbd|replace|a clear description|sample skill|test skill|synthetic fixture)/i.test(s.description));
  skills.forEach(s => { if (!s.copies) delete s.copies; delete s.stars; delete s.official; });
  skills.sort((a, b) => a.id.localeCompare(b.id));

  // File lists go to a separate file the site loads only when a skill is opened.
  const files = {};
  // Slim the list payload: id / title / standard file path are derived in the browser.
  const nicheCounts = {};
  const slim = skills.map(s => {
    files[s.id] = s.files;
    const o = { name: s.name, description: truncate(s.description, L.maxDescriptionChars), repo: s.repo, path: s.path, category: s.category };
    if (s.tags.length) o.tags = s.tags;
    if (s.file !== (s.path ? s.path + '/' : '') + 'SKILL.md') o.file = s.file;
    if (s.license) o.license = s.license;
    o.fileCount = s.fileCount;
    o.firstSeen = s.firstSeen.slice(0, 10);
    if (s.copies) o.copies = s.copies;
    if (s.needs?.length) o.needs = s.needs;
    // Niches come from the name + description, so rule changes apply on the very next run.
    const niches = classifyNiches({ name: s.name, description: s.description, path: s.path });
    if (niches.length) { o.niches = niches; niches.forEach(n => (nicheCounts[n] = (nicheCounts[n] || 0) + 1)); }
    if (s.needsOptional) o.needsOptional = true;
    return o;
  });

  const usedRepos = new Set(skills.map(s => s.repo));
  const finalRepos = outRepos.filter(r => usedRepos.has(r.id));
  const counts = {};
  skills.forEach(s => (counts[s.category] = (counts[s.category] || 0) + 1));
  finalRepos.forEach(r => (r.skillCount = skills.filter(s => s.repo === r.id).length));

  const out = {
    generatedAt: now,
    stats: { skills: skills.length, repos: finalRepos.length, needsKey: slim.filter(s => s.needs && !s.needsOptional).length, trendDays: maxTrendDays, trackingSince: state.since, popularCutoff, scannedRepos: repos.length, treeCalls, durationSec: Math.round((Date.now() - started) / 1000) },
    categories: CATEGORIES.map(({ id, name, icon, desc }) => ({ id, name, icon, desc, count: counts[id] || 0 })),
    niches: NICHES.map(({ id, name, icon, desc }) => ({ id, name, icon, desc, count: nicheCounts[id] || 0 })),
    repos: finalRepos,
    skills: slim,
  };

  // Sanity check: a sudden big drop almost always means GitHub had a bad moment,
  // not that thousands of skills vanished. Refuse to publish; the live site keeps
  // the last good data and the next run tries again. Set FORCE=1 to override.
  const prevCount = prevOut?.skills?.length || 0;
  if (prevCount && skills.length < prevCount * 0.6 && !process.env.FORCE) {
    throw new Error(`Sanity check failed: found ${skills.length} skills, last run had ${prevCount}. Not publishing. (FORCE=1 to override)`);
  }
  if (skills.length < 20 && !process.env.FORCE) {
    throw new Error(`Sanity check failed: only ${skills.length} skills found. Not publishing.`);
  }

  // Prune caches. Skip SHA pruning on runs where some repos failed (their files weren't re-checked).
  if (!failedScans) for (const sha of Object.keys(state.shaCache)) if (!usedShas.has(sha)) delete state.shaCache[sha];
  const cutoff = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
  for (const id of Object.keys(state.firstSeen)) {
    if (!state.lastSeen[id]) state.lastSeen[id] = today; // migrate old state
    if (state.lastSeen[id] < cutoff) { delete state.firstSeen[id]; delete state.lastSeen[id]; }
  }
  for (const id of Object.keys(state.starHistory)) {
    const last = state.starHistory[id].at(-1)?.[0] || '';
    if (!usedRepos.has(id) && last < cutoff) delete state.starHistory[id];
  }

  for (const id of Object.keys(state.scanCache)) if (!meta.has(id.toLowerCase())) delete state.scanCache[id];

  // Write atomically so a crash mid-write never leaves a half-written file behind.
  const writeAtomic = async (file, data) => { await writeFile(file + '.tmp', data); await rename(file + '.tmp', file); };
  await writeAtomic(OUT_FILE, JSON.stringify(out));
  await writeAtomic(FILES_FILE, JSON.stringify(files));
  await writeAtomic(STATE_FILE, JSON.stringify(state));
  log(`done: ${skills.length} skills from ${finalRepos.length} repos · ${failedScans} repos failed (kept previous data) · ${treeCalls} repos re-read, ${repos.length - treeCalls} unchanged · ${apiCalls} API calls · ${out.stats.durationSec}s`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(e => { console.error(e); process.exit(1); });
}
