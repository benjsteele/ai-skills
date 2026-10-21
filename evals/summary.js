// Prints per-variant scores, error counts, token use and cost from a promptfoo
// results file. Usage: node summary.js [results/latest.json]
//
// Scores are pass rates per named metric (each check's `metric:` in
// cases.yaml), with 95% Wilson intervals: two variants whose intervals
// overlap are not reliably different.
const fs = require('fs');

// US$ per million tokens, vendor list prices. Add a row for any other model
// you point the config at; a provider id is matched by longest substring.
const PRICES = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.6 },
  'gpt-4.1-2025-04-14': { input: 2, output: 8 },
};
// Must match the grader in grader.yaml. Override with GRADER_MODEL=<key>.
const GRADER_MODEL = process.env.GRADER_MODEL || 'claude-sonnet-5-5';

function wilson(passes, n) {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = passes / n;
  const centre = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

function price(model, tokens) {
  const rate = PRICES[model];
  if (!rate || !tokens) return 0;
  return ((tokens.prompt || 0) * rate.input + (tokens.completion || 0) * rate.output) / 1e6;
}

function modelOf(providerId) {
  // Longest match wins so a vendor-prefixed id beats a bare model name.
  return Object.keys(PRICES)
    .filter((m) => (providerId || '').includes(m))
    .sort((a, b) => b.length - a.length)[0];
}

const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);
const usd = (x) => `$${x.toFixed(2)}`;

const file = process.argv[2] || 'results/latest.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const results = data.results.results;

const variants = new Map();
// Per case: how many answers were attempted and how many errored, across all
// versions. A case that errors every time is almost certainly being refused
// or content-filtered by the provider, not failing transiently.
const caseErrors = new Map();
for (const r of results) {
  const label = r.prompt.label;
  if (!variants.has(label)) {
    variants.set(label, { metrics: new Map(), cases: 0, errors: 0, cached: 0, tokens: { model: { prompt: 0, completion: 0 }, grader: { prompt: 0, completion: 0 } }, cost: 0 });
  }
  const v = variants.get(label);
  v.cases += 1;
  const caseName = (r.testCase && r.testCase.description) || '(unnamed case)';
  if (!caseErrors.has(caseName)) caseErrors.set(caseName, { attempts: 0, errors: 0 });
  caseErrors.get(caseName).attempts += 1;

  const model = modelOf(r.provider && r.provider.id);
  const usage = (r.response && r.response.tokenUsage) || {};
  if (r.response && r.response.cached) v.cached += 1;
  else if (model) {
    v.tokens.model.prompt += usage.prompt || 0;
    v.tokens.model.completion += usage.completion || 0;
    v.cost += price(model, usage);
  }
  const graderUsage = (r.gradingResult && r.gradingResult.tokensUsed) || {};
  v.tokens.grader.prompt += graderUsage.prompt || 0;
  v.tokens.grader.completion += graderUsage.completion || 0;
  v.cost += price(GRADER_MODEL, graderUsage);

  // A provider error means no answer was graded: count it, don't score it.
  if (r.error && !(r.gradingResult && r.gradingResult.componentResults)) {
    v.errors += 1;
    caseErrors.get(caseName).errors += 1;
    continue;
  }
  for (const c of (r.gradingResult && r.gradingResult.componentResults) || []) {
    const metric = (c.assertion && c.assertion.metric) || '(no metric)';
    if (!v.metrics.has(metric)) v.metrics.set(metric, { pass: 0, n: 0 });
    const m = v.metrics.get(metric);
    m.n += 1;
    if (c.pass) m.pass += 1;
  }
}

const metricNames = [...new Set([...variants.values()].flatMap((v) => [...v.metrics.keys()]))];
console.log(`Results: ${file}\n`);
for (const [label, v] of variants) {
  console.log(`${label}  (${v.cases} answers, ${v.errors} errors, ${v.cached} from cache)`);
  for (const name of metricNames) {
    const m = v.metrics.get(name) || { pass: 0, n: 0 };
    const [lo, hi] = wilson(m.pass, m.n);
    console.log(`  ${name.padEnd(16)} ${pct(m.n ? m.pass / m.n : 0)}  (${m.pass}/${m.n} checks, 95% CI ${pct(lo)}–${pct(hi)})`);
  }
  const t = v.tokens;
  console.log(`  tokens           answers ${t.model.prompt} in / ${t.model.completion} out; grader ${t.grader.prompt} in / ${t.grader.completion} out`);
  console.log(`  cost             ${usd(v.cost)}\n`);
}
const total = [...variants.values()].reduce((sum, v) => sum + v.cost, 0);
console.log(`Total cost: ${usd(total)} (answers from cache cost nothing)`);

const blocked = [...caseErrors].filter(([, c]) => c.errors === c.attempts);
const flaky = [...caseErrors].filter(([, c]) => c.errors > 0 && c.errors < c.attempts);
console.log(`\nCases scored: ${caseErrors.size - blocked.length}/${caseErrors.size}`);
if (blocked.length) {
  console.log('Errored on every attempt (provider refusal or content filter; not scored):');
  for (const [name] of blocked) console.log(`  - ${name}`);
}
if (flaky.length) {
  console.log('Errored on some attempts (likely transient; re-run to fill in):');
  for (const [name, c] of flaky) console.log(`  - ${name} (${c.errors}/${c.attempts})`);
}
