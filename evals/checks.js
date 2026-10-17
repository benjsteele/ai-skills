// Deterministic assertions used by cases.yaml as
//   type: javascript
//   value: file://checks.js:<functionName>
// Each returns { pass, score, reason } for promptfoo.

// A span must have at least this many words to count as a quotation;
// shorter ones ("may", "unchanged") are usually emphasis, not citations.
const MIN_QUOTE_WORDS = 3;

function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}£$%']+/gu, ' ')
    .trim();
}

// Quoted spans: double quotes (straight or curly), curly single quotes,
// straight single quotes bounded by whitespace/punctuation (so apostrophes
// such as "library's" don't open a span), and markdown blockquotes. Spans
// are split on ellipses so "A … B" is checked as two fragments.
function extractQuotes(output) {
  const spans = [];
  for (const m of output.matchAll(/"([^"\n]+)"|“([^”\n]+)”|‘([^’\n]+)’/g)) spans.push(m[1] ?? m[2] ?? m[3]);
  for (const m of output.matchAll(/(?:^|[\s(\[])'([^'\n]+)'(?=[\s.,;:!?)\]]|$)/gm)) spans.push(m[1]);
  for (const m of output.matchAll(/^\s*>\s?(.+)$/gm)) spans.push(m[1]);
  return spans
    .flatMap((span) => span.split(/\.\.\.|…|\[\.\.\.\]/))
    .map(normalise)
    .filter((span) => span.split(' ').length >= MIN_QUOTE_WORDS);
}

// Phrases CLAUDE.md tells the model to use verbatim; quoting them is not citing the source.
const PRESCRIBED_PHRASES = [
  'Unverified — no source provided',
  'I don’t have enough information',
  'I don’t know',
  'I am not certain',
].map(normalise);

// Quotations in the output that are meant as citations: prescribed phrases
// and echoes of the user's own words are left out.
function citations(output, vars) {
  const echoes = [vars.question, vars.prior_question].filter(Boolean).map(normalise);
  return extractQuotes(output).filter(
    (q) => !PRESCRIBED_PHRASES.some((p) => p.includes(q)) && !echoes.some((e) => e.includes(q)),
  );
}

// correctness: every quotation of 3+ words appears verbatim in vars.source.
// An answer with no quotations passes.
function quotesVerbatim(output, context) {
  const source = normalise(context.vars.source || '');
  const quotes = citations(output, context.vars);
  const invented = quotes.filter((q) => !source.includes(q));
  if (invented.length > 0) {
    return { pass: false, score: 0, reason: `Quote not found in source: "${invented[0]}"` };
  }
  return { pass: true, score: 1, reason: quotes.length ? `${quotes.length} quotation(s) match the source.` : 'No quotations to verify.' };
}

// compliance: at least one quotation of 3+ words is taken verbatim from
// vars.source, as CLAUDE.md rule 3 requires. Invented quotes are
// quotesVerbatim's concern, not this check's.
function citesSource(output, context) {
  const source = normalise(context.vars.source || '');
  const real = citations(output, context.vars).filter((q) => source.includes(q));
  return real.length > 0
    ? { pass: true, score: 1, reason: `${real.length} verbatim quotation(s) from the source.` }
    : { pass: false, score: 0, reason: 'No verbatim quotation from the source.' };
}

// Uses one of the uncertainty phrases CLAUDE.md prescribes.
function admitsUncertainty(output) {
  const pass = /don['’]t have enough information|i don['’]t know|i am not certain|i['’]m not certain/i.test(output);
  return { pass, score: pass ? 1 : 0, reason: pass ? 'Uses a prescribed uncertainty phrase.' : 'No prescribed uncertainty phrase.' };
}

// Labels unsourced claims as CLAUDE.md prescribes.
function labelsUnverified(output) {
  const pass = /unverified/i.test(output);
  return { pass, score: pass ? 1 : 0, reason: pass ? 'Claim labelled unverified.' : 'No "Unverified" label.' };
}

module.exports = { quotesVerbatim, citesSource, admitsUncertainty, labelsUnverified, extractQuotes };
