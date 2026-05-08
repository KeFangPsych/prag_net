# RSA Listener Experiment (N=5, M=1) — CogSci 2026

A web-based jsPsych experiment in which participants play the **listener**
role in an RSA-style communication task. They receive a 5-round sequence of
utterances about a clinical-trial outcome from a "speaker" — without ever
seeing the trial data themselves — and rate how effective they think the
treatment is, plus (in some conditions) what kind of speaker they think
they're listening to.

The experiment is designed for Prolific deployment with data persistence
via DataPipe.

## Design — between-subjects 3 × 3 × {1–3} grid

Every participant lands in exactly one of **24 cells** ([`experiment.js`](experiment.js) `CELL_MAP`):

| factor | levels | what it controls |
|---|---|---|
| `listener_belief` | `vigilant` / `credulous` / `naturalistic` | What the participant is **told** about the speaker before the task |
| `speaker_utterances` | `informative` / `pers_plus` / `pers_minus` | Which speaker bias generated the **scripted** utterance sequence they receive |
| `sequence_variant` | 1–3 per speaker condition | Which of the pre-defined 5-utterance scripts in `config.js` is used |

The two factors `listener_belief` and `speaker_utterances` are **independent**: a
participant can be told "this speaker is helpful" (`credulous`) while actually
receiving `pers_plus`-biased utterances. This is the key design feature for
testing whether listener inference is modulated by belief about the speaker's
goal.

### The three listener belief conditions

| condition | what the participant is told before the task |
|---|---|
| `vigilant` | Full disclosure — three possible speaker types (Skeptic, Scientist, Promoter), one is randomly chosen. Listener is asked, every round, both how effective the treatment is AND which speaker type they think it is. |
| `credulous` | The speaker is trying to help them guess effectiveness correctly. Listener is asked only about effectiveness. |
| `naturalistic` | Nothing about the speaker's goal. Listener is asked only about effectiveness. |

### The three utterance conditions

Hardcoded 5-utterance scripts in `config.js`'s `utterance_sequences` block
([`config.js`](config.js)):

| condition | flavor of the script |
|---|---|
| `informative` | Extreme + matched ("most effective", "no ineffective", "all effective" …) — paints a clear picture |
| `pers_plus` | Positively framed even on bad data ("most effective", "some effective", "some ineffective", …) — never makes the treatment sound bad |
| `pers_minus` | Mirror image |

### Cell assignment

Per-participant cell assignment is uniform across all 24 cells via DataPipe's
`action: "condition"`, taken modulo `CELL_MAP.length`. A `test_*`-prefixed
subject (no Prolific PID) falls back to uniform random across the three
factors.

> **Note for replicators**: the original study used a 613-element
> `WEIGHTED_CONDITION_MAP` that gave each cell a number of slots equal to how
> many more participants it still needed to reach a per-cell target of 30
> (accounting for an in-progress dataset). For this public release we
> replaced that with simple uniform-modulo assignment. To reintroduce
> weighted balancing for your own data collection, replace the line
> `experimentState.cellIdx = experimentState.datapipeCondition % CELL_MAP.length`
> in [`experiment.js`](experiment.js) with a custom mapping table keyed to your N-per-cell
> targets.

## Setup

The repository ships **with credentials redacted** so a fresh clone won't
write to anyone's data store. To run the experiment for real you need to fill
in three identifiers.

### 1. DataPipe project

1. Create a project at [https://pipe.jspsych.org/](https://pipe.jspsych.org/)
   and copy the experiment ID it issues.
2. In [`config.js`](config.js), replace
   `REPLACE_WITH_YOUR_DATAPIPE_EXPERIMENT_ID` with that ID.
3. Set `enabled: true` in the same block when you're ready to start writing
   data (default is `false`).
4. On the DataPipe dashboard, configure `condition` assignment to return
   integers in any range you like — uniform-modulo into `CELL_MAP.length` will
   distribute them evenly across the 24 cells.

### 2. Prolific completion codes

Create your Prolific study and look at "Study Completion" — Prolific issues:
- a **completion code** for participants who finish successfully, and
- a **screening code** for participants who are screened out mid-study (here
  triggered by attention-check failure or inactivity timeout, so they receive
  partial compensation).

In [`experiment.js`](experiment.js) (top of the file), replace
`REPLACE_WITH_YOUR_PROLIFIC_COMPLETION_CODE` and
`REPLACE_WITH_YOUR_PROLIFIC_SCREENING_CODE` with your codes.

The experiment reads `PROLIFIC_PID`, `STUDY_ID`, and `SESSION_ID` from the
URL automatically — no further wiring needed.

### 3. Local testing (optional)

```bash
cd web/cogsci26_rsa_listener_experiment_n5_o1
python -m http.server 8000
# then open http://localhost:8000 in a browser
```

When `PROLIFIC_PID` is not in the URL, `experiment.js` falls back to a random
`test_*` subject ID and to uniform-random cell assignment (no DataPipe call).
With `DATAPIPE_CONFIG.enabled = false`, no data is written.

## Stimuli

The 32 stimulus images under [`stimuli_emoji_n5m1/`](stimuli_emoji_n5m1/) are
used **only by the comprehension checks** — during the task itself, the
listener never sees the actual trial outcome (a row of five masked patient
icons is shown instead). Run [`generate_stimuli_twemoji.py`](generate_stimuli_twemoji.py) to regenerate them
from Twemoji glyphs:

```bash
python generate_stimuli_twemoji.py
```

## File layout

```
cogsci26_rsa_listener_experiment_n5_o1/
├── README.md             # this file
├── index.html            # jsPsych + plugin loader; entry point
├── config.js             # all experiment parameters + DataPipe block + scripts
├── experiment.js         # full timeline (~2760 lines)
├── stimuli.js            # stimulus arrangement helpers (used in comprehension only)
├── truth-checker.js      # quantifier semantics for comprehension checks
├── styles.css            # UI styling
├── generate_stimuli_twemoji.py   # Twemoji → PNG generator
└── stimuli_emoji_n5m1/   # 32 generated images
```

## Task structure

A single participant goes through:

1. **Welcome** + consent (with full Stanford IRB language).
2. **Instructions** (3 pages) — clinical trial format, treatment
   effectiveness as a probability, the quantifier × predicate description
   grammar.
3. **Comprehension checks** (4 modules): definitions of `Some` / `Most`,
   one true/false judgment, a multiple-descriptions-can-be-true explainer +
   check, and a multiple-results-one-truth explainer + multi-select. All
   give explanatory feedback but do not gate progress.
4. **Cell assignment** (DataPipe `condition` → modulo into `CELL_MAP`),
   followed by a condition-specific listener-role introduction.
5. **Pairing wait** (cover story; the speaker is simulated via the scripted
   utterance sequences).
6. **Five rounds**, each containing:
   - "Speaker is responding..." cover-story wait (2.5–5 s)
   - Display of 5 masked patient circles plus the speaker's utterance
   - **VIGILANT**: combined-page response — effectiveness slider (0–100%,
     step 5) + speaker-type radio (Skeptic / Scientist / Promoter), order
     randomized between participants
   - **CREDULOUS / NATURALISTIC**: effectiveness slider only
7. **Round 6 = attention check** — same UI but with explicit "please move
   slider to X% and select [type]" instructions. Failing terminates with a
   screening-completion redirect on Prolific.
8. **Competence rating** of the speaker (1–7, with condition-specific
   wording).
9. **Persuasive-speaker reveal** (debrief-adjacent — informs the participant
   about the actual speaker bias).
10. Open-ended free-text questions.
11. Final debrief + DataPipe save + Prolific completion redirect (if running
    on Prolific).

## Quality gates

- **4-module comprehension** — non-gating; explanatory feedback only.
- **One attention check** at the post-trial-6 round; failing triggers
  `saveDataAndEndExperiment("attention_check_failed")` with a partial-
  compensation redirect on Prolific.
- **Inactivity timer**: warning at 90 s, urgent at 120 s, terminate at
  150 s ([`config.js`](config.js)). Notably longer than the speaker experiment because
  per-round listener tasks are more demanding.
- **Copy / devtools blocking** ([`experiment.js`](experiment.js) top): right-click, Ctrl-C/X/A,
  F12, Ctrl+Shift+I/J/C, drag, mouse selection are all blocked except inside
  `<input>` / `<textarea>`. Useful during live data collection, but worth
  noting if you want to inspect or adapt the experiment locally.

## Randomization audit

- **Cell assignment**: between-subjects, uniform via `datapipeCondition % CELL_MAP.length` (was a weighted 613-slot map in the original; see "Cell assignment" above).
- **Within-subject** randomization:
  - Vigilant condition's measure order (effectiveness-first vs. speaker-type-first) is randomized per participant.
  - Comprehension MCQ option order is shuffled per participant.
  - Cover-story wait durations are uniform between configured min/max.

There is no other quota / condition-balancing logic in the code.

## Data

Each participant's full trial-level data is written to DataPipe as a single
CSV named `{subject_id}.csv`. Key fields per trial include:

| field | meaning |
|---|---|
| `subject_id` | Prolific PID, or a random `test_*` string if not on Prolific |
| `task` | trial type: `point_estimate_effectiveness`, `combined_measure`, `attention_check`, `comp1_some`, `competence_rating`, etc. |
| `round` | round number (1–5; 6 for the attention check) |
| `speaker_condition` | `informative` / `pers_plus` / `pers_minus` |
| `listener_belief_condition` | `vigilant` / `credulous` / `naturalistic` |
| `sequence_idx` | which of the 1–3 pre-defined sequences this participant received |
| `cell_idx` | 0–23 — joint index into `CELL_MAP` |
| `measure_order` | `effectiveness_first` / `speaker_type_first` (vigilant only) |
| `utterance_predicate`, `utterance_quantifier`, `utterance_text` | the utterance shown this round |
| `effectiveness_point_estimate` | slider value (0–100) |
| `speaker_type_point_estimate` | radio response (`anti` / `neutral` / `pro`; vigilant only) |
| `attention_check_passed` | for the attention-check trial |
| `completion_status` | `completed`, `terminated_attention_check`, or `terminated_inactivity` |

## Cleanup notes (vs. the live source)

This is a sanitized fork of [`web/rsa_listener_experiment_n5_o1/`](../rsa_listener_experiment_n5_o1/)
prepared for public release. Compared to the live source:

- DataPipe `experiment_id` and Prolific completion / screening codes replaced with placeholders.
- `DATAPIPE_CONFIG.enabled` defaulted to `false`.
- The 613-slot `WEIGHTED_CONDITION_MAP` replaced with uniform `% CELL_MAP.length` modulo (see "Cell assignment" above).
- Removed ~580 lines of dead code carried over from an earlier iteration:
  `createDistributionBuilderHTML`, `initDistributionBuilder`,
  `createEffectivenessPage`, `createSpeakerTypePage`,
  `distributionBuilderExplanation`, plus the
  `effectivenessDistribution` / `speakerTypeDistribution` /
  `effectivenessChanged` / `speakerTypeChanged` state fields and the related
  `n_tokens` / `effectiveness_options` / `speaker_types` config keys. The
  removed code implemented a 20-token "drag tokens onto bins" UI that the
  active timeline does not call. Active per-round measurement uses sliders +
  radio buttons (`createPointEstimatePage`, `createCombinedMeasurePage`).

After cleanup `experiment.js` is **2761 lines** (was 3340).

## Citation

If you use this experiment, please cite the accompanying CogSci 2026
submission (citation key TBD).

## License

(Add your preferred license here — e.g. CC BY 4.0 for the materials, MIT for
the code.)
