# Prediction Market Analyzer

An AI-powered web application for analyzing prediction markets from **Metaculus** and **Manifold Markets**. Get context-specific insights, discover trends, and generate custom feeds based on your interests.

![Prediction Market Analyzer](https://img.shields.io/badge/Status-Active-success)
![License](https://img.shields.io/badge/License-MIT-blue)

## 🌟 Features

### 📊 Multi-Source Data Integration
- **Manifold Markets API**: Access real-time prediction markets with volume and betting data
- **Metaculus API**: Fetch forecasting questions with community predictions
- Seamless switching between data sources

### 🎯 Smart Filtering & Categorization
- **Auto-categorization**: Markets are automatically tagged with categories (AI, Politics, Economics, Sports, Technology, Science, Climate)
- **Category filters**: Click to filter markets by multiple categories
- **Search functionality**: Real-time search with debouncing
- **Smart tag extraction**: Keyword-based tagging system

### 📈 Analytics Dashboard
- **Total Markets**: Count of currently displayed markets
- **Average Probability**: Mean prediction probability across all markets
- **High Confidence**: Markets with strong consensus (>70% or <30%)
- **Trending**: Markets with above-average participation

### 💡 AI-Powered Insights
- **Dual-Mode Analysis**:
  - **Basic Mode**: Statistical analysis (Sentiment, Trends, Categories)
  - **Advanced AI Mode**: Connect your own LLM (GPT-4, Gemini, etc.) for deep semantic analysis
- **Generates**:
  - Unexpected market correlations
  - Geopolitical vs Financial risk analysis
  - Emerging narratives from raw data

### 🎨 Modern UI/UX
- **Glassmorphism design**: Beautiful glass-card effects
- **Gradient animations**: Smooth, eye-catching transitions
- **Dark/Light mode**: Full theme support with auto-detection
- **Responsive layout**: Works on desktop, tablet, and mobile
- **Micro-animations**: Engaging hover effects and transitions

### 📥 Export Functionality
- Export filtered feeds as JSON
- Includes metadata, stats, and market data
- Perfect for further analysis or integration

### 🔧 CORS Handling
- **Manifold Markets**: Direct API access (CORS-enabled)
- **Metaculus**: Uses CORS proxy (allorigins.win) to bypass restrictions
- Seamless experience for both data sources
- See [CORS-SOLUTION.md](CORS-SOLUTION.md) for details

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection for API access
- **Optional**: LLM API Key (OpenAI, OpenRouter, etc.) for advanced insights

### Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd market-prediction
   ```

2. **Open the application**
   - Simply open `index.html` in your web browser
   - Or use a local server:
     ```bash
     # Python 3
     python -m http.server 8000
     
     # Node.js
     npx serve
     ```

3. **Start analyzing!**
   - The app will automatically fetch markets on load
   - Use filters and search to refine your view
   - **Configure AI**: Click "Configure LLM" in the navbar to add your API key
   - Click "Generate Insights" for AI analysis

## 📖 Usage Guide

### Fetching Markets

1. **Select Data Source**: Choose between Manifold Markets or Metaculus
2. **Search (Optional)**: Enter keywords to search for specific topics
3. **Apply Filters**: Click category chips to filter by topic
4. **Fetch Markets**: Click the "Fetch Markets" button

### Configuring AI Assistant

1. Click **Configure LLM** in the top navigation bar
2. Enter your API details:
   - **Base URL**: e.g. `https://api.openai.com/v1`
   - **Model**: e.g. `gpt-4o-mini`
   - **API Key**: Your secret key
3. Click **Save Configuration**
4. Now "Generate Insights" will use the AI model!

### Understanding Market Cards

Each market card displays:
- **Question/Title**: The prediction market question
- **Probability**: Current prediction probability (color-coded)
- **Source Badge**: Indicates data source (Manifold/Metaculus)
- **Volume/Participants**: Trading volume or number of forecasters
- **Tags**: Auto-detected categories
- **Link**: Direct link to the market on the source platform

### Probability Color Coding
- 🟢 **Green (>70%)**: High probability - strong consensus
- 🔴 **Red (<30%)**: Low probability - strong consensus against
- 🔵 **Blue (30-70%)**: Moderate probability - uncertain outcome

### Generating Insights

Click "Generate Insights" to get:
- Most popular categories
- High confidence predictions analysis
- Trending market identification
- Overall market sentiment
- Controversial predictions

### Exporting Data

Click the download icon to export current feed as JSON with:
- Timestamp
- Selected source and categories
- Statistics
- Full market data

## 🏗️ Architecture

### File Structure
```
market-prediction/
├── index.html          # Main HTML file
├── styles.css          # Comprehensive styling with animations
├── app.js             # Application logic and API integration
└── README.md          # This file
```

### Key Components

#### MarketAnalyzer Class (`app.js`)
- **Data Management**: Fetches and normalizes data from both APIs
- **Filtering**: Implements search and category filtering
- **Statistics**: Calculates real-time analytics
- **LLM Integration**: Connects to external AI providers for insights
- **Export**: Handles data export functionality

#### API Integration
- **Manifold Markets**: `https://api.manifold.markets/v0/`
- **Metaculus**: `https://www.metaculus.com/api/`

Both APIs are public and don't require authentication for read operations.

## 🎨 Design System

### Color Palette
- **Primary Gradient**: Purple to violet (`#667eea` → `#764ba2`)
- **Success Gradient**: Teal to green (`#11998e` → `#38ef7d`)
- **Danger Gradient**: Pink to orange (`#ee0979` → `#ff6a00`)
- **Info Gradient**: Blue to cyan (`#4facfe` → `#00f2fe`)

### Typography
- **Font Family**: Inter (Google Fonts)
- **Weights**: 400, 500, 600, 700, 800

### Effects
- Glassmorphism cards with backdrop blur
- Smooth cubic-bezier transitions
- Pulse animations on probability badges
- Fade-in animations on load
- Hover transformations

## 🔧 Customization

### Adding New Categories

Edit the `categories` array in `app.js`:
```javascript
this.categories = ['AI', 'Politics', 'Economics', 'Sports', 'Technology', 'Science', 'Climate', 'YourCategory'];
```

Add keyword mappings in `extractTags()`:
```javascript
const keywords = {
  'YourCategory': ['keyword1', 'keyword2', 'keyword3']
};
```

### Adjusting Fetch Limits

Modify the API URLs in `fetchManifoldMarkets()` and `fetchMetaculusMarkets()`:
```javascript
let url = 'https://api.manifold.markets/v0/markets?limit=100&sort=liquidity';
```

### Customizing Insights

Edit the `generateLocalInsights()` method to add your own analysis logic.

## 📊 API Reference

### Manifold Markets API

**Get Markets**
```
GET https://api.manifold.markets/v0/markets?limit=50&sort=liquidity
```

**Search Markets**
```
GET https://api.manifold.markets/v0/search-markets?term={query}&limit=50
```

### Metaculus API

**Get Posts**
```
GET https://www.metaculus.com/api/posts/?limit=50&has_group=false&order_by=-published_at
```

**Search Posts**
```
GET https://www.metaculus.com/api/posts/?limit=50&search={query}
```

## 🤝 Contributing

Contributions are welcome! Here are some ideas:
- Add more data sources (Polymarket, PredictIt, etc.)
- Implement real-time updates via WebSockets
- Add charting/visualization features
- Create custom alert systems
- Build comparison tools

## 📝 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- **Manifold Markets** for their excellent prediction market platform and API
- **Metaculus** for providing forecasting data and insights
- **Bootstrap** for the UI framework
- **Bootstrap Icons** for the icon set
- **Google Fonts** for the Inter typeface

## 📧 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check the API documentation:
  - [Manifold Markets API](https://docs.manifold.markets/api)
  - [Metaculus API](https://www.metaculus.com/api/)

## 🔮 Future Enhancements

- [ ] Historical data tracking and trends
- [ ] User accounts and saved feeds
- [ ] Email/push notifications for market changes
- [ ] Advanced charting with Chart.js or D3.js
- [ ] Machine learning predictions
- [ ] Social sharing features
- [ ] Mobile app version
- [ ] Browser extension

---

**Built with ❤️ and AI-powered analytics**
