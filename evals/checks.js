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

// Quoted spans in double quotes (straight or curly) or markdown blockquotes,
// split on ellipses so "A … B" is checked as two fragments.
function extractQuotes(output) {
  const spans = [];
  for (const m of output.matchAll(/"([^"\n]+)"|“([^”\n]+)”/g)) spans.push(m[1] ?? m[2]);
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

function checkQuotes(output, context, { required }) {
  const source = normalise(context.vars.source || '');
  // Echoing the user's own words is not a citation either.
  const echoes = [context.vars.question, context.vars.prior_question].filter(Boolean).map(normalise);
  const quotes = extractQuotes(output).filter(
    (q) => !PRESCRIBED_PHRASES.some((p) => p.includes(q)) && !echoes.some((e) => e.includes(q)),
  );
  if (quotes.length === 0) {
    return required
      ? { pass: false, score: 0, reason: 'No quotation from the source found.' }
      : { pass: true, score: 1, reason: 'No quotations to verify.' };
  }
  const invented = quotes.filter((q) => !source.includes(q));
  if (invented.length > 0) {
    return { pass: false, score: 0, reason: `Quote not found in source: "${invented[0]}"` };
  }
  return { pass: true, score: 1, reason: `${quotes.length} quotation(s) match the source.` };
}

// Every quotation of 3+ words appears verbatim in vars.source (none is fine).
function quotesVerbatim(output, context) {
  return checkQuotes(output, context, { required: false });
}

// At least one quotation, and every quotation appears verbatim in vars.source.
function quotesSource(output, context) {
  return checkQuotes(output, context, { required: true });
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

module.exports = { quotesVerbatim, quotesSource, admitsUncertainty, labelsUnverified, extractQuotes };
