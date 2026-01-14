# Quick Start Guide

## 🚀 Your Application is Ready!

I've created a comprehensive **Prediction Market Analyzer** that analyzes feeds from both Metaculus and Manifold Markets APIs.

## 📁 Files Created

1. **index.html** - Main application with modern UI
2. **styles.css** - Beautiful design system with animations and glassmorphism
3. **app.js** - Complete application logic with API integration
4. **README.md** - Comprehensive documentation

## 🎯 Key Features Implemented

### ✅ Data Integration
- ✅ Manifold Markets API integration
- ✅ Metaculus API integration
- ✅ Automatic data fetching on load
- ✅ Search functionality
- ✅ Real-time filtering

### ✅ Smart Categorization
- ✅ Auto-tagging system (AI, Politics, Economics, Sports, Technology, Science, Climate)
- ✅ Keyword-based category detection
- ✅ Multi-category filtering
- ✅ Tag display on market cards

### ✅ Analytics Dashboard
- ✅ Total markets counter
- ✅ Average probability calculation
- ✅ High confidence detection (>70% or <30%)
- ✅ Trending markets identification

### ✅ AI-Powered Insights
- ✅ Category distribution analysis
- ✅ High confidence predictions
- ✅ Participation trends
- ✅ Market sentiment analysis
- ✅ Controversial predictions detection

### ✅ Modern UI/UX
- ✅ Glassmorphism design
- ✅ Gradient animations
- ✅ Dark/Light mode support
- ✅ Responsive layout
- ✅ Micro-animations
- ✅ Color-coded probability badges

### ✅ Export Functionality
- ✅ JSON export with metadata
- ✅ Includes stats and market data

## 🌐 How to Access

### Option 1: Local Server (Currently Running)
A Python HTTP server is now running. Open your browser and go to:
```
http://localhost:8000
```

### Option 2: Direct File Access
Simply double-click `index.html` in your file explorer.

### Option 3: Other Local Servers
```bash
# Node.js
npx serve

# PHP
php -S localhost:8000

# VS Code Live Server extension
Right-click index.html → "Open with Live Server"
```

## 🎮 How to Use

### Step 1: Select Data Source
- Click either "Manifold Markets" or "Metaculus" button
- The app will automatically fetch data

### Step 2: Filter & Search
- **Search**: Type keywords in the search box (e.g., "AI", "election", "climate")
- **Categories**: Click category chips to filter by topic
- Multiple categories can be selected

### Step 3: View Markets
- Browse market cards with:
  - Question/title
  - Probability (color-coded)
  - Volume/participants
  - Auto-detected tags
  - Direct link to source

### Step 4: Generate Insights
- Click "Generate Insights" button
- View AI-powered analysis including:
  - Most popular categories
  - High confidence predictions
  - Trending markets
  - Market sentiment
  - Controversial predictions

### Step 5: Export Data
- Click the download icon (📥) to export current feed
- Saves as JSON with timestamp

## 🎨 Design Highlights

### Color-Coded Probabilities
- 🟢 **Green (>70%)**: High probability
- 🔴 **Red (<30%)**: Low probability  
- 🔵 **Blue (30-70%)**: Uncertain

### Animations
- Smooth fade-in on load
- Hover effects on cards
- Pulsing probability badges
- Rotating background on insight cards

### Themes
- Click the theme toggle (🌓) in navbar
- Choose Light, Dark, or Auto

## 📊 Example Use Cases

### 1. AI Trends
- Search: "AI" or "artificial intelligence"
- Filter by: Technology, AI categories
- See: Latest predictions about AI developments

### 2. Political Forecasting
- Search: "election" or "president"
- Filter by: Politics category
- See: Electoral predictions and political events

### 3. Economic Outlook
- Search: "economy" or "recession"
- Filter by: Economics category
- See: Economic predictions and market sentiment

### 4. Climate Analysis
- Search: "climate" or "emissions"
- Filter by: Climate, Science categories
- See: Environmental predictions

## 🔧 Customization Tips

### Add More Categories
Edit `app.js`, line ~15:
```javascript
this.categories = ['AI', 'Politics', 'Economics', 'Sports', 'Technology', 'Science', 'Climate', 'YourCategory'];
```

### Change Fetch Limit
Edit `app.js`, lines ~100 and ~115:
```javascript
let url = 'https://api.manifold.markets/v0/markets?limit=100&sort=liquidity';
```

### Modify Colors
Edit `styles.css`, lines 1-7:
```css
:root {
  --primary-gradient: linear-gradient(135deg, #your-color-1, #your-color-2);
}
```

## 🐛 Troubleshooting

### Markets Not Loading?
- Check internet connection
- Open browser console (F12) for errors
- APIs might be temporarily down

### Categories Not Showing?
- Markets need to contain category keywords
- Try different search terms
- Check `extractTags()` function in app.js

### Styling Issues?
- Make sure `styles.css` is in the same folder
- Clear browser cache (Ctrl+Shift+R)
- Check browser console for CSS errors

## 📈 Next Steps

### Enhancements You Could Add:
1. **Historical Tracking**: Store data in localStorage
2. **Charting**: Add Chart.js for visualizations
3. **Notifications**: Alert on probability changes
4. **Comparison**: Compare markets side-by-side
5. **Advanced Filters**: Date ranges, probability ranges
6. **User Preferences**: Save favorite categories
7. **Social Sharing**: Share interesting markets
8. **API Integration**: Connect to more prediction platforms

## 🎓 Learning Resources

- [Manifold Markets API Docs](https://docs.manifold.markets/api)
- [Metaculus API](https://www.metaculus.com/api/)
- [Bootstrap 5 Docs](https://getbootstrap.com/docs/5.3/)
- [Modern CSS Techniques](https://web.dev/learn/css/)

## 💡 Pro Tips

1. **Combine Filters**: Use search + categories for precise results
2. **Export Regularly**: Save interesting feeds for later analysis
3. **Watch Trends**: Check "Trending" stat for hot topics
4. **High Confidence**: Look for markets with strong consensus
5. **Controversial**: 50% probability = genuine uncertainty

---

**Enjoy analyzing prediction markets! 🚀**

Need help? Check README.md for detailed documentation.
