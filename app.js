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
        const urlInput = document.getElementById('llm-base-url');
        const modelInput = document.getElementById('llm-model');
        const keyInput = document.getElementById('llm-api-key');

        if (urlInput) urlInput.value = this.llmConfig.baseUrl;
        if (modelInput) modelInput.value = this.llmConfig.model;
        if (keyInput) keyInput.value = this.llmConfig.apiKey;
    }

    saveLLMConfig() {
        const url = document.getElementById('llm-base-url').value.trim();
        const model = document.getElementById('llm-model').value.trim();
        const key = document.getElementById('llm-api-key').value.trim();

        if (!url || !model || !key) {
            alert('Please fill in all fields');
            return;
        }

        localStorage.setItem('llm_base_url', url);
        localStorage.setItem('llm_model', model);
        localStorage.setItem('llm_api_key', key);

        this.llmConfig = { baseUrl: url, model: model, apiKey: key };

        // Hide modal (Bootstrap 5 vanilla JS way)
        const modalEl = document.getElementById('llmConfigModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        // Show success
        alert('Configuration saved! You can now generate AI insights.');
    }

    renderCategoryFilters() {
        const container = document.getElementById('category-filters');
        if (!container) return;

        container.innerHTML = this.categories.map(category => `
      <div class="filter-chip" data-category="${category}">
        ${this.getCategoryIcon(category)} ${category}
      </div>
    `).join('');

        container.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.toggleCategory(category);
                e.currentTarget.classList.toggle('active');
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

    async fetchManifoldMarkets(query) {
        const term = query || '';
        const url = `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(term)}&limit=50&sort=liquidity&filter=open&contractType=ALL`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch Manifold markets');

        const markets = await response.json();
        this.currentMarkets = markets.map(m => this.normalizeManifoldMarket(m));
        this.filteredMarkets = [...this.currentMarkets];
    }

    async fetchMetaculusMarkets(query) {
        let url = 'https://www.metaculus.com/api/posts/';
        const params = new URLSearchParams({
            limit: '50'
        });

        if (query) {
            params.append('search', query);
        }

        url += '?' + params.toString();

        const corsProxies = [
            'https://corsproxy.io/?',  // Most reliable
            'https://api.allorigins.win/raw?url=',
            'https://api.codetabs.com/v1/proxy?quest='
        ];

        let lastError = null;

        for (const corsProxy of corsProxies) {
            try {
                const proxiedUrl = corsProxy + encodeURIComponent(url);
                console.log(`Trying Metaculus with proxy: ${corsProxy}`);

                const response = await fetch(proxiedUrl);
                if (!response.ok) {
                    throw new Error(`Proxy returned ${response.status}`);
                }

                const data = await response.json();

                const markets = data.results || data || [];

                if (!Array.isArray(markets)) {
                    throw new Error('Unexpected API response format');
                }

                if (markets.length > 0) {
                    console.log('=== METACULUS COMPLETE DATA ===');
                    console.log(JSON.stringify(markets[0], null, 2));
                    console.log('================================');
                }

                this.currentMarkets = markets
                    .filter(m => m.question)
                    .map(m => this.normalizeMetaculusMarket(m));
                this.filteredMarkets = [...this.currentMarkets];

                console.log(`✅ Successfully fetched ${this.currentMarkets.length} markets from Metaculus`);
                return;

            } catch (error) {
                console.warn(`❌ Proxy ${corsProxy} failed:`, error.message);
                lastError = error;
            }
        }

        console.error('All CORS proxies failed for Metaculus');
        throw new Error(`Failed to fetch Metaculus markets. All CORS proxies failed. Last error: ${lastError?.message || 'Unknown error'}`);
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
        const tags = [];
        const lowerText = text.toLowerCase();

        this.categories.forEach(category => {
            if (lowerText.includes(category.toLowerCase())) {
                tags.push(category);
            }
        });

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
    }

    calculateStats() {
        const markets = this.filteredMarkets;

        this.stats.totalMarkets = markets.length;

        if (markets.length > 0) {
            const totalProb = markets.reduce((sum, m) => sum + m.probability, 0);
            this.stats.avgProbability = totalProb / markets.length;

            this.stats.highConfidence = markets.filter(m =>
                m.probability > 0.7 || m.probability < 0.3
            ).length;

            const avgParticipants = markets.reduce((sum, m) => sum + m.participants, 0) / markets.length;
            this.stats.trending = markets.filter(m => m.participants > avgParticipants).length;
        }
    }

    displayStats() {
        const statsContainer = document.getElementById('stats-container');
        if (!statsContainer) return;

        statsContainer.innerHTML = `
      <div class="col-md-3">
        <div class="stat-card fade-in">
          <div class="stat-value">${this.stats.totalMarkets}</div>
          <div class="stat-label">Total Markets</div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="stat-card fade-in" style="animation-delay: 0.1s">
          <div class="stat-value">${Math.round(this.stats.avgProbability * 100)}%</div>
          <div class="stat-label">Avg Probability</div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="stat-card fade-in" style="animation-delay: 0.2s">
          <div class="stat-value">${this.stats.highConfidence}</div>
          <div class="stat-label">High Confidence</div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="stat-card fade-in" style="animation-delay: 0.3s">
          <div class="stat-value">${this.stats.trending}</div>
          <div class="stat-label">Trending</div>
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
          <div class="alert alert-info">
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
        const probClass = prob > 70 ? 'probability-high' : prob < 30 ? 'probability-low' : '';
        const sourceColor = market.source === 'manifold' ? 'primary' : 'success';
        const sourceIcon = market.source === 'manifold' ? 'currency-dollar' : 'graph-up';

        const tagsHtml = market.tags.slice(0, 3).map(tag =>
            `<span class="market-tag">${tag}</span>`
        ).join('');

        const volumeDisplay = market.source === 'manifold'
            ? `$${Math.round(market.volume).toLocaleString()}`
            : 'N/A';

        return `
      <div class="col-md-6 col-lg-4 fade-in" style="animation-delay: ${index * 0.05}s">
        <div class="card glass-card market-card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge bg-${sourceColor}">
                <i class="bi bi-${sourceIcon}"></i> ${market.source}
              </span>
              ${market.isResolved ? '<span class="badge bg-secondary">Resolved</span>' : ''}
            </div>
            
            <h6 class="card-title mb-3">${market.question}</h6>
            
            <div class="d-flex justify-content-between align-items-center mb-3">
              <span class="probability-badge ${probClass}">${prob}%</span>
              <div class="text-end">
                <small class="text-muted d-block">Volume: ${volumeDisplay}</small>
                <small class="text-muted">
                  <i class="bi bi-people-fill"></i> ${market.participants}
                </small>
              </div>
            </div>
            
            ${tagsHtml ? `<div class="mb-3">${tagsHtml}</div>` : ''}
            
            <div class="d-flex gap-2">
              <a href="${market.url}" target="_blank" class="btn btn-sm btn-outline-${sourceColor} flex-grow-1">
                View Market <i class="bi bi-box-arrow-up-right"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
    }

    async generateInsights() {
        const insightsContent = document.getElementById('insights-content');
        const btn = document.getElementById('btn-generate-insights');

        if (!insightsContent || !btn) return;

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Analyzing...';

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

            insightsContent.innerHTML = `
        <div class="insight-content">
          <h5 class="mb-3"><i class="bi bi-lightbulb-fill me-2"></i>${this.llmConfig.apiKey ? 'AI Analyst Report' : 'Basic Insights'}</h5>
          ${insights.map(insight => `
            <div class="mb-3">
              <h6><i class="bi bi-arrow-right-circle-fill me-2"></i>${insight.title}</h6>
              <p class="mb-0">${insight.description}</p>
            </div>
          `).join('')}
          ${!this.llmConfig.apiKey ? '<div class="alert alert-info mt-3"><small>Tip: Configure LLM for deeper analysis.</small></div>' : ''}
        </div>
      `;
        } catch (error) {
            insightsContent.innerHTML = `
        <div class="alert alert-warning">
          Could not generate insights: ${error.message}
        </div>
      `;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-stars me-2"></i>Regenerate Insights';
        }
    }

    // NEW FUNCTION: Chat with LLM
    async generateLLMInsights(markets) {
        const prompt = `
        You are an elite Prediction Market Analyst. 
        Analyze the following prediction markets and identify 3-5 unique, high-value insights.
        Focus on:
        1. Unexpected correlations
        2. Geopolitical risks vs Financial optimism
        3. Emerging narratives

        Markets data:
        ${JSON.stringify(markets)}

        Return ONLY a raw JSON array:
        [
            {"title": "Insight Title", "description": "Detailed explanation..."}
        ]
        `;

        const response = await fetch(`${this.llmConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.llmConfig.apiKey}`
            },
            body: JSON.stringify({
                model: this.llmConfig.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`LLM Error: ${err}`);
        }

        const data = await response.json();
        // Handle different API response structures (OpenAI standard)
        const content = data.choices?.[0]?.message?.content;

        if (!content) throw new Error('Invalid response from LLM');

        // Extract JSON from markdown code blocks if present
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
                title: 'Most Popular Category',
                description: `${topCategory[0]} is the most discussed topic with ${topCategory[1]} markets. This suggests high interest and activity in this domain.`
            });
        }

        // High confidence predictions
        const highConfidence = markets.filter(m => m.probability > 70 || m.probability < 30);
        if (highConfidence.length > 0) {
            insights.push({
                title: 'High Confidence Predictions',
                description: `${highConfidence.length} markets show strong consensus (>70% or <30% probability), indicating clear market sentiment on these questions.`
            });
        }

        // Participation analysis
        const avgParticipants = markets.reduce((sum, m) => sum + m.participants, 0) / markets.length;
        const highParticipation = markets.filter(m => m.participants > avgParticipants * 1.5);

        if (highParticipation.length > 0) {
            insights.push({
                title: 'Trending Markets',
                description: `${highParticipation.length} markets have significantly higher participation than average, suggesting these are hot topics attracting attention.`
            });
        }

        // Probability distribution
        const avgProb = markets.reduce((sum, m) => sum + m.probability, 0) / markets.length;
        insights.push({
            title: 'Market Sentiment',
            description: `Average probability across all markets is ${Math.round(avgProb * 100)}%, ${avgProb > 0.5 ? 'indicating general optimism' : 'suggesting cautious outlook'} in the prediction community.`
        });

        // Controversial markets (close to 50%)
        const controversial = markets.filter(m => m.probability > 0.4 && m.probability < 0.6);
        if (controversial.length > 0) {
            insights.push({
                title: 'Controversial Predictions',
                description: `${controversial.length} markets are highly contested with probabilities near 50%, representing genuine uncertainty and divided opinions.`
            });
        }

        return insights.slice(0, 5);
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
