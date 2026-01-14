# 🤖 AI Assistant Setup Guide

## Overview
The Prediction Market Analyzer now supports integration with Large Language Models (LLMs) to provide deep semantic analysis of market trends.

## Supported Providers
The application uses the standard OpenAI Chat Completion API format, which means it works with:

1. **OpenAI** (ChatGPT)
2. **DeepSeek**
3. **OpenRouter** (Access to Claude, Gemini, Llama, etc.)
4. **LocalAI / LM Studio** (Run local models)

## Configuration Details

### OpenAI
- **Base URL**: `https://api.openai.com/v1`
- **Model**: `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`
- **API Key**: `sk-...` (Get from platform.openai.com)

### DeepSeek
- **Base URL**: `https://api.deepseek.com`
- **Model**: `deepseek-chat`
- **API Key**: `sk-...`

### OpenRouter (Recommended for variety)
- **Base URL**: `https://openrouter.ai/api/v1`
- **Model**: `google/gemini-pro-1.5`, `anthropic/claude-3-haiku`, `meta-llama/llama-3-8b`
- **API Key**: `sk-or-...`

### LocalAI / LM Studio
- **Base URL**: `http://localhost:1234/v1` (or whatever port you use)
- **Model**: `local-model` (or exact name loaded)
- **API Key**: `any-string` (usually ignored)

## How It Works in Code
The `generateLLMInsights` function in `app.js` sends a prompt containing a JSON summary of the top 20 markets.

```javascript
// app.js
const marketSummary = this.filteredMarkets.slice(0, 20).map(m => ({
    question: m.question,
    probability: Math.round(m.probability * 100),
    participants: m.participants,
    tags: m.tags,
    source: m.source
}));
```

The LLM is instructed to return a standard JSON array of insights, which is then rendered directly into the UI.

## Troubleshooting
- **CORS Errors**: If using a custom server or LocalAI, ensure CORS is enabled on the server side (`Access-Control-Allow-Origin: *`).
- **401 Unauthorized**: Check your API key.
- **404 Not Found**: Check if your Base URL is correct (usually needs `/v1` at the end).
