# ai-skills

A set of written instructions that make Claude more careful about facts, and a test harness that measures whether they work.

## What this is

Claude, like every AI assistant, follows instructions you give it at the start of a conversation. This repo contains one such set of instructions, called **accuracy-first**, and the tooling to check that it does what it claims.

The instructions tell Claude to:

- say "I don't know" rather than guess;
- quote its sources word for word, and label anything it can't source as unverified;
- treat only the material in front of it as a source, not its background knowledge;
- show its working on anything that needs reasoning.

The test harness asks Claude 26 questions three ways — with no instructions, with the full instructions, and with a short paste-ready version — and scores every answer on whether it is right, whether it followed the rules, and whether it still helped with ordinary requests. Results from real runs are in [Results](#results) below.

Everything here is plain text. There is no code to install to *use* the instructions; the code in `evals/` is only for *testing* them.

```
ai-skills/
├── CLAUDE.md                        The accuracy-first instructions (read by Claude Code)
├── prompts/accuracy-first-short.md  One-paragraph version for apps and APIs
├── .claude/skills/                  Reusable skills (empty for now; see its README)
└── evals/                           The test harness (developer guide inside)
```

## What this is not

- **Not a jailbreak defence or safety layer.** The instructions make Claude more honest about what it knows; they don't stop a determined user from asking it to do something it shouldn't, and they are not a substitute for Claude's own safeguards or your organisation's controls.
- **Not a guarantee of correctness.** An instruction can only shape how Claude *presents* what it knows. If the source it is given is wrong, a well-behaved answer quotes the wrong source accurately and flags the conflict; it does not magically know better. The eval shows a strong model is already near 100% correct on these questions with or without the instructions.
- **Not a fact checker or retrieval system.** Nothing here looks anything up. "Quote your source" means the source you pasted in, the file it read, or the output of a tool it ran in the conversation, and nothing else.
- **Not a style guide for creative work.** The instructions explicitly relax for poems, brainstorming and speculation. They are for research, analysis and anything where a wrong fact has a cost.
- **Not tuned for a specific product.** The cases in the eval are synthetic (a fictional library notice, a fictional railway report). They prove the mechanism works; they don't prove it works on your documents. See [Status](#status).
- **Not a benchmark of Claude.** The eval compares Claude with and without the instructions. It says nothing about how Claude compares to other models.

## The instructions in detail

`CLAUDE.md` opens with a role, then gives five rules, then a caveat.

### The role

> "You are a meticulous research analyst whose professional reputation depends on never overstating confidence."

AI assistants default to fluent and confident. The role tells Claude that a careful "I'm not sure" is a good answer and a confident guess is a bad one, before any specific rule applies.

### The five rules

| # | Rule | What it asks for | The problem it addresses |
|---|---|---|---|
| 1 | **Role and confidence calibration** | Restates the role as the first rule. | Repeats the most important idea so it carries the most weight. How sure the assistant sounds should match how sure it actually is. |
| 2 | **Explicit uncertainty exit** | When unsure, say "I don't know" or "I am not certain". Don't fill gaps with guesses. | Assistants often invent a plausible answer rather than admit a gap. This gives explicit permission to stop, and the exact words to use. |
| 3 | **Citations or direct quotes** | Back every factual claim with a direct quote from the source. If there is no source, label the claim "Unverified — no source provided". | Makes every claim checkable. You can see where a fact came from, or that it came from nowhere. |
| 4 | **Grounding boundary** | Only treat these as sources: what the user provides, files read from the repo, and output from tools run in the session. Background knowledge can support reasoning, but facts from it must be labelled "Unverified". If the sources don't answer the question, say "I don't have enough information", say what's missing, and ask for it or offer to look it up. | Rule 3 needs a definition of "source". This draws the line, stops the assistant passing off memory as fact, and turns "I don't know" into a next step. |
| 5 | **Step-by-step reasoning** | Think step by step before answering logic, maths or multi-step questions. | Working through a problem in steps catches mistakes a snap answer would make. |

### The mode caveat

Strict citation rules make no sense for a poem or a brainstorm. For creative, speculative or brainstorming tasks, rules 3 and 4 are relaxed, but anything speculative must be labelled as such.

### The short version

[`prompts/accuracy-first-short.md`](prompts/accuracy-first-short.md) is a single paragraph for places with limited space. It carries the role and rules 2, 3 and 5. It leaves out rule 4's definition of a source and the mode caveat. In testing it performs the same as the full file on every measure (see [Results](#results)).

## Loading the instructions into Claude

Pick the row that matches where you use Claude. You only need one.

| Where you use Claude | What to do | What happens |
|---|---|---|
| **Claude Code, working in this repo** | Nothing. | Claude Code reads `CLAUDE.md` from the project root at the start of every session. |
| **Claude Code, in another project** | Copy `CLAUDE.md` into that project's root folder (next to its `package.json`, `pyproject.toml` or equivalent). If the project already has a `CLAUDE.md`, paste the contents into it. | Same as above. The file is read on every session start, so edits take effect the next time you open Claude Code. |
| **Claude app or claude.ai, for every chat** | In the app's settings, find the custom-instructions or personal-preferences box (its name and location vary by version) and paste the paragraph from `prompts/accuracy-first-short.md`. | Applies to every new conversation. Existing conversations are not affected. |
| **Claude app or claude.ai, for one area of work** | Create or open a **Project**, open its **Instructions**, and paste the paragraph there. | Applies only to chats inside that Project. Use this if you want accuracy-first for research but not for, say, drafting emails. |
| **Claude API, in your own code** | Pass the paragraph (or the whole of `CLAUDE.md`) as the `system` parameter of each `messages.create` call. | Applies to that request only. Read the file at startup rather than hard-coding the text, so it tracks the repo. |

**Which version to paste.** Use the full `CLAUDE.md` wherever it fits (Claude Code, the API). Use the short paragraph where space is tight (the app's settings box). In testing the two perform the same, so this is a convenience choice, not a quality one.

**Keep copies in sync.** Text pasted into the app or a Project is a snapshot. When `CLAUDE.md` or the short version changes, re-paste. Claude Code and the API read the file live, so they need no action.

## Testing the instructions

The `evals/` folder is a [promptfoo](https://www.promptfoo.dev/) project. It asks Claude the same 26 questions three times — no instructions, the full `CLAUDE.md`, the short paragraph — and scores each answer against checks written in advance.

Every check reports into one of three scores:

| Score | Question it answers | What a good result looks like |
|---|---|---|
| **Correctness** | Is the answer right, and are its quotations real? | High for every version. If the instructions *lower* it, they are making Claude worse. |
| **Compliance** | Does it follow the rules: verbatim quotes, the prescribed uncertainty phrases, "Unverified" labels? | Low without instructions (Claude wasn't told the rules), high with them. This is the direct test of whether the instructions are being followed. |
| **Over-refusal** | Does it still write the poem, brainstorm the names, answer "what's the capital of France"? | High for every version. If the instructions lower it, Claude has become unhelpful. |

The 26 cases cover four kinds of situation: a source is supplied (does Claude quote it, notice when it's wrong, refuse to invent what isn't there?); no source is supplied (does it answer common knowledge, refuse to fabricate a court case, correct a false premise?); reasoning (arithmetic, constraints, a syllogism); and everyday requests that the rules must not block.

Answers are graded by a second, different Claude model, so the model under test isn't marking its own work. The grader is itself calibrated against 63 answers whose verdict is known in advance.

**For developers:** the [developer guide](evals/README.md) covers architecture, how to run it, what it costs, how to add cases, and how to point it at a different model or gateway.

**No setup needed:** you can run a manual version in the Claude app. Ask the questions in [`evals/cases.yaml`](evals/cases.yaml) with your custom instructions off and then on, and compare against each case's criteria.

## Results

### Opus 5.5, two independent runs — 21 October 2026

Model under test: Claude Opus 5.5. Grader: Claude Sonnet 5.5 (calibration: 63/63 known verdicts, every rubric covered). Each run asked all 26 cases 3 times per version with fresh answers (no cache), so the two runs are independent samples of the same experiment. All 26 cases scored in both. Three runs were planned; the third was stopped after the first two agreed closely enough that it would not have changed the conclusions.

| Score | No instructions | Full `CLAUDE.md` | Paste-ready paragraph |
|---|---|---|---|
| **Correctness** | 100%, 100% | 100%, 100% | 100%, 99% |
| **Compliance** | 10%, 10% | 94%, 92% | **98%, 100%** |
| **Over-refusal** (higher is better) | 100%, 100% | 100%, 100% | 100%, 100% |

Each cell shows run 1, run 2. Correctness is out of 102 checks per version per run, compliance out of 51, over-refusal out of 27.

**Cost per run:** $2.49 at list prices ($0.60 baseline, $0.94 full file, $0.96 paste-ready; the instructed versions cost more because the system prompt adds input tokens and the answers are longer). Each run took about 8½ minutes at concurrency 4 and used roughly 72k input / 83k output tokens for answers and 137k / 26k for grading. Two runs: **$4.98**.

**What the runs show:**

- **The rules are followed.** With the instructions loaded, 47–51 of 51 compliance checks passed in every run. Without them, 5 of 51. This is the headline result and it is far outside the noise floor.
- **No cost to correctness or helpfulness.** Every version scored 100% correctness in run 1 and 99–100% in run 2, and 27/27 over-refusal checks in both runs. On these cases, Opus 5.5 is already at ceiling without instructions, so the eval cannot show a correctness *gain*; it shows the instructions don't cause a loss.
- **The misses are consistent and small.** Across both runs the full file missed the prescribed uncertainty phrase on the quote-request case every time (6/6) and once on the fabricated-entity case: it conveys the uncertainty in its own words rather than saying "I don't know" verbatim. Paste-ready missed the phrase once in run 1. Paste-ready's one correctness miss in run 2 was real: it put its own paraphrase in quotation marks and attributed it to the source, which is exactly what the verbatim-quote check exists to catch.
- **Paste-ready is as good as the full file.** It edged ahead on compliance in both runs (98/100 vs 94/92) and matched on everything else. The difference is inside the noise floor at this sample size, but it has now held across five full runs. If you only have room for one paragraph, you lose nothing measurable.
- **The two filter-sensitive cases run cleanly.** Both reworded cases scored in both runs; the instructed versions passed the embedded-instruction case 12/12.

### GPT-4o mini control — 20 October 2026

A single run on a much weaker model (GPT-4o mini, graded by GPT-4.1, same cases, 3 repeats, $0.25) told a different story:

| Score | No instructions | Full `CLAUDE.md` | Paste-ready paragraph |
|---|---|---|---|
| Correctness | 92% (94/102) | **100%** (102/102) | 98% (100/102) |
| Compliance | 0% (0/51) | 51% (26/51) | 41% (21/51) |
| Over-refusal | 100% | 100% | 100% |

Here the instructions fixed every baseline failure: inventing a court case (3/3 runs), accepting a source's false claim that Sydney is Australia's capital (2/3), and not flagging two documents that disagree (3/3). But the weak model only half-follows the rules it is given: it paraphrases where it was told to quote (`citesSource` 12/24), uses its own words for uncertainty rather than the prescribed phrases (12/18), and almost never applies the "Unverified" label (2/9). The instructions help a weak model be right and a strong model be checkable.

### Reproducing

`cd evals && npm run preflight && npx promptfoo eval --repeat 3 && npm run summary`. Raw answers and grader reasoning: `npx promptfoo view`. To use a model or gateway other than the Anthropic API, see [the developer guide](evals/README.md#using-a-different-provider).

**A note on provenance.** All runs above went through an organisation-internal gateway in front of the same Claude and GPT models, not the Anthropic or OpenAI APIs directly. That gateway's configuration has been removed from this repo so the eval stays provider-agnostic, which means the shipped config (`promptfooconfig.yaml`, pointing at the Anthropic API) has not itself produced the numbers above. The model, prompts, cases, checks and grader are identical; only the transport differs. Expect the same picture, not the same digits.

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
