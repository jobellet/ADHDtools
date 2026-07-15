// core/ai-provider.js - provider-agnostic AI assistance layer.
// The app is fully functional without AI: every feature has a non-LLM path and
// this module simply reports "not enabled" when no provider is configured.
// Supported providers: OpenAI (ChatGPT), Google Gemini, Anthropic (Claude),
// Mistral, Groq, OpenRouter, and any custom OpenAI-compatible endpoint
// (Ollama, LM Studio, vLLM, ...).
// Settings live in localStorage under 'adhd-ai-settings' and never leave the browser.

(() => {
  const SETTINGS_KEY = 'adhd-ai-settings';
  const LEGACY_GEMINI_KEY = 'geminiApiKey';

  const PROVIDERS = {
    none: {
      label: 'None (no AI — everything works offline)',
      requiresKey: false,
    },
    openai: {
      label: 'OpenAI (ChatGPT)',
      defaultModel: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
      style: 'openai',
      requiresKey: true,
      keyHint: 'platform.openai.com/api-keys',
    },
    gemini: {
      label: 'Google Gemini',
      defaultModel: 'gemini-2.5-flash',
      style: 'gemini',
      requiresKey: true,
      keyHint: 'aistudio.google.com/app/apikey',
    },
    anthropic: {
      label: 'Anthropic (Claude)',
      defaultModel: 'claude-haiku-4-5-20251001',
      baseUrl: 'https://api.anthropic.com/v1',
      style: 'anthropic',
      requiresKey: true,
      keyHint: 'console.anthropic.com',
    },
    mistral: {
      label: 'Mistral',
      defaultModel: 'mistral-small-latest',
      baseUrl: 'https://api.mistral.ai/v1',
      style: 'openai',
      requiresKey: true,
      keyHint: 'console.mistral.ai/api-keys',
    },
    groq: {
      label: 'Groq',
      defaultModel: 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai/v1',
      style: 'openai',
      requiresKey: true,
      keyHint: 'console.groq.com/keys',
    },
    openrouter: {
      label: 'OpenRouter (many models)',
      defaultModel: 'openai/gpt-4o-mini',
      baseUrl: 'https://openrouter.ai/api/v1',
      style: 'openai',
      requiresKey: true,
      keyHint: 'openrouter.ai/keys',
    },
    custom: {
      label: 'Custom / Local (OpenAI-compatible: Ollama, LM Studio…)',
      defaultModel: 'llama3.2',
      baseUrl: 'http://localhost:11434/v1',
      style: 'openai',
      requiresKey: false,
      keyHint: 'optional, depends on your server',
    },
  };

  function getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { provider: 'none', apiKey: '', model: '', baseUrl: '', ...parsed };
        }
      }
    } catch (err) {
      console.warn('Failed to read AI settings', err);
    }
    // Migrate the legacy Gemini-only key so existing users keep working.
    const legacyKey = localStorage.getItem(LEGACY_GEMINI_KEY);
    if (legacyKey) {
      const migrated = { provider: 'gemini', apiKey: legacyKey, model: '', baseUrl: '' };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(migrated));
      } catch (err) { /* storage full — keep going in-memory */ }
      return migrated;
    }
    return { provider: 'none', apiKey: '', model: '', baseUrl: '' };
  }

  function saveSettings(partial) {
    const next = { ...getSettings(), ...partial };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    // Keep the legacy key in sync so nothing stale lingers.
    if (next.provider === 'gemini' && next.apiKey) {
      localStorage.setItem(LEGACY_GEMINI_KEY, next.apiKey);
    } else {
      localStorage.removeItem(LEGACY_GEMINI_KEY);
    }
    window.dispatchEvent(new CustomEvent('aiSettingsChanged', { detail: next }));
    return next;
  }

  function clearSettings() {
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(LEGACY_GEMINI_KEY);
    window.dispatchEvent(new CustomEvent('aiSettingsChanged', { detail: getSettings() }));
  }

  function resolve(settings) {
    const cfg = settings || getSettings();
    const provider = PROVIDERS[cfg.provider] || PROVIDERS.none;
    return {
      ...cfg,
      providerDef: provider,
      model: cfg.model || provider.defaultModel || '',
      baseUrl: (cfg.baseUrl || provider.baseUrl || '').replace(/\/+$/, ''),
    };
  }

  function isEnabled(settings) {
    const cfg = resolve(settings);
    if (!cfg.providerDef || cfg.provider === 'none' || !cfg.provider) return false;
    if (cfg.providerDef.requiresKey && !cfg.apiKey) return false;
    return true;
  }

  function buildRequest(cfg, { prompt, system, maxTokens = 1024, temperature = 0.4 }) {
    if (cfg.providerDef.style === 'gemini') {
      const model = encodeURIComponent(cfg.model);
      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`,
        headers: { 'Content-Type': 'application/json' },
        body,
        extract: data => data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || null,
      };
    }
    if (cfg.providerDef.style === 'anthropic') {
      const body = {
        model: cfg.model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
      };
      if (system) body.system = system;
      return {
        url: `${cfg.baseUrl}/messages`,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body,
        extract: data => (data?.content || []).map(part => part.text || '').join('') || null,
      };
    }
    // Default: OpenAI-compatible chat completions (OpenAI, Mistral, Groq, OpenRouter, custom/local).
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    return {
      url: `${cfg.baseUrl}/chat/completions`,
      headers,
      body: { model: cfg.model, messages, max_tokens: maxTokens, temperature },
      extract: data => data?.choices?.[0]?.message?.content || null,
    };
  }

  async function complete(prompt, options = {}) {
    const cfg = resolve(options.settings);
    if (!isEnabled(cfg)) {
      throw new Error('No AI provider configured. Open Settings → API / AI to enable AI assistance (optional).');
    }
    const request = buildRequest(cfg, { prompt, ...options });
    let response;
    try {
      response = await fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
      });
    } catch (err) {
      throw new Error(`Could not reach the ${cfg.providerDef.label} endpoint (${err.message}).`);
    }
    if (!response.ok) {
      let detail = '';
      try {
        detail = (await response.text()).slice(0, 300);
      } catch (err) { /* ignore body read failures */ }
      throw new Error(`AI request failed (${response.status}). ${detail}`);
    }
    const data = await response.json();
    const text = request.extract(data);
    if (!text) throw new Error('The AI provider returned an empty response.');
    return text.trim();
  }

  function extractJSON(text) {
    if (!text) return null;
    let candidate = text.trim();
    const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) candidate = fenced[1].trim();
    const firstBrace = candidate.search(/[[{]/);
    if (firstBrace > 0) candidate = candidate.slice(firstBrace);
    // Trim trailing prose after the JSON payload.
    const lastBrace = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
    if (lastBrace !== -1) candidate = candidate.slice(0, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (err) {
      return null;
    }
  }

  async function completeJSON(prompt, options = {}) {
    const system = options.system
      ? `${options.system}\nRespond with valid JSON only. No prose, no markdown fences.`
      : 'Respond with valid JSON only. No prose, no markdown fences.';
    const text = await complete(prompt, { ...options, system, temperature: options.temperature ?? 0.2 });
    const parsed = extractJSON(text);
    if (parsed === null) throw new Error('The AI response was not valid JSON.');
    return parsed;
  }

  async function testConnection(settings) {
    const text = await complete('Reply with the single word: OK', {
      settings,
      maxTokens: 20,
      temperature: 0,
    });
    return text;
  }

  window.AIAssistant = {
    PROVIDERS,
    getSettings,
    saveSettings,
    clearSettings,
    isEnabled,
    complete,
    completeJSON,
    extractJSON,
    testConnection,
    getActiveLabel() {
      const cfg = resolve();
      return isEnabled(cfg) ? `${cfg.providerDef.label} · ${cfg.model}` : null;
    },
  };

  // Backwards-compatible shim: legacy modules call window.callGemini(prompt)
  // and expect a string or null (never a throw).
  window.callGemini = async function callGemini(prompt) {
    try {
      return await complete(prompt);
    } catch (err) {
      console.warn('AI call failed:', err.message);
      return null;
    }
  };
})();
