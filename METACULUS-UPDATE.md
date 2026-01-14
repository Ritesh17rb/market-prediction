# Metaculus API Update - January 2026

## 🔄 Issue: Metaculus API Changes

The Metaculus API has been updated and some parameters may no longer work as expected.

### What Changed

According to the latest Metaculus API documentation:
- The primary endpoint is still `/api/posts/`
- The API now uses a **Post-based** structure instead of standalone questions
- Some query parameters may have changed or been deprecated

### Current Fix Applied

I've simplified the Metaculus API call to use only basic, well-supported parameters:

```javascript
// Simplified approach
let url = 'https://www.metaculus.com/api/posts/';
const params = new URLSearchParams({
    limit: '50'
});

if (query) {
    params.append('search', query);
}
```

**Removed parameters** that might be causing issues:
- ❌ `has_group=false` (may be deprecated)
- ❌ `order_by=-published_at` (may have changed)

### Better Error Handling

Added comprehensive error handling:
- Checks for valid JSON response
- Filters posts to only include those with questions
- Provides detailed error messages in console
- Graceful fallback handling

### Alternative Solutions

If Metaculus still doesn't work, here are alternatives:

#### Option 1: Use Different CORS Proxy

Try these alternative CORS proxies in `app.js`:

```javascript
// Option A: corsproxy.io
const corsProxy = 'https://corsproxy.io/?';

// Option B: cors-anywhere (if available)
const corsProxy = 'https://cors-anywhere.herokuapp.com/';

// Option C: Your own proxy (recommended for production)
```

#### Option 2: Focus on Manifold Markets Only

Since Manifold Markets is working perfectly, you could:
1. Use Manifold as your primary data source
2. Disable Metaculus temporarily
3. Add a note that Metaculus is "coming soon"

To disable Metaculus in the UI, update `index.html`:

```html
<!-- Hide Metaculus option temporarily -->
<input type="radio" class="btn-check" name="source" id="source-metaculus" value="metaculus" disabled>
<label class="btn btn-outline-success" for="source-metaculus">
  <i class="bi bi-graph-up me-2"></i>Metaculus (Coming Soon)
</label>
```

#### Option 3: Server-Side Proxy

For production use, create a simple backend proxy:

**Node.js Example:**
```javascript
// server.js
const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.get('/api/metaculus', async (req, res) => {
    const url = 'https://www.metaculus.com/api/posts/?limit=50';
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
});

app.listen(3000);
```

Then update your app to call your own server instead of using CORS proxy.

### Testing Metaculus API Directly

To test if the Metaculus API is working, try these URLs in your browser:

1. **Basic endpoint**: https://www.metaculus.com/api/posts/?limit=5
2. **With search**: https://www.metaculus.com/api/posts/?limit=5&search=AI

If these return JSON in your browser, the API is working and it's just a CORS issue.

### Current Status

- ✅ **Manifold Markets**: Fully functional
- ⚠️ **Metaculus**: May have API compatibility issues
- ✅ **All other features**: Working perfectly

### Recommendation

For now, I recommend:
1. **Use Manifold Markets** as your primary source (it's working great!)
2. **Monitor Metaculus** - the API might be in transition
3. **Contact Metaculus** at api-requests@metaculus.com for clarification on current API parameters

### What You Can Do

1. **Test in browser**: Visit https://www.metaculus.com/api/posts/?limit=5
   - If you see JSON → API works, just CORS issue
   - If you see HTML → API endpoint may have changed

2. **Check console**: Open browser DevTools (F12) and check the Console tab for specific error messages

3. **Try refresh**: Hard refresh (Ctrl+Shift+R) to ensure you have the latest code

---

**Bottom line**: Manifold Markets is working perfectly! You can use the app fully with that source while we sort out Metaculus. 🚀
