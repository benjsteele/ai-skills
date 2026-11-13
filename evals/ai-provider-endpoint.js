// Template for a custom promptfoo provider that calls an arbitrary HTTP
// endpoint. Copy, rename, and fill in the three marked sections. Everything
// else (caching, error shaping, token accounting) is already correct and is
// the part people usually get wrong.
//
//   providers:
//     - id: file://ai-provider-endpoint.js
//       label: my-model
//       config:
//         url: https://your-endpoint.example.com/v1/models/<model>/generate
//         apiKeyEnvar: MY_ENDPOINT_KEY
//         model: <model>            # anything else you need; read via this.config
//         maxTokens: 4000
//
// Caching goes through context.getCache(), the evaluator's own cache, so
// --no-cache, `promptfoo cache clear` and per-repeat keys behave exactly as
// they do for a built-in provider. Do not require('promptfoo').cache here:
// the CLI runs the ESM build and this file loads the CJS build, so they hold
// separate cache state and --no-cache would never reach this provider.
const crypto = require('crypto');

// Turn promptfoo's prompt (a JSON array of {role, content} from prompts.js,
// or a plain string) into {system, turns} for the request builder.
function parsePrompt(prompt) {
  let turns;
  try {
    turns = JSON.parse(prompt);
  } catch {
    turns = [{ role: 'user', content: String(prompt) }];
  }
  if (!Array.isArray(turns)) turns = [{ role: 'user', content: String(prompt) }];
  return {
    system: turns.filter((t) => t.role === 'system').map((t) => t.content).join('\n\n'),
    turns: turns.filter((t) => t.role !== 'system'),
  };
}

module.exports = class AiProviderEndpoint {
  constructor(options = {}) {
    this.config = options.config || {};
    for (const k of ['url', 'apiKeyEnvar']) {
      if (!this.config[k]) throw new Error(`ai-provider-endpoint.js: config.${k} is required`);
    }
    this.label = options.label;
  }

  id() {
    return `ai-provider-endpoint:${this.config.model || new URL(this.config.url).host}`;
  }

  // ── 1. Request body ─────────────────────────────────────────────────────
  // Shape the request your endpoint expects. This example sends an
  // OpenAI-style messages array; replace it with your API's format.
  buildBody({ system, turns }) {
    const messages = system ? [{ role: 'system', content: system }, ...turns] : turns;
    return { model: this.config.model, messages, max_tokens: this.config.maxTokens ?? 4000 };
  }

  // ── 2. Request headers ──────────────────────────────────────────────────
  buildHeaders(apiKey) {
    return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  }

  // ── 3. Response parsing ─────────────────────────────────────────────────
  // Return { output, promptTokens, completionTokens, finishReason } or
  // { error } if the body indicates a failure your HTTP status didn't.
  parseResponse(data) {
    const choice = data.choices?.[0];
    if (!choice) return { error: `no choices in response: ${JSON.stringify(data).slice(0, 300)}` };
    return {
      output: choice.message?.content ?? '',
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      finishReason: choice.finish_reason,
    };
  }

  // ── Everything below is generic; you should not need to change it. ─────
  async callApi(prompt, context) {
    const apiKey = process.env[this.config.apiKeyEnvar];
    if (!apiKey) return { error: `${this.config.apiKeyEnvar} is not set` };

    const body = this.buildBody(parsePrompt(prompt));
    const bodyStr = JSON.stringify(body);

    const cache = context?.getCache ? await context.getCache() : null;
    const key = `${this.id()}:r${context?.repeatIndex ?? 0}:${crypto.createHash('sha256').update(bodyStr).digest('hex')}`;
    if (cache && !context?.bustCache) {
      const hit = await cache.get(key);
      if (hit) return { ...JSON.parse(hit), cached: true };
    }

    let res;
    let text;
    try {
      res = await fetch(this.config.url, {
        method: 'POST',
        headers: this.buildHeaders(apiKey),
        body: bodyStr,
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 300000),
      });
      text = await res.text();
    } catch (err) {
      return { error: `request failed: ${err.message}` };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { error: `non-JSON response (HTTP ${res.status}): ${text.slice(0, 300)}` };
    }
    if (!res.ok) return { error: `HTTP ${res.status}: ${text.slice(0, 500)}` };

    const parsed = this.parseResponse(data);
    if (parsed.error) return { error: parsed.error };

    const result = {
      output: parsed.output,
      tokenUsage: {
        prompt: parsed.promptTokens || 0,
        completion: parsed.completionTokens || 0,
        total: (parsed.promptTokens || 0) + (parsed.completionTokens || 0),
      },
      finishReason: parsed.finishReason,
      raw: data,
    };
    if (cache) await cache.set(key, JSON.stringify(result));
    return result;
  }
};
