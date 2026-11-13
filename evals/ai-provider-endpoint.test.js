// Run with: npm test
// Exercises the generic parts of ai-provider-endpoint.js against a stubbed
// fetch: prompt parsing, cache hit/miss/bust, error shaping, token totals.
const test = require('node:test');
const assert = require('node:assert');
const Provider = require('./ai-provider-endpoint.js');

const CONFIG = { url: 'https://example.test/v1/chat', apiKeyEnvar: 'TEST_ENDPOINT_KEY', model: 'm', maxTokens: 10 };
const PROMPT = JSON.stringify([
  { role: 'system', content: 'Be brief.' },
  { role: 'user', content: 'Hi' },
]);

function okResponse(text = 'Hello', usage = { prompt_tokens: 7, completion_tokens: 3 }) {
  return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: text }, finish_reason: 'stop' }], usage }) };
}

function memoryCache() {
  const m = new Map();
  return { get: async (k) => m.get(k), set: async (k, v) => void m.set(k, v), size: () => m.size };
}

function withFetch(impl, fn) {
  const orig = globalThis.fetch;
  globalThis.fetch = impl;
  return fn().finally(() => (globalThis.fetch = orig));
}

test.beforeEach(() => (process.env.TEST_ENDPOINT_KEY = 'k'));

test('requires url and apiKeyEnvar', () => {
  assert.throws(() => new Provider({ config: { url: 'x' } }), /apiKeyEnvar/);
  assert.throws(() => new Provider({ config: { apiKeyEnvar: 'x' } }), /url/);
});

test('errors cleanly when the key env var is unset', async () => {
  delete process.env.TEST_ENDPOINT_KEY;
  const r = await new Provider({ config: CONFIG }).callApi(PROMPT, {});
  assert.match(r.error, /TEST_ENDPOINT_KEY is not set/);
});

test('sends system + turns and returns output with token totals', async () => {
  let sent;
  const r = await withFetch(async (url, init) => { sent = { url, init }; return okResponse(); }, () =>
    new Provider({ config: CONFIG }).callApi(PROMPT, {}));
  assert.strictEqual(sent.url, CONFIG.url);
  assert.strictEqual(sent.init.headers.Authorization, 'Bearer k');
  const body = JSON.parse(sent.init.body);
  assert.deepStrictEqual(body.messages[0], { role: 'system', content: 'Be brief.' });
  assert.deepStrictEqual(body.messages[1], { role: 'user', content: 'Hi' });
  assert.strictEqual(r.output, 'Hello');
  assert.deepStrictEqual(r.tokenUsage, { prompt: 7, completion: 3, total: 10 });
  assert.strictEqual(r.cached, undefined);
});

test('a plain-string prompt becomes a single user turn', async () => {
  let body;
  await withFetch(async (_u, init) => { body = JSON.parse(init.body); return okResponse(); }, () =>
    new Provider({ config: CONFIG }).callApi('just text', {}));
  assert.deepStrictEqual(body.messages, [{ role: 'user', content: 'just text' }]);
});

test('caches by body and repeat index; bustCache bypasses the read', async () => {
  const cache = memoryCache();
  let calls = 0;
  const impl = async () => { calls++; return okResponse(`answer ${calls}`); };
  const p = new Provider({ config: CONFIG });
  const ctx = (extra) => ({ getCache: async () => cache, ...extra });

  const a = await withFetch(impl, () => p.callApi(PROMPT, ctx({ repeatIndex: 0 })));
  const b = await withFetch(impl, () => p.callApi(PROMPT, ctx({ repeatIndex: 0 })));
  const c = await withFetch(impl, () => p.callApi(PROMPT, ctx({ repeatIndex: 1 })));
  const d = await withFetch(impl, () => p.callApi(PROMPT, ctx({ repeatIndex: 0, bustCache: true })));

  assert.strictEqual(a.output, 'answer 1');
  assert.strictEqual(b.output, 'answer 1');
  assert.strictEqual(b.cached, true);
  assert.strictEqual(c.output, 'answer 2', 'a different repeat index is a separate sample');
  assert.strictEqual(d.output, 'answer 3', 'bustCache forces a fresh call');
  assert.strictEqual(calls, 3);
});

test('non-2xx and non-JSON responses become errors, not outputs', async () => {
  const p = new Provider({ config: CONFIG });
  const r1 = await withFetch(async () => ({ ok: false, status: 503, text: async () => '{"message":"down"}' }), () => p.callApi(PROMPT, {}));
  assert.match(r1.error, /HTTP 503/);
  const r2 = await withFetch(async () => ({ ok: true, status: 200, text: async () => '<html>oops</html>' }), () => p.callApi(PROMPT, {}));
  assert.match(r2.error, /non-JSON/);
  const r3 = await withFetch(async () => { throw new Error('ECONNRESET'); }, () => p.callApi(PROMPT, {}));
  assert.match(r3.error, /request failed: ECONNRESET/);
});

test('a 200 with no choices is an error from parseResponse', async () => {
  const r = await withFetch(async () => ({ ok: true, status: 200, text: async () => '{"error":"filtered"}' }), () =>
    new Provider({ config: CONFIG }).callApi(PROMPT, {}));
  assert.match(r.error, /no choices/);
});
