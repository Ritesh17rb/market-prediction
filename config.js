// Configuration file for Market Analyzer
// Modify these settings to customize the application

const CONFIG = {
    // API Settings
    api: {
        manifold: {
            baseUrl: 'https://api.manifold.markets/v0',
            defaultLimit: 50,
            defaultSort: 'liquidity', // Options: 'created-time', 'updated-time', 'last-bet-time', 'liquidity'
        },
        metaculus: {
            baseUrl: 'https://www.metaculus.com/api',
            defaultLimit: 50,
            defaultOrder: '-published_at', // Use '-' prefix for descending
        },
    },

    // Categories for auto-tagging
    categories: [
        'AI',
        'Politics',
        'Economics',
        'Sports',
        'Technology',
        'Science',
        'Climate',
    ],

    // Keywords for category detection
    categoryKeywords: {
        'AI': [
            'artificial intelligence',
            'machine learning',
            'gpt',
            'chatgpt',
            'ai',
            'llm',
            'neural network',
            'deep learning',
        ],
        'Politics': [
            'election',
            'president',
            'congress',
            'senate',
            'political',
            'vote',
            'government',
            'democracy',
            'republican',
            'democrat',
        ],
        'Economics': [
            'economy',
            'inflation',
            'gdp',
            'stock',
            'market',
            'recession',
            'unemployment',
            'federal reserve',
            'interest rate',
        ],
        'Sports': [
            'nfl',
            'nba',
            'soccer',
            'football',
            'championship',
            'olympics',
            'world cup',
            'super bowl',
            'baseball',
            'basketball',
        ],
        'Technology': [
            'tech',
            'software',
            'hardware',
            'apple',
            'google',
            'microsoft',
            'startup',
            'innovation',
            'blockchain',
            'cryptocurrency',
        ],
        'Science': [
            'research',
            'study',
            'discovery',
            'nobel',
            'physics',
            'biology',
            'chemistry',
            'space',
            'nasa',
            'experiment',
        ],
        'Climate': [
            'climate',
            'warming',
            'carbon',
            'renewable',
            'emissions',
            'temperature',
            'environment',
            'sustainability',
            'green energy',
        ],
    },

    // Probability thresholds
    thresholds: {
        highConfidence: 0.7,  // Markets above this are "high confidence YES"
        lowConfidence: 0.3,   // Markets below this are "high confidence NO"
        controversial: {
            min: 0.4,           // Markets between these values are "controversial"
            max: 0.6,
        },
    },

    // UI Settings
    ui: {
        defaultTheme: 'auto', // Options: 'light', 'dark', 'auto'
        animationDuration: 300, // milliseconds
        cardAnimationDelay: 50, // milliseconds between each card animation
        maxTagsPerCard: 3,
        autoFetchOnLoad: true,
        defaultSource: 'manifold', // Options: 'manifold', 'metaculus'
    },

    // Stats calculation
    stats: {
        trendingMultiplier: 1.5, // Markets with participants > avg * this value are "trending"
    },

    // Export settings
    export: {
        includeMetadata: true,
        includeStats: true,
        includeFullMarketData: true,
        filenamePrefix: 'prediction-feed',
    },

    // Insights generation
    insights: {
        maxInsights: 5,
        minMarketsForAnalysis: 5,
        includeCategories: true,
        includeConfidence: true,
        includeParticipation: true,
        includeSentiment: true,
        includeControversial: true,
    },

    // Advanced settings
    advanced: {
        debounceDelay: 500, // milliseconds for search debouncing
        maxRetries: 3,
        retryDelay: 1000, // milliseconds
        cacheEnabled: false, // Enable localStorage caching (future feature)
        cacheDuration: 300000, // 5 minutes in milliseconds
    },
};

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
