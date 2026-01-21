// Market Prediction Analyzer - Main Application Logic

class MarketAnalyzer {
    constructor() {
        this.currentMarkets = [];
        this.filteredMarkets = [];
        this.categories = ['AI', 'Politics', 'Economics', 'Sports', 'Technology', 'Science', 'Climate'];
        this.selectedCategories = new Set();
        this.currentSource = 'manifold';
        this.metaculusServerBaseUrl = (typeof CONFIG !== 'undefined' && CONFIG.api?.metaculus?.serverBaseUrl) || '';
        this.metaculusSettings = {
            listLimit: (typeof CONFIG !== 'undefined' && CONFIG.api?.metaculus?.listLimit) || 20,
            detailLimit: (typeof CONFIG !== 'undefined' && CONFIG.api?.metaculus?.detailLimit) || 10,
            requestDelayMs: (typeof CONFIG !== 'undefined' && CONFIG.api?.metaculus?.requestDelayMs) || 1200,
            maxRetries: (typeof CONFIG !== 'undefined' && CONFIG.api?.metaculus?.maxRetries) || 5
        };
        this.fetchCounter = 0;
        this.activeFetchId = 0;
        this.activeInsightId = 0;
        this.isFetching = false;
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

        document.querySelectorAll('input[name="source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentSource = e.target.value;
                this.fetchMarkets();
            });
        });

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
        const icon = type === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill';

        const html = `
            <div id="${alertId}" class="toast align-items-center text-bg-${type} border-0 show" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="bi bi-${icon} me-2"></i>${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', html);

        // Auto remove after 3 seconds
        setTimeout(() => {
            const el = document.getElementById(alertId);
            if (el) {
                el.classList.remove('show');
                setTimeout(() => el.remove(), 150); // Wait for fade out
            }
        }, 3000);
    }

    renderCategoryFilters() {
        const container = document.getElementById('category-filters');
        if (!container) return;

        // Render categories as "Demo Card" style templates
        container.innerHTML = this.categories.map((category, index) => `
            <div class="col-md-6 col-lg-3">
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
            'Sports': '⚽',
            'Technology': '💻',
            'Science': '🔬',
            'Climate': '🌍'
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
        const source = document.querySelector('input[name="source"]:checked')?.value || 'manifold';
        const query = document.getElementById('query-input')?.value || '';
        const fetchId = ++this.fetchCounter;
        this.activeFetchId = fetchId;
        this.isFetching = true;

        // Clear State & UI immediately to avoid showing stale data while loading
        this.currentMarkets = [];
        this.filteredMarkets = [];

        const marketsContainer = document.getElementById('markets-container');
        if (marketsContainer) {
            marketsContainer.innerHTML = this.renderMarketSkeletons(6);
        }

        const insightsContent = document.getElementById('insights-content');
        if (insightsContent) {
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
        }

        const statsContainer = document.getElementById('stats-container');
        if (statsContainer) {
            statsContainer.innerHTML = Array(4).fill(0).map(() => `
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

        this.showLoading(true);

        try {
            if (source === 'manifold') {
                await this.fetchManifoldMarkets(query);
            } else {
                await this.fetchMetaculusMarkets(query);
            }

            this.calculateStats();
            this.displayMarkets();
            this.displayStats();
            this.showInsightsSection(true);
            this.isFetching = false;
            this.generateInsights(true, fetchId); // Auto-generate insights (silent mode)
        } catch (error) {
            this.showError(`Error fetching data: ${error.message}`);
        } finally {
            if (this.activeFetchId === fetchId) {
                this.isFetching = false;
            }
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

    // Skip fetch functions as they are logic only...

    async fetchManifoldMarkets(query) {
        const term = query || '';
        const url = `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(term)}&limit=50&sort=liquidity&filter=open&contractType=ALL`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch Manifold markets');

        const markets = await response.json();
        this.currentMarkets = markets.map(m => this.normalizeManifoldMarket(m));
        this.filteredMarkets = [...this.currentMarkets];
    }

    async fetchMetaculusApi(path, params = {}) {
        const baseUrl = this.metaculusServerBaseUrl.replace(/\/$/, '');
        if (!baseUrl) {
            throw new Error('Metaculus server base URL is not configured.');
        }

        const url = new URL(`${baseUrl}/api/metaculus/${path.replace(/^\//, '')}`);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, value);
            }
        });

        const maxRetries = this.metaculusSettings.maxRetries;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const response = await fetch(url);
            if (response.ok) {
                return await response.json();
            }

            const err = await response.text();
            if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
                const retryAfter = response.headers.get('retry-after');
                const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 0;
                const backoffMs = this.metaculusSettings.requestDelayMs * (attempt + 1);
                const jitterMs = Math.floor(Math.random() * 250);
                await this.sleep(Math.max(retryAfterMs, backoffMs) + jitterMs);
                continue;
            }
            throw new Error(`Metaculus API error (${response.status}): ${err}`);
        }
        throw new Error('Metaculus API error: retries exhausted');
    }

    async fetchMetaculusMarkets(query) {
        let url = 'https://www.metaculus.com/api/posts/';
        const params = new URLSearchParams({
            limit: String(this.metaculusSettings.listLimit)
        });

        if (query) {
            params.append('search', query);
        }

        url += '?' + params.toString();

        try {
            console.log('Fetching Metaculus list via server...');
            const data = this.metaculusServerBaseUrl
                ? await this.fetchMetaculusApi('posts/', { limit: String(this.metaculusSettings.listLimit), search: query || '' })
                : await (async () => {
                    const response = await fetch(url);
                    if (!response.ok) {
                        const err = await response.text();
                        throw new Error(`Metaculus API error (${response.status}): ${err}`);
                    }
                    return await response.json();
                })();
            const initialMarkets = data.results || data || [];

            if (!Array.isArray(initialMarkets)) {
                throw new Error('Unexpected API response format');
            }

            // Fetch details with strict rate limiting to avoid 429s
            const detailTargets = initialMarkets.slice(0, this.metaculusSettings.detailLimit);
            console.log(`Fetching details for ${detailTargets.length} markets...`);

            const detailedMarkets = [];
            for (let i = 0; i < detailTargets.length; i++) {
                const market = detailTargets[i];
                if (!market.id) {
                    detailedMarkets.push(market);
                    continue;
                }

                try {
                    if (this.metaculusServerBaseUrl) {
                        detailedMarkets.push(await this.fetchMetaculusApi(`posts/${market.id}/`));
                    } else {
                        const detailUrl = `https://www.metaculus.com/api/posts/${market.id}/`;
                        const detailResponse = await fetch(detailUrl);
                        if (!detailResponse.ok) {
                            const err = await detailResponse.text();
                            throw new Error(`Metaculus detail error (${detailResponse.status}): ${err}`);
                        }
                        detailedMarkets.push(await detailResponse.json());
                    }
                } catch (e) {
                    console.warn(`Failed to fetch detail for ${market.id}`, e);
                    detailedMarkets.push(market);
                }

                if (i < detailTargets.length - 1) {
                    await this.sleep(this.metaculusSettings.requestDelayMs);
                }
            }

            this.currentMarkets = detailedMarkets
                .filter(m => m.question)
                .map(m => this.normalizeMetaculusMarket(m));

            this.filteredMarkets = [...this.currentMarkets];
            console.log(`✅ Successfully fetched ${this.currentMarkets.length} markets from Metaculus`);

        } catch (error) {
            console.error('Metaculus fetch failed:', error);
            throw error;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    normalizeManifoldMarket(market) {
        return {
            id: market.id,
            source: 'manifold',
            question: market.question,
            probability: market.probability || 0,
            volume: market.volume || 0,
            participants: market.uniqueBettorCount || 0,
            url: market.url,
            createdTime: market.createdTime,
            closeTime: market.closeTime,
            isResolved: market.isResolved,
            resolution: market.resolution,
            tags: this.extractTags(market.question),
            liquidity: market.totalLiquidity || 0
        };
    }

    normalizeMetaculusMarket(post) {
        const question = post.question || {};

        let prob = 0;

        const aggregationLatest = question.aggregations?.recency_weighted?.latest ||
            question.aggregations?.unweighted?.latest ||
            question.aggregations?.mean?.latest ||
            question.aggregations?.median?.latest;

        const candidates = [
            aggregationLatest?.centers?.[0],
            aggregationLatest?.means?.[0],
            aggregationLatest?.forecast_values?.[1],
            question.community_prediction?.full?.q2,
            question.my_forecasts?.latest?.forecast_values?.[1],
            question.possibilities?.type === 'binary' ? question.possibilities?.probability : undefined,
            question.probability
        ];

        for (const value of candidates) {
            if (typeof value === 'number') {
                prob = value;
                break;
            }
        }

        if (prob > 1 && prob <= 100) {
            prob = prob / 100;
        }

        const participants = question.nr_forecasters ||
            question.forecasters_count ||
            post.nr_forecasters ||
            0;

        return {
            id: post.id,
            source: 'metaculus',
            question: post.title || post.question?.title || 'Untitled Question',
            probability: prob,
            volume: 0,
            participants: participants,
            url: post.url ? `https://www.metaculus.com${post.url}` : `https://www.metaculus.com/questions/${post.id}`,
            createdTime: post.published_at ? new Date(post.published_at).getTime() : Date.now(),
            closeTime: question.scheduled_close_time ? new Date(question.scheduled_close_time).getTime() : null,
            isResolved: question.resolution !== null && question.resolution !== undefined,
            resolution: question.resolution,
            tags: this.extractTags(post.title || ''),
            liquidity: 0
        };
    }

    extractTags(text) {
        // ... (unchanged)
        const tags = [];
        const lowerText = text.toLowerCase();

        this.categories.forEach(category => {
            if (lowerText.includes(category.toLowerCase())) {
                tags.push(category);
            }
        });

        // Simplified keywords for brevity in this replacement block, but logic remains
        const keywords = {
            'AI': ['artificial intelligence', 'machine learning', 'gpt', 'chatgpt', 'ai', 'llm'],
            'Politics': ['election', 'president', 'congress', 'senate', 'political', 'vote'],
            'Economics': ['economy', 'inflation', 'gdp', 'stock', 'market', 'recession'],
            'Sports': ['nfl', 'nba', 'soccer', 'football', 'championship', 'olympics'],
            'Technology': ['tech', 'software', 'hardware', 'apple', 'google', 'microsoft'],
            'Science': ['research', 'study', 'discovery', 'nobel', 'physics', 'biology'],
            'Climate': ['climate', 'warming', 'carbon', 'renewable', 'emissions']
        };

        Object.entries(keywords).forEach(([category, words]) => {
            if (words.some(word => lowerText.includes(word)) && !tags.includes(category)) {
                tags.push(category);
            }
        });

        return tags;
    }

    filterMarkets(searchQuery = '') {
        // ... (Logic unchanged, re-included to maintain block)
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

    // ... calculateStats and displayStats match logic/structure

    calculateStats() {
        // ... unchanged logic
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
        const prob = Math.round(market.probability * 100);
        let probBadgeClass = 'prob-mid';
        if (prob > 70) probBadgeClass = 'prob-high';
        if (prob < 30) probBadgeClass = 'prob-low';

        const sourceBadge = market.source === 'manifold'
            ? '<span class="badge bg-primary-subtle text-primary-emphasis border border-primary-subtle">Manifold</span>'
            : '<span class="badge bg-success-subtle text-success-emphasis border border-success-subtle">Metaculus</span>';

        // Format Date
        const dateStr = new Date(market.createdTime).toLocaleDateString();

        return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 demo-card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              ${sourceBadge}
              <span class="badg prob-badge ${probBadgeClass}">${prob}%</span>
            </div>
            
            <h6 class="card-title mb-3"><a href="${market.url}" target="_blank" class="text-decoration-none text-reset stretched-link">${market.question}</a></h6>
            
            <div class="d-flex justify-content-between align-items-center text-muted small">
                <span><i class="bi bi-people me-1"></i> ${market.participants}</span>
                <span><i class="bi bi-calendar me-1"></i> ${dateStr}</span>
            </div>
          </div>
        </div>
      </div>
    `;
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

    // NEW FUNCTION: Chat with LLM
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
        const systemPrompt = document.getElementById('system-prompt')?.value ||
            'You are a prediction market intelligence analyst.';
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
                temperature: 0.7
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

    generateLocalInsights(markets) {
        const insights = [];

        // Category distribution
        const categoryCount = {};
        markets.forEach(m => {
            m.tags.forEach(tag => {
                categoryCount[tag] = (categoryCount[tag] || 0) + 1;
            });
        });

        const topCategory = Object.entries(categoryCount)
            .sort((a, b) => b[1] - a[1])[0];

        if (topCategory) {
            insights.push({
                title: 'Market Focus: ' + topCategory[0],
                description: `${topCategory[0]} is the dominant theme with ${topCategory[1]} active markets. Traders are heavily focused on this sector right now.`
            });
        }

        // High confidence predictions
        const highConfidence = markets.filter(m => m.probability > 70 || m.probability < 30);
        if (highConfidence.length > 0) {
            insights.push({
                title: 'Consensus Signals',
                description: `${highConfidence.length} markets show strong crowd consensus (>70% or <30%). These represent "settled" narratives in the eyes of the market.`
            });
        }

        // Participation analysis
        const avgParticipants = markets.reduce((sum, m) => sum + m.participants, 0) / markets.length;
        const highParticipation = markets.filter(m => m.participants > avgParticipants * 1.5);

        if (highParticipation.length > 0) {
            insights.push({
                title: 'Hot Topics',
                description: `${highParticipation.length} viral markets are seeing >50% above-average participation. The crowd is flocking to these specific questions.`
            });
        }

        // Probability distribution
        const avgProb = markets.reduce((sum, m) => sum + m.probability, 0) / markets.length;
        insights.push({
            title: 'Global Sentiment',
            description: `The aggregate probability across all visible markets is ${Math.round(avgProb * 100)}%. This indicates a ${avgProb > 0.5 ? 'bullish/optimistic' : 'bearish/cautious'} bias in the current feed.`
        });

        // Controversial markets (close to 50%)
        const controversial = markets.filter(m => m.probability > 0.4 && m.probability < 0.6);
        if (controversial.length > 0) {
            insights.push({
                title: 'Controversial Predictions',
                description: `${controversial.length} markets are highly contested with probabilities near 50%, representing genuine uncertainty and divided opinions.`
            });
        }

        return insights;
    }

    exportFeed() {
        const feedData = {
            generated: new Date().toISOString(),
            source: this.currentSource,
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
