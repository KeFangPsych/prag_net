# RSA Clinical Trial Communication Experiment

A jsPsych 7.x experiment investigating how people communicate clinical trial results under different communicative goals.

## Setup

1. **Generate Stimuli**: First, generate the stimulus images using the Python script:
   ```bash
   pip install pillow
   python generate_stimuli_twemoji.py
   ```
   This creates the `stimuli_emoji/` folder with 126 trial outcome images.

2. **Move Stimuli**: Move or copy the `stimuli_emoji/` folder into the `experiment/` directory.

3. **Serve Locally**: The experiment needs to be served from a web server (can't run from `file://` due to CORS):
   ```bash
   cd experiment
   python -m http.server 8000
   ```
   Then open `http://localhost:8000` in your browser.

## Experiment Structure

### 1. Welcome & Consent
- Welcome page (press SPACE to continue)
- Informed consent (click "I Consent" to proceed)

### 2. Instructions (3 pages, with back/forward navigation)
1. Cover story and data representation
2. Description structure ("[Q] sessions are [Pred] for [Q] patients")
3. Truth/false judgment rules

### 3. Comprehension Tests (4 modules)

**Module 1**: Data structure understanding
- Questions about number of patients/treatments
- Review instruction page 1 on failure

**Module 2**: Quantifier definitions
- "Some" = at least one (could be all)
- "Most" = more than 50% (could be all)
- Review instruction pages 2-3 on failure

**Module 3**: True/False judgments (4 items, randomized)
- Evaluate whether statements are TRUE or FALSE
- Resume from current position after review

**Module 4**: Match descriptions to trials (2 items, randomized)
- Select which trial matches a description
- Resume from current position after review

### 4. Main Speaker Task (3 blocks × 15 rounds)

Three within-subject conditions (randomized order):
- **Informative**: Neutral clinical scientist
- **Persuade+**: Treatment company representative  
- **Persuade-**: Competitor company representative

Each block:
1. Waiting screen (5-10s, simulating listener matching)
2. Scenario instruction with role description
3. 15 rounds of trial descriptions
   - View trial outcome image
   - Select description using dropdowns
   - Only TRUE statements can be submitted
   - Wait for "listener response" (3-7s)
4. Block completion message

### 5. Feedback & Debrief
- Open feedback text box
- Debrief explaining simulated listeners

## Files

```
experiment/
├── index.html          # Main HTML file
├── styles.css          # Experiment styling
├── config.js           # Configuration and trial sequences
├── stimuli.js          # Stimulus display utilities
├── truth-checker.js    # Utterance truth validation
├── trials.js           # Additional trial utilities
├── experiment.js       # Main experiment logic
└── stimuli_emoji/      # Generated stimulus images (126 PNGs)
    ├── obs_0_0_0_0_5.png
    ├── obs_0_0_0_1_4.png
    └── ...
```

## Trial Sequences

Each condition has 4 possible sequences of 15 trials. Participants are randomly assigned to one sequence per condition.

### Informative Sequences
Moderate theta values, balanced outcomes

### Persuade+ Sequences  
Lower theta values (more failures visible)
- Speaker's goal: Make treatment seem effective

### Persuade- Sequences
Higher theta values (more successes visible)
- Speaker's goal: Make treatment seem ineffective

## Data Output

The experiment saves:
- Comprehension check responses and accuracy
- For each trial:
  - Scenario/condition
  - Round number
  - Observation tuple
  - Selected quantifiers and predicate
  - Full utterance string
  - Response time

## Customization

### Modify timing
In `config.js`:
```javascript
pairing_wait_min: 5000,    // Min wait for "pairing" (ms)
pairing_wait_max: 10000,   // Max wait for "pairing" (ms)
listener_response_min: 3000, // Min "listener thinking" time
listener_response_max: 7000  // Max "listener thinking" time
```

### Modify trial sequences
In `config.js`, edit the `trial_sequences` object.

### Modify scenario descriptions
In `config.js`, edit the `scenarios` object.

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

## Notes

- Images are preloaded at experiment start
- All 126 possible trial outcomes are preloaded
- The "listener" is simulated (no actual real-time matching)
- Participants are debriefed about this at the end
