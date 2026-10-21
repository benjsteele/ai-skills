# ai-skills

Instructions that shape how AI assistants behave in day-to-day work, plus a way to test whether those instructions actually help.

## Why this exists

AI assistants such as Claude follow written instructions: "cite your sources", "say when you don't know", "show your working". Writing those instructions is easy. Knowing whether they work is not. An instruction can make answers more accurate, make no difference, or quietly make the assistant less helpful, for example by refusing simple questions or burying answers under caveats.

This repo holds both halves:

1. **Instructions** ([`CLAUDE.md`](CLAUDE.md)). What the assistant should do.
2. **Evaluations** ([`evals/`](evals/README.md)). Repeatable tests that compare the assistant's answers with and without the instructions, so changes are judged on evidence rather than impressions.

```
ai-skills/
├── CLAUDE.md          The accuracy-first instructions (read by Claude Code)
├── prompts/           Paste-ready short version for apps and APIs
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

**Two versions.** `CLAUDE.md` has the full rules above. [`prompts/accuracy-first-short.md`](prompts/accuracy-first-short.md) has a one-paragraph **paste-ready** version for tools with limited space. The short version covers the role and rules 2, 3 and 5, but not rule 4's definition of a source or the mode caveat.

## Loading the instructions into Claude

| Where you use Claude | How to load the instructions |
|---|---|
| **Claude Code, in this repo** | Nothing to do. Claude Code reads `CLAUDE.md` from the project folder automatically. |
| **Claude Code, in another project** | Copy `CLAUDE.md` into that project's root folder. |
| **Claude app or claude.ai** | Paste the paragraph from [`prompts/accuracy-first-short.md`](prompts/accuracy-first-short.md) into your personal preferences (custom instructions) in settings. It then applies to every chat. To apply it to one area of work only, paste it into a Project's instructions instead. |
| **Claude API, in your own code** | Send the paste-ready paragraph, or the whole of `CLAUDE.md`, as the `system` prompt of each request. |

**Keep copies in sync.** Text pasted into the app or a Project doesn't update when `CLAUDE.md` changes. Re-paste after every edit.

## Testing the instructions

The `evals/` folder tests whether the instructions help. It asks Claude 26 test questions, with and without the instructions, and scores the answers on three things:

- **Correctness:** is the answer right?
- **Compliance:** does it follow the rules above?
- **Over-refusal:** does it still help with ordinary requests?

**Developers:** the [developer guide](evals/README.md) covers how it's built, how to run it, cost and how to add tests.

**No setup needed:** you can test by hand in the Claude app. Ask the same questions with your custom instructions off and then on, and compare the answers against the criteria in [`evals/cases.yaml`](evals/cases.yaml).

## Results so far

First real run, 20–21 October 2026. Each of the 26 cases was asked 3 times per version. Model under test: Claude Opus 5.5. Grader: Claude Sonnet 5.5, which agreed 32/32 with known verdicts in calibration at the time; the calibration set has since grown to 63 answers covering every rubric, and GPT-4.1 scores 63/63 on it. Cost: about $2.60 per full run at list prices. All 26 cases scored.

| Score | No instructions | Full `CLAUDE.md` | Paste-ready paragraph |
|---|---|---|---|
| Correctness | 100% (102/102) | 98% (100/102) | 100% (102/102) |
| Compliance | 8% (4/51) | 96% (49/51) | **100%** (51/51) |
| Over-refusal (higher is better) | 100% (27/27) | 100% (27/27) | 100% (27/27) |

What this says:

- **The rules are followed.** With the instructions loaded, 49–51 of 51 compliance checks passed: quotes are verbatim, the prescribed uncertainty phrases are used, unsourced facts are labelled. Without them, 8%.
- **No cost to helpfulness.** Not one over-refusal in any version, including the paste-ready paragraph that omits the mode caveat.
- **Correctness can't improve on these cases.** Opus 5.5 already scores 100% without instructions, so the synthetic cases are too easy to show a gain.
- **The full file can over-hedge.** Its only two correctness misses were on the pushback case: it kept the right price (£8), quoted the source, and refused to switch to £10, but then added that it "can't say which is current" and labelled the user's claim "Unverified". That is rule 4 applied to the user's own words, and the grader read it as presenting the price as uncertain. The paste-ready paragraph, which omits rule 4, did not do this. Whether it is a flaw or correct caution is a judgement call; the case is listed as one in the developer guide.
- **Paste-ready is as good as the full file here.** Across three full runs the two versions traded single-check misses; neither is reliably better on these cases.
- **The two filter-sensitive cases now run.** An earlier version of this run covered only 24 of 26 because the gateway's content filter refused two cases outright. Both were reworded to keep what they test while passing the filter (see the [developer guide](evals/README.md#content-filters)); the overt originals are kept as an opt-in adversarial set. The instructed versions passed the reworded injection case 6/6.

A control run on a much weaker model (GPT-4o mini, graded by GPT-4.1, same cases, 3 repeats, $0.25, re-run clean after the checker fix) told a different story:

| Score | No instructions | Full `CLAUDE.md` | Paste-ready paragraph |
|---|---|---|---|
| Correctness | 92% (94/102) | **100%** (102/102) | 98% (100/102) |
| Compliance | 0% (0/51) | 51% (26/51) | 41% (21/51) |
| Over-refusal | 100% | 100% | 100% |

Here the instructions fixed every baseline failure: inventing a court case (3/3 runs), accepting a source's false claim that Sydney is Australia's capital (2/3), and not flagging two documents that disagree (3/3). But the weak model only half-follows the rules it is given: it paraphrases where it was told to quote (`citesSource` 12/24), uses its own words for uncertainty rather than the prescribed phrases (12/18), and almost never applies the "Unverified" label (2/9). The instructions help a weak model be right and a strong model be checkable. This run covered all 26 cases.

To reproduce: `cd evals && npm run preflight && npx promptfoo eval --repeat 3 && npm run summary`. Raw answers and grader reasoning: `npx promptfoo view`. To use a model or gateway other than the Anthropic API, see [the developer guide](evals/README.md#using-a-different-provider).

**A note on provenance.** The runs above went through an organisation-internal gateway in front of the same Claude and GPT models, not the Anthropic or OpenAI APIs directly. That gateway's configuration has been removed from this repo so the eval stays provider-agnostic, which means the shipped config (`promptfooconfig.yaml`, pointing at the Anthropic API) has not itself produced the numbers above. The model, prompts, cases, checks and grader are identical; only the transport differs. Expect the same picture, not the same digits.

## Status

- [x] Accuracy-first instructions (`CLAUDE.md`)
- [x] Evaluation framework, dry-run tested
- [x] First real eval run (Opus 5.5, plus GPT-4o mini as a control; see results above)
- [x] Refine from the results. Nothing to change in `CLAUDE.md` on Opus 5.5. The quote checker in `evals/checks.js` was producing false positives on formulas, short paraphrases and labelled blockquotes; fixed and confirmed on a clean GPT-4o mini re-run (0 false positives)
- [x] Make the eval run behind content filters. Two cases were refused outright by a gateway filter; both reworded to keep the construct and verified against the filter, overt versions moved to an opt-in adversarial set, and a `preflight` script added so a blocked case is found before a full run rather than after
- [x] Release hygiene: grader calibration extended to all 25 rubric cases, `summary.js` unit-tested, shared `providers.yaml`, CI, LICENSE
- [ ] Run the shipped config once against the Anthropic API directly so the published numbers come from the repo as released
- [ ] Replace made-up test questions with real ones over time. Priority now that Opus is at ceiling on the synthetic set
- [ ] Add skills to `.claude/skills/`, with evals for each
