# RSA Clinical Trial Communication Experiment (N=5, M=1)

A jsPsych 7.x experiment investigating how people communicate clinical trial results under different communicative goals.

## Overview

This is a simplified version of the RSA experiment with:
- **5 patients** per trial
- **1 treatment session** per patient
- **Single-quantifier utterances**: "The treatment was [Effective/Ineffective] for [No/Some/Most/All] patients."

## Setup

### 1. Generate Stimuli

First, generate the stimulus images using the Python script:

```bash
pip install pillow
python generate_stimuli.py
```

This creates the `stimuli_emoji_n5m1/` folder with 6 trial outcome images:
- `effective_0.png` - 🤒🤒🤒🤒🤒 (0 effective)
- `effective_1.png` - 😃🤒🤒🤒🤒 (1 effective)
- `effective_2.png` - 😃😃🤒🤒🤒 (2 effective)
- `effective_3.png` - 😃😃😃🤒🤒 (3 effective)
- `effective_4.png` - 😃😃😃😃🤒 (4 effective)
- `effective_5.png` - 😃😃😃😃😃 (5 effective)

### 2. Serve Locally

The experiment needs to be served from a web server (can't run from `file://` due to CORS):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Experiment Structure

### 1. Welcome & Consent
- Welcome page (press SPACE to continue)
- Informed consent (click "I Consent" to proceed)

### 2. Instructions (3 pages, with back/forward navigation)
1. Cover story and data representation (5 patients, 1 session each)
2. Description structure: "The treatment was [Predicate] for [Quantifier] patients."
3. Truth/false judgment rules with worked examples

### 3. Comprehension Tests (3 modules)

**Module 1**: Quantifier definitions
- "Some" = at least one (could be all)
- "Most" = more than half (could be all)
- Review instruction pages 2-3 on failure

**Module 2**: True/False judgments (2 items, randomized)
- effective_3: "The treatment was Ineffective for Some patients." – TRUE
- effective_1: "The treatment was Ineffective for All patients." – FALSE
- Resume from current position after review

**Module 3**: Match description to trials (multiple selection)
- "The treatment was Ineffective for Most patients."
- Correct: effective_2 and effective_0
- Incorrect: effective_3

### 4. Main Speaker Task (3 blocks × 10 rounds)

Three within-subject conditions (randomized order):

| Condition | Role | Goal |
|-----------|------|------|
| **Informative** | Neutral Clinical Scientist | Be accurate and informative |
| **Persuade+** | Treatment Company Rep | Make treatment seem effective |
| **Persuade-** | Competitor Company Rep | Make treatment seem ineffective |

Each block:
1. Waiting screen (5-10s, simulating listener matching)
2. Scenario instruction with role description
3. 10 rounds of trial descriptions
   - View trial outcome image
   - Select description using dropdowns
   - Only TRUE statements can be submitted
   - Wait for "listener response" (3-5s)
4. Block completion message

### 5. Feedback & Debrief
- Open feedback text box
- Debrief explaining simulated listeners

## Files

```
experiment_n5m1/
├── index.html           # Main HTML file
├── styles.css           # Experiment styling
├── config.js            # Configuration and trial sequences
├── stimuli.js           # Stimulus display utilities
├── truth-checker.js     # Utterance truth validation
├── experiment.js        # Main experiment logic
├── generate_stimuli.py  # Python script to generate images
├── README.md            # This file
└── stimuli_emoji_n5m1/  # Generated stimulus images (6 PNGs)
    ├── effective_0.png
    ├── effective_1.png
    └── ...
```

## Trial Sequences

Each condition has 2 possible sequences of 10 trials. Participants are randomly assigned to one sequence per condition.

### Informative Sequences
Moderate effectiveness values, balanced outcomes

### Persuade+ Sequences  
Lower effectiveness values (more failures visible)
- Speaker's goal: Make treatment seem effective

### Persuade- Sequences
Higher effectiveness values (more successes visible)
- Speaker's goal: Make treatment seem ineffective

## Utterance Truth Table

| Effective Patients | True Utterances |
|-------------------|-----------------|
| 0 | Effective for No; Ineffective for All, Most, Some |
| 1 | Effective for Some; Ineffective for Most, Some |
| 2 | Effective for Some; Ineffective for Most, Some |
| 3 | Effective for Most, Some; Ineffective for Some |
| 4 | Effective for Most, Some; Ineffective for Some |
| 5 | Effective for All, Most, Some; Ineffective for No |

## Data Output

The experiment saves:
- Comprehension check responses and accuracy
- For each trial:
  - Scenario/condition
  - Round number
  - Number of effective patients
  - Selected predicate and quantifier
  - Full utterance string
  - Response time
  - False attempt count and details

## Dependencies

- jsPsych 7.3.4
- jsPsych plugins (loaded from CDN):
  - html-keyboard-response
  - html-button-response
  - survey-multi-choice
  - survey-text
  - instructions
  - preload
  - call-function

## Browser Compatibility

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
