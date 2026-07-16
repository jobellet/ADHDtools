# Optional AI Assistance (Any Provider)

ADHD Tools works **fully offline with no AI at all** — the schedule generator, natural-language quick capture, routines, rewards, and every other tool have non-LLM implementations. Configuring an AI provider is optional and unlocks:

* Smarter natural-language task capture (typed or spoken) — better date/duration/priority understanding than the offline parser.
* ✨ AI Breakdown in the Task Breakdown tool (sub-tasks with duration estimates).
* AI Plan in the Day Planner (schedules loose tasks around existing events).
* A short AI encouragement note in the daily progress card.

## Supported providers

Open **Settings → AI Assistance (optional — any provider)** and pick one:

| Provider | Default model | Where to get a key |
| --- | --- | --- |
| OpenAI (ChatGPT) | `gpt-4o-mini` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Google Gemini | `gemini-2.5-flash` | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| Anthropic (Claude) | `claude-haiku-4-5-20251001` | [console.anthropic.com](https://console.anthropic.com) |
| Mistral | `mistral-small-latest` | [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys) |
| Groq | `llama-3.3-70b-versatile` | [console.groq.com/keys](https://console.groq.com/keys) |
| OpenRouter | `openai/gpt-4o-mini` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Custom / Local | any | Any OpenAI-compatible endpoint: Ollama, LM Studio, vLLM… (no key needed for most local servers) |

Paste your key, optionally override the model, click **Test connection**, then **Save**. A step-by-step tutorial for obtaining keys is built into the Settings panel itself.

Keys are stored only in your browser's `localStorage` and requests go directly from your browser to the provider — there is no middleman server. Using an API may incur charges with your provider; keep your key private and use the **Clear** button to remove it at any time.

Existing users with a saved Gemini key are migrated automatically.

**Developers:** the shared layer lives in `core/ai-provider.js` (`window.AIAssistant.complete/completeJSON/isEnabled`). New features should call it (never a specific provider) and must always offer a non-AI fallback path.

---

[← Back to README](../README.md)
