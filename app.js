// Market Prediction Analyzer - Main Application Logic

class MarketAnalyzer {
    constructor() {
        this.currentMarkets = [];
        this.filteredMarkets = [];
        this.categories = ['AI', 'Politics', 'Economics', 'Sports'];
        this.selectedCategories = new Set();
        this.currentSource = 'manifold';
        this.fetchCounter = 0;
        this.activeFetchId = 0;
        this.isFetching = false;
        this.hasPendingRefresh = false;
        this.snapshots = [];
        this.localSnapshotKey = 'market_snapshots_v1';
        this.lookbackDays = this.loadLookbackDays();
        this.currentSnapshotDate = null;
        this.pastSnapshotDate = null;
        this.marketHistory = new Map();
        this.stats = {
            totalMarkets: 0,
            avgProbability: 0,
            highConfidence: 0,
            trending: 0
        };
    }

    async initialize() {
        this.setupEventListeners();
        this.renderCategoryFilters();
        const marketMovers = document.getElementById('market-movers');
        if (marketMovers) {
            marketMovers.classList.add('d-none');
        }
    }

    setupEventListeners() {
        document.getElementById('btn-fetch')?.addEventListener('click', () => this.fetchMarkets());
        document.getElementById('btn-export-feed')?.addEventListener('click', () => this.exportFeed());

        const lookbackSelect = document.getElementById('lookback-period');
        if (lookbackSelect) {
            lookbackSelect.value = String(this.lookbackDays);
            lookbackSelect.addEventListener('change', () => {
                const nextValue = parseInt(lookbackSelect.value, 10);
                this.lookbackDays = Number.isFinite(nextValue) ? nextValue : 10;
                localStorage.setItem('lookback_days', String(this.lookbackDays));
                this.hasPendingRefresh = true;
                this.updateFetchButtonState();
            });

            // Circular navigation with Arrow keys
            lookbackSelect.addEventListener('keydown', (e) => {
                const isArrowUp = e.key === 'ArrowUp';
                const isArrowDown = e.key === 'ArrowDown';

                if (isArrowUp || isArrowDown) {
                    e.preventDefault();
                    const options = lookbackSelect.options;
                    let index = lookbackSelect.selectedIndex;

                    if (isArrowDown) {
                        index = (index + 1) % options.length;
                    } else {
                        index = (index - 1 + options.length) % options.length;
                    }

                    lookbackSelect.selectedIndex = index;
                    // Connect the UI change to the logic
                    lookbackSelect.dispatchEvent(new Event('change'));
                }
            });
        }

        // Search with debounce
        const searchInput = document.getElementById('query-input');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filterMarkets(e.target.value);
                }, 500);
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.fetchMarkets();
                }
            });
        }

        this.updateFetchButtonState();
    }

    showAlert(message, type = 'success') {
        const container = document.getElementById('alert-container');
        if (!container) return;

        const alertId = 'alert-' + Date.now();
        const icons = {
            success: 'check-circle-fill',
            info: 'info-circle-fill',
            warning: 'exclamation-triangle-fill',
            danger: 'x-circle-fill'
        };
        const icon = icons[type] || icons.success;

        const html = `
            <div id="${alertId}" class="custom-toast ${type} shadow-lg" role="alert">
                <div class="toast-content">
                    <i class="bi bi-${icon} toast-icon"></i>
                    <span class="toast-message">${message}</span>
                </div>
                <button type="button" class="btn-close ms-3" aria-label="Close" onclick="this.parentElement.classList.add('toast-exit'); setTimeout(() => this.parentElement.remove(), 300);"></button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', html);

        // Auto remove after 3.5 seconds
        setTimeout(() => {
            const el = document.getElementById(alertId);
            if (el) {
                el.classList.add('toast-exit');
                setTimeout(() => el.remove(), 300);
            }
        }, 3500);
    }

    renderCategoryFilters() {
        const container = document.getElementById('category-filters');
        if (!container) return;

        // Render categories as "Demo Card" style templates
        container.innerHTML = this.categories.map((category, index) => `
            <div class="col-md-6 col-xl-3">
                <div class="card h-100 demo-card" style="cursor: pointer;" data-category="${category}">
                    <div class="card-body">
                        <h6 class="card-title">${this.getCategoryIcon(category)} ${category}</h6>
                        <p class="card-text small text-muted">View trending prediction markets related to ${category === 'AI' ? 'AI' : category.toLowerCase()}.</p>
                    </div>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.demo-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;

                // Single-select category: clear previous selection
                container.querySelectorAll('.demo-card.active, .demo-card.border-primary')
                    .forEach(activeCard => activeCard.classList.remove('active', 'border-primary'));
                this.selectedCategories.clear();
                this.selectedCategories.add(category);
                e.currentTarget.classList.add('active', 'border-primary');

                this.filterMarkets();
            });
        });
    }

    getCategoryIcon(category) {
        const icons = {
            'AI': '🤖',
            'Politics': '🏛️',
            'Economics': '💰',
            'Sports': '⚽'
        };
        return icons[category] || '📊';
    }

    toggleCategory(category) {
        // Redundant with new click handler but kept for logic structure if needed
        if (this.selectedCategories.has(category)) {
            this.selectedCategories.delete(category);
        } else {
            this.selectedCategories.add(category);
        }
        this.filterMarkets();
    }

    async fetchMarkets() {
        const query = document.getElementById('query-input')?.value || '';
        const fetchId = ++this.fetchCounter;
        this.activeFetchId = fetchId;
        this.isFetching = true;
        this.hasPendingRefresh = false;
        this.updateFetchButtonState();

        // Clear State & UI
        this.currentMarkets = [];
        this.filteredMarkets = [];

        const marketsContainer = document.getElementById('markets-container');
        if (marketsContainer) marketsContainer.innerHTML = this.renderMarketSkeletons(6);

        const statsContainer = document.getElementById('stats-container');
        if (statsContainer) statsContainer.innerHTML = this.renderStatsSkeleton();

        const marketMovers = document.getElementById('market-movers');
        if (marketMovers) {
            marketMovers.classList.remove('d-none');
        }

        const catchupSummary = document.getElementById('catchup-summary');
        const catchupRange = document.getElementById('catchup-range');
        const catchupMovers = document.getElementById('catchup-movers');
        const catchupGainers = document.getElementById('catchup-gainers');
        const catchupLosers = document.getElementById('catchup-losers');

        if (catchupSummary && catchupRange && catchupMovers && catchupGainers && catchupLosers) {
            catchupSummary.innerHTML = this.renderCatchupSummarySkeleton();
            catchupRange.innerHTML = this.renderCatchupRangeSkeleton();
            catchupMovers.innerHTML = this.renderCatchupMoversSkeleton(6);
            catchupGainers.innerHTML = this.renderCatchupListSkeleton();
            catchupLosers.innerHTML = this.renderCatchupListSkeleton();
        }

        this.showLoading(true);

        try {
            // 1. Fetch Live Data
            const liveMarkets = await this.fetchManifoldMarkets(query);
            const currentSnapshot = this.buildSnapshotFromLive(liveMarkets);
            const snapshots = await this.loadSnapshots();
            const merged = this.mergeSnapshotArrays(snapshots, [currentSnapshot]);
            const cleaned = this.pruneSnapshots(merged);
            this.saveSnapshots(cleaned);
            this.snapshots = cleaned;

            const targetTime = new Date(currentSnapshot.date).getTime() - (this.lookbackDays * 24 * 60 * 60 * 1000);
            let windowSnapshots = cleaned
                .filter(snapshot => new Date(snapshot.date).getTime() >= targetTime)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            let pastSnapshot = this.findClosestSnapshot(cleaned, targetTime);
            if (!pastSnapshot) {
                pastSnapshot = await this.backfillHistory(liveMarkets, this.lookbackDays, 4);
            }

            if (windowSnapshots.length < 2 && this.lookbackDays > 1) {
                const seriesSnapshots = await this.backfillHistorySeries(
                    liveMarkets,
                    this.lookbackDays,
                    new Date(currentSnapshot.date).getTime(),
                    4,
                    2
                );
                windowSnapshots = this.mergeSnapshotArrays(seriesSnapshots, windowSnapshots)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            }

            if (pastSnapshot && !windowSnapshots.some(snapshot => snapshot.date === pastSnapshot.date)) {
                windowSnapshots.unshift(pastSnapshot);
            }

            this.marketHistory = this.buildMarketHistory(windowSnapshots);

            this.currentSnapshotDate = currentSnapshot.date;
            this.pastSnapshotDate = pastSnapshot?.date || null;

            this.currentMarkets = liveMarkets.map(m => this.normalizeManifoldMarket(m));
            this.currentMarkets = await this.hydrateMissingAnswers(this.currentMarkets);
            this.filteredMarkets = [...this.currentMarkets];

            await this.renderCatchupDigest(currentSnapshot, pastSnapshot, query);

            this.filterMarkets(query);
            this.isFetching = false;

        } catch (error) {
            this.showError(`Error fetching data: ${error.message}`);
        } finally {
            if (this.activeFetchId === fetchId) this.isFetching = false;
            this.showLoading(false);
        }
    }

    updateFetchButtonState() {
        const fetchButton = document.getElementById('btn-fetch');
        if (!fetchButton) return;
        fetchButton.textContent = this.hasPendingRefresh ? 'Fetch update' : 'Fetch';
        fetchButton.classList.toggle('btn-warning', this.hasPendingRefresh);
        fetchButton.classList.toggle('btn-primary', !this.hasPendingRefresh);
    }

    renderMarketSkeletons(count = 6) {
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

    renderStatsSkeleton() {
        return Array(4).fill(0).map(() => `
            <div class="col-md-3">
                <div class="card h-100 text-center p-3 border-light-subtle">
                    <div class="h2 mb-0 placeholder-glow">
                        <span class="placeholder col-4 text-secondary"></span>
                    </div>
                    <small class="text-muted text-uppercase placeholder-glow">
                        <span class="placeholder col-6"></span>
                    </small>
                </div>
            </div>
        `).join('');
    }

    renderCatchupSummarySkeleton() {
        return `
            <div class="placeholder-glow">
                <span class="placeholder col-3"></span>
                <span class="placeholder col-8 d-block mt-2"></span>
            </div>
        `;
    }

    renderCatchupRangeSkeleton() {
        return `
            <div class="placeholder-glow">
                <span class="placeholder col-4"></span>
            </div>
        `;
    }

    renderCatchupMoversSkeleton(count = 6) {
        return Array(count).fill(0).map(() => `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 demo-card">
                    <div class="card-body">
                        <div class="placeholder-glow mb-2">
                            <span class="placeholder col-4"></span>
                            <span class="placeholder col-3 ms-2"></span>
                        </div>
                        <div class="placeholder-glow mb-3">
                            <span class="placeholder col-12"></span>
                            <span class="placeholder col-9"></span>
                        </div>
                        <div class="placeholder-glow">
                            <span class="placeholder col-6"></span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderCatchupListSkeleton() {
        return `
            <div class="card h-100 digest-list-card">
                <div class="card-body">
                    <div class="placeholder-glow mb-3">
                        <span class="placeholder col-5"></span>
                    </div>
                    <ul class="list-unstyled digest-list mb-0">
                        ${Array(3).fill(0).map(() => `
                            <li class="placeholder-glow">
                                <span class="placeholder col-8"></span>
                                <span class="placeholder col-3"></span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    // Skip fetch functions as they are logic only...

    async loadSnapshots() {
        const remoteSnapshots = await this.loadRemoteSnapshots();
        const localSnapshots = this.loadLocalSnapshots();
        const merged = this.mergeSnapshotArrays(remoteSnapshots, localSnapshots);
        const cleaned = this.pruneSnapshots(merged);
        this.snapshots = cleaned;
        return cleaned;
    }

    async loadRemoteSnapshots() {
        // Remote snapshots not used - data is stored locally in localStorage
        return [];
    }

    loadLocalSnapshots() {
        try {
            const raw = localStorage.getItem(this.localSnapshotKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    saveSnapshots(snapshots) {
        try {
            localStorage.setItem(this.localSnapshotKey, JSON.stringify(snapshots));
        } catch (error) {
            console.warn('Could not persist snapshots locally.', error);
        }
    }

    loadLookbackDays() {
        const raw = localStorage.getItem('lookback_days');
        const parsed = parseInt(raw, 10);
        if (!Number.isFinite(parsed)) return 20;
        return Math.min(Math.max(parsed, 1), 365);
    }

    mergeSnapshotArrays(primary, secondary) {
        const merged = new Map();
        [...primary, ...secondary].forEach(snapshot => {
            if (!snapshot?.date || !Array.isArray(snapshot?.markets)) return;
            merged.set(snapshot.date, snapshot);
        });
        return Array.from(merged.values());
    }

    pruneSnapshots(snapshots, maxSnapshots = 120) {
        const sorted = [...snapshots].sort((a, b) => {
            const aTime = new Date(a.date).getTime();
            const bTime = new Date(b.date).getTime();
            return aTime - bTime;
        });
        if (sorted.length <= maxSnapshots) return sorted;
        return sorted.slice(sorted.length - maxSnapshots);
    }

    buildMarketHistory(snapshots) {
        const history = new Map();
        snapshots.forEach(snapshot => {
            const ts = new Date(snapshot.date).getTime();
            snapshot.markets.forEach(market => {
                if (!market?.id || typeof market.probability !== 'number') return;
                if (!history.has(market.id)) history.set(market.id, []);
                history.get(market.id).push({ ts, p: market.probability });
            });
        });
        history.forEach(series => {
            series.sort((a, b) => a.ts - b.ts);
        });
        return history;
    }

    findClosestSnapshot(snapshots, targetTime) {
        const candidates = snapshots
            .map(snapshot => ({
                snapshot,
                ts: new Date(snapshot.date).getTime()
            }))
            .filter(item => item.ts <= targetTime)
            .sort((a, b) => b.ts - a.ts);
        return candidates.length ? candidates[0].snapshot : null;
    }

    getMarketTrendInfo(marketId) {
        const series = this.marketHistory.get(marketId) || [];
        if (series.length < 2) return null;

        const start = series[0];
        const end = series[series.length - 1];
        const delta = (end.p - start.p) * 100;

        let totalSwing = 0;
        for (let i = 1; i < series.length; i += 1) {
            totalSwing += Math.abs((series[i].p - series[i - 1].p) * 100);
        }
        const avgSwing = totalSwing / Math.max(series.length - 1, 1);

        return {
            series,
            delta,
            start: start.p,
            end: end.p,
            avgSwing
        };
    }

    renderSparkline(series, className = '') {
        if (!series || series.length < 2) return '';
        const values = series.map(point => point.p);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;

        const points = series.map((point, index) => {
            const x = (index / (series.length - 1)) * 100;
            const y = 24 - ((point.p - min) / range) * 24;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ');

        const areaPoints = `0,24 ${points} 100,24`;
        const lastPoint = points.split(' ').slice(-1)[0] || '';
        const [lastX, lastY] = lastPoint.split(',').map(Number);
        const gradientId = `sparkline-grad-${Math.random().toString(36).slice(2, 8)}`;
        const delta = series[series.length - 1].p - series[0].p;
        const trendClass = Math.abs(delta) < 0.001
            ? 'sparkline-neutral'
            : (delta > 0 ? 'sparkline-up' : 'sparkline-down');

        return `
            <svg class="sparkline ${trendClass} ${className}" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                    <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="currentColor" stop-opacity="0.35"></stop>
                        <stop offset="100%" stop-color="currentColor" stop-opacity="0"></stop>
                    </linearGradient>
                </defs>
                <line class="sparkline-grid" x1="0" y1="2" x2="100" y2="2"></line>
                <line class="sparkline-grid" x1="0" y1="12" x2="100" y2="12"></line>
                <line class="sparkline-grid" x1="0" y1="22" x2="100" y2="22"></line>
                <polyline class="sparkline-area" fill="url(#${gradientId})" stroke="none" points="${areaPoints}"></polyline>
                <polyline class="sparkline-line" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="${points}"></polyline>
                ${Number.isFinite(lastX) && Number.isFinite(lastY) ? `<circle class="sparkline-dot" cx="${lastX.toFixed(2)}" cy="${lastY.toFixed(2)}" r="1.8"></circle>` : ''}
            </svg>
        `;
    }

    formatCompactNumber(value) {
        if (typeof value !== 'number' || !isFinite(value)) return 'n/a';
        return new Intl.NumberFormat('en', {
            notation: 'compact',
            maximumFractionDigits: 1
        }).format(value);
    }

    formatOutcomeType(outcomeType) {
        if (!outcomeType) return 'n/a';
        return String(outcomeType).replace(/_/g, ' ').toLowerCase();
    }

    formatDate(value) {
        if (!value) return 'n/a';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'n/a';
        return date.toLocaleDateString();
    }

    normalizeAnswerProbability(value) {
        if (typeof value !== 'number' || !isFinite(value)) return null;
        if (value > 1) return value / 100;
        return Math.min(Math.max(value, 0), 1);
    }

    async backfillHistory(markets, days, maxTargets = 4) {
        if (!markets.length) return null;

        // Limit to a small set of active markets to minimize API load.
        const targets = markets.slice(0, maxTargets);
        const targetTime = Date.now() - (days * 24 * 60 * 60 * 1000);

        const promises = targets.map(async (market) => {
            // Only backfill if we don't have this market's history in memory? 
            // For now, simpler to just fetch for the target date.
            const prob = await this.fetchHistoricalProbability(market.id, targetTime);
            if (prob !== null) {
                const snapshotMarket = this.normalizeSnapshotFromManifold(market);
                snapshotMarket.probability = prob;
                return snapshotMarket;
            }
            return null;
        });

        const results = await Promise.all(promises);
        const validResults = results.filter(m => m !== null);

        if (validResults.length === 0) return null;

        return {
            date: new Date(targetTime).toISOString(),
            markets: validResults
        };
    }

    async backfillHistorySeries(markets, days, baseTime = Date.now(), maxTargets = 4, maxPoints = 2) {
        if (!markets.length) return [];
        const targets = markets.slice(0, maxTargets);
        const dayMs = 24 * 60 * 60 * 1000;
        const snapshots = [];
        const lastKnown = new Map();
        const points = Math.min(days, maxPoints);
        for (let offset = points; offset >= 1; offset -= 1) {
            const timestamp = baseTime - (offset * dayMs);
            const results = await Promise.all(targets.map(async (market) => {
                let prob = await this.fetchHistoricalProbability(market.id, timestamp);
                if (prob === null && lastKnown.has(market.id)) {
                    prob = lastKnown.get(market.id);
                }
                if (prob === null) return null;
                const snapshotMarket = this.normalizeSnapshotFromManifold(market);
                snapshotMarket.probability = prob;
                lastKnown.set(market.id, prob);
                return snapshotMarket;
            }));
            const validResults = results.filter(m => m !== null);
            if (validResults.length > 0) {
                snapshots.push({
                    date: new Date(timestamp).toISOString(),
                    markets: validResults
                });
            }
        }

        return snapshots;
    }

    async fetchHistoricalProbability(marketId, timestamp) {
        try {
            // Get most recent bet BEFORE timestamp (single request to reduce API load).
            const url = `https://api.manifold.markets/v0/bets?contractId=${marketId}&beforeTime=${timestamp}&limit=1&order=desc`;
            const response = await fetch(url);

            if (response.ok) {
                const bets = await response.json();
                if (Array.isArray(bets) && bets.length > 0) {
                    return bets[0].probAfter;
                }
            }

            // If no bets found, data essentially hasn't changed or market didn't exist
            return null;
        } catch (error) {
            console.warn(`Failed to fetch history for ${marketId}`, error);
            return null;
        }
    }

    async fetchManifoldMarkets(query) {
        const term = query || '';
        const url = `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(term)}&limit=25&sort=liquidity&filter=open&contractType=ALL`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch Manifold markets');

        const markets = await response.json();
        return await this.enrichMarketsWithDetails(markets);
    }

    shouldFetchMarketDetails(market) {
        const needsProbability = typeof market?.probability !== 'number';
        const needsAnswers = !Array.isArray(market?.answers) || market.answers.length === 0;
        const outcomeType = String(market?.outcomeType || '').toUpperCase();
        const isMultiChoice = outcomeType === 'MULTIPLE_CHOICE';
        return needsProbability || (isMultiChoice && needsAnswers);
    }

    async enrichMarketsWithDetails(markets) {
        const maxDetailRequests = 6;
        const detailCandidates = markets.filter(market => this.shouldFetchMarketDetails(market));
        const rankedCandidates = detailCandidates
            .slice()
            .sort((a, b) => {
                const aScore = a?.totalLiquidity ?? a?.liquidity ?? a?.volume ?? 0;
                const bScore = b?.totalLiquidity ?? b?.liquidity ?? b?.volume ?? 0;
                return bScore - aScore;
            });
        const detailTargets = rankedCandidates.slice(0, maxDetailRequests);
        if (!detailTargets.length) return markets;

        const detailMap = new Map();
        await Promise.all(detailTargets.map(async market => {
            try {
                const response = await fetch(`https://api.manifold.markets/v0/market/${market.id}`);
                if (!response.ok) return;
                const detail = await response.json();
                detailMap.set(market.id, detail);
            } catch (error) {
                console.warn('Failed to fetch market detail', market.id, error);
            }
        }));

        return markets.map(market => detailMap.get(market.id) || market);
    }

    buildSnapshotFromLive(markets) {
        return {
            date: new Date().toISOString(),
            markets: markets.map(market => this.normalizeSnapshotFromManifold(market))
        };
    }

    normalizeSnapshotFromManifold(market) {
        const probability = this.computeMarketProbability(market);
        const answers = Array.isArray(market.answers)
            ? market.answers.map(answer => ({
                id: answer.id,
                text: answer.text || answer.name || 'Unknown',
                probability: this.normalizeAnswerProbability(
                    typeof answer.probability === 'number'
                        ? answer.probability
                        : (typeof answer.prob === 'number' ? answer.prob : null)
                ),
                isResolved: Boolean(answer.isResolved) || Boolean(answer.resolution)
            }))
            : [];

        return {
            id: market.id,
            question: market.question,
            probability,
            participants: market.uniqueBettorCount || 0,
            url: market.url,
            createdTime: market.createdTime,
            closeTime: market.closeTime,
            volume: market.volume || 0,
            liquidity: market.totalLiquidity || 0,
            isResolved: Boolean(market.isResolved),
            resolution: market.resolution ?? null,
            outcomeType: market.outcomeType || null,
            answers
        };
    }

    computeMarketProbability(market) {
        if (typeof market?.probability === 'number') return market.probability;
        if (Array.isArray(market?.answers) && market.answers.length > 0) {
            const maxAnswer = market.answers.reduce((best, current) => {
                if (typeof current.probability !== 'number') return best;
                if (!best || current.probability > best.probability) return current;
                return best;
            }, null);
            if (maxAnswer && typeof maxAnswer.probability === 'number') {
                return maxAnswer.probability;
            }
        }
        return 0;
    }

    normalizeManifoldMarket(market) {
        const probability = this.computeMarketProbability(market);
        const answers = Array.isArray(market.answers)
            ? market.answers.map(answer => ({
                id: answer.id,
                text: answer.text || answer.name || 'Unknown',
                probability: this.normalizeAnswerProbability(
                    typeof answer.probability === 'number'
                        ? answer.probability
                        : (typeof answer.prob === 'number' ? answer.prob : null)
                ),
                isResolved: Boolean(answer.isResolved) || Boolean(answer.resolution)
            }))
            : [];

        return {
            id: market.id,
            source: 'manifold',
            question: market.question,
            probability,
            volume: market.volume || 0,
            participants: market.uniqueBettorCount || 0,
            url: market.url,
            createdTime: market.createdTime,
            closeTime: market.closeTime,
            isResolved: market.isResolved,
            resolution: market.resolution,
            tags: this.extractTags(market.question),
            liquidity: market.totalLiquidity || 0,
            outcomeType: market.outcomeType || null,
            answers
        };
    }

    async hydrateMissingAnswers(markets, limit = 4) {
        const targets = markets.filter(market => {
            const outcomeType = String(market?.outcomeType || '').toUpperCase();
            const needsAnswers = !Array.isArray(market?.answers) || market.answers.length === 0;
            return outcomeType === 'MULTIPLE_CHOICE' && needsAnswers;
        }).slice(0, limit);
        if (!targets.length) return markets;

        const detailMap = new Map();
        await Promise.all(targets.map(async market => {
            try {
                const response = await fetch(`https://api.manifold.markets/v0/market/${market.id}`);
                if (!response.ok) return;
                const detail = await response.json();
                detailMap.set(market.id, detail);
            } catch (error) {
                console.warn('Failed to hydrate answers', market.id, error);
            }
        }));

        if (!detailMap.size) return markets;
        return markets.map(market => {
            const detail = detailMap.get(market.id);
            return detail ? this.normalizeManifoldMarket(detail) : market;
        });
    }

    normalizeSnapshotMarket(market) {
        return {
            id: market.id,
            source: 'manifold',
            question: market.question || 'Untitled Question',
            probability: typeof market.probability === 'number' ? market.probability : 0,
            volume: market.volume || 0,
            participants: market.participants || 0,
            url: market.url || '#',
            createdTime: market.createdTime || Date.now(),
            closeTime: market.closeTime || null,
            isResolved: Boolean(market.isResolved),
            resolution: market.resolution ?? null,
            tags: market.tags || this.extractTags(market.question || ''),
            liquidity: market.liquidity || 0
        };
    }

    resolveMarketUrl(market) {
        const rawUrl = market?.url || '';
        const isPlaceholder = /manifold\.markets\/example/i.test(rawUrl);
        if (rawUrl && !isPlaceholder) {
            return rawUrl;
        }
        const query = encodeURIComponent(market?.question || '');
        return query
            ? `https://manifold.markets/search?q=${query}`
            : 'https://manifold.markets/';
    }

    extractTags(text) {
        const tags = [];
        const lowerText = text.toLowerCase();

        this.categories.forEach(category => {
            if (lowerText.includes(category.toLowerCase())) {
                tags.push(category);
            }
        });

        // Keywords for category detection
        const keywords = {
            'AI': ['artificial intelligence', 'machine learning', 'gpt', 'chatgpt', 'ai', 'neural', 'deep learning'],
            'Politics': ['election', 'president', 'congress', 'senate', 'political', 'vote', 'government', 'policy'],
            'Economics': ['economy', 'inflation', 'gdp', 'stock', 'recession', 'bitcoin', 'crypto', 'finance'],
            'Sports': ['nfl', 'nba', 'soccer', 'football', 'championship', 'olympics', 'baseball', 'basketball', 'tennis']
        };

        Object.entries(keywords).forEach(([category, words]) => {
            if (words.some(word => lowerText.includes(word)) && !tags.includes(category)) {
                tags.push(category);
            }
        });

        return tags;
    }

    filterMarkets(searchQuery = '') {
        this.filteredMarkets = this.currentMarkets.filter(market => {
            const matchesSearch = !searchQuery ||
                market.question.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory = this.selectedCategories.size === 0 ||
                market.tags.some(tag => this.selectedCategories.has(tag));

            return matchesSearch && matchesCategory;
        });
        this.filteredMarkets.sort((a, b) => {
            const aTrend = this.getMarketTrendInfo(a.id);
            const bTrend = this.getMarketTrendInfo(b.id);
            const aDelta = aTrend ? Math.abs(aTrend.delta) : 0;
            const bDelta = bTrend ? Math.abs(bTrend.delta) : 0;
            return bDelta - aDelta;
        });

        this.displayMarkets();
        this.calculateStats();
        this.displayStats();
    }

    calculateStats() {
        const markets = this.filteredMarkets;
        this.stats.totalMarkets = markets.length;
        if (markets.length > 0) {
            const totalProb = markets.reduce((sum, m) => sum + m.probability, 0);
            this.stats.avgProbability = totalProb / markets.length;
            this.stats.highConfidence = markets.filter(m => m.probability > 0.7 || m.probability < 0.3).length;
            const avgParticipants = markets.reduce((sum, m) => sum + m.participants, 0) / markets.length;
            this.stats.trending = markets.filter(m => m.participants > avgParticipants).length;
        }
    }

    displayStats() {
        const statsContainer = document.getElementById('stats-container');
        if (!statsContainer) return;

        statsContainer.innerHTML = `
      <div class="col-md-3">
        <div class="card h-100 text-center p-3 border-light-subtle">
          <div class="h2 mb-0 text-primary">${this.stats.totalMarkets}</div>
          <small class="text-muted text-uppercase">Total Markets</small>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card h-100 text-center p-3 border-light-subtle">
          <div class="h2 mb-0 text-info">${Math.round(this.stats.avgProbability * 100)}%</div>
          <small class="text-muted text-uppercase">Average Probability</small>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card h-100 text-center p-3 border-light-subtle">
          <div class="h2 mb-0 text-success">${this.stats.highConfidence}</div>
          <small class="text-muted text-uppercase">High-Confidence</small>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card h-100 text-center p-3 border-light-subtle">
          <div class="h2 mb-0 text-warning">${this.stats.trending}</div>
          <small class="text-muted text-uppercase">Trending Markets</small>
        </div>
      </div>
    `;
    }

    displayMarkets() {
        const container = document.getElementById('markets-container');
        if (!container) return;

        if (this.filteredMarkets.length === 0) {
            container.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info border-0 bg-info-subtle text-info-emphasis">
            No markets found. Try adjusting your filters or search query.
          </div>
        </div>
      `;
            return;
        }

        container.innerHTML = this.filteredMarkets.map((market, index) =>
            this.createMarketCard(market, index)
        ).join('');
    }

    createMarketCard(market, index) {
        const hasProb = typeof market.probability === 'number';
        const prob = hasProb ? Math.round(market.probability * 100) : null;

        // Format Date
        const dateStr = new Date(market.createdTime).toLocaleDateString();

        const safeUrl = this.resolveMarketUrl(market);
        const trendInfo = this.getMarketTrendInfo(market.id);
        const deltaLabel = trendInfo
            ? `${trendInfo.delta >= 0 ? '+' : ''}${Math.round(trendInfo.delta)} pts`
            : null;
        const deltaClass = trendInfo && trendInfo.delta >= 0 ? 'delta-up' : 'delta-down';
        const volatilityLabel = trendInfo
            ? (trendInfo.avgSwing < 2 ? 'Stable' : trendInfo.avgSwing < 6 ? 'Active' : 'Choppy')
            : null;
        const thenProb = trendInfo ? Math.round(trendInfo.start * 100) : null;
        const nowProb = hasProb ? prob : (trendInfo ? Math.round(trendInfo.end * 100) : null);
        const getProbBadgeClass = (value) => {
            if (typeof value !== 'number') return 'prob-mid';
            if (value > 70) return 'prob-high';
            if (value < 30) return 'prob-low';
            return 'prob-mid';
        };
        const thenBadgeClass = getProbBadgeClass(thenProb);
        const nowBadgeClass = getProbBadgeClass(nowProb);
        const statusLabel = market.isResolved ? 'resolved' : 'open';
        const closeLabel = this.formatDate(market.closeTime);
        const volumeLabel = this.formatCompactNumber(market.volume);
        const liquidityLabel = this.formatCompactNumber(market.liquidity);

        return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 demo-card">
          <div class="card-body" data-market-id="${market.id}">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="prob-badge ${thenBadgeClass}">Then ${thenProb !== null ? `${thenProb}%` : '—'}</span>
              <span class="prob-badge ${nowBadgeClass}">Now ${nowProb !== null ? `${nowProb}%` : '—'}</span>
            </div>
            
            <h6 class="card-title mb-3"><a href="${safeUrl}" target="_blank" rel="noopener" class="text-decoration-none text-reset stretched-link">${market.question}</a></h6>
            ${this.renderAnswerHighlights(market)}
            <div class="market-meta small text-muted">
                <div class="market-meta-row"><span>Status</span><span>${statusLabel}</span></div>
                <div class="market-meta-row"><span>Closes</span><span>${closeLabel}</span></div>
                <div class="market-meta-row"><span>Volume</span><span>${volumeLabel}</span></div>
                <div class="market-meta-row"><span>Liquidity</span><span>${liquidityLabel}</span></div>
            </div>
            ${trendInfo ? `
                <div class="feed-trend d-flex align-items-center justify-content-between mb-2">
                    <span class="delta-pill ${deltaClass}">${deltaLabel}</span>
                    <span class="trend-meta text-muted small">${volatilityLabel} · ${this.lookbackDays}d</span>
                </div>
                ${this.renderSparkline(trendInfo.series, 'sparkline-feed')}
            ` : `
            <div class="d-flex justify-content-between align-items-center text-muted small">
                <span><i class="bi bi-people me-1"></i> ${market.participants}</span>
                <span><i class="bi bi-calendar me-1"></i> ${dateStr}</span>
            </div>
            `}
          </div>
        </div>
      </div>
    `;
    }

    renderAnswerHighlights(market) {
        if (!Array.isArray(market.answers) || market.answers.length === 0) return '';
        const candidates = market.answers
            .filter(answer => typeof answer.probability === 'number');
        const unresolved = candidates.filter(answer => !answer.isResolved);
        const ranked = (unresolved.length ? unresolved : candidates)
            .slice()
            .sort((a, b) => b.probability - a.probability);
        const topAnswers = ranked.slice(0, 3);
        if (!topAnswers.length) return '';

        return `
            <div class="answer-highlights mb-2">
                <div class="small text-muted">Top options</div>
                ${topAnswers.map(answer => `
                    <div class="answer-row">
                        <span class="answer-text">${answer.text}</span>
                        <span class="answer-prob">${Math.round(answer.probability * 100)}%</span>
                    </div>
                `).join('')}
            </div>
        `;
    }



    async renderCatchupDigest(currentSnapshot, pastSnapshot, query) {
        const summaryEl = document.getElementById('catchup-summary');
        const moversEl = document.getElementById('catchup-movers');
        const gainersEl = document.getElementById('catchup-gainers');
        const losersEl = document.getElementById('catchup-losers');
        const rangeEl = document.getElementById('catchup-range');

        if (!summaryEl || !moversEl || !gainersEl || !losersEl || !rangeEl) return;

        const currentDate = new Date(currentSnapshot.date);
        const pastDate = pastSnapshot ? new Date(pastSnapshot.date) : null;
        const rangeLabel = pastDate
            ? `${pastDate.toLocaleDateString()} → ${currentDate.toLocaleDateString()}`
            : `${currentDate.toLocaleDateString()}`;

        rangeEl.textContent = `Lookback: ${rangeLabel}`;

        if (!pastSnapshot) {
            summaryEl.innerHTML = `
                <div class="alert alert-info border-0">
                    <strong>Catch-up Engine warming up.</strong> Capture at least two real snapshots within ${this.lookbackDays} days to compute movers.
                </div>
            `;
            moversEl.innerHTML = '';
            gainersEl.innerHTML = '';
            losersEl.innerHTML = '';
            return;
        }

        const filteredCurrentMarkets = this.filterSnapshotMarkets(currentSnapshot.markets);
        const filteredPastMarkets = this.filterSnapshotMarkets(pastSnapshot.markets);
        const pastMap = new Map(filteredPastMarkets.map(market => [market.id, market]));
        const movers = filteredCurrentMarkets.map(market => {
            const past = pastMap.get(market.id);
            if (!past || typeof past.probability !== 'number' || typeof market.probability !== 'number') {
                return null;
            }
            const safeUrl = this.resolveMarketUrl(market);
            const delta = (market.probability - past.probability) * 100;
            const trendInfo = this.getMarketTrendInfo(market.id);
            return {
                id: market.id,
                question: market.question,
                url: safeUrl,
                current: market.probability,
                past: past.probability,
                delta,
                absDelta: Math.abs(delta),
                participants: market.participants || 0,
                trend: trendInfo
            };
        }).filter(Boolean);

        if (!movers.length) {
            summaryEl.innerHTML = `
                <div class="alert alert-warning border-0">
                    <strong>No overlapping markets yet.</strong> We need two snapshots with matching market IDs to compute movers.
                </div>
            `;
            moversEl.innerHTML = '';
            gainersEl.innerHTML = this.renderMoverList([], 'Top Gainers');
            losersEl.innerHTML = this.renderMoverList([], 'Top Losers');
            return;
        }

        const moversSorted = movers.sort((a, b) => b.absDelta - a.absDelta);
        const topMovers = moversSorted.slice(0, 6);
        const topGainers = moversSorted.filter(m => m.delta > 0).slice(0, 6);
        const topLosers = moversSorted.filter(m => m.delta < 0).slice(0, 6);
        const currentMarketMap = new Map(filteredCurrentMarkets.map(market => [market.id, market]));
        const topMoverMarkets = topMovers
            .map(mover => currentMarketMap.get(mover.id))
            .filter(Boolean);

        console.log(`Market Movers calculated: ${topGainers.length} gainers, ${topLosers.length} losers (${this.lookbackDays} day period)`);

        summaryEl.innerHTML = `
            <div class="digest-summary">
                <div class="digest-kicker">Catch-up Digest</div>
                <h3 class="digest-headline mb-2">Here is what changed the most while you were away.</h3>
                <p class="text-muted mb-0">Largest swings are calculated from the absolute probability change over the last ${this.lookbackDays} days.</p>
            </div>
        `;

        moversEl.innerHTML = topMoverMarkets
            .map((market, index) => this.createMarketCard(market, index))
            .join('');
        gainersEl.innerHTML = this.renderMoverList(topGainers, 'Top Gainers');
        losersEl.innerHTML = this.renderMoverList(topLosers, 'Top Losers');
    }

    filterSnapshotMarkets(markets) {
        if (!Array.isArray(markets)) return [];
        if (this.selectedCategories.size === 0) return markets;
        return markets.filter(market => {
            const tags = market.tags || this.extractTags(market.question || '');
            return tags.some(tag => this.selectedCategories.has(tag));
        });
    }

    renderMoverCard(item) {
        const delta = Math.round(item.delta);
        const deltaClass = delta >= 0 ? 'delta-up' : 'delta-down';
        const deltaLabel = `${delta >= 0 ? '+' : ''}${delta} pts`;
        const current = Math.round(item.current * 100);
        const past = Math.round(item.past * 100);
        const trend = item.trend;

        return `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 digest-card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge text-bg-light digest-badge">Biggest Mover</span>
                            <span class="delta-pill ${deltaClass}">${deltaLabel}</span>
                        </div>
                        <h6 class="card-title mb-2">
                            <a href="${item.url}" target="_blank" rel="noopener" class="text-decoration-none text-reset">${item.question}</a>
                        </h6>
                        <div class="small text-muted mb-2">Then ${past}% → Now ${current}%</div>
                        ${trend ? `
                            <div class="digest-trend mb-2">
                                ${this.renderSparkline(trend.series, 'sparkline-digest')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderMoverList(items, title) {
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
            const deltaClass = delta >= 0 ? 'delta-up' : 'delta-down';
            const deltaLabel = `${delta >= 0 ? '+' : ''}${delta} pts`;
            return `
                                <li>
                                    <a href="${item.url}" target="_blank" rel="noopener" class="text-decoration-none text-reset">
                                        ${item.question}
                                    </a>
                                    <span class="delta-pill ${deltaClass}">${deltaLabel}</span>
                                </li>
                            `;
        }).join('')}
                    </ul>
                </div>
            </div>
        `;
    }


    exportFeed() {
        const feedData = {
            generated: new Date().toISOString(),
            source: this.currentSource,
            snapshotDate: this.currentSnapshotDate,
            comparisonDate: this.pastSnapshotDate,
            categories: Array.from(this.selectedCategories),
            stats: this.stats,
            markets: this.filteredMarkets.map(m => ({
                question: m.question,
                probability: m.probability,
                url: m.url,
                tags: m.tags,
                participants: m.participants
            }))
        };

        const blob = new Blob([JSON.stringify(feedData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prediction-feed-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.toggle('d-none', !show);
        }
    }

    showError(message) {
        const container = document.getElementById('markets-container');
        if (container) {
            container.innerHTML = `
                <div class="col-12">
                  <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>${message}
                  </div>
                </div>
            `;
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const analyzer = new MarketAnalyzer();
    analyzer.initialize();
});
