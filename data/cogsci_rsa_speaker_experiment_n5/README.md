# RSA Speaker Experiment — Data & Model Fits (CogSci 2026)

This directory holds the **public-facing data artifact and analysis
pipeline** for the speaker experiment at
[`web/cogsci26_rsa_speaker_experiment_n5/`](../../web/cogsci26_rsa_speaker_experiment_n5/).

It does two things:

1. **`process_data.ipynb`** (Stage A) — turns the per-subject jsPsych CSVs
   produced by the experiment into a single wide-form table with one row
   per participant.
2. **`model_fitting.ipynb`** (Stage B) — fits 7 RSA speaker models to each
   participant's behavior in each of the 3 scenarios, merges the fits
   back onto the table, anonymizes, and emits a public CSV plus a column
   profile.

The fitted artifact is shipped pre-built as
`speaker_n1_fitted_anonymized.csv` so reviewers can reproduce all
analyses in the paper without re-running the pipeline.

## File layout

```
cogsci_rsa_speaker_experiment_n5/
├── README.md                              # this file
├── process_data.ipynb                     # Stage A
├── model_fitting.ipynb                    # Stage B
├── rsa_optimal_exp_core.py                # RSA classes (literal + level-1 pragmatic)
├── rsa_optimal_exp_fitting.py             # log-lik / alpha-optimization helpers
├── speaker_n1_fitted_anonymized.csv       # public artifact (109 rows × 318 cols)
├── data_dictionary.csv                    # per-column profile of the artifact
└── raw_do_not_track/                      # gitignored — your raw CSVs go here
    ├── prag_net_speaker_n1_pilot/         #   one CSV per pilot participant
    ├── prag_net_speaker_n1_main/          #   one CSV per main-study participant
    ├── processed_speaker_n1_full.csv      #   Stage A output (with identifiers)
    └── speaker_n1_fitted.csv              #   Stage B intermediate (with identifiers)
```

`raw_do_not_track/` matches the project-wide `**/raw_do_not_track/`
gitignore pattern, so **anything inside it is never committed**. All
files containing identifiers (Prolific PID, subject_id, timestamps,
source filenames) live there.

## Reproducing the pipeline

You only need this section if you want to re-run from the raw subject
CSVs. To use the pre-built `speaker_n1_fitted_anonymized.csv`, skip
straight to "Schema" below.

### Inputs you need

The raw data is the per-subject CSV that DataPipe produces from the
running experiment ([`web/cogsci26_rsa_speaker_experiment_n5/`](../../web/cogsci26_rsa_speaker_experiment_n5/)).
For this dataset the pilot and main studies were collected separately;
drop them into:

```
raw_do_not_track/prag_net_speaker_n1_pilot/<subject>.csv
raw_do_not_track/prag_net_speaker_n1_main/<subject>.csv
```

Each CSV is jsPsych's long-form trial-level export. The pipeline tags
participants with the source folder (`pilot`/`main`) and merges them.

### Run order

1. Open `process_data.ipynb`. The "Run the pipeline" cell at the bottom
   defines `INPUT_PATH_PILOT`, `INPUT_PATH_MAIN`, `OUTPUT_PATH_FULL` —
   edit only if your layout differs from the default. Run all cells.
   Output: `raw_do_not_track/processed_speaker_n1_full.csv`.
2. Open `model_fitting.ipynb`. The "Run the full pipeline" cell defines
   `INPUT_PATH`, `OUTPUT_FULL`, `OUTPUT_ANON`, `OUTPUT_DICT`. Run all
   cells. Outputs:
   - `raw_do_not_track/speaker_n1_fitted.csv` (with identifiers; do not
     share)
   - `speaker_n1_fitted_anonymized.csv` (public)
   - `data_dictionary.csv` (public)

Stage B fits 7 models × 3 scenarios = **21 fits per participant**, each
with a grid-search over alpha (default `GRID_POINTS=300`, log spacing).
On commodity hardware Stage B takes a few minutes for ≈ 100 participants.

### Dependencies

`pandas`, `numpy`, `scipy`, `xarray`, `tqdm`. The `rsa_optimal_exp_core`
and `rsa_optimal_exp_fitting` modules are vendored in this directory and
imported by relative path; nothing else is needed beyond the standard
scientific-Python stack.

## Schema

The anonymized CSV has 109 rows (one per completed participant) and 318
columns. See `data_dictionary.csv` for a per-column profile (dtype,
missingness, unique counts, example values). High-level groups:

| group | columns | content |
|---|---|---|
| identification | `participant_id`, `study` | `participant_id` is `P001`–`P*` (no link to Prolific). `study` is `'pilot'` or `'main'`. |
| metadata | `experiment_version`, `completion_status`, `terminated_early`, `termination_reason`, `duration_minutes`, `total_time_elapsed_ms` | session-level info |
| block order | `block_1_scenario`, `block_2_scenario`, `block_3_scenario`, `block_order` | which scenario was played in which slot |
| attention checks | `attention_block_{1..3}_*` | passed, round, time, required-description |
| comprehension | `comp1_some/most_*`, `comp2_{1,2}_*`, `comp3_*`, `*_role_comp_*` | accuracy, RT, selected option |
| speaker trials | `{cond}_r{1..10}_{num_effective,variant,positions,predicate,quantifier,time_elapsed,rt_approx}` | full trial detail. `cond ∈ {inf, persp, persm}` |
| **model fits** | `{cond}_{model}_ll`, `{cond}_{model}_alpha` | log-likelihood and fitted alpha for each (scenario, model) |
| free text | `feedback_text` | post-experiment comments |

### Model-fit columns

For each scenario `cond ∈ {inf, persp, persm}` and each of 7 models, two
columns are produced:

| model name | psi | update_internal | meaning |
|---|---|---|---|
| `literal` | n/a | n/a | level-0 LiteralSpeaker (uniform over true utterances) |
| `inf_T` | `inf` | True | informative speaker, internal listener model updates with each utterance |
| `inf_F` | `inf` | False | informative speaker, internal models frozen at prior |
| `persp_T` | `pers+` | True | persuade-up speaker, dynamic |
| `persp_F` | `pers+` | False | persuade-up speaker, static |
| `persm_T` | `pers-` | True | persuade-down speaker, dynamic |
| `persm_F` | `pers-` | False | persuade-down speaker, static |

All fits use `omega='strat'` and `beta=0.0` (pure goal — no
informativeness mixing for `pers±`; ignored for `inf`). Alpha is fit by
grid search over `[0.001, 100.0]` with 300 log-spaced points and the
deterministic-argmax limit (`alpha="determ"`) included as a candidate.
The `_alpha` column may therefore be a float or the literal string
`"determ"` — handle accordingly when loading.

## PII handling

- `participant_id` (`P001`, …) is the only identifier in any committed
  file. It does not link back to Prolific PIDs.
- The full per-subject jsPsych CSVs and the intermediate
  `processed_speaker_n1_full.csv` / `speaker_n1_fitted.csv` files contain
  identifiers and live exclusively under `raw_do_not_track/`. This
  directory's gitignore treats `raw_do_not_track/` as opaque; nothing
  inside is ever committed.
- The `create_anonymized_version` step in `model_fitting.ipynb` drops
  `subject_id`, `prolific_pid`, `study_id`, `session_id`, `start_time`,
  `completion_time`, and `source_file` before writing
  `speaker_n1_fitted_anonymized.csv`. To verify, both columns and body:

  ```bash
  python -c "import pandas as pd; df = pd.read_csv('speaker_n1_fitted_anonymized.csv'); \
      assert not any(c in df.columns for c in ['prolific_pid','subject_id','study_id','session_id','start_time','completion_time','source_file'])"
  grep -E 'PROLIFIC_|test_[a-z0-9]{6,}' speaker_n1_fitted_anonymized.csv | head
  ```

## Connection to the simulation pipeline

The world here (n=1, m=5, 8-utterance vocabulary) is identical to the
simulation pipeline at
[`models/simulations/`](../../models/simulations/). The seven fitted
speaker models are a strict subset of the speakers produced by Stage 2
of that pipeline — `inf_F`, `persp_F`, `persm_F` correspond exactly to
its `update_internal=False` agents.

The vendored `rsa_optimal_exp_core.py` is an earlier sibling of
`models/simulations/rsa_core.py` (no level-2+ speakers; uses the global
`np.random` for any sampling, but model fitting only computes
log-likelihoods, so the RNG-threading work in the simulation pipeline is
not relevant here).

## Citation

If you use this dataset or pipeline, please cite the accompanying CogSci
2026 submission (citation key TBD).

## License

(Add your preferred license here — e.g. CC BY 4.0 for the data and MIT
for the code.)
