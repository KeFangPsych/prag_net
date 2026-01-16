# Deployment Guide: RSA Speaker Experiment

## Overview

This guide explains how to deploy your experiment on GitHub Pages and collect data using DataPipe for use with Prolific.

---

## Step 1: Create GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click the **+** icon → **New repository**
3. Settings:
   - **Name**: `rsa-speaker-experiment` (or your preferred name)
   - **Visibility**: **Public** (required for GitHub Pages)
   - **Initialize with README**: ✓ Check this
4. Click **Create repository**

---

## Step 2: Upload Experiment Files

### Option A: Using GitHub Web Interface

1. In your repository, click **Add file** → **Upload files**
2. Drag and drop all files:
   ```
   index.html
   experiment.js
   config.js
   stimuli.js
   truth-checker.js
   styles.css
   ```
3. Create a folder for images:
   - Click **Add file** → **Create new file**
   - Type `stimuli_emoji_n5m1/effective_0.png` (this creates the folder)
   - Cancel and then upload images to that folder

### Option B: Using Git Command Line

```bash
git clone https://github.com/YOUR-USERNAME/rsa-speaker-experiment.git
cd rsa-speaker-experiment

# Copy your experiment files here
cp -r /path/to/experiment/* .

git add .
git commit -m "Add experiment files"
git push origin main
```

---

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top menu)
3. Scroll down to **Pages** (left sidebar)
4. Under **Source**:
   - Select **Deploy from a branch**
   - Branch: **main**
   - Folder: **/ (root)**
5. Click **Save**
6. Wait 2-5 minutes for deployment
7. Your experiment URL will be:
   ```
   https://YOUR-USERNAME.github.io/rsa-speaker-experiment/
   ```

---

## Step 4: Set Up DataPipe

### Create DataPipe Account

1. Go to [pipe.jspsych.org](https://pipe.jspsych.org)
2. Click **Sign in with GitHub**
3. Authorize DataPipe to access your GitHub

### Create New Experiment

1. Click **New Experiment**
2. Fill in:
   - **Experiment Name**: RSA Speaker Study
   - **GitHub Repository**: Select your repo
   - **Data Directory**: `data` (default)
3. Click **Create**
4. **Copy your Experiment ID** (looks like: `abc123xyz789`)

### Update Your Config

Edit `config.js` and replace the placeholder:

```javascript
const DATAPIPE_CONFIG = {
    experiment_id: "abc123xyz789", // ← Put your actual ID here
    enabled: true
};
```

Commit and push this change to GitHub.

---

## Step 5: Set Up Prolific Study

### Create Study on Prolific

1. Go to [prolific.com](https://www.prolific.com) and sign in
2. Click **New Study**
3. Fill in study details:
   - **Study name**: Clinical Trial Communication Study
   - **Description**: Describe your study
   - **Estimated completion time**: 15-20 minutes

### Configure Study Link

1. Under **Study URL**, enter:
   ```
   https://YOUR-USERNAME.github.io/rsa-speaker-experiment/?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
   ```
   
2. Under **Completion**, select **I'll redirect them using a URL**

3. Get your completion code from Prolific and update `experiment.js`:
   ```javascript
   // In the on_finish callback of jsPsych initialization:
   window.location.href = "https://app.prolific.com/submissions/complete?cc=YOUR_CODE";
   ```

### Important Settings

- **How do you want to confirm participants have completed your study?**: URL redirect
- **Device type**: Desktop only (recommended for this experiment)
- **Prescreening**: Set as needed

---

## Step 6: Test Before Launch

### Local Testing

1. Test your experiment locally by opening `index.html` in a browser
2. Check the browser console (F12) for any errors
3. Verify data appears in console at the end

### Test with DataPipe

1. Go through the experiment on your GitHub Pages URL
2. Check DataPipe dashboard to verify data was received
3. Download the test data and verify format

### Test Prolific Integration

1. Create a test URL with fake Prolific parameters:
   ```
   https://YOUR-USERNAME.github.io/rsa-speaker-experiment/?PROLIFIC_PID=test123&STUDY_ID=test&SESSION_ID=test
   ```
2. Complete the experiment
3. Verify redirect works (you'll see an error page since the code is fake, but that's OK)

---

## Data Format

Your data will be saved as CSV files in the format: `{subject_id}.csv`

Key columns in your data:

| Column | Description |
|--------|-------------|
| `subject_id` | Participant identifier |
| `prolific_pid` | Prolific participant ID |
| `task` | Trial type (speaker, attention_check, etc.) |
| `scenario` | Role type (informative, pers_plus, pers_minus) |
| `round` | Trial number within block |
| `num_effective` | Number of effective patients shown |
| `utterance` | Description participant selected |
| `predicate` | Effective or Ineffective |
| `quantifier` | No, Some, Most, or All |
| `attention_passed` | Boolean for attention checks |
| `role_comp_correct` | Boolean for role comprehension |
| `rt` | Response time in ms |

---

## Troubleshooting

### Data not saving

1. Check browser console for errors
2. Verify experiment ID is correct in config.js
3. Make sure DataPipe is enabled: `DATAPIPE_CONFIG.enabled: true`
4. Check DataPipe dashboard for any error messages

### GitHub Pages not updating

1. Check repository **Actions** tab for deployment status
2. Hard refresh the page (Ctrl+Shift+R)
3. Wait a few more minutes

### Prolific redirect not working

1. Verify completion code is correct
2. Check that URL parameters are being passed correctly
3. Test the redirect URL directly

---

## Downloading Data

1. Go to [pipe.jspsych.org](https://pipe.jspsych.org)
2. Select your experiment
3. Click **Download Data**
4. Choose format (CSV recommended)

---

## Contact

For issues with:
- **DataPipe**: Check [DataPipe documentation](https://pipe.jspsych.org/docs)
- **jsPsych**: Check [jsPsych documentation](https://www.jspsych.org)
- **Prolific**: Check [Prolific Help Center](https://researcher-help.prolific.com)
