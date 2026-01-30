// Market Prediction Analyzer - Refactored

const CONFIG = {
  categories: ['AI', 'Politics', 'Economics', 'Sports'],
  icons: { AI: '🤖', Politics: '🏛️', Economics: '💰', Sports: '⚽' },
  keywords: {
    AI: ['artificial intelligence', 'machine learning', 'gpt', 'chatgpt', 'ai', 'neural', 'deep learning'],
    Politics: ['election', 'president', 'congress', 'senate', 'political', 'vote', 'government', 'policy'],
    Economics: ['economy', 'inflation', 'gdp', 'stock', 'recession', 'bitcoin', 'crypto', 'finance'],
    Sports: ['nfl', 'nba', 'soccer', 'football', 'championship', 'olympics', 'baseball', 'basketball', 'tennis']
  },
  pageSize: 40,
  maxSnapshots: 120,
  storageKey: 'market_snapshots_v1'
};

class MarketAnalyzer {
  constructor() {
    this.markets = [];
    this.filtered = [];
    this.selectedCategories = new Set();
    this.lookbackDays = this.loadLookback();
    this.snapshots = [];
    this.history = new Map();
    this.offset = 0;
    this.hasMore = false;
    this.fetching = false;
    this.fetchingMore = false;
    this.pendingRefresh = false;
    this.lastFetchQuery = '';
  }

  async init() {
    this.setupEvents();
    this.renderCategories();
    document.getElementById('market-movers').classList.add('d-none');
  }

  setupEvents() {
    const $ = (id) => document.getElementById(id);
    $('btn-fetch')?.addEventListener('click', () => this.fetch());
    $('btn-load-more')?.addEventListener('click', () => this.loadMore());

    const lookback = $('lookback-period');
    if (lookback) {
      lookback.value = String(this.lookbackDays);
      lookback.addEventListener('change', () => {
        this.lookbackDays = Math.max(1, Math.min(365, parseInt(lookback.value) || 20));
        localStorage.setItem('lookback_days', String(this.lookbackDays));
        this.pendingRefresh = true;
        this.updateFetchBtn();
      });
      lookback.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const opts = lookback.options;
          let i = lookback.selectedIndex;
          lookback.selectedIndex = e.key === 'ArrowDown' ? (i + 1) % opts.length : (i - 1 + opts.length) % opts.length;
          lookback.dispatchEvent(new Event('change'));
        }
      });
    }

    const search = $('query-input');
        if (search) {
            search.addEventListener('keydown', (e) => e.key === 'Enter' && this.fetch());
        }

    this.updateFetchBtn();
    this.updateLoadMoreBtn();
  }

  renderCategories() {
    const container = document.getElementById('category-filters');
    if (!container) return;
    container.innerHTML = CONFIG.categories.map(cat => `
      <div class="col-md-6 col-xl-3">
        <div class="card h-100 demo-card" style="cursor: pointer;" data-category="${cat}">
          <div class="card-body">
            <h6 class="card-title">${CONFIG.icons[cat]} ${cat}</h6>
            <p class="card-text small text-muted">View trending prediction markets related to ${cat === 'AI' ? 'AI' : cat.toLowerCase()}.</p>
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.demo-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const cat = e.currentTarget.dataset.category;
        container.querySelectorAll('.demo-card.active, .demo-card.border-primary')
          .forEach(c => c.classList.remove('active', 'border-primary'));
        this.selectedCategories.clear();
        this.selectedCategories.add(cat);
        e.currentTarget.classList.add('active', 'border-primary');
        this.filter();
      });
    });
  }

  async fetch() {
    const query = document.getElementById('query-input')?.value || '';
    const fetchQuery = query || (this.selectedCategories.size === 1 ? [...this.selectedCategories][0] : '');
    this.fetching = true;
    this.pendingRefresh = false;
    this.offset = 0;
    this.hasMore = false;
    this.markets = [];
    this.filtered = [];
    this.lastFetchQuery = fetchQuery;
    this.updateFetchBtn();
    this.updateLoadMoreBtn();

    const $ = (id) => document.getElementById(id);
    const mc = $('markets-container');
    const sc = $('stats-container');
    if (mc) mc.innerHTML = this.skeleton(6);
    if (sc) sc.innerHTML = this.statsSkeleton();

    const mm = $('market-movers');
    if (mm) mm.classList.remove('d-none');

    const cs = $('catchup-summary');
    const cr = $('catchup-range');
    const cm = $('catchup-movers');
    const cg = $('catchup-gainers');
    const cl = $('catchup-losers');
    if (cs) cs.innerHTML = this.catchupSkeleton();
    if (cr) cr.innerHTML = '<div class="placeholder-glow"><span class="placeholder col-4"></span></div>';
    if (cm) cm.innerHTML = this.skeleton(6);
    if (cg) cg.innerHTML = this.listSkeleton();
    if (cl) cl.innerHTML = this.listSkeleton();

    try {
      const live = await this.fetchAPI(fetchQuery, 0);
      const current = this.snapshot(live);

      this.snapshots = this.prune([...await this.loadSnapshots(), current]);
      this.saveSnapshots();

      const targetTime = new Date(current.date).getTime() - (this.lookbackDays * 86400000);
      let windows = this.snapshots
        .filter(s => new Date(s.date).getTime() >= targetTime)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let past = this.closestOnDay(this.snapshots, targetTime);
      if (!past) past = await this.backfill(live, targetTime);

      if (windows.length < 2 && this.lookbackDays > 1) {
        const series = await this.backfillSeries(live, this.lookbackDays, new Date(current.date).getTime());
        windows = this.prune([...series, ...windows]).sort((a, b) => new Date(a.date) - new Date(b.date));
      }

      if (past && !windows.some(s => s.date === past.date)) windows.unshift(past);
      this.history = this.buildHistory(windows);

      this.markets = live.map(m => this.normalize(m));
      this.markets = await this.hydrate(this.markets);
      this.offset = live.length;
      this.hasMore = live.length >= CONFIG.pageSize;
      this.filtered = [...this.markets];

      await this.renderDigest(current, past);
      this.filter(query);
    } catch (err) {
      this.showAlert(`Error: ${err.message}`, 'danger');
    } finally {
      this.fetching = false;
      this.updateLoadMoreBtn();
    }
  }

  async loadMore() {
    if (this.fetching || this.fetchingMore || !this.hasMore) return;
    this.fetchingMore = true;
    this.updateLoadMoreBtn();

    try {
      const query = this.lastFetchQuery || document.getElementById('query-input')?.value || '';
      const markets = await this.fetchAPI(query, this.offset);
      if (!markets.length) {
        this.hasMore = false;
        return;
      }

      const normalized = markets.map(m => this.normalize(m));
      const hydrated = await this.hydrate(normalized);
      const ids = new Set(this.markets.map(m => m.id));
      hydrated.forEach(m => !ids.has(m.id) && this.markets.push(m));

      this.offset += markets.length;
      this.hasMore = markets.length >= CONFIG.pageSize;
      this.filter(query);
    } catch (err) {
      this.showAlert(`Error loading more: ${err.message}`, 'warning');
    } finally {
      this.fetchingMore = false;
      this.updateLoadMoreBtn();
    }
  }

  async fetchAPI(query, offset) {
    const url = `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(query)}&limit=${CONFIG.pageSize}&offset=${offset}&sort=liquidity&filter=open&contractType=ALL`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch markets');
    const markets = await res.json();
    return await this.enrich(markets);
  }

  async enrich(markets) {
    const targets = markets
      .filter(m => typeof m?.probability !== 'number' || (m.outcomeType === 'MULTIPLE_CHOICE' && !m.answers?.length))
      .sort((a, b) => (b.totalLiquidity || b.liquidity || b.volume || 0) - (a.totalLiquidity || a.liquidity || a.volume || 0))
      .slice(0, 6);

    if (!targets.length) return markets;

    const details = new Map();
    await Promise.all(targets.map(async m => {
      try {
        const res = await fetch(`https://api.manifold.markets/v0/market/${m.id}`);
        if (res.ok) details.set(m.id, await res.json());
      } catch { }
    }));

    return markets.map(m => details.get(m.id) || m);
  }

  async hydrate(markets) {
    const targets = markets
      .filter(m => m.outcomeType === 'MULTIPLE_CHOICE' && !m.answers?.length)
      .slice(0, 4);
    if (!targets.length) return markets;

    const details = new Map();
    await Promise.all(targets.map(async m => {
      try {
        const res = await fetch(`https://api.manifold.markets/v0/market/${m.id}`);
        if (res.ok) details.set(m.id, await res.json());
      } catch { }
    }));

    return markets.map(m => details.has(m.id) ? this.normalize(details.get(m.id)) : m);
  }

  normalize(m) {
    const prob = this.prob(m);
    const answers = (m.answers || []).map(a => ({
      id: a.id,
      text: a.text || a.name || 'Unknown',
      probability: this.normalizeProb(a.probability ?? a.prob),
      isResolved: Boolean(a.isResolved || a.resolution)
    }));

    return {
      id: m.id,
      source: 'manifold',
      question: m.question,
      probability: prob,
      volume: m.volume || 0,
      participants: m.uniqueBettorCount || 0,
      url: m.url,
      createdTime: m.createdTime,
      closeTime: m.closeTime,
      isResolved: m.isResolved,
      resolution: m.resolution,
      tags: this.tags(m.question),
      liquidity: m.totalLiquidity || 0,
      outcomeType: m.outcomeType,
      answers
    };
  }

  prob(m) {
    if (typeof m?.probability === 'number') return m.probability;
    if (m.answers?.length) {
      const max = m.answers.reduce((best, curr) =>
        typeof curr.probability === 'number' && (!best || curr.probability > best.probability) ? curr : best, null);
      if (max?.probability) return max.probability;
    }
    return 0;
  }

  normalizeProb(val) {
    if (typeof val !== 'number' || !isFinite(val)) return null;
    return Math.min(Math.max(val > 1 ? val / 100 : val, 0), 1);
  }

  tags(text) {
    const tags = [];
    const lower = text.toLowerCase();
    CONFIG.categories.forEach(cat => {
      if (CONFIG.keywords[cat].some(kw => lower.includes(kw)) && !tags.includes(cat)) {
        tags.push(cat);
      }
    });
    return tags;
  }

  snapshot(markets) {
    return {
      date: new Date().toISOString(),
      markets: markets.map(m => ({
        id: m.id,
        question: m.question,
        probability: this.prob(m),
        participants: m.uniqueBettorCount || 0,
        url: m.url,
        createdTime: m.createdTime,
        closeTime: m.closeTime,
        volume: m.volume || 0,
        liquidity: m.totalLiquidity || 0,
        isResolved: Boolean(m.isResolved),
        resolution: m.resolution,
        outcomeType: m.outcomeType,
        answers: (m.answers || []).map(a => ({
          id: a.id,
          text: a.text || a.name || 'Unknown',
          probability: this.normalizeProb(a.probability ?? a.prob),
          isResolved: Boolean(a.isResolved || a.resolution)
        }))
      }))
    };
  }

  async loadSnapshots() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveSnapshots() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.snapshots));
    } catch { }
  }

  prune(snapshots) {
    const unique = new Map();
    snapshots.forEach(s => s?.date && Array.isArray(s?.markets) && unique.set(s.date, s));
    const sorted = Array.from(unique.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
    return sorted.length > CONFIG.maxSnapshots ? sorted.slice(-CONFIG.maxSnapshots) : sorted;
  }

  closest(snapshots, targetTime) {
    const candidates = snapshots
      .map(s => ({ s, ts: new Date(s.date).getTime() }))
      .filter(x => x.ts <= targetTime)
      .sort((a, b) => b.ts - a.ts);
    return candidates[0]?.s || null;
  }

  closestOnDay(snapshots, targetTime) {
    const target = new Date(targetTime);
    const sameDay = (d) =>
      d.getFullYear() === target.getFullYear() &&
      d.getMonth() === target.getMonth() &&
      d.getDate() === target.getDate();

    const candidates = snapshots
      .map(s => ({ s, ts: new Date(s.date).getTime() }))
      .filter(x => sameDay(new Date(x.ts)))
      .sort((a, b) => Math.abs(a.ts - targetTime) - Math.abs(b.ts - targetTime));

    return candidates[0]?.s || null;
  }

  buildHistory(snapshots) {
    const history = new Map();
    snapshots.forEach(snap => {
      const ts = new Date(snap.date).getTime();
      snap.markets.forEach(m => {
        if (!m?.id || typeof m.probability !== 'number') return;
        if (!history.has(m.id)) history.set(m.id, []);
        history.get(m.id).push({ ts, p: m.probability });
      });
    });
    history.forEach(series => series.sort((a, b) => a.ts - b.ts));
    return history;
  }

  trend(id) {
    const series = this.history.get(id) || [];
    if (series.length < 2) {
      if (series.length === 1) {
        const p = series[0].p;
        return { series: [series[0], { ts: series[0].ts + 1, p }], delta: 0, start: p, end: p, swing: 0 };
      }
      return null;
    }

    const start = series[0];
    const end = series[series.length - 1];
    const delta = (end.p - start.p) * 100;

    let swing = 0;
    for (let i = 1; i < series.length; i++) {
      swing += Math.abs((series[i].p - series[i - 1].p) * 100);
    }

    return { series, delta, start: start.p, end: end.p, swing: swing / Math.max(series.length - 1, 1) };
  }

  async backfill(markets, targetTime) {
    if (!markets.length) return null;
    const targets = markets;

    const results = await Promise.all(targets.map(async m => {
      const prob = await this.fetchHist(m.id, targetTime);
      if (prob === null) return null;
      const snap = this.snapshot([m]).markets[0];
      snap.probability = prob;
      return snap;
    }));

    const valid = results.filter(Boolean);
    return valid.length ? { date: new Date(targetTime).toISOString(), markets: valid } : null;
  }

  async backfillSeries(markets, days, baseTime) {
    if (!markets.length) return [];
    const targets = markets.slice(0, 20);
    const snapshots = [];
    const lastKnown = new Map();
    const points = Math.min(days, 2);

    for (let offset = points; offset >= 1; offset--) {
      const ts = baseTime - (offset * 86400000);
      const results = await Promise.all(targets.map(async m => {
        let prob = await this.fetchHist(m.id, ts);
        if (prob === null && lastKnown.has(m.id)) prob = lastKnown.get(m.id);
        if (prob === null) return null;
        const snap = this.snapshot([m]).markets[0];
        snap.probability = prob;
        lastKnown.set(m.id, prob);
        return snap;
      }));

      const valid = results.filter(Boolean);
      if (valid.length) snapshots.push({ date: new Date(ts).toISOString(), markets: valid });
    }

    return snapshots;
  }

  async fetchHist(id, timestamp) {
    try {
      const url = `https://api.manifold.markets/v0/bets?contractId=${id}&beforeTime=${timestamp}&limit=1&order=desc`;
      const res = await fetch(url);
      if (res.ok) {
        const bets = await res.json();
        return bets?.[0]?.probAfter ?? null;
      }
      return null;
    } catch {
      return null;
    }
  }

  filter(query = '') {
    this.filtered = this.markets.filter(m => {
      const matchQuery = !query || m.question.toLowerCase().includes(query.toLowerCase());
      const matchCat = !this.selectedCategories.size || m.tags.some(t => this.selectedCategories.has(t));
      return matchQuery && matchCat;
    });

    this.filtered.sort((a, b) => {
      const aTrend = this.trend(a.id);
      const bTrend = this.trend(b.id);
      return (bTrend ? Math.abs(bTrend.delta) : 0) - (aTrend ? Math.abs(aTrend.delta) : 0);
    });

    this.display();
    this.displayStats();
    this.updateLoadMoreBtn();
    if (this.filtered.length < 30 && this.hasMore && !this.fetching && !this.fetchingMore) this.loadMore();
  }

  display() {
    const container = document.getElementById('markets-container');
    if (!container) return;

    if (!this.filtered.length) {
      container.innerHTML = '<div class="col-12"><div class="alert alert-info border-0 bg-info-subtle text-info-emphasis">No markets found. Try adjusting your filters or search query.</div></div>';
      return;
    }

    container.innerHTML = this.filtered.map((m, i) => this.card(m, i)).join('');
  }

  card(m) {
    const prob = typeof m.probability === 'number' ? Math.round(m.probability * 100) : null;
    const url = this.url(m);
    const trend = this.trend(m.id);

    // Calculate display values
    const delta = trend ? `${trend.delta >= 0 ? '+' : ''}${Math.round(trend.delta)} pts` : null;
    const deltaClass = trend && trend.delta >= 0 ? 'delta-up' : 'delta-down';
    const vol = trend ? (trend.swing < 2 ? 'Stable' : trend.swing < 6 ? 'Active' : 'Choppy') : null;

    // IMPORTANT: Always use current probability for 'Now', historical for 'Then'
    const thenProb = trend ? Math.round(trend.start * 100) : prob;
    const nowProb = prob; // Always use current live probability
    const badge = (v) => v > 70 ? 'prob-high' : v < 30 ? 'prob-low' : 'prob-mid';

    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 demo-card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="prob-badge ${badge(thenProb)}">Then ${thenProb ?? '—'}%</span>
              <span class="prob-badge ${badge(nowProb)}">Now ${nowProb ?? '—'}%</span>
            </div>
            <h6 class="card-title mb-3"><a href="${url}" target="_blank" rel="noopener" class="text-decoration-none text-reset stretched-link">${m.question}</a></h6>
            ${this.answerHighlights(m)}
            <div class="market-meta small text-muted">
              <div class="market-meta-row"><span>Status</span><span>${m.isResolved ? 'resolved' : 'open'}</span></div>
              <div class="market-meta-row"><span>Closes</span><span>${this.fmt(m.closeTime)}</span></div>
              <div class="market-meta-row"><span>Volume</span><span>${this.compact(m.volume)}</span></div>
              <div class="market-meta-row"><span>Liquidity</span><span>${this.compact(m.liquidity)}</span></div>
            </div>
            ${trend ? `
              <div class="feed-trend d-flex align-items-center justify-content-between mb-2">
                <span class="delta-pill ${deltaClass}">${delta}</span>
                <span class="trend-meta text-muted small">${vol} · ${this.lookbackDays}d</span>
              </div>
              ${this.sparkline(trend.series)}
            ` : `
              <div class="d-flex justify-content-between align-items-center text-muted small mt-2">
                <span><i class="bi bi-people me-1"></i> ${m.participants}</span>
                <span><i class="bi bi-calendar me-1"></i> ${new Date(m.createdTime).toLocaleDateString()}</span>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  answerHighlights(m) {
    if (!m.answers?.length) return '';
    const candidates = m.answers.filter(a => typeof a.probability === 'number');
    const unresolved = candidates.filter(a => !a.isResolved);
    const top = (unresolved.length ? unresolved : candidates)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 3);
    if (!top.length) return '';

    return `
      <div class="answer-highlights mb-2">
        <div class="small text-muted">Top options</div>
        ${top.map(a => `
          <div class="answer-row">
            <span class="answer-text">${a.text}</span>
            <span class="answer-prob">${Math.round(a.probability * 100)}%</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  sparkline(series) {
    if (!series || series.length < 2) return '';
    const vals = series.map(p => p.p);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;

    const points = series.map((p, i) => {
      const x = (i / (series.length - 1)) * 100;
      const y = 24 - ((p.p - min) / range) * 24;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');

    const area = `0,24 ${points} 100,24`;
    const [lastX, lastY] = points.split(' ').slice(-1)[0].split(',').map(Number);
    const gid = `g${Math.random().toString(36).slice(2, 8)}`;
    const delta = series[series.length - 1].p - series[0].p;
    const cls = Math.abs(delta) < 0.001 ? 'sparkline-neutral' : (delta > 0 ? 'sparkline-up' : 'sparkline-down');

    return `
      <svg class="sparkline ${cls}" viewBox="0 0 100 24" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.35"></stop>
            <stop offset="100%" stop-color="currentColor" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        <line class="sparkline-grid" x1="0" y1="2" x2="100" y2="2"></line>
        <line class="sparkline-grid" x1="0" y1="12" x2="100" y2="12"></line>
        <line class="sparkline-grid" x1="0" y1="22" x2="100" y2="22"></line>
        <polyline class="sparkline-area" fill="url(#${gid})" stroke="none" points="${area}"></polyline>
        <polyline class="sparkline-line" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="${points}"></polyline>
        ${Number.isFinite(lastX) && Number.isFinite(lastY) ? `<circle class="sparkline-dot" cx="${lastX}" cy="${lastY}" r="1.8"></circle>` : ''}
      </svg>
    `;
  }

  displayStats() {
    const container = document.getElementById('stats-container');
    if (!container) return;

    const total = this.filtered.length;
    const avg = total ? Math.round((this.filtered.reduce((s, m) => s + m.probability, 0) / total) * 100) : 0;
    const high = this.filtered.filter(m => m.probability > 0.7 || m.probability < 0.3).length;
    const avgPart = total ? this.filtered.reduce((s, m) => s + m.participants, 0) / total : 0;
    const trending = this.filtered.filter(m => m.participants > avgPart).length;

    container.innerHTML = `
      <div class="col-md-3">
        <div class="card h-100 text-center p-3 border-light-subtle">
          <div class="h2 mb-0 text-primary">${total}</div>
          <small class="text-muted text-uppercase">Total Markets</small>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card h-100 text-center p-3 border-light-subtle">
          <div class="h2 mb-0 text-info">${avg}%</div>
          <small class="text-muted text-uppercase">Average Probability</small>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card h-100 text-center p-3 border-light-subtle">
          <div class="h2 mb-0 text-success">${high}</div>
          <small class="text-muted text-uppercase">High-Confidence</small>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card h-100 text-center p-3 border-light-subtle">
          <div class="h2 mb-0 text-warning">${trending}</div>
          <small class="text-muted text-uppercase">Trending Markets</small>
        </div>
      </div>
    `;
  }

  async renderDigest(current, past) {
    const $ = (id) => document.getElementById(id);
    const summary = $('catchup-summary');
    const range = $('catchup-range');
    const movers = $('catchup-movers');
    const gainers = $('catchup-gainers');
    const losers = $('catchup-losers');

    if (!summary || !range || !movers || !gainers || !losers) return;

    const cd = new Date(current.date);
    const pd = past ? new Date(past.date) : null;
    range.textContent = `Lookback: ${pd ? pd.toLocaleDateString() : cd.toLocaleDateString()} → ${cd.toLocaleDateString()}`;

    if (!past) {
      summary.innerHTML = `<div class="alert alert-info border-0"><strong>Catch-up Engine warming up.</strong> Capture at least two real snapshots within ${this.lookbackDays} days to compute movers.</div>`;
      movers.innerHTML = gainers.innerHTML = losers.innerHTML = '';
      return;
    }

    const filtCurr = this.filterSnap(current.markets);
    const filtPast = this.filterSnap(past.markets);
    const pastMap = new Map(filtPast.map(m => [m.id, m]));

    const changes = filtCurr.map(m => {
      const p = pastMap.get(m.id);
      if (!p || typeof p.probability !== 'number' || typeof m.probability !== 'number') return null;
      const delta = (m.probability - p.probability) * 100;
      return {
        id: m.id,
        question: m.question,
        url: this.url(m),
        current: m.probability,
        past: p.probability,
        delta,
        abs: Math.abs(delta),
        participants: m.participants || 0,
        trend: this.trend(m.id)
      };
    }).filter(Boolean);

    if (!changes.length) {
      summary.innerHTML = `<div class="alert alert-warning border-0"><strong>No overlapping markets yet.</strong> We need two snapshots with matching market IDs to compute movers.</div>`;
      movers.innerHTML = '';
      gainers.innerHTML = this.moverList([], 'Top Gainers');
      losers.innerHTML = this.moverList([], 'Top Losers');
      return;
    }

    const sorted = changes.sort((a, b) => b.abs - a.abs);
    const top = sorted.slice(0, 6);
    const topG = sorted.filter(m => m.delta > 0).slice(0, 10);
    const topL = sorted.filter(m => m.delta < 0).slice(0, 10);

    const currMap = new Map(filtCurr.map(m => [m.id, m]));
    const topMarkets = top.map(t => currMap.get(t.id)).filter(Boolean).map(m => this.normalize(m));

    summary.innerHTML = `
      <div class="digest-summary">
        <div class="digest-kicker">Catch-up Digest</div>
        <h3 class="digest-headline mb-2">Here is what changed the most while you were away.</h3>
        <p class="text-muted mb-0">Largest swings are calculated from the absolute probability change over the last ${this.lookbackDays} days.</p>
      </div>
    `;

    movers.innerHTML = topMarkets.map((m, i) => this.card(m, i)).join('');
    gainers.innerHTML = this.moverList(topG, 'Top Gainers');
    losers.innerHTML = this.moverList(topL, 'Top Losers');
  }

  filterSnap(markets) {
    if (!this.selectedCategories.size) return markets;
    return markets.filter(m => {
      const tags = m.tags || this.tags(m.question || '');
      return tags.some(t => this.selectedCategories.has(t));
    });
  }

  moverList(items, title) {
    if (!items.length) {
      return `
        <div class="card h-100 digest-list-card">
          <div class="card-body">
            <h5 class="card-title mb-3">${title}</h5>
            <p class="text-muted mb-0">No significant movers detected for this period.</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="card h-100 digest-list-card">
        <div class="card-body">
          <h5 class="card-title mb-3">${title}</h5>
          <ul class="list-unstyled digest-list mb-0">
            ${items.map(item => {
      const delta = Math.round(item.delta);
      const cls = delta >= 0 ? 'delta-up' : 'delta-down';
      const label = `${delta >= 0 ? '+' : ''}${delta} pts`;
      return `
                <li>
                  <a href="${item.url}" target="_blank" rel="noopener" class="text-decoration-none text-reset">${item.question}</a>
                  <span class="delta-pill ${cls}">${label}</span>
                </li>
              `;
    }).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  url(m) {
    const raw = m?.url || '';
    const isPlaceholder = /manifold\.markets\/example/i.test(raw);
    if (raw && !isPlaceholder) return raw;
    const q = encodeURIComponent(m?.question || '');
    return q ? `https://manifold.markets/search?q=${q}` : 'https://manifold.markets/';
  }

  updateFetchBtn() {
    const btn = document.getElementById('btn-fetch');
    if (!btn) return;
    btn.textContent = this.pendingRefresh ? 'Fetch update' : 'Fetch';
    btn.classList.toggle('btn-warning', this.pendingRefresh);
    btn.classList.toggle('btn-primary', !this.pendingRefresh);
  }

  updateLoadMoreBtn() {
    const container = document.getElementById('load-more-container');
    const btn = document.getElementById('btn-load-more');
    if (!container || !btn) return;

    const show = this.hasMore && this.markets.length > 0;
    container.classList.toggle('d-none', !show);
    btn.disabled = this.fetchingMore || this.fetching;
    btn.innerHTML = this.fetchingMore
      ? '<span class="spinner-border spinner-border-sm me-2"></span>Loading...'
      : 'Load more';
  }

  showAlert(msg, type = 'success') {
    const container = document.getElementById('alert-container');
    if (!container) return;

    const id = 'alert-' + Date.now();
    const icons = { success: 'check-circle-fill', info: 'info-circle-fill', warning: 'exclamation-triangle-fill', danger: 'x-circle-fill' };
    const icon = icons[type] || icons.success;

    container.insertAdjacentHTML('beforeend', `
      <div id="${id}" class="custom-toast ${type} shadow-lg">
        <div class="toast-content">
          <i class="bi bi-${icon} toast-icon"></i>
          <span class="toast-message">${msg}</span>
        </div>
        <button type="button" class="btn-close ms-3" onclick="this.parentElement.classList.add('toast-exit'); setTimeout(() => this.parentElement.remove(), 300);"></button>
      </div>
    `);

    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('toast-exit');
        setTimeout(() => el.remove(), 300);
      }
    }, 3500);
  }

  skeleton(count) {
    return Array(count).fill(0).map(() => `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 demo-card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2 placeholder-glow">
              <span class="placeholder col-4"></span>
              <span class="placeholder col-3"></span>
            </div>
            <div class="placeholder-glow mb-3">
              <span class="placeholder col-12"></span>
              <span class="placeholder col-9"></span>
            </div>
            <div class="d-flex justify-content-between align-items-center placeholder-glow">
              <span class="placeholder col-4"></span>
              <span class="placeholder col-4"></span>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  statsSkeleton() {
    return Array(4).fill(0).map(() => `
      <div class="col-md-3">
        <div class="card h-100 text-center p-3 border-light-subtle">
          <div class="h2 mb-0 placeholder-glow"><span class="placeholder col-4 text-secondary"></span></div>
          <small class="text-muted text-uppercase placeholder-glow"><span class="placeholder col-6"></span></small>
        </div>
      </div>
    `).join('');
  }

  catchupSkeleton() {
    return '<div class="placeholder-glow"><span class="placeholder col-3"></span><span class="placeholder col-8 d-block mt-2"></span></div>';
  }

  listSkeleton() {
    return `
      <div class="card h-100 digest-list-card">
        <div class="card-body">
          <div class="placeholder-glow mb-3"><span class="placeholder col-5"></span></div>
          <ul class="list-unstyled digest-list mb-0">
            ${Array(3).fill(0).map(() => '<li class="placeholder-glow"><span class="placeholder col-8"></span><span class="placeholder col-3"></span></li>').join('')}
          </ul>
        </div>
      </div>
    `;
  }

  loadLookback() {
    const raw = localStorage.getItem('lookback_days');
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 365) : 7;
  }

  compact(val) {
    if (typeof val !== 'number' || !isFinite(val)) return 'n/a';
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(val);
  }

  fmt(val) {
    if (!val) return 'n/a';
    const d = new Date(val);
    return isNaN(d.getTime()) ? 'n/a' : d.toLocaleDateString();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const analyzer = new MarketAnalyzer();
  analyzer.init();
});
