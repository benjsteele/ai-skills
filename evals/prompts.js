// Prompt variants under test. Each reads its source file at run time so the
// eval always tests the current instructions, never a stale copy.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CLAUDE_MD = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');

// The standalone prompt is the text under "## Prompt" in
// prompts/accuracy-first-short.md, up to the next heading or end of file.
const PASTE_READY = (() => {
  const file = path.join(ROOT, 'prompts', 'accuracy-first-short.md');
  const match = fs.readFileSync(file, 'utf8').match(/^## Prompt\s+([\s\S]*?)(?=\n## |\s*$)/m);
  if (!match || !match[1].trim()) throw new Error(`Could not find a "## Prompt" section in ${file}`);
  return match[1].trim();
})();

function userMessage(vars) {
  if (!vars.source) return vars.question;
  return `<source>\n${vars.source}\n</source>\n\n${vars.question}`;
}

// Optional prior exchange (vars.prior_question / vars.prior_answer) for
// multi-turn cases; the source travels with the first user turn.
function messages(system, vars) {
  const turns = system ? [{ role: 'system', content: system }] : [];
  if (vars.prior_question) {
    turns.push({ role: 'user', content: userMessage({ ...vars, question: vars.prior_question }) });
    turns.push({ role: 'assistant', content: vars.prior_answer });
    turns.push({ role: 'user', content: vars.question });
  } else {
    turns.push({ role: 'user', content: userMessage(vars) });
  }
  return turns;
}

module.exports = {
  baseline: ({ vars }) => messages(null, vars),
  claudeMd: ({ vars }) => messages(CLAUDE_MD, vars),
  pasteReady: ({ vars }) => messages(PASTE_READY, vars),
};
