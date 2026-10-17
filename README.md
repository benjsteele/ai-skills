# ai-skills

Instructions that shape how AI assistants behave in day-to-day work, plus a way to test whether those instructions actually help.

## Why this exists

AI assistants such as Claude follow written instructions: "cite your sources", "say when you don't know", "show your working". Writing those instructions is easy. Knowing whether they work is not. An instruction can make answers more accurate, make no difference, or quietly make the assistant less helpful, for example by refusing simple questions or burying answers under caveats.

This repo holds both halves:

1. **Instructions** ([`CLAUDE.md`](CLAUDE.md)). What the assistant should do.
2. **Evaluations** ([`evals/`](evals/README.md)). Repeatable tests that compare the assistant's answers with and without the instructions, so changes are judged on evidence rather than impressions.

```
ai-skills/
├── CLAUDE.md          The accuracy-first instructions
├── .claude/skills/    Reusable skills (empty for now; see its README)
└── evals/             The evaluation framework (developer guide inside)
```

## The instructions

`CLAUDE.md` contains **accuracy-first** instructions. Their goal is an assistant that would rather say "I don't know" than sound confident and be wrong.

### The default role

> "You are a meticulous research analyst whose professional reputation depends on never overstating confidence."

The role sets the assistant's priorities before any specific rule applies. AI assistants tend to answer fluently and confidently, even when they are unsure. Casting the assistant as an analyst whose reputation depends on calibrated confidence tells it that a careful "I'm not sure" is a good answer, and a confident guess is a bad one.

### The five rules and what each one is for

| # | Rule | What it asks for | The problem it addresses |
|---|---|---|---|
| 1 | **Role and confidence calibration** | Restates the default role as the first rule. | Repeats the most important idea so it carries the most weight. How sure the assistant sounds should match how sure it actually is. |
| 2 | **Explicit uncertainty exit** | When unsure, say "I don't know" or "I am not certain". Don't fill gaps with guesses. | Assistants often invent a plausible answer rather than admit a gap. This rule gives explicit permission to stop, and the exact words to use. |
| 3 | **Citations or direct quotes** | Back every factual claim with a direct quote from the source. If there is no source, label the claim "Unverified — no source provided". | Makes every claim checkable. You can see where a fact came from, or that it came from nowhere. |
| 4 | **Grounding boundary** | Only treat these as sources: what the user provides, files read from the repo, and output from tools run in the session. Background knowledge can support reasoning, but facts from it must be labelled "Unverified". If the sources don't answer the question, say "I don't have enough information", say what's missing, and ask for it or offer to look it up. | Rule 3 needs a definition of "source". This draws the line, stops the assistant passing off memory as fact, and turns "I don't know" into a next step. |
| 5 | **Step-by-step reasoning** | Think step by step before answering logic, maths or multi-step questions. | Working through a problem in steps catches mistakes a snap answer would make. |

**The mode caveat.** Strict citation rules make no sense for a poem or a brainstorm. For creative, speculative or brainstorming tasks, rules 3 and 4 are relaxed, but anything speculative must be labelled as such.

**Two versions.** `CLAUDE.md` has the full rules above, plus a one-paragraph **Paste-Ready System Prompt** for tools with limited space. The short version covers the role and rules 2, 3 and 5, but not rule 4's definition of a source.

## Loading the instructions into Claude

| Where you use Claude | How to load the instructions |
|---|---|
| **Claude Code, in this repo** | Nothing to do. Claude Code reads `CLAUDE.md` from the project folder automatically. |
| **Claude Code, in another project** | Copy `CLAUDE.md` into that project's root folder. |
| **Claude app or claude.ai** | Paste the Paste-Ready System Prompt paragraph into your personal preferences (custom instructions) in settings. It then applies to every chat. To apply it to one area of work only, paste it into a Project's instructions instead. |
| **Claude API, in your own code** | Send the paste-ready paragraph, or the whole of `CLAUDE.md`, as the `system` prompt of each request. |

**Keep copies in sync.** Text pasted into the app or a Project doesn't update when `CLAUDE.md` changes. Re-paste after every edit.

## Testing the instructions

The `evals/` folder tests whether the instructions help. It asks Claude 26 test questions, with and without the instructions, and scores the answers on three things:

- **Correctness:** is the answer right?
- **Compliance:** does it follow the rules above?
- **Over-refusal:** does it still help with ordinary requests?

**Developers:** the [developer guide](evals/README.md) covers how it's built, how to run it, cost and how to add tests.

**No setup needed:** you can test by hand in the Claude app. Ask the same questions with your custom instructions off and then on, and compare the answers against the criteria in [`evals/cases.yaml`](evals/cases.yaml).

## Status

- [x] Accuracy-first instructions (`CLAUDE.md`)
- [x] Evaluation framework, dry-run tested
- [ ] First real eval run, then refine `CLAUDE.md` from the results
- [ ] Replace made-up test questions with real ones over time
- [ ] Add skills to `.claude/skills/`, with evals for each
