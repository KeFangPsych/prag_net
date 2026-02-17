# Deployment Guide: Study 1 — Known Goal Discounting

## Step 1: Set Up DataPipe

1. **Go to** [pipe.jspsych.org](https://pipe.jspsych.org) and sign in (or create an account).

2. **Create a new experiment:**
   - Click **"New Experiment"**
   - Give it a descriptive name (e.g., `selective_truths_exp1_known_goal`)
   - You'll receive an **Experiment ID** (a long alphanumeric string like `abc123def456...`)

3. **Configure condition assignment:**
   - In the experiment settings, set **Number of Conditions = 6**
   - This enables DataPipe's balanced assignment across your 6 cells:
     - 0: informative × identification
     - 1: informative × production
     - 2: pers_plus × identification
     - 3: pers_plus × production
     - 4: pers_minus × identification
     - 5: pers_minus × production
   - DataPipe will assign each new participant to the condition with the fewest completions

4. **Enable data saving:**
   - Make sure data collection is enabled
   - Data will be saved as CSV files named `{participant_id}.csv`

5. **Copy your Experiment ID** — you'll need it in Step 2.

## Step 2: Configure Your Experiment Files

1. **Open `config.js`** and replace the placeholder:
   ```javascript
   const DATAPIPE_CONFIG = {
     experiment_id: "YOUR_ACTUAL_EXPERIMENT_ID_HERE",  // ← paste from Step 1
     enabled: true,
   };
   ```

2. **Open `experiment.js`** and update the Prolific completion code (line 32):
   ```javascript
   const PROLIFIC_COMPLETION_CODE = "YOUR_ACTUAL_CODE";  // ← from Prolific (Step 4)
   ```

## Step 3: Host Your Experiment

Host all experiment files on a static web server. Options include:

**Option A: GitHub Pages (recommended)**
1. Create a GitHub repository (e.g., `selective-truths-exp1`)
2. Upload all files maintaining this structure:
   ```
   /
   ├── index.html
   ├── config.js
   ├── experiment.js
   ├── stimuli.js
   ├── truth-checker.js
   ├── styles.css
   └── stimuli_emoji_n5m1/
       ├── effective_0_v0.png
       ├── effective_1_v0.png
       ├── ... (all stimulus images)
       └── effective_5_v0.png
   ```
3. Go to Settings → Pages → set source to "main" branch, root folder
4. Your URL will be: `https://yourusername.github.io/selective-truths-exp1/`

**Option B: Any static hosting** (Netlify, Vercel, university server, etc.)
- Just upload all files and ensure the URL is publicly accessible via HTTPS.

## Step 4: Set Up Prolific

1. **Create a new study** on [Prolific](https://app.prolific.com):
   - **Study name:** Selective Truths and Epistemic Vigilance (Exp 1)
   - **Study URL:** Your hosted experiment URL with Prolific URL parameters:
     ```
     https://yourusername.github.io/selective-truths-exp1/?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
     ```
   - **Completion URL:** Select "I'll use a URL to confirm participants have completed my study"
   - Copy the **completion code** Prolific generates and paste it into `experiment.js` (line 32)

2. **Participant requirements:**
   - Approval rate: ≥ 95%
   - Country: US, UK, or Canada
   - First language: English
   - No previous participation in this study

3. **Study details:**
   - **Estimated time:** 8–10 minutes
   - **Reward:** $1.60 base payment
   - **Bonus:** Up to $2.00 (Block 1 bonus up to $1.00 + Block 2 bonus up to $1.00)
   - **Total places:** 300 (50 per cell × 6 cells)
   - **Description:** "In this study, you will play a communication game about clinical trial results. You will take on the roles of speaker and listener, making decisions about how to describe and interpret medical information."

4. **Attention/data quality settings:**
   - Enable "Prevent participants from taking the study on a mobile device" (recommended for this UI)

## Step 5: Test Before Launch

1. **Local testing:**
   - In `config.js`, temporarily set `enabled: false` in DATAPIPE_CONFIG
   - Open `index.html` in a browser
   - Test all 6 conditions by refreshing (random assignment when DataPipe disabled)
   - Verify data saves in browser console: `jsPsych.data.get().csv()`

2. **Live testing with DataPipe:**
   - Re-enable DataPipe (`enabled: true`)
   - Open your hosted URL
   - Complete the experiment and verify:
     - CSV file appears in your DataPipe dashboard
     - Condition number is correctly assigned (0–5)
     - All data fields are present

3. **Prolific preview:**
   - Use Prolific's "Preview" feature to test the full flow
   - Verify the completion redirect works back to Prolific

## Step 6: Launch & Monitor

1. **Publish the study** on Prolific.

2. **Monitor in DataPipe:**
   - Check that CSV files are appearing as participants complete
   - Check condition balance: DataPipe should distribute roughly equally across 0–5

3. **Monitor in Prolific:**
   - Watch for any early returns or timeouts
   - Check bonus payment queue

4. **If a cell falls below 40 after exclusions:**
   - Recruit additional participants (Prolific allows increasing total places)
   - DataPipe's balanced assignment will automatically send new participants to underfilled conditions

## Data Fields Reference

### Global Properties (every row)
| Field | Description |
|---|---|
| `subject_id` | Prolific PID or test ID |
| `prolific_pid` | Prolific participant ID |
| `study_id` / `session_id` | Prolific metadata |
| `experiment_version` | "1.0.0" |
| `start_time` / `completion_time` | ISO timestamps |
| `condition_number` | 0–5 (DataPipe assigned) |
| `goal_condition` | informative / pers_plus / pers_minus |
| `grounding_condition` | identification / production |
| `block1_sequence` / `block2_sequence` | JSON arrays of stimuli shown |
| `block1_sequence_idx` / `block2_sequence_idx` | Which sequence variant was selected |
| `image_order_reversed` | Block 2 image order counterbalance |
| `comp_total_correct` | Number of comprehension checks correct (out of 5) |
| `comp_passed` | true if ≥ 4 correct |
| `block1_attention_passed` | Block 1 attention check result (null for identification) |
| `block2_attention_passed` | Block 2 attention check result |
| `completion_status` | "completed" or "terminated_{reason}" |
| `terminated_early` | boolean |

### Trial-Level Data (filtered by `task` column)
| Task | Key Fields |
|---|---|
| `comp1a` / `comp1b` | `comp_correct`, `rt` |
| `comp2` / `comp3a` / `comp3b` | `comp_correct`, `selected`, `rt` |
| `goal_comprehension` | `goal_comp_correct`, `selected_option`, `rt` |
| `block1_identification` | `round`, `num_effective`, `results` (JSON of all 8), `n_correct`, `rt` |
| `block1_production` | `round`, `num_effective`, `predicate`, `quantifier`, `utterance`, `display_order`, `selected_position`, `rt` |
| `block1_attention_check` | `attention_check_passed`, `selected_description`, `rt` |
| `block2_trial` | `round`, `utterance_predicate`, `utterance_quantifier`, `utterance_text`, `predictive_posterior`, `possible_observations`, `rt` |
| `block2_attention_check` | `prediction_selected`, `attention_check_passed`, `rt` |
| `block1_strategy` | `response` (JSON with `block1_strategy` key) |
| `listener_strategy` | `response` (JSON with `listener_strategy` key) |
| `general_feedback` | `response` (JSON with `general_feedback` key) |

### Exclusion Criteria (for analysis)
1. `comp_passed == false` (failed > 1 of 5 comprehension checks)
2. `block1_attention_passed == false` (production condition only)
3. `block2_attention_passed == false`
4. `terminated_early == true` (inactivity timeout)
5. Flat responding: same `predictive_posterior` on all 6 Block 2 rounds (sensitivity analysis)
