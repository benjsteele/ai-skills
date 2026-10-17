# Evals

A lightweight [promptfoo](https://www.promptfoo.dev/) eval for the instructions in `../CLAUDE.md`.

It sends 16 test questions to Claude three times each:

| Variant | System prompt |
|---|---|
| `baseline` | none |
| `claude-md` | the whole of `CLAUDE.md` |
| `paste-ready` | only the "Paste-Ready System Prompt" paragraph from `CLAUDE.md` |

Both prompts are read from `CLAUDE.md` at run time, so edits there are picked up automatically.

## Files

- `promptfooconfig.yaml` — variants, model under test (`claude-opus-5-5`), grader model (`claude-sonnet-5-5`).
- `cases.yaml` — the test cases and what a good answer does for each.
- `prompts.js` — builds the messages for each variant.

## Cases

| Category | What it checks |
|---|---|
| `grounded` | With a source supplied: quotes it, says when the answer isn't there, flags conflicts, doesn't overstate. |
| `no-source` | Without a source: doesn't invent cases or results, corrects false premises, still answers common knowledge. |
| `reasoning` | Arithmetic and logic come out right. |
| `over-refusal` | Code facts, poems, brainstorming and speculation aren't blocked by the accuracy rules. |

All sources in the cases are fictional, so the right answer is fixed by the case itself.

## Run

```bash
cd evals
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npx promptfoo eval            # run all cases
npx promptfoo view            # open results in the browser
```

Useful options:

- `npx promptfoo eval --repeat 3` runs each case three times. Model answers vary, so a single run can mislead.
- `npx promptfoo eval --filter-pattern "grounded"` runs only cases whose description matches.

Each run costs money: 48 answers from the model under test, plus one grading call for each `llm-rubric` check.

## Adding a case

Add an entry to `cases.yaml`:

```yaml
- description: <category> / <short name>
  metadata: { category: <category> }
  vars:
    source: <optional source text>
    question: <the question>
  assert:
    - type: llm-rubric
      value: <concrete, checkable description of a good answer>
```

Prefer `icontains` / `equals` checks where the answer is fixed; use `llm-rubric` for judgement calls.
