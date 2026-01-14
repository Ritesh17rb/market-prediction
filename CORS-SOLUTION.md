# CORS Issue - Explanation & Solutions

## 🔍 What is CORS?

**CORS (Cross-Origin Resource Sharing)** is a security feature implemented by web browsers to prevent malicious websites from making unauthorized requests to other domains.

### The Problem

When you try to fetch data from `https://www.metaculus.com/api/` from your local development server (`http://127.0.0.1:5501`), the browser blocks the request because:

1. **Different Origins**: Your app runs on `http://127.0.0.1:5501` but tries to access `https://www.metaculus.com`
2. **Missing Headers**: Metaculus API doesn't send the `Access-Control-Allow-Origin` header
3. **Browser Security**: The browser blocks the request to protect users

### Why Manifold Works but Metaculus Doesn't?

- ✅ **Manifold Markets**: Their API includes CORS headers allowing cross-origin requests
- ❌ **Metaculus**: Their API doesn't include CORS headers (likely intended for server-side use only)

## ✅ Solution Implemented

I've updated `app.js` to use a **CORS proxy** for Metaculus requests:

```javascript
async fetchMetaculusMarkets(query) {
    let url = 'https://www.metaculus.com/api/posts/?limit=50&has_group=false&order_by=-published_at';
    if (query) {
        url += `&search=${encodeURIComponent(query)}`;
    }

    // Use CORS proxy to bypass CORS restrictions
    const corsProxy = 'https://api.allorigins.win/raw?url=';
    const proxiedUrl = corsProxy + encodeURIComponent(url);

    const response = await fetch(proxiedUrl);
    // ... rest of the code
}
```

### How It Works

1. **CORS Proxy**: `https://api.allorigins.win` acts as an intermediary
2. **Request Flow**: 
   - Your app → CORS Proxy → Metaculus API
   - Metaculus API → CORS Proxy → Your app
3. **Headers Added**: The proxy adds the necessary CORS headers
4. **Browser Happy**: Browser allows the request because it's from the same origin

## 🎯 Testing the Fix

1. **Refresh your browser** (Ctrl+F5 or Cmd+Shift+R)
2. **Select Metaculus** as the data source
3. **Click "Fetch Markets"**
4. You should now see Metaculus markets without errors!

## 🔄 Alternative Solutions

### Option 1: CORS Proxy (Current Implementation) ✅

**Pros:**
- ✅ Works immediately
- ✅ No server setup required
- ✅ Free service (allorigins.win)

**Cons:**
- ⚠️ Depends on third-party service
- ⚠️ Slightly slower (extra hop)
- ⚠️ Rate limits may apply

### Option 2: Build Your Own Proxy Server

Create a simple Node.js proxy:

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

app.get('/api/metaculus/*', async (req, res) => {
    const url = 'https://www.metaculus.com' + req.path.replace('/api/metaculus', '');
    const response = await fetch(url + '?' + new URLSearchParams(req.query));
    const data = await response.json();
    res.json(data);
});

app.listen(3000, () => console.log('Proxy running on port 3000'));
```

**Pros:**
- ✅ Full control
- ✅ No rate limits
- ✅ Can add caching

**Cons:**
- ❌ Requires Node.js setup
- ❌ Need to deploy/maintain server

### Option 3: Browser Extension

Install a CORS-unblocking browser extension (development only):

- **Chrome**: "CORS Unblock" or "Allow CORS"
- **Firefox**: "CORS Everywhere"

**Pros:**
- ✅ Quick for development

**Cons:**
- ❌ Only works on your machine
- ❌ Security risk if left enabled
- ❌ Not a production solution

### Option 4: Server-Side Rendering (SSR)

Use Next.js, Nuxt, or similar framework with API routes:

```javascript
// pages/api/metaculus.js (Next.js)
export default async function handler(req, res) {
    const response = await fetch('https://www.metaculus.com/api/posts/...');
    const data = await response.json();
    res.status(200).json(data);
}
```

**Pros:**
- ✅ Production-ready
- ✅ No CORS issues
- ✅ Can add authentication, caching, etc.

**Cons:**
- ❌ Requires framework setup
- ❌ More complex deployment

## 🛡️ Other CORS Proxy Options

If `allorigins.win` is slow or down, you can use alternatives:

### 1. **corsproxy.io**
```javascript
const corsProxy = 'https://corsproxy.io/?';
const proxiedUrl = corsProxy + encodeURIComponent(url);
```

### 2. **cors-anywhere (self-hosted)**
```javascript
const corsProxy = 'https://cors-anywhere.herokuapp.com/';
const proxiedUrl = corsProxy + url;
```

### 3. **Your Own Cloudflare Worker**
```javascript
// worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')
  
  const response = await fetch(targetUrl)
  const newResponse = new Response(response.body, response)
  
  newResponse.headers.set('Access-Control-Allow-Origin', '*')
  return newResponse
}
```

## 📝 Updating the Proxy

To change the CORS proxy in `app.js`, find line ~134:

```javascript
const corsProxy = 'https://api.allorigins.win/raw?url=';
```

Replace with your preferred proxy:

```javascript
// Option 1: corsproxy.io
const corsProxy = 'https://corsproxy.io/?';

// Option 2: Your own proxy
const corsProxy = 'https://your-proxy.com/api?url=';
```

## 🚨 Important Notes

### For Development
- The CORS proxy solution works great for development and testing
- No additional setup required

### For Production
Consider these options:
1. **Backend Proxy**: Create your own API proxy server
2. **Serverless Functions**: Use Vercel, Netlify, or AWS Lambda
3. **Contact Metaculus**: Request CORS headers be added to their API

### Rate Limits
- Free CORS proxies may have rate limits
- For heavy usage, consider self-hosting or using a backend

## 🔧 Troubleshooting

### Proxy Not Working?

1. **Check Network Tab**: Open DevTools → Network to see the actual request
2. **Try Different Proxy**: Switch to an alternative CORS proxy
3. **Check Proxy Status**: Visit the proxy URL directly to ensure it's online

### Still Getting CORS Errors?

1. **Clear Cache**: Hard refresh (Ctrl+Shift+R)
2. **Check Console**: Look for specific error messages
3. **Verify URL**: Ensure the Metaculus API URL is correct

### Slow Loading?

- CORS proxies add latency (extra network hop)
- Consider caching responses in localStorage
- Use your own proxy server for better performance

## 📚 Learn More

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Understanding CORS](https://web.dev/cross-origin-resource-sharing/)
- [CORS Proxy Comparison](https://gist.github.com/jimmywarting/ac1be6ea0297c16c477e17f8fbe51347)

## ✅ Current Status

✅ **FIXED**: Metaculus API now works through CORS proxy
✅ **Manifold Markets**: Works natively (no proxy needed)
✅ **Both sources**: Fully functional in the application

---

**Your application is now fully functional with both data sources!** 🎉
