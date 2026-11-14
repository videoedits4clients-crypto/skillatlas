/* SkillAtlas front-end — no build step, no framework. */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  const PAGE = 36;
  const NEW_DAYS = 7;
  const SUGGESTIONS = ['Make slides', 'Fill PDF forms', 'Analyze a spreadsheet', 'Write tests', 'Design a UI', 'Build an MCP server', 'Code review', 'Write a blog post', 'Make a video'];
  // Plain-English words → the words skills actually use.
  const SYNONYMS = {
    slides: ['pptx', 'presentation', 'powerpoint', 'deck'], slide: ['pptx', 'presentation'], deck: ['pptx', 'slides'],
    powerpoint: ['pptx'], excel: ['xlsx', 'spreadsheet'], spreadsheet: ['xlsx', 'excel', 'csv'], word: ['docx'],
    doc: ['docx', 'document'], document: ['docx', 'pdf'], test: ['testing', 'tests', 'playwright'], tests: ['testing', 'test'],
    ui: ['design', 'frontend', 'interface'], website: ['web', 'frontend', 'landing'], chart: ['visualization', 'graph', 'plot'],
    graph: ['chart', 'visualization'], video: ['animation', 'remotion', 'ffmpeg'], image: ['images', 'picture', 'photo'],
    picture: ['image'], blog: ['article', 'writing', 'post'], email: ['mail', 'gmail'], mcp: ['model context protocol', 'server'],
    seo: ['search engine'], research: ['paper', 'academic'], deploy: ['deployment', 'hosting'], pr: ['pull request'],
    review: ['reviewing', 'audit'], bug: ['debug', 'debugging', 'fix'], debug: ['debugging', 'bug'],
  };
  const STOP = new Set(['a', 'an', 'the', 'to', 'for', 'of', 'and', 'or', 'my', 'me', 'i', 'want', 'how', 'do', 'with', 'in', 'on', 'make', 'create', 'build', 'help', 'skill', 'skills']);

  const state = {
    data: null, skills: [], repoMap: new Map(), catMap: new Map(),
    q: '', cat: '', repo: '', source: 'all', keys: 'any', sort: 'best', shown: PAGE, view: 'browse',
    saved: new Set(store.get('saved', [])), openId: null, lastFocus: null,
  };

  // ---------- Theme ----------
  $('#themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('theme', next);
    try { localStorage.setItem('theme', next); } catch { }
  });

  // ---------- Toast ----------
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }
  async function copy(text, label = 'Copied') {
    try { await navigator.clipboard.writeText(text); toast(label + ' ✓'); }
    catch { prompt('Copy this:', text); }
  }

  // ---------- Time ----------
  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400);
    return d < 30 ? `${d} day${d > 1 ? 's' : ''} ago` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ---------- Data ----------
  async function load() {
    $('#grid').innerHTML = '<div class="skeleton"></div>'.repeat(9);
    try {
      const res = await fetch('data/skills.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      state.data = await res.json();
    } catch (e) {
      $('#grid').innerHTML = '';
      $('#updatedLabel').textContent = 'Could not load skills — please refresh.';
      return;
    }
    const d = state.data;
    d.repos.forEach(r => state.repoMap.set(r.id, r));
    d.categories.forEach(c => state.catMap.set(c.id, c));
    const newCutoff = Date.now() - NEW_DAYS * 864e5;
    // Skills first seen on the day tracking began are the starting catalogue, not "new".
    const since = d.stats.trackingSince || (d.skills.every(s => s.firstSeen === d.skills[0]?.firstSeen) ? d.skills[0]?.firstSeen : '');
    // Real star trends need a few days of history; until then "hot" = popular + recently updated.
    state.trendReady = (d.stats.trendDays || 0) >= 3;
    const weekAgo = Date.now() - 7 * 864e5;
    d.repos.forEach(r => {
      if (state.trendReady) {
        const growth = r.trend / Math.max(r.stars - r.trend, 50);
        r.heat = r.trend > 0 ? Math.log10(r.trend + 1) * 10 + Math.min(growth, 1) * 25 : 0;
      } else {
        r.heat = Date.parse(r.pushedAt) > weekAgo ? Math.log10(r.stars + 1) * 10 : 0;
      }
    });
    const humanize = n => n.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    state.skills = d.skills.map(s => {
      const r = state.repoMap.get(s.repo) || {};
      const cat = state.catMap.get(s.category);
      const sk = {
        ...s, r, stars: r.stars || 0, official: !!r.official,
        id: s.repo + (s.path ? '/' + s.path : ''),
        title: humanize(s.name),
        file: s.file || (s.path ? s.path + '/' : '') + 'SKILL.md',
        tags: s.tags || [],
        needs: s.needs || [], needsOptional: !!s.needsOptional,
        needsKey: !!(s.needs && s.needs.length && !s.needsOptional),
        isNew: !!since && s.firstSeen.slice(0, 10) > since.slice(0, 10) && new Date(s.firstSeen).getTime() > newCutoff,
        hayName: (s.name + ' ' + s.title).toLowerCase(),
        hayDesc: s.description.toLowerCase(),
        hayMeta: [s.repo, s.path, cat?.name, ...(s.tags || []).map(t => state.catMap.get(t)?.name), ...(r.topics || []), ...(s.needs || [])].join(' ').toLowerCase(),
      };
      sk.base = Math.log10(sk.stars + 1) * 10 + (sk.official ? 25 : 0) + (sk.isNew ? 3 : 0) + Math.min(s.description.length, 200) / 100 - (r.archived ? 10 : 0);
      return sk;
    });

    $('#updatedLabel').textContent = `Updated ${ago(d.generatedAt)} · refreshes twice daily`;
    $('#footUpdated').textContent = `Last updated ${new Date(d.generatedAt).toLocaleString()}`;
    const newCount = state.skills.filter(s => s.isNew).length;
    $('#stats').innerHTML = [
      [d.stats.skills, 'skills'], [d.stats.repos, 'collections'],
      [d.categories.filter(c => c.count).length, 'categories'],
      [state.skills.filter(s => !s.needsKey).length, 'need no extra API key'],
      ...(newCount ? [[newCount, `new this week`]] : []),
    ].map(([n, l]) => `<div class="stat"><b>${n.toLocaleString()}</b><span>${l}</span></div>`).join('');

    renderStatic();
    readURL();
    route();
  }

  // ---------- Search ----------
  function tokens(q) {
    return q.toLowerCase().replace(/[^\p{L}\p{N}\s.+#-]/gu, ' ').split(/\s+/).filter(t => t && !STOP.has(t));
  }
  function scoreSkill(s, toks) {
    let total = 0;
    for (const t of toks) {
      const alts = [t, ...(SYNONYMS[t] || [])];
      if (t.length > 3 && t.endsWith('s')) alts.push(t.slice(0, -1));
      let best = 0;
      for (const a of alts) {
        const w = a === t ? 1 : 0.7;
        if (s.name === a) best = Math.max(best, 14 * w);
        else if (s.hayName.includes(a)) best = Math.max(best, 8 * w);
        if (s.hayDesc.includes(a)) best = Math.max(best, 3 * w);
        if (s.hayMeta.includes(a)) best = Math.max(best, 1.5 * w);
      }
      if (!best) return 0; // every word must match something
      total += best;
    }
    return total;
  }

  function filtered() {
    const toks = tokens(state.q);
    let list = state.skills;
    if (state.cat) list = list.filter(s => s.category === state.cat);
    if (state.repo) list = list.filter(s => s.repo === state.repo);
    if (state.source === 'official') list = list.filter(s => s.official);
    if (state.source === 'community') list = list.filter(s => !s.official);
    if (state.keys === 'none') list = list.filter(s => !s.needsKey);
    if (toks.length) {
      list = list.map(s => ({ s, m: scoreSkill(s, toks) })).filter(x => x.m > 0)
        .map(x => (x.s._score = x.m * 4 + x.s.base, x.s));
    } else list = list.map(s => (s._score = s.base, s));
    const sorters = {
      best: (a, b) => b._score - a._score,
      stars: (a, b) => b.stars - a.stars || a.name.localeCompare(b.name),
      new: (a, b) => b.firstSeen.localeCompare(a.firstSeen) || b._score - a._score,
      trending: (a, b) => (b.r.heat || 0) - (a.r.heat || 0) || b._score - a._score,
      az: (a, b) => a.title.localeCompare(b.title),
    };
    return [...list].sort(sorters[state.sort] || sorters.best);
  }

  // ---------- Rendering ----------
  const catIcon = id => state.catMap.get(id)?.icon || '✨';
  const catName = id => state.catMap.get(id)?.name || 'Other';

  function cardHTML(s, extra = '') {
    const owner = s.repo.split('/')[0];
    return `<article class="card" data-id="${esc(s.id)}" tabindex="0" role="button" aria-label="${esc(s.title)}">
      <button class="save ${state.saved.has(s.id) ? 'on' : ''}" data-save="${esc(s.id)}" aria-label="Save ${esc(s.title)}">${state.saved.has(s.id) ? '♥' : '♡'}</button>
      <div class="card-top">
        <div class="cat-icon" aria-hidden="true">${catIcon(s.category)}</div>
        <div><h3>${esc(s.title)}</h3><div class="cat-name">${esc(catName(s.category))}</div></div>
      </div>
      <p>${esc(s.description)}</p>
      ${badges(s, extra)}
      <div class="card-foot">
        ${s.r.avatar ? `<img src="${esc(s.r.avatar)}&s=40" alt="" loading="lazy">` : ''}
        <span class="repo" title="${esc(s.repo)}">${esc(owner)} / ${esc(s.repo.split('/')[1])}</span>
        <span class="stars" title="${s.stars.toLocaleString()} GitHub stars">★ ${fmt(s.stars)}</span>
      </div>
    </article>`;
  }
  function badges(s, extra = '') {
    if (typeof extra !== 'string') extra = ''; // guard against .map(cardHTML) passing an index
    const b = extra ? [extra] : [];
    if (s.official) b.push('<span class="badge official">✓ Official</span>');
    if (s.isNew && !extra.includes('🆕')) b.push('<span class="badge new">New</span>');
    if (s.needsKey) b.push(`<span class="badge key" title="Needs an account / API key: ${esc(s.needs.join(', '))}">🔑 Needs key</span>`);
    else if (s.needs.length) b.push(`<span class="badge" title="Optional key for extras: ${esc(s.needs.join(', '))}">🔑 Optional key</span>`);
    if (s.r.marketplace) b.push('<span class="badge plugin" title="Installable as a Claude Code plugin">Plugin</span>');
    if (s.r.archived) b.push('<span class="badge">Archived</span>');
    return b.length ? `<div class="badges">${b.join('')}</div>` : '';
  }

  function renderStatic() {
    $('#suggestions').innerHTML = SUGGESTIONS.map(t => `<button class="chip" data-suggest="${esc(t)}">${esc(t)}</button>`).join('');
    const cats = state.data.categories.filter(c => c.count);
    $('#catGrid').innerHTML = cats.map(c => `<button class="cat-card" data-cat="${c.id}">
      <span class="cat-icon">${c.icon}</span>
      <span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small><span class="count">${c.count.toLocaleString()} skills →</span></span>
    </button>`).join('');
    // Start-here rail: official first, then the most-starred community skills (one per repo).
    const off = state.skills.filter(s => s.official).sort((a, b) => b.base - a.base).slice(0, 8);
    const seenRepo = new Set();
    const comm = state.skills.filter(s => !s.official).sort((a, b) => b.base - a.base)
      .filter(s => !seenRepo.has(s.repo) && seenRepo.add(s.repo)).slice(0, 12 - Math.min(off.length, 8));
    $('#startRail').innerHTML = [...off, ...comm].map(s => cardHTML(s)).join('');

    // Trending: hottest repos first, at most 2 skills per repo so one big collection can't take over.
    const trend = diverse(state.skills.filter(s => s.r.heat > 0).sort((a, b) => b.r.heat - a.r.heat || b.base - a.base));
    if (trend.length >= 4) {
      $('#trendTitle').textContent = state.trendReady ? '🔥 Trending this week' : '🔥 Popular & active this week';
      $('#trendSub').textContent = state.trendReady
        ? 'Skills whose collections gained the most GitHub stars in the last 7 days.'
        : 'Well-loved skills from collections that were updated in the last few days.';
      $('#trendRail').innerHTML = trend.map(s => cardHTML(s, state.trendReady
        ? `<span class="badge hot" title="New GitHub stars on ${esc(s.repo)} in the last ${s.r.trendDays} days">🔥 +${fmt(s.r.trend)} ★ this week</span>`
        : `<span class="badge hot">🔄 updated ${ago(s.r.pushedAt)}</span>`)).join('');
      state.hasTrend = true;
    }
    // Just added: newest first.
    const fresh = diverse(state.skills.filter(s => s.isNew).sort((a, b) => b.firstSeen.localeCompare(a.firstSeen) || b.base - a.base));
    if (fresh.length >= 4) {
      $('#newRail').innerHTML = fresh.map(s => cardHTML(s, `<span class="badge new">🆕 ${addedAgo(s.firstSeen)}</span>`)).join('');
      state.hasNew = true;
    }
  }
  function diverse(list, perRepo = 2, n = 12) {
    const per = new Map(); const out = [];
    for (const s of list) {
      const c = per.get(s.repo) || 0;
      if (c >= perRepo) continue;
      per.set(s.repo, c + 1); out.push(s);
      if (out.length >= n) break;
    }
    return out;
  }
  function addedAgo(date) {
    const days = Math.floor((Date.now() - Date.parse(date.slice(0, 10))) / 864e5);
    return days <= 0 ? 'added today' : days === 1 ? 'added yesterday' : `added ${days} days ago`;
  }

  function renderBrowse() {
    const list = filtered();
    const filtersOn = state.q || state.cat || state.repo || state.source !== 'all' || state.keys !== 'any';
    $('#catBlock').hidden = !!filtersOn;
    $('#startBlock').hidden = !!filtersOn;
    $('#trendBlock').hidden = !!filtersOn || !state.hasTrend;
    $('#newBlock').hidden = !!filtersOn || !state.hasNew;

    // Sidebar counts reflect everything except the category filter.
    const saveCat = state.cat; state.cat = '';
    const pre = filtered(); state.cat = saveCat;
    const counts = {}; pre.forEach(s => (counts[s.category] = (counts[s.category] || 0) + 1));
    $('#catList').innerHTML = `<li><button data-cat="" class="${!state.cat ? 'on' : ''}">🗂️ All skills <span class="n">${pre.length.toLocaleString()}</span></button></li>` +
      state.data.categories.filter(c => c.count).map(c => `<li><button data-cat="${c.id}" class="${state.cat === c.id ? 'on' : ''}">${c.icon} ${esc(c.name)} <span class="n">${(counts[c.id] || 0).toLocaleString()}</span></button></li>`).join('');

    const title = state.cat ? catName(state.cat) : state.repo ? state.repo : state.q ? 'Results' : 'All skills';
    $('#resultsTitle').textContent = title;
    $('#resultsCount').textContent = `${list.length.toLocaleString()} skill${list.length === 1 ? '' : 's'}`;

    const af = [];
    if (state.q) af.push(`<button class="af" data-clear="q">“${esc(state.q)}”</button>`);
    if (state.cat) af.push(`<button class="af" data-clear="cat">${catIcon(state.cat)} ${esc(catName(state.cat))}</button>`);
    if (state.repo) af.push(`<button class="af" data-clear="repo">📦 ${esc(state.repo)}</button>`);
    if (state.source !== 'all') af.push(`<button class="af" data-clear="source">${state.source === 'official' ? 'Official only' : 'Community only'}</button>`);
    if (state.keys === 'none') af.push('<button class="af" data-clear="keys">🔓 No API key needed</button>');
    $('#activeFilters').innerHTML = af.join('');
    $('#noKeyBtn').setAttribute('aria-pressed', String(state.keys === 'none'));

    $('#grid').innerHTML = list.slice(0, state.shown).map(s => cardHTML(s)).join('');
    $('#empty').hidden = list.length > 0;
    $('#more').hidden = list.length <= state.shown;
    $('#moreBtn').textContent = `Show more (${(list.length - state.shown).toLocaleString()} left)`;
    $$('.seg button').forEach(b => b.classList.toggle('on', b.dataset.source === state.source));
    $('#sort').value = state.sort;
  }

  function renderCollections() {
    const q = $('#repoQ').value.toLowerCase().trim();
    const repos = state.data.repos.filter(r => !q || (r.id + ' ' + r.description + ' ' + r.topics.join(' ')).toLowerCase().includes(q))
      .sort((a, b) => Number(b.official) - Number(a.official) || b.stars - a.stars);
    $('#repoList').innerHTML = repos.map(r => `<button class="repo-row" data-repo="${esc(r.id)}">
      <img src="${esc(r.avatar)}&s=88" alt="" loading="lazy">
      <div><h3>${esc(r.id)} ${r.official ? '<span class="badge official">✓ Official</span>' : ''} ${r.marketplace ? '<span class="badge plugin">Plugin</span>' : ''}</h3>
      <p>${esc(r.description || 'No description')}</p></div>
      <div class="repo-nums"><b>${r.skillCount}</b> skill${r.skillCount === 1 ? '' : 's'} · ★ ${fmt(r.stars)}</div>
    </button>`).join('') || '<p class="muted">No collections match.</p>';
  }

  function renderSaved() {
    const list = state.skills.filter(s => state.saved.has(s.id));
    $('#savedGrid').innerHTML = list.map(s => cardHTML(s)).join('');
    $('#savedEmpty').hidden = list.length > 0;
  }

  function updateSavedCount() {
    const el = $('#savedCount');
    el.textContent = state.saved.size || '';
  }

  // ---------- Routing (query string) ----------
  function readURL() {
    const p = new URLSearchParams(location.search);
    state.view = p.get('view') || 'browse';
    state.q = p.get('q') || '';
    state.cat = p.get('cat') || '';
    state.repo = p.get('repo') || '';
    state.source = p.get('source') || 'all';
    state.keys = p.get('keys') === 'none' ? 'none' : 'any';
    state.sort = p.get('sort') || 'best';
    state.openId = p.get('skill');
    $('#q').value = state.q;
  }
  function writeURL(push = false) {
    const p = new URLSearchParams();
    if (state.view !== 'browse') p.set('view', state.view);
    if (state.q) p.set('q', state.q);
    if (state.cat) p.set('cat', state.cat);
    if (state.repo) p.set('repo', state.repo);
    if (state.source !== 'all') p.set('source', state.source);
    if (state.keys !== 'any') p.set('keys', state.keys);
    if (state.sort !== 'best') p.set('sort', state.sort);
    if (state.openId) p.set('skill', state.openId);
    const url = location.pathname + (p.toString() ? '?' + p : '');
    history[push ? 'pushState' : 'replaceState'](null, '', url);
  }
  function route() {
    $$('.view').forEach(v => (v.hidden = v.id !== 'view-' + state.view));
    $$('.nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === state.view));
    if (state.view === 'browse') renderBrowse();
    if (state.view === 'collections') renderCollections();
    if (state.view === 'saved') renderSaved();
    updateSavedCount();
    if (state.openId) openSkill(state.openId, false); else closeDrawer(false);
  }
  window.addEventListener('popstate', () => { readURL(); route(); });

  function go(view, patch = {}) {
    Object.assign(state, { view, shown: PAGE, openId: null }, patch);
    writeURL(true); route();
    window.scrollTo({ top: 0 });
  }
  function update(patch, scrollToResults = false) {
    Object.assign(state, { shown: PAGE }, patch);
    if (state.view !== 'browse') state.view = 'browse';
    writeURL(); route();
    if (scrollToResults) $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Events ----------
  let qT;
  $('#q').addEventListener('input', e => {
    clearTimeout(qT);
    qT = setTimeout(() => update({ q: e.target.value.trim() }), 140);
  });
  $('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(qT); update({ q: e.target.value.trim() }, true); } });
  $('#sort').addEventListener('change', e => update({ sort: e.target.value }));
  $('#noKeyBtn').addEventListener('click', () => update({ keys: state.keys === 'none' ? 'any' : 'none' }));
  $('#repoQ').addEventListener('input', renderCollections);
  $('#moreBtn').addEventListener('click', () => { state.shown += PAGE; renderBrowse(); });
  $('#clearAll').addEventListener('click', () => { $('#q').value = ''; update({ q: '', cat: '', repo: '', source: 'all', keys: 'any' }); });

  document.addEventListener('click', e => {
    const t = e.target;
    const nav = t.closest('[data-nav]');
    if (nav) { e.preventDefault(); const v = nav.dataset.nav; if (v === 'browse') { $('#q').value = ''; go('browse', { q: '', cat: '', repo: '', source: 'all', keys: 'any' }); } else go(v); return; }
    const save = t.closest('[data-save]');
    if (save) { e.stopPropagation(); toggleSave(save.dataset.save); return; }
    const sug = t.closest('[data-suggest]');
    if (sug) { $('#q').value = sug.dataset.suggest; update({ q: sug.dataset.suggest }, true); return; }
    const cat = t.closest('[data-cat]');
    if (cat) { update({ cat: cat.dataset.cat }, !!cat.closest('#catGrid')); return; }
    const see = t.closest('[data-see]');
    if (see) { update({ sort: see.dataset.see }, true); return; }
    const src = t.closest('[data-source]');
    if (src) { update({ source: src.dataset.source }); return; }
    const clr = t.closest('[data-clear]');
    if (clr) { const k = clr.dataset.clear; if (k === 'q') $('#q').value = ''; update({ [k]: k === 'source' ? 'all' : k === 'keys' ? 'any' : '' }); return; }
    const repo = t.closest('[data-repo]');
    if (repo) { closeDrawer(false); state.openId = null; go('browse', { repo: repo.dataset.repo, q: '', cat: '' }); $('#q').value = ''; setTimeout(() => $('#results').scrollIntoView({ block: 'start' }), 0); return; }
    const card = t.closest('[data-id]');
    if (card && !t.closest('a')) { state.lastFocus = card; openSkill(card.dataset.id, true); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); if (state.view !== 'browse') go('browse'); $('#q').focus(); }
    if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(true);
    if (e.key === 'Enter' && document.activeElement.matches('.card')) document.activeElement.click();
  });
  $('#scrim').addEventListener('click', () => closeDrawer(true));
  $('#dClose').addEventListener('click', () => closeDrawer(true));

  function toggleSave(id) {
    if (state.saved.has(id)) { state.saved.delete(id); toast('Removed from saved'); } else { state.saved.add(id); toast('Saved ♥'); }
    store.set('saved', [...state.saved]);
    $$(`[data-save="${CSS.escape(id)}"]`).forEach(b => { const on = state.saved.has(id); b.classList.toggle('on', on); b.textContent = on ? '♥' : '♡'; });
    updateSavedCount();
    if (state.view === 'saved') renderSaved();
  }

  // ---------- Skill drawer ----------
  const rawURL = (s, file) => `https://raw.githubusercontent.com/${s.repo}/${encodeURIComponent(s.r.branch)}/${file.split('/').map(encodeURIComponent).join('/')}`;
  const treeURL = s => `https://github.com/${s.repo}/tree/${encodeURIComponent(s.r.branch)}/${s.path.split('/').map(encodeURIComponent).join('/')}`;
  const blobURL = (s, file) => `https://github.com/${s.repo}/blob/${encodeURIComponent(s.r.branch)}/${file.split('/').map(encodeURIComponent).join('/')}`;
  const folderName = s => (s.path.split('/').pop() || s.name).replace(/[^\w.-]+/g, '-');

  function openSkill(id, push) {
    const s = state.skills.find(x => x.id === id);
    if (!s) { state.openId = null; writeURL(); return; }
    state.openId = id;
    if (push) writeURL(true);
    document.title = `${s.title} — SkillAtlas`;

    const r = s.r;
    const folder = folderName(s);
    const degit = `npx degit ${s.repo}${s.path ? '/' + s.path : ''}#${r.branch} ~/.claude/skills/${folder}`;
    const projDegit = `npx degit ${s.repo}${s.path ? '/' + s.path : ''}#${r.branch} .claude/skills/${folder}`;
    const related = state.skills.filter(x => x.id !== s.id && x.category === s.category).sort((a, b) => b.base - a.base).slice(0, 4);
    const sameRepo = state.skills.filter(x => x.id !== s.id && x.repo === s.repo).sort((a, b) => b.base - a.base).slice(0, 4);

    $('#drawerBody').innerHTML = `
      <div class="d-hero">
        <div class="cat-icon">${catIcon(s.category)}</div>
        <div><h2 id="dTitle">${esc(s.title)}</h2>${badges(s) || ''}</div>
      </div>
      <p class="d-desc">${esc(s.description)}</p>
      ${keyCallout(s)}
      <div class="d-actions">
        <button class="btn" id="dlBtn">⬇ Download .zip</button>
        <a class="btn ghost" href="${treeURL(s)}" target="_blank" rel="noopener">View on GitHub ↗</a>
        <button class="btn ghost" data-save="${esc(s.id)}">${state.saved.has(s.id) ? '♥ Saved' : '♡ Save'}</button>
        <button class="btn ghost" id="shareBtn">🔗 Share</button>
      </div>
      <div class="d-meta">
        <div><small>Category</small><span>${catIcon(s.category)} ${esc(catName(s.category))}</span></div>
        <div><small>Collection</small><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(s.repo)}</a></div>
        <div><small>Stars</small><span>★ ${(s.stars).toLocaleString()}${r.trend > 0 ? ` <span class="muted">(+${fmt(r.trend)} this week)</span>` : ''}</span></div>
        <div><small>License</small><span>${esc(s.license || r.license || 'Not stated')}</span></div>
        <div><small>Extra API key</small><span>${s.needsKey ? '🔑 ' + esc(s.needs.join(', ')) : s.needs.length ? 'Optional' : '🔓 None detected'}</span></div>
        <div><small>Files</small><span>${s.fileCount}</span></div>
        <div><small>Repo updated</small><span>${ago(r.pushedAt)}</span></div>
      </div>

      <div class="d-section">
        <h3>How to install</h3>
        <div class="tabs" role="tablist">
          <button class="on" data-tab="app">Claude app</button>
          <button data-tab="code">Claude Code</button>
          ${r.marketplace ? '<button data-tab="plugin">Plugin</button>' : ''}
          <button data-tab="other">Other agents</button>
        </div>
        <div data-pane="app">
          <ol class="steps">
            <li>Click <b>Download .zip</b> above.</li>
            <li>In Claude, open <b>Settings → Capabilities → Skills</b>.</li>
            <li>Choose <b>Upload skill</b> and pick the zip. Turn it on — done.</li>
          </ol>
        </div>
        <div data-pane="code" hidden>
          <p class="muted">For you everywhere (personal skills):</p>
          ${cmd(degit)}
          <p class="muted">Or just for the current project:</p>
          ${cmd(projDegit)}
          <p class="muted">Then restart Claude Code — it picks the skill up automatically when relevant.</p>
        </div>
        ${r.marketplace ? `<div data-pane="plugin" hidden>
          <p class="muted">This collection is a Claude Code plugin marketplace. Inside Claude Code run:</p>
          ${cmd(`/plugin marketplace add ${s.repo}`)}
          <p class="muted">Then open <b>/plugin</b> and install the plugin that contains this skill.</p>
        </div>` : ''}
        <div data-pane="other" hidden>
          <p class="muted">Skills use the open <code>SKILL.md</code> format. Copy the folder into your agent's skills directory (check its docs), for example:</p>
          ${cmd(`npx degit ${s.repo}${s.path ? '/' + s.path : ''}#${r.branch} ./skills/${folder}`)}
        </div>
        ${s.official ? '' : '<p class="note">⚠️ Community skill — skim the SKILL.md and any scripts before installing.</p>'}
      </div>

      <div class="d-section">
        <h3>SKILL.md preview</h3>
        <div class="md" id="mdBox"><p class="muted">Loading…</p></div>
      </div>

      <div class="d-section" id="filesBox">
        <h3>What's inside (${s.fileCount} file${s.fileCount === 1 ? '' : 's'})</h3>
        <p class="muted">Loading file list…</p>
      </div>

      ${sameRepo.length ? `<div class="d-section"><h3>More from ${esc(s.repo)}</h3><div class="mini-list">${sameRepo.map(mini).join('')}</div></div>` : ''}
      ${related.length ? `<div class="d-section"><h3>Similar skills</h3><div class="mini-list">${related.map(mini).join('')}</div></div>` : ''}
    `;

    $$('[data-tab]', $('#drawerBody')).forEach(b => b.addEventListener('click', () => {
      $$('[data-tab]', $('#drawerBody')).forEach(x => x.classList.toggle('on', x === b));
      $$('[data-pane]', $('#drawerBody')).forEach(p => (p.hidden = p.dataset.pane !== b.dataset.tab));
    }));
    $$('[data-copy]', $('#drawerBody')).forEach(b => b.addEventListener('click', () => copy(b.dataset.copy, 'Command copied')));
    $('#dlBtn').addEventListener('click', () => downloadZip(s, $('#dlBtn')));
    $('#shareBtn').addEventListener('click', () => copy(location.href, 'Link copied'));

    $('#drawer').hidden = false; $('#scrim').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#drawerBody').scrollTop = 0;
    $('#dClose').focus();
    loadMarkdown(s);
    getFiles(s).then(files => {
      const box = $('#filesBox');
      if (!box || state.openId !== s.id) return;
      box.innerHTML = files
        ? `<h3>What's inside (${files.length} file${files.length === 1 ? '' : 's'})</h3>
           <ul class="files">${files.map(f => `<li><a href="${blobURL(s, (s.path ? s.path + '/' : '') + f)}" target="_blank" rel="noopener">${esc(f)}</a></li>`).join('')}</ul>`
        : `<h3>What's inside (${s.fileCount} files)</h3><p class="muted">Large skill — <a href="${treeURL(s)}" target="_blank" rel="noopener">browse its files on GitHub ↗</a></p>`;
    });
  }

  let filesPromise;
  async function getFiles(s) {
    filesPromise ||= fetch('data/files.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
    const map = await filesPromise;
    return map[s.id] || null;
  }
  function keyCallout(s) {
    const names = s.needs.filter(n => n !== 'API key');
    const list = names.length ? '<b>' + names.map(esc).join(', ') + '</b>' : 'an outside service';
    if (s.needsKey) return `<div class="callout key"><span>🔑</span><div>Needs your own account or API key for ${list}. Some of these services charge, so check their pricing first.<small>Detected automatically from the skill's instructions, so it may not be exact.</small></div></div>`;
    if (s.needs.length) return `<div class="callout free"><span>🔓</span><div>Works without extra keys. An optional key for ${list} unlocks extras or higher limits.<small>Detected automatically from the skill's instructions, so it may not be exact.</small></div></div>`;
    return `<div class="callout free"><span>🔓</span><div>No extra account or API key detected. It should work with just your AI assistant.<small>Checked automatically from the skill's instructions, so it may not be exact.</small></div></div>`;
  }
  function cmd(text) {
    return `<div class="cmd"><pre>${esc(text)}</pre><button data-copy="${esc(text)}">Copy</button></div>`;
  }
  function mini(s) {
    return `<button class="mini" data-id="${esc(s.id)}"><span class="cat-icon">${catIcon(s.category)}</span><span><b>${esc(s.title)}</b><small>${esc(s.description)}</small></span></button>`;
  }
  function closeDrawer(updateURL) {
    if ($('#drawer').hidden) return;
    $('#drawer').hidden = true; $('#scrim').hidden = true;
    document.body.style.overflow = '';
    document.title = 'SkillAtlas — find the right AI skill';
    state.openId = null;
    if (updateURL) writeURL(true);
    state.lastFocus?.focus?.();
  }

  const mdCache = new Map();
  async function loadMarkdown(s) {
    const box = $('#mdBox');
    try {
      let text = mdCache.get(s.id);
      if (!text) {
        const res = await fetch(rawURL(s, s.file));
        if (!res.ok) throw new Error(res.status);
        text = await res.text();
        mdCache.set(s.id, text);
      }
      if (state.openId !== s.id) return;
      const body = text.replace(/^﻿?\s*---[\s\S]*?\n---\s*/, '');
      if (window.marked && window.DOMPurify) {
        box.innerHTML = DOMPurify.sanitize(marked.parse(body.slice(0, 60000)));
        $$('a', box).forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
        $$('img', box).forEach(img => { const src = img.getAttribute('src'); if (src && !/^(https?:|data:)/.test(src)) img.src = rawURL(s, (s.path ? s.path + '/' : '') + src.replace(/^\.\//, '')); });
      } else {
        box.innerHTML = `<pre>${esc(body.slice(0, 20000))}</pre>`;
      }
    } catch {
      if (state.openId === s.id) box.innerHTML = `<p class="muted">Couldn't load the preview. <a href="${blobURL(s, s.file)}" target="_blank" rel="noopener">Open SKILL.md on GitHub ↗</a></p>`;
    }
  }

  async function downloadZip(s, btn) {
    const fallback = `https://download-directory.github.io/?url=${encodeURIComponent(treeURL(s))}`;
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Preparing…';
    const list = await getFiles(s);
    if (!list || !window.JSZip) { btn.disabled = false; btn.textContent = label; window.open(fallback, '_blank', 'noopener'); return; }
    try {
      const zip = new JSZip();
      const root = zip.folder(folderName(s));
      let done = 0;
      const files = s.path ? list : [s.file];
      await Promise.all(files.map(async f => {
        const res = await fetch(rawURL(s, (s.path ? s.path + '/' : '') + f));
        if (!res.ok) throw new Error(`${f}: ${res.status}`);
        root.file(f, await res.arrayBuffer());
        btn.textContent = `Packing ${++done}/${files.length}…`;
      }));
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `${folderName(s)}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Download started');
    } catch (e) {
      toast('Direct download failed — opening backup downloader');
      window.open(fallback, '_blank', 'noopener');
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }

  load();
})();
