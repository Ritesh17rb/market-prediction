// Market Prediction Analyzer - Main Application Logic

class MarketAnalyzer {
    constructor() {
        this.currentMarkets = [];
        this.filteredMarkets = [];
        this.categories = ['AI', 'Politics', 'Economics', 'Sports', 'Technology', 'Science', 'Climate'];
        this.selectedCategories = new Set();
        this.currentSource = 'manifold';
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

    // Updated Generate Function
    async generateLLMInsights(markets) {
        // Get dynamic values from UI
        const systemPrompt = document.getElementById('system-prompt').value;
        const currentModel = document.getElementById('model-select').value;

        // User Prompt with Data
        const userPrompt = `
        Here is the current market data:
        ${JSON.stringify(markets)}
        
        Please provide the insights as requested in the JSON format.
        `;

        const response = await fetch(`${this.llmConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.llmConfig.apiKey}`
            },
            body: JSON.stringify({
                model: currentModel || this.llmConfig.model, // Prefer UI value
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

        // Extract JSON
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to parse LLM Response:', content);
            throw new Error('LLM returned invalid JSON');
        }
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

                // Toggle active class visually
                if (this.selectedCategories.has(category)) {
                    this.selectedCategories.delete(category);
                    e.currentTarget.classList.remove('active', 'border-primary');
                } else {
                    this.selectedCategories.add(category);
                    e.currentTarget.classList.add('active', 'border-primary');
                }

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

        // Clear State & UI immediately to avoid showing stale data while loading
        this.currentMarkets = [];
        this.filteredMarkets = [];

        const marketsContainer = document.getElementById('markets-container');
        if (marketsContainer) marketsContainer.innerHTML = '';

        const insightsContent = document.getElementById('insights-content');
        if (insightsContent) {
            insightsContent.innerHTML = `
                <div class="text-center py-5 text-muted fade-in">
                  <i class="bi bi-hourglass-split display-1 mb-3 d-block opacity-25"></i>
                  <h4 class="fw-light">Updating Data...</h4>
                  <p>Fetching fresh market data for analysis.</p>
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
            this.generateInsights(true); // Auto-generate insights (silent mode)
        } catch (error) {
            // Show helpful error message for Metaculus
            if (source === 'metaculus') {
                this.showMetaculusError();
            } else {
                this.showError(`Error fetching data: ${error.message}`);
            }
        } finally {
            this.showLoading(false);
        }
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

    async fetchWithProxy(url) {
        const corsProxies = [
            'https://corsproxy.io/?',
            'https://api.allorigins.win/raw?url=',
            'https://api.codetabs.com/v1/proxy?quest='
        ];

        let lastError = null;

        for (const corsProxy of corsProxies) {
            try {
                const proxiedUrl = corsProxy + encodeURIComponent(url);
                const response = await fetch(proxiedUrl);
                if (!response.ok) throw new Error(`Status ${response.status}`);
                return await response.json();
            } catch (error) {
                // console.warn(`Proxy ${corsProxy} failed:`, error.message);
                lastError = error;
            }
        }
        throw new Error(`All proxies failed. Last error: ${lastError?.message}`);
    }

    async fetchMetaculusMarkets(query) {
        let url = 'https://www.metaculus.com/api/posts/';
        const params = new URLSearchParams({
            limit: '20' // Reduced limit for detail fetching performance
        });

        if (query) {
            params.append('search', query);
        }

        url += '?' + params.toString();

        try {
            console.log('Fetching Metaculus list...');
            const data = await this.fetchWithProxy(url);
            const initialMarkets = data.results || data || [];

            if (!Array.isArray(initialMarkets)) {
                throw new Error('Unexpected API response format');
            }

            // Fetch details for each market to get valid probability
            // The List API no longer returns prediction data, so we must fetch details
            console.log(`Fetching details for ${initialMarkets.length} markets...`);

            const detailedMarkets = await Promise.all(initialMarkets.map(async (m) => {
                if (!m.id) return m;
                try {
                    const detailUrl = `https://www.metaculus.com/api/posts/${m.id}/`;
                    return await this.fetchWithProxy(detailUrl);
                } catch (e) {
                    console.warn(`Failed to fetch detail for ${m.id}`, e);
                    return m; // Fallback to list item
                }
            }));

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

        if (question.aggregations?.recency_weighted?.latest?.centers?.[0]) {
            prob = question.aggregations.recency_weighted.latest.centers[0];
        }
        else if (question.community_prediction?.full?.q2) {
            prob = question.community_prediction.full.q2;
        }
        else if (question.my_forecasts?.latest?.forecast_values?.[1]) {
            prob = question.my_forecasts.latest.forecast_values[1];
        }
        else if (question.possibilities?.type === 'binary' && question.possibilities?.probability) {
            prob = question.possibilities.probability;
        }
        else if (typeof question.probability === 'number') {
            prob = question.probability;
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

        // Debounce automatic insights for search/filtering
        if (this.insightsDebounce) clearTimeout(this.insightsDebounce);
        this.insightsDebounce = setTimeout(() => {
            this.generateInsights(true);
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

    async generateInsights(silentMode = false) {
        const insightsContent = document.getElementById('insights-content');
        const btn = document.getElementById('btn-generate-insights');

        if (!insightsContent || !btn) return;

        // Validation: Need markets first
        if (this.filteredMarkets.length === 0) {
            if (!silentMode) this.showAlert('Please fetch some markets first!', 'warning');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Analyzing...';

        // Add loading effect to content area
        insightsContent.innerHTML = `
            <div class="text-center py-5 fade-in">
                <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <h5 class="fw-normal">Generating Market Insights...</h5>
                <p class="text-muted small">Analyzing probability distributions and correlations</p>
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
            let insights;
            if (this.llmConfig.baseUrl && this.llmConfig.apiKey) {
                insights = await this.generateLLMInsights(marketSummary); // NEW
            } else {
                insights = this.generateLocalInsights(marketSummary); // OLD fallback
            }

            // Render Results as Cards
            insightsContent.innerHTML = `
                <div class="row g-3">
                    ${insights.map(insight => `
                    <div class="col-md-6 fade-in">
                        <div class="card h-100 bg-body-tertiary border-0 shadow-sm">
                            <div class="card-body">
                                <h6 class="card-title text-primary"><i class="bi bi-lightbulb-fill me-2"></i>${insight.title}</h6>
                                <p class="card-text small">${insight.description}</p>
                            </div>
                        </div>
                    </div>
                    `).join('')}
                </div>
                ${!this.llmConfig.apiKey ? '<div class="alert alert-info mt-3"><small><i class="bi bi-info-circle me-1"></i> Running in basic mode. Configure LLM for deep semantic analysis.</small></div>' : ''}
            `;

            if (!silentMode) this.showAlert('Analysis Complete!', 'success');

        } catch (error) {
            insightsContent.innerHTML = `
                <div class="alert alert-warning">
                  <i class="bi bi-exclamation-octagon me-2"></i>Could not generate insights: ${error.message}
                </div>
            `;
            this.showAlert('Analysis Failed', 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-cpu-fill me-1"></i> Re-Run Analysis';
        }
    }

    // NEW FUNCTION: Chat with LLM
    async generateLLMInsights(markets) {
        // Get dynamic values from UI
        const systemPrompt = document.getElementById('system-prompt')?.value || 'You are an expert analyst.';
        const currentModel = document.getElementById('model-select')?.value;

        // User Prompt with Data
        const userPrompt = `
        Analyze these prediction markets and return 4 high-value insights.
        
        Data: ${JSON.stringify(markets)}
        
        REQUIREMENTS:
        - Return ONLY raw JSON array.
        - Fields: "title" (short punchy header), "description" (2-3 sentences).
        - Focus on: Contrarian signals, Risk assessment, and Thematic clusters.
        `;

        const response = await fetch(`${this.llmConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.llmConfig.apiKey}`
            },
            body: JSON.stringify({
                model: currentModel || this.llmConfig.model,
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

        // Extract JSON
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

        try {
            return JSON.parse(jsonStr);
        } catch (e) {
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

    showMetaculusError() {
        const container = document.getElementById('markets-container');
        if (container) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-warning">
                        <h5><i class="bi bi-info-circle-fill me-2"></i>Metaculus API Not Available in Browser</h5>
                        <p class="mb-2">
                            The Metaculus API is designed for <strong>server-side use only</strong> and cannot be accessed directly from a web browser.
                        </p>
                        <hr>
                        <p class="mb-2"><strong>Why this happens:</strong></p>
                        <ul class="mb-3">
                            <li>Metaculus blocks CORS (Cross-Origin Resource Sharing) requests</li>
                            <li>CORS proxy services are being blocked with 403 Forbidden errors</li>
                            <li>This is a security measure to prevent unauthorized scraping</li>
                        </ul>
                        <p class="mb-2"><strong>Solutions:</strong></p>
                        <ol class="mb-3">
                            <li><strong>Use Manifold Markets</strong> - Fully functional with all features! ✅</li>
                            <li><strong>Build a backend proxy</strong> - See METACULUS-UPDATE.md for code examples</li>
                            <li><strong>Use Metaculus directly</strong> - Visit <a href="https://www.metaculus.com" target="_blank">metaculus.com</a></li>
                        </ol>
                        <div class="alert alert-info mb-0">
                            <h6 class="mb-2"><i class="bi bi-lightbulb-fill me-2"></i>Recommended Action</h6>
                            <p class="mb-2">
                                Switch to <strong>Manifold Markets</strong> for a fully functional experience!
                            </p>
                            <button class="btn btn-primary btn-sm" onclick="document.getElementById('source-manifold').click(); document.getElementById('btn-fetch').click();">
                                <i class="bi bi-arrow-right-circle me-1"></i>Switch to Manifold Markets
                            </button>
                        </div>
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
