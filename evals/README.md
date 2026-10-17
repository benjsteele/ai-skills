# Evals

A lightweight [promptfoo](https://www.promptfoo.dev/) eval for the instructions in `../CLAUDE.md`.

It sends 22 test questions to Claude, once for each of three prompt versions:

| Variant | System prompt |
|---|---|
| `baseline` | none |
| `claude-md` | the whole of `CLAUDE.md` |
| `paste-ready` | only the "Paste-Ready System Prompt" paragraph from `CLAUDE.md` |

Both prompts are read from `CLAUDE.md` at run time, so edits there are picked up automatically.

## Files

- `promptfooconfig.yaml` — variants, model under test (`claude-opus-5-5`), grader model (`claude-sonnet-5-5`).
- `cases.yaml` — the test cases and what a good answer does for each.
- `prompts.js` — builds the messages for each variant, including the optional earlier exchange for two-turn cases.
- `checks.js` — code checks: quotations appear word for word in the source, prescribed phrases ("I don't have enough information", "Unverified") are used. Tested by `checks.test.js` (`npm test`).

## Cases

| Category | What it checks |
|---|---|
| `grounded` | With a source supplied: quotes it accurately, says when the answer isn't there, flags conflicts, doesn't overstate, ignores instructions hidden in the source, holds its answer under pushback. |
| `no-source` | Without a source: doesn't invent cases or results, corrects false premises, asks when a question is unclear, still answers common knowledge. |
| `reasoning` | Arithmetic and logic come out right. |
| `over-refusal` | Code facts, poems, brainstorming and speculation aren't blocked by the accuracy rules. |

All sources in the cases are fictional, so the right answer is fixed by the case itself. The model under test has no tools (no web search), which the "recent event" case relies on.

## Reading the results

Every check reports into one of three named scores, shown per prompt version in `promptfoo view`:

| Score | Question it answers |
|---|---|
| `correctness` | Is the answer right and grounded? |
| `compliance` | Does it follow `CLAUDE.md`'s rules: quotes the source, labels unsourced facts "Unverified", uses the prescribed uncertainty phrases? |
| `over-refusal` | Does it still help with ordinary requests the rules shouldn't block? |

Compare these scores between versions, not the overall pass rate. A case passes overall only if every check passes, which mixes the three. Expect `baseline` to score low on `compliance`, since it was never given the rules.

The grader model sees only the answer and the rubric text, not the question. Rubrics that need the source include it with `{{source}}`.

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
- `npx promptfoo eval --filter-metadata category=grounded` runs one category only.

Each run costs money: 66 answers from the model under test (22 cases × 3 versions), plus 66 grading calls (one per `llm-rubric` check). The cost hasn't been measured yet; run a few cases first with `--filter-first-n 3` to see it.

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
      metric: correctness            # or compliance / over-refusal
      value: |
        Source given to the model: {{source}}
        Criteria: <concrete, checkable description of a good answer>
```

Prefer `regex` / `icontains` checks where the answer is fixed; use `llm-rubric` for judgement calls. Give every check a `metric`.
