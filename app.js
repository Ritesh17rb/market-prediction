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
        this.activeInsightId = 0;
        this.isFetching = false;
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
        // LLM Configuration
        this.llmConfig = {
            baseUrl: localStorage.getItem('llm_base_url') || '',
            model: localStorage.getItem('llm_model') || '',
            apiKey: localStorage.getItem('llm_api_key') || ''
        };
    }

    async initialize() {
        this.setupEventListeners();
        this.renderCategoryFilters();
        this.loadLLMConfigUI(); // Load saved config into UI
        await this.fetchMarkets();
    }

    setupEventListeners() {
        document.getElementById('btn-fetch')?.addEventListener('click', () => this.fetchMarkets());
        document.getElementById('btn-generate-insights')?.addEventListener('click', () => this.generateInsights());
        document.getElementById('btn-export-feed')?.addEventListener('click', () => this.exportFeed());

        // LLM Config Save
        document.getElementById('btn-save-llm-config')?.addEventListener('click', () => this.saveLLMConfig());

        const lookbackSelect = document.getElementById('lookback-period');
        if (lookbackSelect) {
            lookbackSelect.value = this.lookbackDays;
            lookbackSelect.addEventListener('change', () => {
                this.lookbackDays = parseInt(lookbackSelect.value) || 7;
                localStorage.setItem('lookback_days', String(this.lookbackDays));
                this.fetchMarkets();
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
        }
    }

    loadLLMConfigUI() {
        // Load Base URL and API Key into Modal Inputs
        const urlInput = document.getElementById('llm-base-url');
        const keyInput = document.getElementById('llm-api-key');

        if (urlInput) urlInput.value = this.llmConfig.baseUrl || 'https://api.openai.com/v1';
        if (keyInput) keyInput.value = this.llmConfig.apiKey;

        // Load Model into Inline Input
        const modelInput = document.getElementById('model-select');
        if (modelInput) modelInput.value = this.llmConfig.model || 'gpt-5-nano';
    }

    saveLLMConfig() {
        const url = document.getElementById('llm-base-url').value.trim();
        const key = document.getElementById('llm-api-key').value.trim();

        // Note: Model is now read directly from the inline input during generation,
        // but we save the modal values (URL/Key) here.
        // We also update the local config with value from the inline input just to be safe.
        const model = document.getElementById('model-select')?.value.trim() || 'gpt-5-nano';

        if (!url || !key) {
            this.showAlert('Please fill in Base URL and API Key', 'danger');
            return;
        }

        localStorage.setItem('llm_base_url', url);
        localStorage.setItem('llm_api_key', key);
        localStorage.setItem('llm_model', model);

        this.llmConfig = { baseUrl: url, model: model, apiKey: key };

        // Hide modal
        const modalEl = document.getElementById('llmConfigModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        this.showAlert('API Configuration Saved!', 'success');
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
                        <p class="card-text small text-muted">View trending prediction markets related to ${category.toLowerCase()}.</p>
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

        // Clear State & UI
        this.currentMarkets = [];
        this.filteredMarkets = [];

        const marketsContainer = document.getElementById('markets-container');
        if (marketsContainer) marketsContainer.innerHTML = this.renderMarketSkeletons(6);

        const insightsContent = document.getElementById('insights-content');
        if (insightsContent) insightsContent.innerHTML = this.renderInsightsSkeleton();

        const statsContainer = document.getElementById('stats-container');
        if (statsContainer) statsContainer.innerHTML = this.renderStatsSkeleton();

        this.showLoading(true);

        try {
            // 1. Fetch Live Data
            const liveMarkets = await this.fetchManifoldMarkets(query);
            const currentSnapshot = this.buildSnapshotFromLive(liveMarkets);

            // 2. Fetch Historical Data directly from API (Purely Stateless)
            const pastSnapshot = await this.backfillHistory(liveMarkets, this.lookbackDays);

            // 3. Construct 2-point history (Then vs Now)
            const syntheticSnapshots = [currentSnapshot];
            if (pastSnapshot) syntheticSnapshots.unshift(pastSnapshot);

            this.marketHistory = this.buildMarketHistory(syntheticSnapshots, currentSnapshot.date, this.lookbackDays);

            this.currentSnapshotDate = currentSnapshot.date;
            this.pastSnapshotDate = pastSnapshot?.date || null;

            this.currentMarkets = liveMarkets.map(m => this.normalizeManifoldMarket(m));
            this.filteredMarkets = [...this.currentMarkets];

            await this.renderCatchupDigest(currentSnapshot, pastSnapshot, query);

            this.calculateStats();
            this.displayMarkets();
            this.displayStats();
            this.showInsightsSection(true);
            this.isFetching = false;
            this.generateInsights(true, fetchId);

        } catch (error) {
            this.showError(`Error fetching data: ${error.message}`);
        } finally {
            if (this.activeFetchId === fetchId) this.isFetching = false;
            this.showLoading(false);
        }
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

    renderInsightsSkeleton() {
        return `
            <div class="row g-3">
              ${Array(3).fill(0).map(() => `
                <div class="col-md-4 fade-in">
                  <div class="card h-100 p-3 demo-card">
                    <div class="card-body">
                      <div class="d-flex justify-content-between align-items-start mb-3 placeholder-glow">
                        <span class="placeholder col-4"></span>
                        <span class="placeholder col-3"></span>
                      </div>
                      <div class="placeholder-glow mb-3">
                        <span class="placeholder col-12"></span>
                        <span class="placeholder col-9"></span>
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
        `;
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
        const parsed = parseInt(raw);
        return isNaN(parsed) ? 7 : Math.min(Math.max(parsed, 1), 365);
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
        return history;
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

        return `
            <svg class="sparkline ${className}" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
                <polyline fill="none" stroke="currentColor" stroke-width="2" points="${points}"></polyline>
            </svg>
        `;
    }

    async backfillHistory(markets, days) {
        if (!markets.length) return null;

        // Limit to top 24 active markets to avoid rate limits while getting good coverage
        const targets = markets.slice(0, 24);
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

    async fetchHistoricalProbability(marketId, timestamp) {
        try {
            // Using correct timestamp filtering parameters: 'afterTime' and 'beforeTime'
            // The 'before' and 'after' parameters are for Bet IDs, which caused 404s.
            let url = `https://api.manifold.markets/v0/bets?contractId=${marketId}&afterTime=${timestamp}&limit=1&order=asc`;
            let response = await fetch(url);

            if (response.ok) {
                const bets = await response.json();
                if (Array.isArray(bets) && bets.length > 0) {
                    return bets[0].probBefore;
                }
            }

            // Fallback: Get most recent bet BEFORE timestamp
            url = `https://api.manifold.markets/v0/bets?contractId=${marketId}&beforeTime=${timestamp}&limit=1&order=desc`;
            response = await fetch(url);

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
        const url = `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(term)}&limit=50&sort=liquidity&filter=open&contractType=ALL`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch Manifold markets');

        const markets = await response.json();
        return await this.enrichMarketsWithDetails(markets);
    }

    shouldFetchMarketDetails(market) {
        const needsProbability = typeof market?.probability !== 'number';
        const needsAnswers = !Array.isArray(market?.answers) || market.answers.length === 0;
        const isMultiChoice = market?.outcomeType === 'MULTIPLE_CHOICE';
        return needsProbability || (isMultiChoice && needsAnswers);
    }

    async enrichMarketsWithDetails(markets) {
        const maxDetailRequests = 15;
        const detailTargets = markets.filter(market => this.shouldFetchMarketDetails(market)).slice(0, maxDetailRequests);
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
                probability: typeof answer.probability === 'number' ? answer.probability : null
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
                probability: typeof answer.probability === 'number' ? answer.probability : null
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
            'AI': ['artificial intelligence', 'machine learning', 'gpt', 'chatgpt', 'ai', 'llm', 'neural', 'deep learning'],
            'Politics': ['election', 'president', 'congress', 'senate', 'political', 'vote', 'government', 'policy'],
            'Economics': ['economy', 'inflation', 'gdp', 'stock', 'market', 'recession', 'bitcoin', 'crypto', 'finance'],
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

        this.displayMarkets();
        this.calculateStats();
        this.displayStats();

        if (this.filteredMarkets.length === 0) {
            const insightsContent = document.getElementById('insights-content');
            if (insightsContent) {
                insightsContent.innerHTML = `
                    <div class="text-center py-5 text-muted">
                        <i class="bi bi-bar-chart-line display-1 mb-3 d-block opacity-25"></i>
                        <h4 class="fw-light">Ready to analyze market data</h4>
                        <p>Fetch some markets and click "Run Analysis" to generate deep insights.</p>
                    </div>
                `;
            }
            const insightsBody = insightsContent?.closest('.card-body');
            if (insightsBody) insightsBody.classList.remove('insights-scroll');
            return;
        }

        // Debounce automatic insights for search/filtering
        if (this.insightsDebounce) clearTimeout(this.insightsDebounce);
        this.insightsDebounce = setTimeout(() => {
            this.generateInsights(true, this.activeFetchId);
        }, 1000);
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
          <small class="text-muted text-uppercase">Avg Probability</small>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card h-100 text-center p-3 border-light-subtle">
          <div class="h2 mb-0 text-success">${this.stats.highConfidence}</div>
          <small class="text-muted text-uppercase">High Confidence</small>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card h-100 text-center p-3 border-light-subtle">
          <div class="h2 mb-0 text-warning">${this.stats.trending}</div>
          <small class="text-muted text-uppercase">Trending</small>
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
        let probBadgeClass = 'prob-mid';
        if (hasProb && prob > 70) probBadgeClass = 'prob-high';
        if (hasProb && prob < 30) probBadgeClass = 'prob-low';

        const sourceBadge = '<span class="badge bg-primary-subtle text-primary-emphasis border border-primary-subtle">Manifold</span>';

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

        return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 demo-card">
          <div class="card-body" data-market-id="${market.id}">
            <div class="d-flex justify-content-between align-items-start mb-2">
              ${sourceBadge}
              <span class="badg prob-badge ${probBadgeClass}">${hasProb ? `${prob}%` : '—'}</span>
            </div>
            
            <h6 class="card-title mb-3"><a href="${safeUrl}" target="_blank" rel="noopener" class="text-decoration-none text-reset stretched-link">${market.question}</a></h6>
            ${this.renderAnswerHighlights(market)}
            ${trendInfo ? `
                <div class="feed-trend d-flex align-items-center justify-content-between mb-2">
                    <span class="delta-pill ${deltaClass}">${deltaLabel}</span>
                    <span class="trend-meta text-muted small">${volatilityLabel} · ${this.lookbackDays}d</span>
                </div>
                ${this.renderSparkline(trendInfo.series, 'sparkline-feed')}
                <div class="small text-muted d-flex justify-content-between mt-2">
                    <span>Then: ${Math.round(trendInfo.start * 100)}%</span>
                    <span>Now: ${Math.round(trendInfo.end * 100)}%</span>
                </div>
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
        const topAnswers = [...market.answers]
            .filter(answer => typeof answer.probability === 'number')
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 3);
        if (!topAnswers.length) return '';

        return `
            <div class="answer-highlights mb-2">
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
                    <strong>Catch-up Engine warming up.</strong> Capture at least two real snapshots within 14 days to compute movers.
                </div>
            `;
            moversEl.innerHTML = '';
            gainersEl.innerHTML = '';
            losersEl.innerHTML = '';
            return;
        }

        const pastMap = new Map(pastSnapshot.markets.map(market => [market.id, market]));
        const movers = currentSnapshot.markets.map(market => {
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

        console.log(`Market Movers calculated: ${topGainers.length} gainers, ${topLosers.length} losers (${this.lookbackDays} day period)`);

        summaryEl.innerHTML = `
            <div class="digest-summary">
                <div class="digest-kicker">Catch-up Digest</div>
                <h3 class="digest-headline mb-2">Here is what changed the most while you were away.</h3>
                <p class="text-muted mb-0">Largest swings are calculated from the absolute probability change over the last ${this.lookbackDays} days.</p>
            </div>
        `;

        moversEl.innerHTML = topMovers.map(item => this.renderMoverCard(item)).join('');
        gainersEl.innerHTML = this.renderMoverList(topGainers, 'Top Gainers');
        losersEl.innerHTML = this.renderMoverList(topLosers, 'Top Losers');

        const insights = await this.generateMoverInsights(topMovers);
        if (insights) {
            const enriched = topMovers.map(item => ({
                ...item,
                insight: insights[item.id]
            }));
            moversEl.innerHTML = enriched.map(item => this.renderMoverCard(item)).join('');
        }
    }

    renderMoverCard(item) {
        const delta = Math.round(item.delta);
        const deltaClass = delta >= 0 ? 'delta-up' : 'delta-down';
        const deltaLabel = delta >= 0 ? `+${delta}` : `${delta}`;
        const current = Math.round(item.current * 100);
        const past = Math.round(item.past * 100);
        const insightText = item.insight?.description || item.insight?.summary;
        const trend = item.trend;

        return `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 digest-card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge text-bg-light digest-badge">Biggest Mover</span>
                            <span class="delta-pill ${deltaClass}">${deltaLabel} pts</span>
                        </div>
                        <h6 class="card-title mb-2">
                            <a href="${item.url}" target="_blank" rel="noopener" class="text-decoration-none text-reset">${item.question}</a>
                        </h6>
                        ${trend ? `
                            <div class="digest-trend mb-2">
                                ${this.renderSparkline(trend.series, 'sparkline-digest')}
                            </div>
                        ` : ''}
                        <div class="small text-muted d-flex justify-content-between">
                            <span>Then: ${past}%</span>
                            <span>Now: ${current}%</span>
                        </div>
                        <div class="digest-insight mt-3">
                            ${insightText ? `<p class="mb-0 small">${insightText}</p>` : '<p class="mb-0 small text-muted">Connect an LLM to add context.</p>'}
                        </div>
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
            const deltaLabel = delta >= 0 ? `+${delta}` : `${delta}`;
            return `
                                <li>
                                    <a href="${item.url}" target="_blank" rel="noopener" class="text-decoration-none text-reset">
                                        ${item.question}
                                    </a>
                                    <span class="delta-pill ${deltaClass}">${deltaLabel} pts</span>
                                </li>
                            `;
        }).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    async generateMoverInsights(movers) {
        if (!movers.length) return null;
        if (!this.llmConfig.baseUrl || !this.llmConfig.apiKey) {
            return null;
        }

        const systemPrompt = 'You are a prediction market editor writing concise, factual newsroom summaries.';
        const currentModel = document.getElementById('model-select')?.value;
        const userPrompt = `
Summarize the most important move for each market in 1-2 sentences. Explain the change using only the numbers provided.

Return ONLY a raw JSON object with market ids as keys:
{
  "market-id": { "summary": "..." }
}

Markets:
${JSON.stringify(movers.map(m => ({
            id: m.id,
            question: m.question,
            past: Math.round(m.past * 100),
            current: Math.round(m.current * 100),
            delta: Math.round(m.delta)
        })))}
`;

        try {
            const response = await fetch(`${this.llmConfig.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.llmConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: currentModel || this.llmConfig.model || 'gpt-5-nano',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) return null;
            return this.parseLLMResponse(content);
        } catch (error) {
            console.warn('Mover insight generation failed.', error);
            return null;
        }
    }

    async generateInsights(silentMode = false, fetchId = this.activeFetchId) {
        const insightsContent = document.getElementById('insights-content');
        const btn = document.getElementById('btn-generate-insights');
        const insightsBody = insightsContent?.closest('.accordion-body');

        if (!insightsContent) return;
        if (fetchId !== this.activeFetchId || this.isFetching) return;

        const insightId = ++this.activeInsightId;

        // Validation: Need markets first
        if (this.filteredMarkets.length === 0) {
            if (!silentMode) this.showAlert('Please fetch some markets first!', 'warning');
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Analyzing...';
        }

        // Add loading effect to content area
        insightsContent.innerHTML = `
            <div class="row g-3">
              ${Array(6).fill(0).map(() => `
                <div class="col-md-6 col-lg-4 fade-in">
                  <div class="card h-100 demo-card">
                    <div class="card-body">
                      <div class="d-flex justify-content-between align-items-start mb-3 placeholder-glow">
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
              `).join('')}
            </div>
        `;

        try {
            const marketSummary = this.filteredMarkets.slice(0, 20).map(m => ({
                question: m.question,
                probability: Math.round(m.probability * 100),
                participants: m.participants,
                tags: m.tags,
                source: m.source
            }));

            // Check if we have LLM config
            if (!this.llmConfig.baseUrl || !this.llmConfig.apiKey) {
                insightsContent.innerHTML = `
                    <div class="alert alert-info">
                      <i class="bi bi-info-circle me-2"></i>Configure the LLM to generate AI insights.
                    </div>
                `;
                if (!silentMode) this.showAlert('Configure LLM to generate insights.', 'warning');
                return;
            }

            let insights;
            try {
                insights = await this.generateLLMInsights(marketSummary);
            } catch (error) {
                console.warn('LLM insight generation failed:', error);
                insightsContent.innerHTML = `
                    <div class="alert alert-warning">
                      <i class="bi bi-exclamation-octagon me-2"></i>LLM insights failed. Try again or adjust your model settings.
                    </div>
                `;
                if (!silentMode) this.showAlert('LLM failed to generate insights.', 'warning');
                return;
            }

            // Render Results as Cards
            if (insightId !== this.activeInsightId || fetchId !== this.activeFetchId || this.isFetching) {
                return;
            }
            if (insightsBody) {
                if (insights.length > 6) {
                    insightsBody.classList.add('insights-scroll');
                } else {
                    insightsBody.classList.remove('insights-scroll');
                }
            }
            insightsContent.innerHTML = `
                <div class="row g-3">
                    ${insights.map(insight => `
                    <div class="col-md-6 col-lg-4 fade-in">
                        <div class="card h-100 bg-body-tertiary border-0 shadow-sm">
                            <div class="card-body">
                                <h6 class="card-title text-primary"><i class="bi bi-lightbulb-fill me-2"></i>${insight.title}</h6>
                                <p class="card-text small">${insight.description}</p>
                            </div>
                        </div>
                    </div>
                    `).join('')}
                </div>
            `;

            if (!silentMode) this.showAlert('Analysis Complete!', 'success');

        } catch (error) {
            if (insightId !== this.activeInsightId) {
                return;
            }
            if (insightsBody) {
                insightsBody.classList.remove('insights-scroll');
            }
            insightsContent.innerHTML = `
                <div class="alert alert-warning">
                  <i class="bi bi-exclamation-octagon me-2"></i>Could not generate insights: ${error.message}
                </div>
            `;
            this.showAlert('Analysis Failed', 'danger');
        } finally {
            if (insightId === this.activeInsightId) {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-cpu-fill me-1"></i> Re-Run Analysis';
                }
            }
        }
    }

    parseLLMResponse(content) {
        const fenced = content.match(/```json\s*([\s\S]*?)\s*```/i);
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        const objectMatch = content.match(/\{[\s\S]*\}/);
        const jsonStr = fenced?.[1] || arrayMatch?.[0] || objectMatch?.[0] || content;
        return JSON.parse(jsonStr);
    }

    normalizeInsights(raw) {
        const insightsArray = Array.isArray(raw) ? raw : raw?.insights;
        if (!Array.isArray(insightsArray)) {
            throw new Error('LLM returned unexpected JSON structure');
        }

        const normalized = insightsArray.map((insight, index) => ({
            title: String(insight?.title || `Insight ${index + 1}`).trim(),
            description: String(insight?.description || '').trim()
        })).filter(item => item.description);

        if (normalized.length === 0) {
            throw new Error('LLM returned empty insights');
        }

        return normalized;
    }

    async generateLLMInsights(markets) {
        const systemPrompt = document.getElementById('system-prompt')?.value || 'You are a prediction market intelligence analyst.';
        const currentModel = document.getElementById('model-select')?.value;

        const userPrompt = `
Goal:
Convert prediction market crowd wisdom into actionable business intelligence for a decision support system.
Prediction markets are faster than news and provide probabilities. Use them to filter noise and surface
context-specific, high-impact insights.

What to detect:
- Consensus signals (high confidence across related markets).
- Divergences or contradictions (e.g., similar topics with different probabilities or sources).
- Emerging narratives and risk monitors (what should be watched next).
- Uncertainty hotspots (markets near 50% or low participation).

Data (JSON array of markets):
${JSON.stringify(markets)}

Output format:
- Return ONLY a raw JSON array (no markdown or prose).
- Each item: { "title": "Short insight", "description": "2-3 sentences with actionable implication." }
`;

        const response = await fetch(`${this.llmConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.llmConfig.apiKey}`
            },
            body: JSON.stringify({
                model: currentModel || this.llmConfig.model || 'gpt-5-nano',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 1
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`LLM Error: ${err}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) throw new Error('Invalid response from LLM');

        try {
            const parsed = this.parseLLMResponse(content);
            return this.normalizeInsights(parsed);
        } catch (error) {
            console.error('Failed to parse LLM Response:', content);
            throw new Error('LLM returned invalid JSON');
        }
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

    showInsightsSection(show) {
        const section = document.getElementById('insights-section');
        if (section) {
            section.classList.toggle('d-none', !show);
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
