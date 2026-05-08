# RSA Speaker Experiment (N=5, M=1) — CogSci 2026

A web-based jsPsych experiment in which participants play the **speaker** role in
an RSA-style communication task. They describe clinical-trial outcomes — five
patients receive a treatment, k of whom respond — using a fixed quantifier ×
predicate utterance vocabulary. Each participant plays three speaker scenarios
in a randomized order:

| scenario | role | bonus rule |
|---|---|---|
| `informative` | unbiased clinical scientist | the listener correctly identifies the trial |
| `pers_plus` | treatment-company sales rep | the listener rates the treatment as effective |
| `pers_minus` | competitor sales rep | the listener rates the treatment as ineffective |

The experiment runs in any modern browser, takes about 10–15 minutes, and is
designed to deploy on Prolific with data persistence via DataPipe.

## Setup

The repository ships **with credentials redacted** so a fresh clone won't write
to anyone's data store. To run the experiment for real you need to fill in
three identifiers.

### 1. DataPipe project

1. Create a project at [https://pipe.jspsych.org/](https://pipe.jspsych.org/)
   and copy the experiment ID it issues.
2. In [`config.js`](config.js), replace
   `REPLACE_WITH_YOUR_DATAPIPE_EXPERIMENT_ID` with that ID.
3. Set `enabled: true` in the same block when you're ready to start writing
   data (default is `false` so a misconfigured fresh clone doesn't try to
   write).

### 2. Prolific completion codes

1. Create your Prolific study and look at its "Study Completion" settings —
   Prolific issues two codes:
   - a **completion code** (used when a participant finishes successfully)
   - a **screening code** (used when a participant is screened out
     mid-study, here triggered by attention-check failures or inactivity
     timeout, so they can still receive partial compensation)
2. In [`experiment.js`](experiment.js) (top of the file), replace
   `REPLACE_WITH_YOUR_PROLIFIC_COMPLETION_CODE` and
   `REPLACE_WITH_YOUR_PROLIFIC_SCREENING_CODE` with your codes.
3. The experiment reads `PROLIFIC_PID`, `STUDY_ID`, and `SESSION_ID` from
   the URL automatically — no further wiring is needed for Prolific
   integration.

### 3. Local testing (optional)

You can run the experiment locally without Prolific or DataPipe:

```bash
cd web/cogsci26_rsa_speaker_experiment_n5
python -m http.server 8000
# then open http://localhost:8000 in a browser
```

When `PROLIFIC_PID` is not in the URL, `experiment.js` falls back to a random
`test_*` subject ID; when `DATAPIPE_CONFIG.enabled` is `false`, no data is
saved (the timeline still runs end-to-end so you can verify the flow).

## Stimuli

The 32 stimulus images live under [`stimuli_emoji_n5m1/`](stimuli_emoji_n5m1/),
named `effective_{k}_v{variant}.png` for `k = 0..5` and `variant = 0..C(5,k)−1`
(so all C(5,k) arrangements of effective vs. ineffective patients are
represented). They are generated programmatically by
[`generate_stimuli.py`](generate_stimuli.py) using Twemoji glyphs downloaded
from a CDN; you only need to re-run it if you change `N_PATIENTS` or want to
regenerate from a different emoji set:

```bash
python generate_stimuli.py
```

## File layout

```
cogsci26_rsa_speaker_experiment_n5/
├── README.md             # this file
├── index.html            # jsPsych + plugin loader; entry point
├── config.js             # all experiment parameters + DataPipe block
├── experiment.js         # full timeline (welcome → consent → comprehension
│                         #   → 3 speaker blocks → debrief → save)
├── stimuli.js            # stimulus arrangement helpers
├── truth-checker.js      # quantifier semantics; enforces literal truth
│                         #   in the speaker's utterance choices
├── styles.css            # UI styling
├── generate_stimuli.py   # one-shot stimulus generator (Twemoji → PNG)
└── stimuli_emoji_n5m1/   # 32 generated images
```

## Task structure

A single participant goes through:

1. **Welcome** + consent (with full Stanford IRB language).
2. **Instructions** — three pages explaining the trial format, the
   quantifier × predicate description grammar, and how truth conditions
   work for those descriptions.
3. **Comprehension checks** in three modules:
   - definitions of `Some` / `Most`,
   - true/false judgments on two example trials,
   - a multi-select on which trials make a given description true.
   Each gives explanatory feedback but does not gate progress.
4. **Three speaker blocks** in randomized order, one per scenario. Each
   block: scenario card → role-comprehension forced-correct question →
   "finding listener" wait (cover story; the listener is simulated) →
   10 trials, with one **attention-check trial** randomly inserted after
   round 5–9. ≥ 2 attention-check failures across the experiment terminate
   the study with a screening-completion redirect on Prolific.
5. **Inactivity timer**: 30 s warning, 60 s urgent warning, 90 s timeout
   triggers the same termination flow. Resets on any click within a
   trial.
6. **Feedback** (free-text), data save to DataPipe, **debrief** disclosing
   that the listener was simulated. Prolific participants are auto-
   redirected to the appropriate completion URL on the final screen.

The trial sequences for each scenario are fixed in
[`config.js`](config.js) and chosen so the speaker faces a "challenging"
distribution for their role: `pers_plus` mostly sees few-effective trials
(must spin up), `pers_minus` mostly sees many-effective trials (must spin
down), `informative` sees mixed.

## Randomization

All randomization is **within-subject**:

- Block order across the three scenarios (random permutation).
- Trial sequence within a block (random pick of one of two pre-defined
  10-round sequences).
- Stimulus arrangement variant per trial (random pick over C(5, k)
  arrangements).
- Order of true-utterance options on the response screen.
- Order of MCQ options in comprehension and role-comprehension checks.
- Round at which the attention check is inserted (5–9).

There is **no between-subject quota or condition-balancing** — every
participant goes through every scenario, in a random order.

## Data

Each participant's full trial-level data is written to DataPipe as a single
CSV named `{subject_id}.csv`. Key fields per trial include:

| field | meaning |
|---|---|
| `subject_id` | Prolific PID, or a random `test_*` string if not on Prolific |
| `task` | trial type: `speaker`, `attention_check`, `comp1_some`, `comp2`, `comp3`, `role_comprehension`, `feedback`, etc. |
| `block`, `round` | block index (0–2) and round number (1–10) |
| `scenario` | `informative` / `pers_plus` / `pers_minus` |
| `seq_idx` | which of the two pre-defined sequences this block used |
| `num_effective` | k on this trial (0–5) |
| `stimulus_variant`, `stimulus_positions` | which arrangement was shown |
| `predicate`, `quantifier`, `utterance` | the speaker's chosen description |
| `attention_passed` | for attention-check trials |
| `completion_status` | `completed`, `terminated_attention_check`, or `terminated_inactivity` |

## Citation

If you use this experiment, please cite the accompanying CogSci 2026
submission (citation key TBD).

## License

(Add your preferred license here — e.g. CC BY 4.0 for the materials,
MIT for the code.)
