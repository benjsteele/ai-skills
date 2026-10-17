// Prompt variants under test. Each reads ../CLAUDE.md at run time so the eval
// always tests the current instructions, never a stale copy.
const fs = require('fs');
const path = require('path');

const CLAUDE_MD = fs.readFileSync(path.join(__dirname, '..', 'CLAUDE.md'), 'utf8');

// The standalone prompt is the paragraph under "## Paste-Ready System Prompt".
const PASTE_READY = (() => {
  const match = CLAUDE_MD.match(/## Paste-Ready System Prompt\s+([\s\S]*?)\n## /);
  if (!match) throw new Error('Could not find "## Paste-Ready System Prompt" section in CLAUDE.md');
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
