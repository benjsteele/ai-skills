// Run with: npm test
// Exercises summary.js against a small synthetic results file: metric
// aggregation, error accounting, cost by provider id, and the per-case
// coverage report.
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function result({ label, caseName, providerId = 'anthropic:messages:claude-opus-5-5', error, checks = [], cached = false, tokens = { prompt: 100, completion: 50 } }) {
  const r = {
    prompt: { label },
    testCase: { description: caseName },
    provider: { id: providerId },
    response: error ? undefined : { output: 'x', cached, tokenUsage: tokens },
    gradingResult: error
      ? undefined
      : { tokensUsed: { prompt: 200, completion: 20 }, componentResults: checks.map(([metric, pass]) => ({ pass, assertion: { metric } })) },
  };
  if (error) r.error = error;
  return r;
}

function runSummary(results, env = {}) {
  const file = path.join(os.tmpdir(), `summary-test-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ results: { results } }));
  try {
    return execFileSync('node', [path.join(__dirname, 'summary.js'), file], { encoding: 'utf8', env: { ...process.env, ...env } });
  } finally {
    fs.unlinkSync(file);
  }
}

test('aggregates pass rates per metric and version', () => {
  const out = runSummary([
    result({ label: 'baseline', caseName: 'c1', checks: [['correctness', true], ['compliance', false]] }),
    result({ label: 'baseline', caseName: 'c2', checks: [['correctness', false], ['compliance', false]] }),
    result({ label: 'claude-md', caseName: 'c1', checks: [['correctness', true], ['compliance', true]] }),
    result({ label: 'claude-md', caseName: 'c2', checks: [['correctness', true], ['compliance', true]] }),
  ]);
  assert.match(out, /baseline[\s\S]*correctness\s+50%\s+\(1\/2 checks/);
  assert.match(out, /baseline[\s\S]*compliance\s+0%\s+\(0\/2 checks/);
  assert.match(out, /claude-md[\s\S]*compliance\s+100%\s+\(2\/2 checks/);
  assert.match(out, /Cases scored: 2\/2/);
});

test('a case that errors on every attempt is reported as blocked, not scored', () => {
  const out = runSummary([
    result({ label: 'baseline', caseName: 'ok', checks: [['correctness', true]] }),
    result({ label: 'baseline', caseName: 'blocked', error: 'content filter' }),
    result({ label: 'claude-md', caseName: 'ok', checks: [['correctness', true]] }),
    result({ label: 'claude-md', caseName: 'blocked', error: 'content filter' }),
  ]);
  assert.match(out, /baseline\s+\(2 answers, 1 errors/);
  assert.match(out, /Cases scored: 1\/2/);
  assert.match(out, /Errored on every attempt[\s\S]*- blocked/);
  assert.doesNotMatch(out, /Errored on some attempts/);
});

test('a case that errors on some attempts is reported as transient', () => {
  const out = runSummary([
    result({ label: 'baseline', caseName: 'flaky', checks: [['correctness', true]] }),
    result({ label: 'baseline', caseName: 'flaky', error: 'timeout' }),
  ]);
  assert.match(out, /Cases scored: 1\/1/);
  assert.match(out, /Errored on some attempts[\s\S]*- flaky \(1\/2\)/);
  assert.doesNotMatch(out, /Errored on every attempt/);
});

test('prices answers by the longest matching provider id and skips cached ones', () => {
  // 1,000,000 prompt tokens at $4/M = $4.00; cached answer costs nothing.
  const out = runSummary([
    result({ label: 'v', caseName: 'c', tokens: { prompt: 1_000_000, completion: 0 } }),
    result({ label: 'v', caseName: 'c', cached: true, tokens: { prompt: 1_000_000, completion: 0 } }),
  ], { GRADER_MODEL: 'no-such-model' });
  assert.match(out, /v\s+\(2 answers, 0 errors, 1 from cache\)/);
  assert.match(out, /cost\s+\$4\.00/);
});

test('an unknown provider id contributes zero model cost', () => {
  const out = runSummary([
    result({ label: 'v', caseName: 'c', providerId: 'mystery:model', tokens: { prompt: 1_000_000, completion: 1_000_000 } }),
  ], { GRADER_MODEL: 'no-such-model' });
  assert.match(out, /cost\s+\$0\.00/);
});
