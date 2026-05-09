# RSA Listener Experiment — Data & Model Fits (CogSci 2026)

This directory holds the **public-facing data artifact and analysis pipeline**
for the listener experiment at
[`web/cogsci26_rsa_listener_experiment_n5_o1/`](../../web/cogsci26_rsa_listener_experiment_n5_o1/).

It contains everything needed to reproduce the two listener-model analyses
reported in the paper:

| paper section | notebook | what it produces |
|---|---|---|
| 9-cell effectiveness fit (literal vs credulous vs vigilant; mean LL ranges) | [`fit_effectiveness.ipynb`](fit_effectiveness.ipynb) | per (speaker_cond × listener_belief_cond) mean LL per model |
| Speaker-type fit, Table 1 (Uniform Prior + Truth-Default Prior columns) | [`fit_speaker_type.ipynb`](fit_speaker_type.ipynb) | per-sequence (α, JS) under each prior |

The pre-built fitted artifact `processed_listener_n1_anonymized.csv` is
shipped so reviewers can reproduce the analyses without re-running Stage A
(raw → wide-form processing).

## File layout

```
cogsci_rsa_listener_experiment_n5_o1/
├── README.md                                # this file
├── process_data.ipynb                       # Stage A: raw CSVs → wide-form participant table + speaker_type aggregation
├── fit_effectiveness.ipynb                  # Stage B.1: 9-cell effectiveness fit
├── fit_speaker_type.ipynb                   # Stage B.2: speaker-type fit (uniform + truth-default priors)
├── rsa_optimal_exp_core.py                  # RSA library (literal + level-1 pragmatic)
├── processed_listener_n1_anonymized.csv     # public artifact (634 rows × 64 cols)
├── speaker_type.csv                         # aggregated speaker-type proportions for vigilant participants
└── raw_do_not_track/                        # gitignored — reproducer drops raw CSVs here
```

## What the pipeline does

The listener experiment ([`web/cogsci26_rsa_listener_experiment_n5_o1/`](../../web/cogsci26_rsa_listener_experiment_n5_o1/))
is between-subjects: each participant lands in one of 24 cells (3 belief
conditions × 3 utterance scripts × {1–3} sequence variants), gets a 5-round
sequence of utterances about a clinical-trial outcome, and rates how
effective the treatment is (everyone) plus what kind of speaker they think
they're listening to (vigilant condition only).

Stage A processes the raw per-subject jsPsych CSVs into one wide-form row
per participant and emits two public artifacts:

1. **`processed_listener_n1_anonymized.csv`** — wide-form participant
   table. Identifying columns (`subject_id`, `prolific_pid`, `study_id`,
   `session_id`, `source_file`, `start_time`, `completion_time`) are
   dropped before this file is written. `participant_id` (P001, P002, …)
   is the only remaining identifier and does not link back to Prolific.
2. **`speaker_type.csv`** — counts and proportions of speaker-type
   responses per (`speaker_sequence`, `round`, `speaker_type`) over the
   vigilant-condition participants who completed the experiment and passed
   the attention check. Used as input to Stage B.2.
   *In the source repo this aggregation was produced by an R Markdown
   script. Stage A reimplements it in Python so the pipeline is fully
   self-contained.*

Stage B then fits RSA listener models to the participant data:

- **Stage B.1 (`fit_effectiveness.ipynb`)** — fits five listener models
  (`literal`, `credulous_T`, `credulous_F`, `vigilant_T`, `vigilant_F`,
  where `_T`/`_F` is `update_internal=True`/`False`) to each participant's
  effectiveness ratings (5 ratings per participant, on a 0–100% scale
  binned to the 21-point θ grid). For each `(speaker_condition,
  listener_belief_condition)` cell — 9 cells total — the rationality
  parameter α is optimized independently for each pragmatic model.
  The headline finding: **literal best for informative speakers
  (mean LL ∈ [-10.10, -8.11]); credulous best for persuasive speakers
  (mean LL ∈ [-14.33, -13.70])**, with differences typically < 1 LL —
  effectiveness ratings alone don't strongly discriminate listener models,
  and explicit knowledge of the speaker's potential bias (vigilant
  condition) doesn't substantially shift estimates.
- **Stage B.2 (`fit_speaker_type.ipynb`)** — fits the `vigilant_F` model to
  vigilant-condition participants' categorical speaker-type judgments,
  reporting (α, JS distance) per utterance sequence under both a uniform
  prior `[1/3, 1/3, 1/3]` and a "truth-default" prior `[0.25, 0.50, 0.25]`
  (recovered by sweeping over candidate priors and picking the one that
  minimizes mean JS across sequences). The headline finding: **best-fit α
  floors out near 0.10 for all six persuasive sequences** under either
  prior — listeners aren't using the underinformative quantifier "some" as
  diagnostic of speaker bias even when explicitly warned.

## Reproducing from raw data

You only need this section if you want to re-run from per-subject jsPsych
CSVs. To use the pre-built artifacts (`processed_listener_n1_anonymized.csv`
and `speaker_type.csv`), skip to "Reproducing the model fits" below.

### Inputs

The raw data is the per-subject CSV that DataPipe produces from the
listener experiment. Drop them into:

```
raw_do_not_track/prag_net_listener_n1_main/<subject>.csv
```

### Run order

1. Open `process_data.ipynb`. The "Run the pipeline" cell at the bottom
   defines `INPUT_FOLDER`, `OUTPUT_FULL`, `OUTPUT_ANON` — edit only if
   your layout differs. Run all cells. Outputs:
   - `raw_do_not_track/processed_listener_n1_full.csv` (still has identifiers — do not share)
   - `processed_listener_n1_anonymized.csv` (public)
   - `speaker_type.csv` (public, aggregate)
   - `data_dictionary.csv` (public, per-column profile)

## Reproducing the model fits

With `processed_listener_n1_anonymized.csv` and `speaker_type.csv` in
place:

1. Open `fit_effectiveness.ipynb`. Run all cells. ~70 seconds (the
   listener-prediction lookup is the dominant cost). Last cell reproduces
   the paper's mean LL ranges:
   - Informative literal LLs across 3 belief conds: ≈ [-10.31, -7.91]
     (paper: [-10.10, -8.11])
   - Persuasive credulous LLs across 6 cells:        ≈ [-14.40, -13.57]
     (paper: [-14.33, -13.70])
   The small discrepancy (~0.2 LL) reflects that the original analysis
   uses the same no-comp-filter, completed+attention-passed cohort
   (n=609); the pattern and ordering of model fits matches exactly.

2. Open `fit_speaker_type.ipynb`. Run all cells. ~5 minutes (the
   prior-sweep over 25 candidate P(inf) values × 8 sequences × 200 α is
   the dominant cost). Last cell reproduces Table 1.

## Connection to other parts of the repo

- World identical to the simulation pipeline at
  [`models/simulations/`](../../models/simulations/) (`n=1`, `m=5`,
  21-point θ grid, 8-utterance vocabulary).
- Listener model class names in the paper map to (`omega`,
  `update_internal`) settings of `PragmaticListener_obs_n` from
  [`rsa_optimal_exp_core.py`](rsa_optimal_exp_core.py):

| paper name | omega | update_internal | also called |
|---|---|---|---|
| literal | n/a | n/a | LiteralListener |
| credulous | `coop` | True / False | `credulous_T` / `credulous_F` |
| vigilant | `strat` | True / False | `vigilant_T` / `vigilant_F` |

All listener fits in this directory use **`_F` (update_internal=False)** as
the canonical model — internal speaker models stay frozen at their priors
across the 5-round trial. This matches the convention used throughout the
simulation pipeline (e.g., agent directory names like `vigilant_L1strat_a3_uiF`
in `models/simulations/simulation_experiments/`).

## Cleanup notes (vs. live source)

This is a sanitized fork of [`data/prag_net_listener_n1/`](../prag_net_listener_n1/)
prepared for public release. Compared to the live source:

- **Quasi-identifying timestamps** (`start_time`, `completion_time`)
  dropped from the public CSV.
- **Three messy notebooks consolidated to three focused notebooks**:
  - The original `process_data_listener.ipynb` had 23 cells (the main
    pipeline + ~17 cells of repetitive exploratory plotting). All
    plotting cells removed; the pipeline code consolidated into the
    cleaned [`process_data.ipynb`](process_data.ipynb).
  - The original `listener_fitting.ipynb` had **five competing α-pooling
    strategies** (per-participant, per listener_condition, per (speaker
    × listener), per (sequence × listener), and a JS-divergence variant
    on effectiveness data) plus the speaker-type fit. The paper uses the
    per (speaker × listener) variant for effectiveness — that's
    [`fit_effectiveness.ipynb`](fit_effectiveness.ipynb). The
    speaker-type fit moved to its own
    [`fit_speaker_type.ipynb`](fit_speaker_type.ipynb), and the **truth-
    default prior sweep** (paper Table column 2) was added there since it
    was missing from the original notebook.
  - The original `likelihood.ipynb` was a 19-cell stimulus-design
    discrimination analysis with multiple "FIX:" iterations — used to
    select the utterance sequences hardcoded in the listener experiment.
    Not cited in the paper. Dropped.
- **R Markdown analysis dropped**. The original
  `R_prag_net_listener_n1/` directory contained an R-Markdown that ran
  per-cell `lmer` models on effectiveness — these are not reported in the
  paper. The R script's only load-bearing output was `speaker_type.csv`,
  which Stage A now aggregates directly in Python; the R analysis is
  dropped entirely along with its build artifacts (`.html`, `.tex`,
  `.log`).
- **Duplicate CSVs deduplicated**. The source had three copies of
  `speaker_type.csv` and two of `processed_listener_n1_anonymized.csv`
  scattered between the top level and `R_prag_net_listener_n1/`. One copy
  of each remains.
- **Hardcoded absolute paths** (`~/Documents/prag_net/...`) replaced with
  relative paths.
- All notebook cell outputs cleared — no embedded data is committed.

## Citation

If you use this dataset or pipeline, please cite the accompanying CogSci
2026 submission (citation key TBD).

## License

(Add your preferred license here — e.g. CC BY 4.0 for the data and MIT
for the code.)
