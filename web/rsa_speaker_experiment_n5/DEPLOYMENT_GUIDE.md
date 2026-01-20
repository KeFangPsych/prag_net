# Complete Deployment Guide: RSA Speaker Experiment

This guide walks you through deploying your experiment on **GitHub Pages** with **DataPipe** for data collection and **Prolific** for participant recruitment.

---

## Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Prolific  │ ──► │   GitHub    │ ──► │  DataPipe   │
│  (recruit)  │     │   Pages     │     │  (save data)│
│             │     │  (host exp) │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Flow:**
1. Prolific sends participants to your GitHub Pages URL
2. Participant completes experiment
3. Data saves to DataPipe (linked to OSF)
4. Participant redirects back to Prolific

---

## Step 1: Prepare Your Files

### 1.1 Generate Stimulus Images

First, generate the 32 stimulus images using Python:

```bash
cd /path/to/your/experiment
pip install pillow
python generate_stimuli.py
```

This creates `stimuli_emoji_n5m1/` folder with 32 PNG files:
- `effective_0_v0.png` (1 file for 0 effective)
- `effective_1_v0.png` through `effective_1_v4.png` (5 files for 1 effective)
- `effective_2_v0.png` through `effective_2_v9.png` (10 files for 2 effective)
- `effective_3_v0.png` through `effective_3_v9.png` (10 files for 3 effective)
- `effective_4_v0.png` through `effective_4_v4.png` (5 files for 4 effective)
- `effective_5_v0.png` (1 file for 5 effective)

### 1.2 Verify All Files

Your experiment folder should contain:
```
experiment_n5m1/
├── index.html
├── experiment.js
├── config.js
├── stimuli.js
├── truth-checker.js
├── styles.css
├── generate_stimuli.py
├── README.md
├── DEPLOYMENT.md
└── stimuli_emoji_n5m1/
    ├── effective_0_v0.png
    ├── effective_1_v0.png
    ├── effective_1_v1.png
    ├── ... (32 PNG files total)
    └── effective_5_v0.png
```

---

## Step 2: Set Up DataPipe

### 2.1 Create DataPipe Account

1. Go to [pipe.jspsych.org](https://pipe.jspsych.org)
2. Click **"Sign in with OSF"** (or GitHub)
3. Authorize DataPipe

### 2.2 Create New Experiment

1. Click **"New Experiment"**
2. Fill in details:
   - **Name:** RSA Speaker Study N5M1
   - **Description:** Clinical trial communication experiment
3. Click **"Create"**

### 2.3 Copy Your Experiment ID

After creation, you'll see your **Experiment ID** (e.g., `lDXBSBtc67aZ`).

**Keep this ID - you'll need it!**

### 2.4 Configure Data Storage

1. In DataPipe dashboard, click on your experiment
2. Go to **Settings** → **OSF Integration**
3. Link to an OSF project (creates one if needed)
4. Data will be stored in the OSF project's data component

---

## Step 3: Update Configuration

### 3.1 Update config.js

Open `config.js` and update the DataPipe configuration:

```javascript
const DATAPIPE_CONFIG = {
    experiment_id: "YOUR_EXPERIMENT_ID_HERE",  // ← Replace with your ID
    enabled: true  // Set to true for real data collection
};
```

### 3.2 Update Prolific Completion Code (Later)

You'll update this after creating your Prolific study (Step 5).

---

## Step 4: Set Up GitHub Repository

### 4.1 Create Repository

1. Go to [github.com](https://github.com) and sign in
2. Click **"+"** → **"New repository"**
3. Configure:
   - **Repository name:** `rsa-speaker-experiment` (or your preferred name)
   - **Visibility:** **Public** ⚠️ (required for GitHub Pages)
   - **Initialize with README:** ✓ Check this
4. Click **"Create repository"**

### 4.2 Upload Files

#### Option A: Using GitHub Web Interface

1. In your repository, click **"Add file"** → **"Upload files"**
2. Drag and drop these files:
   - `index.html`
   - `experiment.js`
   - `config.js`
   - `stimuli.js`
   - `truth-checker.js`
   - `styles.css`
3. Click **"Commit changes"**

4. Create the stimulus folder:
   - Click **"Add file"** → **"Upload files"**
   - Drag the entire `stimuli_emoji_n5m1` folder
   - Or upload all 32 PNG files and GitHub will create the folder

#### Option B: Using Git Command Line

```bash
# Clone your new repository
git clone https://github.com/YOUR-USERNAME/rsa-speaker-experiment.git
cd rsa-speaker-experiment

# Copy all experiment files
cp /path/to/experiment_n5m1/* .
cp -r /path/to/experiment_n5m1/stimuli_emoji_n5m1 .

# Commit and push
git add .
git commit -m "Add experiment files"
git push origin main
```

### 4.3 Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **"Settings"** (top menu)
3. Click **"Pages"** (left sidebar)
4. Under **"Source"**:
   - Select **"Deploy from a branch"**
   - Branch: **main**
   - Folder: **/ (root)**
5. Click **"Save"**
6. Wait 2-5 minutes for deployment

### 4.4 Get Your Experiment URL

Your experiment will be available at:
```
https://YOUR-USERNAME.github.io/rsa-speaker-experiment/
```

**Test this URL** in your browser to make sure it loads!

---

## Step 5: Set Up Prolific Study

### 5.1 Create New Study

1. Go to [prolific.com](https://www.prolific.com) and sign in
2. Click **"New Study"**

### 5.2 Configure Study Details

**Basic Info:**
- **Study name:** Clinical Trial Communication Study
- **Internal name:** RSA_N5M1_v1 (for your reference)
- **Description:**
  ```
  In this study, you will play different roles describing clinical trial results 
  to other participants. You will see trial outcomes and choose descriptions to 
  send to listeners. The study takes approximately 15-20 minutes to complete.
  ```

**Study URL:**
```
https://YOUR-USERNAME.github.io/rsa-speaker-experiment/?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
```

⚠️ **Important:** Include the `?PROLIFIC_PID=...` parameters exactly as shown!

### 5.3 Configure Completion Paths

Your study will have **two completion paths**:
1. **Successful completion** → Full payment
2. **Custom screening (early termination)** → Partial payment

#### Enable Custom Screening:

1. In study setup, find **"Custom screening"** section
2. Select **"Yes"** to add custom screening completion path
3. Configure:
   - **Number of screening slots:** Set to ~10-20% of your sample (e.g., 10 for N=50)
   - **Screening reward:** $1-2 (fair compensation for partial time)
   
4. You will now have **TWO completion codes**:
   - **Main completion code** (for full completion)
   - **Screening code** (for early termination)

**Copy BOTH codes!**

### 5.4 Update experiment.js with BOTH Codes

Open `experiment.js` and find this section at the top (around lines 9-11):

```javascript
// ============================================================================
// PROLIFIC CONFIGURATION - UPDATE THESE WITH YOUR ACTUAL CODES
// ============================================================================

const PROLIFIC_COMPLETION_CODE = "YOUR_COMPLETION_CODE";  // For successful completion
const PROLIFIC_SCREENING_CODE = "YOUR_SCREENING_CODE";    // For early termination (custom screening)
```

Replace both codes with your actual Prolific codes:

```javascript
const PROLIFIC_COMPLETION_CODE = "C1A2B3C4";   // ← Your main completion code
const PROLIFIC_SCREENING_CODE = "SCREEN123";   // ← Your screening code
```

**Commit and push this change to GitHub!**

### 5.5 Configure Study Settings

**Timing:**
- **Estimated completion time:** 18 minutes
- **Maximum time allowed:** 45 minutes

**Prescreening (Recommended):**
- **Approval rate:** ≥ 95%
- **Number of previous submissions:** ≥ 50
- **Country:** US, UK, Canada (or your target)
- **First language:** English
- **Device:** Desktop only

**Payment:**
- **Reward per participant:** Calculate based on your base payment
- Example: $9 base for ~18 min = $30/hour rate

### 5.6 Save as Draft

Click **"Save as draft"** - don't publish yet!

---

## Step 6: Pre-Launch Testing

### 6.1 Test Locally

1. Open `index.html` in a browser
2. Complete the entire experiment
3. Check browser console (F12) for errors

### 6.2 Test on GitHub Pages

1. Go to your GitHub Pages URL
2. Add test parameters:
   ```
   https://YOUR-USERNAME.github.io/rsa-speaker-experiment/?PROLIFIC_PID=TEST123&STUDY_ID=TEST&SESSION_ID=TEST
   ```
3. Complete the entire experiment

### 6.3 Verify DataPipe

1. Go to [pipe.jspsych.org](https://pipe.jspsych.org)
2. Select your experiment
3. Check that test data appeared
4. Click to view/download the CSV
5. Verify all columns are present:
   - `subject_id`, `prolific_pid`
   - `completion_status`, `completion_time`
   - `task`, `scenario`, `round`
   - `num_effective`, `stimulus_variant`, `stimulus_positions`
   - `predicate`, `quantifier`, `utterance`
   - etc.

### 6.4 Test Prolific Redirect

After completing the test experiment:
- You should be redirected to Prolific
- You'll see an error (because TEST123 isn't a real participant) - this is OK!

### 6.5 Delete Test Data

**Before launching, delete all test data:**

1. Go to your OSF project linked to DataPipe
2. Navigate to the data component
3. Delete all test CSV files (e.g., `TEST123.csv`, `test_xxxxx.csv`)

---

## Step 7: Launch Checklist

Before publishing your Prolific study, verify:

- [ ] **config.js:** DataPipe `experiment_id` is correct
- [ ] **config.js:** `enabled: true` for DataPipe
- [ ] **experiment.js:** `PROLIFIC_COMPLETION_CODE` is set correctly
- [ ] **experiment.js:** `PROLIFIC_SCREENING_CODE` is set correctly
- [ ] **GitHub:** All files uploaded (including 32 stimulus images)
- [ ] **GitHub Pages:** Site loads correctly
- [ ] **DataPipe:** Test data received and deleted
- [ ] **Prolific:** Study URL includes `{{%PROLIFIC_PID%}}` parameters
- [ ] **Prolific:** Custom screening enabled with partial payment set
- [ ] **Prolific:** Both completion codes copied to experiment.js

---

## Step 8: Publish Study

1. Go to your Prolific draft study
2. Review all settings
3. Set number of participants
4. Click **"Publish"**
5. Add funds if needed

---

## Understanding Completion Paths

Your experiment handles three completion scenarios:

### Successful Completion
- Participant completes all trials
- Data saved with `completion_status: 'completed'`
- Redirected to main completion URL → **Full payment**
- **Counts toward your submission quota**

### Early Termination: Attention Check Failure
- Triggered after 2 failed attention checks
- Data saved with `completion_status: 'terminated_attention_check'`
- Shown termination message with "Return to Prolific" button
- Redirected to screening URL → **Partial payment (e.g., $1-2)**
- **Does NOT count toward your quota** (uses screening slots)

### Early Termination: Inactivity Timeout
- Triggered after 90 seconds of no response
- Data saved with `completion_status: 'terminated_inactivity'`
- Shown termination message with "Return to Prolific" button
- Redirected to screening URL → **Partial payment (e.g., $1-2)**
- **Does NOT count toward your quota** (uses screening slots)

### Why Use Custom Screening?

| Without Screening | With Screening |
|-------------------|----------------|
| Early terminations waste submission slots | Early terminations use separate screening slots |
| You pay full price for incomplete data | You pay partial amount for partial work |
| May need to recruit more participants | Quota stays intact |
| Participants might feel unfairly treated | Fair compensation for time spent |

---

## Monitoring Your Study

### Check DataPipe Dashboard

- Monitor incoming data at [pipe.jspsych.org](https://pipe.jspsych.org)
- View completion rates and check for issues

### Check Prolific Dashboard

- Monitor submissions
- Handle any participant messages
- Review completion times

### Data Quality Checks

Look for these in your data:
- `completion_status === 'completed'` for valid completions
- `terminated_early === true` for early terminations
- Check `attention_passed` columns

---

## Handling Early Terminations on Prolific

### What Happens When a Participant is Terminated Early

When a participant fails attention checks or times out due to inactivity:

1. **Data is saved** to DataPipe with `completion_status` indicating the reason
2. **Participant sees a message** explaining why the study ended
3. **Prolific participants see instructions** to return the study

### Termination Messages Include:

For Prolific participants, the termination screen shows:
- Explanation of why the study ended
- Instructions to return to Prolific
- Link to return the study: `https://app.prolific.com/submissions/complete?cc=NOCODE`

### Managing Terminated Submissions on Prolific

Participants who are terminated early will appear as:
- **"Returned"** - if they clicked the return link
- **"Timed out"** - if they didn't return within the time limit

**You should NOT approve or reject these submissions** - they will be automatically handled by Prolific's return system.

### Identifying Terminated Participants in Your Data

In your CSV data, check:

| completion_status | Meaning |
|-------------------|---------|
| `completed` | Successfully finished - approve on Prolific |
| `terminated_attention_check` | Failed 2 attention checks - should be returned |
| `terminated_inactivity` | Timed out (90s no response) - should be returned |

### Recommended Prolific Workflow

1. **Download data** from DataPipe
2. **Filter by `completion_status === 'completed'`** for valid submissions
3. **Approve** only participants with `completed` status
4. Terminated participants should have already returned their submission

---

## Troubleshooting

### Data Not Saving

1. Check browser console for errors
2. Verify `DATAPIPE_CONFIG.experiment_id` is correct
3. Verify `DATAPIPE_CONFIG.enabled` is `true`
4. Check DataPipe dashboard for error messages

### GitHub Pages Not Updating

1. Check repository **Actions** tab for deployment status
2. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
3. Wait a few more minutes (can take up to 10 min)

### Prolific Redirect Not Working

1. Verify completion code in `experiment.js`
2. Check that `prolificPID` is being captured from URL
3. Test with URL parameters

### Images Not Loading

1. Check file paths are correct (`stimuli_emoji_n5m1/effective_X_vY.png`)
2. Verify all 32 images are uploaded to GitHub
3. Check browser console for 404 errors

---

## Downloading Final Data

1. Go to [pipe.jspsych.org](https://pipe.jspsych.org)
2. Select your experiment
3. Click **"Download All"**

Or download from OSF:
1. Go to your linked OSF project
2. Navigate to the data component
3. Download individual CSVs or all files

---

## Data Dictionary

| Column | Description |
|--------|-------------|
| `subject_id` | Participant ID (Prolific PID or test ID) |
| `prolific_pid` | Prolific participant ID |
| `study_id` | Prolific study ID |
| `session_id` | Prolific session ID |
| `completion_status` | `completed`, `terminated_attention_check`, or `terminated_inactivity` |
| `completion_time` | ISO timestamp of completion |
| `terminated_early` | `true` or `false` |
| `termination_reason` | `null`, `attention_check_failure`, or `inactivity_timeout` |
| `task` | Trial type (`speaker`, `attention_check`, `comp1_some`, etc.) |
| `scenario` | `informative`, `pers_plus`, or `pers_minus` |
| `block` | Block number (0, 1, 2) |
| `round` | Round within block (1-10) |
| `num_effective` | Number of effective patients (0-5) |
| `stimulus_variant` | Which arrangement was shown |
| `stimulus_positions` | JSON array of effective positions |
| `predicate` | `Effective` or `Ineffective` |
| `quantifier` | `No`, `Some`, `Most`, or `All` |
| `utterance` | Full utterance text |
| `rt` | Response time in ms |
| `attention_passed` | Boolean for attention checks |
| `total_failures` | Cumulative attention check failures |

---

## Quick Reference

| Service | URL |
|---------|-----|
| DataPipe | https://pipe.jspsych.org |
| GitHub | https://github.com |
| Prolific | https://www.prolific.com |
| Your Experiment | https://YOUR-USERNAME.github.io/rsa-speaker-experiment/ |

---

## Contact & Support

- **DataPipe Issues:** https://github.com/jspsych/datapipe/issues
- **jsPsych Documentation:** https://www.jspsych.org
- **Prolific Help:** https://researcher-help.prolific.com
