/**
 * experiment.js - Main experiment logic for Listener Experiment
 * Between-subjects design: Each participant paired with ONE speaker type
 */

// ============================================================================
// SUBJECT ID AND PROLIFIC INTEGRATION
// ============================================================================

const urlParams = new URLSearchParams(window.location.search);
const prolificPID = urlParams.get("PROLIFIC_PID") || null;
const studyID = urlParams.get("STUDY_ID") || null;
const sessionID = urlParams.get("SESSION_ID") || null;

function generateSubjectId() {
  if (prolificPID) {
    return prolificPID;
  }
  return "test_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();
}

const subjectId = generateSubjectId();

// ============================================================================
// PROLIFIC CONFIGURATION
// ============================================================================

const PROLIFIC_COMPLETION_CODE = "YOUR_COMPLETION_CODE"; // Replace with actual code
const PROLIFIC_SCREENING_CODE = "YOUR_SCREENING_CODE";   // Replace with actual code

// Initialize jsPsych
const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: false,
  on_finish: function () {
    if (prolificPID && !experimentState.terminatedEarly) {
      window.location.href = `https://app.prolific.com/submissions/complete?cc=${PROLIFIC_COMPLETION_CODE}`;
    }
  },
});

// Add subject info to all trials
jsPsych.data.addProperties({
  subject_id: subjectId,
  prolific_pid: prolificPID,
  study_id: studyID,
  session_id: sessionID,
  experiment_version: "1.0.0",
  start_time: new Date().toISOString(),
});

// ============================================================================
// EXPERIMENT STATE
// ============================================================================

const experimentState = {
  // Condition assignments (between-subjects)
  speakerCondition: null,      // "informative", "pers_plus", or "pers_minus" (utterances received)
  listenerBeliefCondition: null, // "vigilant", "credulous", or "naturalistic" (what they're told)
  utteranceSequence: [],
  sequenceIdx: 0,
  
  // Order randomization
  measureOrder: null,  // "effectiveness_first" or "speaker_type_first"
  
  // Distribution states (carry over between rounds)
  effectivenessDistribution: null,  // Array of 11 values
  speakerTypeDistribution: null,    // Array of 3 values
  
  // Track if distributions were changed this round
  effectivenessChanged: false,
  speakerTypeChanged: false,
  
  // Round tracking
  currentRound: 0,
  currentUtterance: null,  // Store current utterance for use across pages
  
  // Comprehension check state
  comp2_items: [],
  comp3_options: [],
  
  // Timer state
  inactivityTimer: null,
  inactivityStartTime: null,
  warning1Shown: false,
  warning2Shown: false,
  
  // Termination flag
  terminatedEarly: false,
  
  // Progress tracking
  completedTrials: 0,
};

// Calculate total progress steps
// Welcome(1) + Consent(1) + Instructions(1) + Comp checks(11) + Intro pages(2) + 
// Pairing(1) + Matched(1) + Trials(5 rounds × 2 measure pages = 10) + Final(2) = 30
const TOTAL_PROGRESS_STEPS = 30;

function updateProgress() {
  experimentState.completedTrials++;
  const progress = Math.min(experimentState.completedTrials / TOTAL_PROGRESS_STEPS, 1);
  jsPsych.setProgressBar(progress);
}

// ============================================================================
// INACTIVITY TIMER SYSTEM
// ============================================================================

function showInactivityWarning(message, isUrgent = false) {
  removeInactivityWarning();

  const overlay = document.createElement("div");
  overlay.id = "inactivity-warning-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  const warningBox = document.createElement("div");
  warningBox.style.cssText = `
    background: white;
    padding: 30px 50px;
    border-radius: 12px;
    text-align: center;
    max-width: 500px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    border: 4px solid ${isUrgent ? "#f44336" : "#ff9800"};
  `;

  warningBox.innerHTML = `
    <h2 style="color: ${isUrgent ? "#f44336" : "#ff9800"}; margin-bottom: 15px;">
      ⚠️ ${isUrgent ? "Urgent: " : ""}Please Respond
    </h2>
    <p style="font-size: 1.1em; margin-bottom: 20px;">${message}</p>
    <button id="dismiss-warning-btn" class="jspsych-btn" style="background: ${isUrgent ? "#f44336" : "#ff9800"}; color: white; padding: 12px 30px;">
      I'm here - Continue
    </button>
  `;

  overlay.appendChild(warningBox);
  document.body.appendChild(overlay);

  document.getElementById("dismiss-warning-btn").addEventListener("click", () => {
    removeInactivityWarning();
  });
}

function removeInactivityWarning() {
  const overlay = document.getElementById("inactivity-warning-overlay");
  if (overlay) {
    overlay.remove();
  }
}

function startInactivityTimer() {
  clearInactivityTimer();
  experimentState.inactivityStartTime = Date.now();
  experimentState.warning1Shown = false;
  experimentState.warning2Shown = false;

  experimentState.inactivityTimer = setInterval(() => {
    const elapsed = Date.now() - experimentState.inactivityStartTime;

    if (elapsed >= CONFIG.inactivity_warning_1 && !experimentState.warning1Shown) {
      experimentState.warning1Shown = true;
      showInactivityWarning(
        "Please complete your response.<br>The experiment will end if no response is received.",
        false
      );
    }

    if (elapsed >= CONFIG.inactivity_warning_2 && !experimentState.warning2Shown) {
      experimentState.warning2Shown = true;
      showInactivityWarning(
        "Please respond soon!<br><strong>The experiment will end in 30 seconds.</strong>",
        true
      );
    }

    if (elapsed >= CONFIG.inactivity_timeout) {
      clearInactivityTimer();
      removeInactivityWarning();
      saveDataAndEndExperiment("inactivity_timeout");
    }
  }, 1000);
}

function clearInactivityTimer() {
  if (experimentState.inactivityTimer) {
    clearInterval(experimentState.inactivityTimer);
    experimentState.inactivityTimer = null;
  }
  removeInactivityWarning();
}

function resetInactivityTimer() {
  experimentState.inactivityStartTime = Date.now();
  experimentState.warning1Shown = false;
  experimentState.warning2Shown = false;
  removeInactivityWarning();
}

// ============================================================================
// EARLY TERMINATION
// ============================================================================

function getTerminationMessage(reason) {
  const isProlific = !!prolificPID;
  const prolificRedirect = isProlific
    ? `<div style="margin-top: 25px; padding: 20px; background: #e3f2fd; border: 2px solid #2196F3; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 15px 0; color: #1565c0;"><strong>Click below to return to Prolific:</strong></p>
        <button onclick="window.location.href='https://app.prolific.com/submissions/complete?cc=${PROLIFIC_SCREENING_CODE}'" 
                style="padding: 12px 30px; font-size: 16px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer;">
          Return to Prolific
        </button>
      </div>`
    : "";

  if (reason === "inactivity_timeout") {
    return `<div class="debrief-container">
      <h2 style="color: #f44336;">Study Ended Due to Inactivity</h2>
      <p>Unfortunately, the study has ended because no response was received within the time limit.</p>
      <p style="margin-top: 15px; color: #666;">Thank you for your participation.</p>
      ${prolificRedirect}
    </div>`;
  } else {
    return `<div class="debrief-container">
      <h2 style="color: #f44336;">Study Ended</h2>
      <p>The study has ended unexpectedly.</p>
      <p style="margin-top: 15px; color: #666;">Thank you for your participation.</p>
      ${prolificRedirect}
    </div>`;
  }
}

async function saveDataAndEndExperiment(reason) {
  experimentState.terminatedEarly = true;

  let completionStatus = "terminated_unknown";
  if (reason === "inactivity_timeout") {
    completionStatus = "terminated_inactivity";
  }

  jsPsych.data.addProperties({
    completion_status: completionStatus,
    completion_time: new Date().toISOString(),
    terminated_early: true,
    termination_reason: reason,
  });

  if (DATAPIPE_CONFIG.enabled) {
    try {
      await fetch("https://pipe.jspsych.org/api/data/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "*/*",
        },
        body: JSON.stringify({
          experimentID: DATAPIPE_CONFIG.experiment_id,
          filename: `${subjectId}.csv`,
          data: jsPsych.data.get().csv(),
        }),
      });
    } catch (error) {
      console.error("Failed to save data on early termination:", error);
    }
  }

  jsPsych.endExperiment(getTerminationMessage(reason));
}

// ============================================================================
// DISTRIBUTION BUILDER COMPONENT
// ============================================================================

/**
 * Creates HTML for a distribution builder
 * @param {string} type - "effectiveness" or "speaker_type"
 * @param {string} title - Title to display above the builder
 * @param {Array} initialDistribution - Initial token counts (or null for empty)
 */
function createDistributionBuilderHTML(type, title, initialDistribution = null) {
  const nTokens = CONFIG.n_tokens;
  let options, labels;
  
  if (type === "effectiveness") {
    options = CONFIG.effectiveness_options;
    labels = options.map(v => `${v}%`);
  } else {
    options = CONFIG.speaker_types;
    labels = options.map(t => `${t.icon}<br>${t.label}`);
  }
  
  const nOptions = options.length;
  const builderClass = type === "speaker_type" ? "distribution-builder speaker-type" : "distribution-builder";
  
  let html = `
    <div class="distribution-builder-container" id="${type}-builder">
      <div class="distribution-builder-title">${title}</div>
      <div class="${builderClass}" data-type="${type}">
  `;
  
  for (let i = 0; i < nOptions; i++) {
    const initialCount = initialDistribution ? initialDistribution[i] : 0;
    
    html += `
      <div class="distribution-column" data-col="${i}">
        <div class="column-count" id="${type}-count-${i}">${initialCount} assigned</div>
        <div class="column-grid" data-col="${i}">
    `;
    
    // Create 20 grid cells
    for (let j = 0; j < nTokens; j++) {
      const filled = j < initialCount ? "filled" : "";
      html += `<div class="grid-cell" data-row="${j}" ${filled ? 'class="grid-cell filled"' : 'class="grid-cell"'}></div>`;
    }
    
    html += `
        </div>
        <div class="column-buttons">
          <button class="column-btn minus" data-col="${i}" ${initialCount === 0 ? 'disabled' : ''}>−</button>
          <button class="column-btn plus" data-col="${i}">+</button>
        </div>
        <div class="column-label">${labels[i]}</div>
      </div>
    `;
  }
  
  html += `
      </div>
      <div class="distribution-summary incomplete" id="${type}-summary">
        You have ${nTokens} tokens left. Please assign all tokens.
      </div>
    </div>
  `;
  
  return html;
}

/**
 * Initializes distribution builder interactivity
 * @param {string} type - "effectiveness" or "speaker_type"
 * @param {Function} onChangeCallback - Called when distribution changes
 */
function initDistributionBuilder(type, onChangeCallback) {
  const nTokens = CONFIG.n_tokens;
  const nOptions = type === "effectiveness" ? CONFIG.effectiveness_options.length : CONFIG.speaker_types.length;
  
  // Get current distribution from state or initialize to zeros
  let distribution;
  if (type === "effectiveness") {
    distribution = experimentState.effectivenessDistribution || new Array(nOptions).fill(0);
  } else {
    distribution = experimentState.speakerTypeDistribution || new Array(nOptions).fill(0);
  }
  
  function getTokensUsed() {
    return distribution.reduce((a, b) => a + b, 0);
  }
  
  function getTokensLeft() {
    return nTokens - getTokensUsed();
  }
  
  function updateDisplay() {
    const tokensLeft = getTokensLeft();
    const summaryEl = document.getElementById(`${type}-summary`);
    
    // Update column counts and grid displays
    for (let i = 0; i < nOptions; i++) {
      const countEl = document.getElementById(`${type}-count-${i}`);
      if (countEl) {
        countEl.textContent = `${distribution[i]} assigned`;
      }
      
      // Update grid cells
      const gridCells = document.querySelectorAll(`.distribution-builder[data-type="${type}"] .distribution-column[data-col="${i}"] .grid-cell`);
      gridCells.forEach((cell, j) => {
        if (j < distribution[i]) {
          cell.classList.add('filled');
        } else {
          cell.classList.remove('filled');
        }
      });
      
      // Update button states
      const minusBtn = document.querySelector(`.distribution-builder[data-type="${type}"] .column-btn.minus[data-col="${i}"]`);
      const plusBtn = document.querySelector(`.distribution-builder[data-type="${type}"] .column-btn.plus[data-col="${i}"]`);
      
      if (minusBtn) minusBtn.disabled = distribution[i] === 0;
      if (plusBtn) plusBtn.disabled = tokensLeft === 0;
    }
    
    // Update summary
    if (summaryEl) {
      if (tokensLeft === 0) {
        summaryEl.textContent = "All tokens assigned. ✓";
        summaryEl.className = "distribution-summary complete";
      } else {
        summaryEl.textContent = `You have ${tokensLeft} token${tokensLeft !== 1 ? 's' : ''} left. Please assign all tokens.`;
        summaryEl.className = "distribution-summary incomplete";
      }
    }
    
    // Mark as changed
    if (type === "effectiveness") {
      experimentState.effectivenessChanged = true;
      experimentState.effectivenessDistribution = [...distribution];
    } else {
      experimentState.speakerTypeChanged = true;
      experimentState.speakerTypeDistribution = [...distribution];
    }
    
    if (onChangeCallback) onChangeCallback();
  }
  
  function showWarning(message) {
    const summaryEl = document.getElementById(`${type}-summary`);
    if (summaryEl) {
      summaryEl.textContent = message;
      summaryEl.className = "distribution-summary warning";
      setTimeout(() => updateDisplay(), 2000);
    }
  }
  
  // Add click handlers for plus/minus buttons
  document.querySelectorAll(`.distribution-builder[data-type="${type}"] .column-btn.plus`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      resetInactivityTimer();
      const col = parseInt(e.target.dataset.col);
      if (getTokensLeft() > 0) {
        distribution[col]++;
        updateDisplay();
      } else {
        showWarning("You have 0 tokens left. Please adjust other options to add more here.");
      }
    });
  });
  
  document.querySelectorAll(`.distribution-builder[data-type="${type}"] .column-btn.minus`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      resetInactivityTimer();
      const col = parseInt(e.target.dataset.col);
      if (distribution[col] > 0) {
        distribution[col]--;
        updateDisplay();
      }
    });
  });
  
  // Add click handlers for grid columns (click to set height)
  document.querySelectorAll(`.distribution-builder[data-type="${type}"] .column-grid`).forEach(grid => {
    grid.addEventListener('click', (e) => {
      resetInactivityTimer();
      const col = parseInt(grid.dataset.col);
      const cell = e.target.closest('.grid-cell');
      
      if (cell) {
        const targetHeight = parseInt(cell.dataset.row) + 1;
        const currentHeight = distribution[col];
        const tokensNeeded = targetHeight - currentHeight;
        
        if (tokensNeeded > 0 && tokensNeeded > getTokensLeft()) {
          showWarning(`Not enough tokens. You need ${tokensNeeded} but only have ${getTokensLeft()} left.`);
          return;
        }
        
        distribution[col] = targetHeight;
        updateDisplay();
      }
    });
  });
  
  // Initial display
  updateDisplay();
  
  // Reset change tracking after initial display
  if (type === "effectiveness") {
    experimentState.effectivenessChanged = false;
  } else {
    experimentState.speakerTypeChanged = false;
  }
  
  return {
    getDistribution: () => [...distribution],
    isComplete: () => getTokensLeft() === 0
  };
}

// ============================================================================
// INSTRUCTION PAGES (same as speaker experiment)
// ============================================================================

const instructionPages = [
  // Page 1: Cover story and data representation
  `<div class="instructions-container">
    <h2>The Treatment</h2>
    <p>In this study, you will see results from a clinical trial testing a new medical treatment.</p>
    <p>The treatment has some chance of working for any given patient. The trial shows what happened for 5 patients, which gives evidence about how effective the treatment is overall.</p>
    <p>For each patient, the treatment can be:</p>
    <ul>
      <li><strong>EFFECTIVE</strong> (😃) — the treatment worked</li>
      <li><strong>INEFFECTIVE</strong> (🤒) — the treatment did not work</li>
    </ul>
    <p>Here's what a clinical trial looks like:</p>
    <div class="example-box">
      <div style="text-align: center;">
        <img src="stimuli_emoji_n5m1/effective_2_v0.png" alt="Example trial" class="stimulus-image" style="max-width: 400px;">
      </div>
      <p style="margin-top: 15px; text-align: center;">The treatment worked for 2 patients (😃😃) and didn't work for 3 (🤒🤒🤒).</p>
    </div>
  </div>`,

  // Page 2: Description structure
  `<div class="instructions-container">
    <h2>Descriptions</h2>
    <p>Trial results are described using sentences like this:</p>
    <div class="definition-box" style="text-align: center; font-size: 1.1em; padding: 20px;">
      "The treatment was <strong>[effective / ineffective]</strong> for <strong>[no / some / most / all]</strong> patients."
    </div>
    <p style="margin-top: 20px;">Here's what each word means:</p>
    <ul style="font-size: 1.05em; line-height: 1.8;">
      <li><strong>NO</strong> — 0 patients</li>
      <li><strong>SOME</strong> — 1, 2, 3, 4, or 5 patients (at least one)</li>
      <li><strong>MOST</strong> — 3, 4, or 5 patients (more than half)</li>
      <li><strong>ALL</strong> — 5 patients</li>
    </ul>
  </div>`,

  // Page 3: Truth conditions
  `<div class="instructions-container">
    <h2>Which Descriptions Are True?</h2>
    <p>For any clinical trial, multiple descriptions can be true at the same time. Consider this one:</p>

    <div style="text-align: center; margin: 20px 0;">
      <img src="stimuli_emoji_n5m1/effective_3_v0.png" alt="Example" class="stimulus-image" style="max-width: 300px;">
    </div>

    <div style="display: flex; flex-direction: column; gap: 10px;">
      <div style="background: #e8f5e9; border-left: 4px solid #4CAF50; padding: 12px 16px; border-radius: 4px;">
        <strong style="color: #2e7d32;">✓ TRUE:</strong> "The treatment was <b><u>effective</u></b> for <b><u>some</u></b> patients." <span style="color: #666;">(3 is at least 1)</span>
      </div>
      <div style="background: #e8f5e9; border-left: 4px solid #4CAF50; padding: 12px 16px; border-radius: 4px;">
        <strong style="color: #2e7d32;">✓ TRUE:</strong> "The treatment was <b><u>effective</u></b> for <b><u>most</u></b> patients." <span style="color: #666;">(3 is more than half)</span>
      </div>
      <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 12px 16px; border-radius: 4px;">
        <strong style="color: #c62828;">✗ FALSE:</strong> "The treatment was <b><u>effective</u></b> for <b><u>all</u></b> patients." <span style="color: #666;">(only 3, not 5)</span>
      </div>
    </div>
  </div>`,
];

// ============================================================================
// 1. WELCOME
// ============================================================================

const welcome = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <div class="welcome-container">
      <h1>Welcome</h1>
      <p class="subtitle">This is a study about how we interpret information from others.</p>
      <p>This study takes approximately <strong>8-12 minutes</strong> to complete.</p>
      <p class="press-space">Press <strong>SPACE</strong> to continue</p>
    </div>
  `,
  choices: [" "],
  on_finish: updateProgress,
};

// ============================================================================
// 2. CONSENT
// ============================================================================

const consent = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="consent-container">
      <h2>Informed Consent</h2>
      
      <div class="consent-section">
        <p><strong>DESCRIPTION:</strong> You are invited to participate in a research study about language and communication. The purpose of the research is to understand how you interact and communicate with other people under different roles and goals. This research will be conducted through the Prolific platform, including participants from the US, UK, and Canada. If you decide to participate in this research, you will play a communication game with one partner.</p>
      </div>
      
      <div class="consent-section">
        <p><strong>TIME INVOLVEMENT:</strong> The task will last the amount of time advertised on Prolific. There will be bonuses you will receive based on your performance in the task. You are free to withdraw from the study at any time.</p>
      </div>
      
      <div class="consent-section">
        <p><strong>RISKS AND BENEFITS:</strong> There are no risks beyond those of everyday life that we are aware of. Study data will be stored securely, in compliance with Stanford University standards, minimizing the risk of confidentiality breach. This study advances our scientific understanding of how people communicate in naturalistic settings. This study may lead to further insights about what can go wrong in teamwork, suggest interventions to overcome these barriers, and help to develop assistive technologies that collaborate with human partners. We cannot and do not guarantee or promise that you will receive any benefits from this study.</p>
      </div>
      
      <div class="consent-section">
        <p><strong>PAYMENTS:</strong> You will receive a base payment of <strong>${CONFIG.base_payment}</strong> for completing this study. Additionally, you may earn bonus payments of up to <strong>${CONFIG.bonus_max}</strong> based on your performance as described in the instructions. If you do not complete this study, you will receive prorated payment based on the time that you have spent.</p>
      </div>
      
      <div class="consent-section">
        <p><strong>PARTICIPANT'S RIGHTS:</strong> If you have read this form and have decided to participate in this project, please understand your participation is voluntary and you have the right to withdraw your consent or discontinue participation at any time without penalty or loss of benefits to which you are otherwise entitled. The alternative is not to participate. You have the right to refuse to answer particular questions. The results of this research study may be presented at scientific or professional meetings or published in scientific journals. Your individual privacy will be maintained in all published and written data resulting from the study. In accordance with scientific norms, the data from this study may be used or shared with other researchers for future research (after removing personally identifying information) without additional consent from you.</p>
      </div>
      
      <div class="consent-section">
        <p><strong>CONTACT INFORMATION:</strong></p>
        <p><em>Questions:</em> If you have any questions, concerns or complaints about this research, its procedures, risks and benefits, contact the Protocol Director, Robert Hawkins (rdhawkins@stanford.edu, 217-549-6923).</p>
        <p><em>Independent Contact:</em> If you are not satisfied with how this study is being conducted, or if you have any concerns, complaints, or general questions about the research or your rights as a participant, please contact the Stanford Institutional Review Board (IRB) to speak to someone independent of the research team at 650-723-2480 or toll free at 1-866-680-2906, or email at irbnonmed@stanford.edu. You can also write to the Stanford IRB, Stanford University, 1705 El Camino Real, Palo Alto, CA 94306.</p>
      </div>
      
      <p style="margin-top: 20px; font-style: italic;">Please save or print a copy of this page for your records.</p>
      
      <p style="margin-top: 20px; font-weight: bold; text-align: center;">
        If you agree to participate in this research, please click "I Consent".
      </p>
    </div>
  `,
  choices: ["I Consent"],
  button_html: '<button class="jspsych-btn" style="background: #4CAF50; color: white;">%choice%</button>',
  on_finish: updateProgress,
};

// ============================================================================
// 3. INSTRUCTIONS
// ============================================================================

const instructions = {
  type: jsPsychInstructions,
  pages: instructionPages,
  show_clickable_nav: true,
  button_label_previous: "Back",
  button_label_next: "Continue",
  allow_backward: true,
  on_load: function () {
    const checkLastPage = setInterval(() => {
      const currentPage = document.querySelector(".jspsych-instructions-pagenum");
      if (currentPage && currentPage.textContent.includes("3/3")) {
        const nextBtn = document.querySelector('button[id="jspsych-instructions-next"]');
        if (nextBtn && nextBtn.textContent === "Continue") {
          nextBtn.textContent = "I understood everything!";
          clearInterval(checkLastPage);
        }
      }
    }, 100);
  },
  on_finish: updateProgress,
};

// ============================================================================
// 4. COMPREHENSION TESTS (same as speaker experiment)
// ============================================================================

// Module 1: Quantifier definitions
const comp1_some = {
  type: jsPsychSurveyMultiChoice,
  preamble: '<div class="comprehension-container"><h2>Quick Check</h2></div>',
  questions: [
    {
      prompt: '<strong>What does "SOME" mean in this study?</strong>',
      name: "some_def",
      options: CONFIG.comprehension.module1.some.options,
      required: true,
    },
  ],
  data: { task: "comp1_some" },
  on_finish: function (data) {
    const selectedIndex = CONFIG.comprehension.module1.some.options.indexOf(data.response.some_def);
    data.comp1_some_correct = selectedIndex === CONFIG.comprehension.module1.some.correct;
    updateProgress();
  },
};

const comp1_some_feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data.get().filter({ task: "comp1_some" }).last(1).values()[0];
    if (data.comp1_some_correct) {
      return `<div class="comprehension-container">
        <h2 style="color: #4CAF50;">✓ Correct!</h2>
        <p><strong>SOME</strong> means <strong>1 or more, including all 5</strong>.</p>
      </div>`;
    } else {
      return `<div class="comprehension-container">
        <h2 style="color: #f44336;">✗ Incorrect</h2>
        <p>You answered: "${jsPsych.data.get().filter({ task: "comp1_some" }).last(1).values()[0].response.some_def}"</p>
        <p>But <strong>SOME</strong> actually means: <strong>1 or more, including all 5.</strong></p>
        <p>"The treatment was <b><u>effective</u></b> for <b><u>some</u></b> patients." is true if 1, 2, 3, 4, or all 5 patients had effective treatment.</p>
      </div>`;
    }
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

const comp1_most = {
  type: jsPsychSurveyMultiChoice,
  preamble: '<div class="comprehension-container"><h2>Quick Check (continued)</h2></div>',
  questions: [
    {
      prompt: '<strong>What does "MOST" mean in this study?</strong>',
      name: "most_def",
      options: CONFIG.comprehension.module1.most.options,
      required: true,
    },
  ],
  data: { task: "comp1_most" },
  on_finish: function (data) {
    const selectedIndex = CONFIG.comprehension.module1.most.options.indexOf(data.response.most_def);
    data.comp1_most_correct = selectedIndex === CONFIG.comprehension.module1.most.correct;
    updateProgress();
  },
};

const comp1_most_feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data.get().filter({ task: "comp1_most" }).last(1).values()[0];
    if (data.comp1_most_correct) {
      return `<div class="comprehension-container">
        <h2 style="color: #4CAF50;">✓ Correct!</h2>
        <p><strong>MOST</strong> means <strong>more than half, including all 5</strong>.</p>
      </div>`;
    } else {
      return `<div class="comprehension-container">
        <h2 style="color: #f44336;">✗ Incorrect</h2>
        <p>You answered: "${jsPsych.data.get().filter({ task: "comp1_most" }).last(1).values()[0].response.most_def}"</p>
        <p>But <strong>MOST</strong> actually means: <strong>more than half, including all 5.</strong></p>
        <p>For 5 patients, <strong>MOST</strong> patients means 3, 4, or 5 patients.</p>
      </div>`;
    }
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// Module 2: True/False judgments
const comp2_welcome = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="comprehension-container">
    <h2>Quick Check: True or False?</h2>
    <p>For each trial result shown, decide if the statement is <strong>TRUE</strong> or <strong>FALSE</strong>.</p>
  </div>`,
  choices: ["Begin"],
  on_finish: function () {
    experimentState.comp2_items = shuffleArray([...CONFIG.comprehension.module2]);
    updateProgress();
  },
};

const comp2_trial_1 = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const item = experimentState.comp2_items[0];
    const imgPath = Stimuli.getImagePath(item.numEffective, 0);
    return `<div class="comprehension-container">
      <h3>Is this statement TRUE or FALSE?</h3>
      <div class="stimulus-container">
        <img src="${imgPath}" class="stimulus-image" style="max-width: 400px;">
      </div>
      <div class="definition-box" style="text-align: center; font-size: 1.2em;">"${item.statement}"</div>
      <div style="margin-top: 30px; text-align: center;">
        <button class="jspsych-btn tf-btn true-btn" id="btn-true">TRUE</button>
        <button class="jspsych-btn tf-btn false-btn" id="btn-false">FALSE</button>
      </div>
    </div>`;
  },
  choices: [],
  data: { task: "comp2", item_index: 0 },
  on_load: function () {
    const item = experimentState.comp2_items[0];
    document.getElementById("btn-true").addEventListener("click", () => {
      jsPsych.finishTrial({ task: "comp2", item_index: 0, item: item, response: true, comp2_correct: item.correct === true });
    });
    document.getElementById("btn-false").addEventListener("click", () => {
      jsPsych.finishTrial({ task: "comp2", item_index: 0, item: item, response: false, comp2_correct: item.correct === false });
    });
  },
  on_finish: updateProgress,
};

const comp2_feedback_1 = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data.get().filter({ task: "comp2", item_index: 0 }).last(1).values()[0];
    const item = data.item;
    const numIneffective = 5 - item.numEffective;
    let explanation = "";
    const statementLower = item.statement.toLowerCase();
    if (statementLower.includes("ineffective") && statementLower.includes("some")) {
      explanation = `<strong>SOME</strong> means at least 1. The treatment was ineffective for ${numIneffective} patient${numIneffective === 1 ? "" : "s"}.`;
    } else if (statementLower.includes("ineffective") && statementLower.includes("all")) {
      explanation = `<strong>ALL</strong> means all 5. The treatment was ineffective for only ${numIneffective} patient${numIneffective === 1 ? "" : "s"}.`;
    }
    if (data.comp2_correct) {
      return `<div class="comprehension-container"><h2 style="color: #4CAF50;">✓ Correct</h2><p>${explanation}</p></div>`;
    } else {
      return `<div class="comprehension-container"><h2 style="color: #f44336;">✗ Incorrect</h2><p>The answer is <strong>${item.correct ? "TRUE" : "FALSE"}</strong>. ${explanation}</p></div>`;
    }
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

const comp2_trial_2 = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const item = experimentState.comp2_items[1];
    const imgPath = Stimuli.getImagePath(item.numEffective, 0);
    return `<div class="comprehension-container">
      <h3>Is this statement TRUE or FALSE?</h3>
      <div class="stimulus-container">
        <img src="${imgPath}" class="stimulus-image" style="max-width: 400px;">
      </div>
      <div class="definition-box" style="text-align: center; font-size: 1.2em;">"${item.statement}"</div>
      <div style="margin-top: 30px; text-align: center;">
        <button class="jspsych-btn tf-btn true-btn" id="btn-true">TRUE</button>
        <button class="jspsych-btn tf-btn false-btn" id="btn-false">FALSE</button>
      </div>
    </div>`;
  },
  choices: [],
  data: { task: "comp2", item_index: 1 },
  on_load: function () {
    const item = experimentState.comp2_items[1];
    document.getElementById("btn-true").addEventListener("click", () => {
      jsPsych.finishTrial({ task: "comp2", item_index: 1, item: item, response: true, comp2_correct: item.correct === true });
    });
    document.getElementById("btn-false").addEventListener("click", () => {
      jsPsych.finishTrial({ task: "comp2", item_index: 1, item: item, response: false, comp2_correct: item.correct === false });
    });
  },
  on_finish: updateProgress,
};

const comp2_feedback_2 = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data.get().filter({ task: "comp2", item_index: 1 }).last(1).values()[0];
    const item = data.item;
    const numIneffective = 5 - item.numEffective;
    let explanation = "";
    const statementLower = item.statement.toLowerCase();
    if (statementLower.includes("ineffective") && statementLower.includes("some")) {
      explanation = `<strong>SOME</strong> means at least 1. The treatment was ineffective for ${numIneffective} patient${numIneffective === 1 ? "" : "s"}.`;
    } else if (statementLower.includes("ineffective") && statementLower.includes("all")) {
      explanation = `<strong>ALL</strong> means all 5. The treatment was ineffective for only ${numIneffective} patient${numIneffective === 1 ? "" : "s"}.`;
    }
    if (data.comp2_correct) {
      return `<div class="comprehension-container"><h2 style="color: #4CAF50;">✓ Correct</h2><p>${explanation}</p></div>`;
    } else {
      return `<div class="comprehension-container"><h2 style="color: #f44336;">✗ Incorrect</h2><p>The answer is <strong>${item.correct ? "TRUE" : "FALSE"}</strong>. ${explanation}</p></div>`;
    }
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// Module 3: Multiple choice
const comp3_trial = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const item = CONFIG.comprehension.module3;
    const shuffledOptions = shuffleArray(item.options.map((opt, idx) => ({ ...opt, origIdx: idx })));
    experimentState.comp3_options = shuffledOptions;

    let html = `<div class="comprehension-container">
      <h3>Which clinical trials make this statement TRUE?</h3>
      <div class="definition-box" style="text-align: center; font-size: 1.2em;">"${item.statement}"</div>
      <p style="text-align: center; color: #666; margin-top: 20px;">Select all that apply:</p>
      <div class="checkbox-options">`;

    shuffledOptions.forEach((opt, i) => {
      const imgPath = Stimuli.getImagePath(opt.numEffective, 0);
      html += `<div class="checkbox-option" data-idx="${i}" id="opt-${i}">
        <img src="${imgPath}" style="max-width: 180px;">
        <div class="checkbox-label"><span class="checkbox-marker"></span></div>
      </div>`;
    });

    html += `</div>
      <div style="margin-top: 20px; text-align: center;">
        <button id="comp3-submit" class="jspsych-btn">Submit Answer</button>
      </div>
    </div>`;
    return html;
  },
  choices: [],
  data: { task: "comp3" },
  on_load: function () {
    const selectedIndices = new Set();
    const options = document.querySelectorAll(".checkbox-option");
    const submitBtn = document.getElementById("comp3-submit");

    options.forEach((opt, i) => {
      opt.addEventListener("click", () => {
        if (selectedIndices.has(i)) {
          selectedIndices.delete(i);
          opt.classList.remove("selected");
        } else {
          selectedIndices.add(i);
          opt.classList.add("selected");
        }
      });
    });

    submitBtn.addEventListener("click", () => {
      const selectedOptions = experimentState.comp3_options.filter((_, i) => selectedIndices.has(i));
      const correctOptions = experimentState.comp3_options.filter((opt) => opt.correct);
      const allCorrectSelected = correctOptions.every((opt) => selectedIndices.has(experimentState.comp3_options.indexOf(opt)));
      const noIncorrectSelected = selectedOptions.every((opt) => opt.correct);
      const isCorrect = allCorrectSelected && noIncorrectSelected && selectedIndices.size > 0;

      jsPsych.finishTrial({
        task: "comp3",
        selected: Array.from(selectedIndices).map((i) => experimentState.comp3_options[i].numEffective),
        comp3_correct: isCorrect,
      });
    });
  },
  on_finish: updateProgress,
};

const comp3_feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data.get().filter({ task: "comp3" }).last(1).values()[0];
    if (data.comp3_correct) {
      return `<div class="comprehension-container">
        <h2 style="color: #4CAF50;">✓ Correct</h2>
        <p><strong>MOST</strong> means more than half. The treatment was ineffective for 3 or more patients in the correct answers.</p>
      </div>`;
    } else {
      return `<div class="comprehension-container">
        <h2 style="color: #f44336;">✗ Incorrect</h2>
        <p><strong>MOST</strong> means more than half. Look for trials where the treatment was ineffective for 3, 4, or 5 patients.</p>
      </div>`;
    }
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// ============================================================================
// 5. LISTENER TASK INTRODUCTION (varies by belief condition)
// ============================================================================

// Initial assignment of conditions (called before showing intro)
const assignConditions = {
  type: jsPsychCallFunction,
  func: function() {
    // Randomly assign listener belief condition
    const beliefConditions = CONFIG.listener_belief_conditions;
    experimentState.listenerBeliefCondition = beliefConditions[Math.floor(Math.random() * beliefConditions.length)];
    
    // Randomly assign utterance sequence condition (independent of belief condition)
    const utteranceConditions = CONFIG.utterance_conditions;
    experimentState.speakerCondition = utteranceConditions[Math.floor(Math.random() * utteranceConditions.length)];
    
    // Select utterance sequence
    const sequences = CONFIG.utterance_sequences[experimentState.speakerCondition];
    experimentState.sequenceIdx = Math.floor(Math.random() * sequences.length);
    experimentState.utteranceSequence = sequences[experimentState.sequenceIdx];
    
    // Randomize measure order (between-participants, fixed within)
    experimentState.measureOrder = Math.random() < 0.5 ? "effectiveness_first" : "speaker_type_first";
    
    // Initialize distributions as null (unassigned)
    experimentState.effectivenessDistribution = null;
    experimentState.speakerTypeDistribution = null;
  }
};

// INFORMED condition intro - told about all 3 speaker types
const listenerIntroVigilant = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="listener-intro-container">
      <h2>Your Role: Listener</h2>
      <p>You have been assigned to be a <strong>listener</strong> in this study.</p>
      <p>You will be paired with another participant who has been assigned the role of <strong>speaker</strong>. 
      The speaker will see clinical trial results and describe them to you.</p>
      
      <h3 style="margin-top: 30px;">The Three Types of Speakers</h3>
      <p>Speakers in this study are assigned one of three roles:</p>
      
      <div class="speaker-type-card informative">
        <span class="speaker-type-icon">🔬</span>
        <div class="speaker-type-info">
          <div class="speaker-type-name">Neutral Scientist</div>
          <div class="speaker-type-goal">Goal: Accurately and informatively describe the treatment outcomes</div>
        </div>
      </div>
      
      <div class="speaker-type-card pers_plus">
        <span class="speaker-type-icon">👍</span>
        <div class="speaker-type-info">
          <div class="speaker-type-name">Pro-treatment Representative</div>
          <div class="speaker-type-goal">Goal: Present the treatment in a favorable light</div>
        </div>
      </div>
      
      <div class="speaker-type-card pers_minus">
        <span class="speaker-type-icon">👎</span>
        <div class="speaker-type-info">
          <div class="speaker-type-name">Anti-treatment Representative</div>
          <div class="speaker-type-goal">Goal: Downplay the treatment's effectiveness</div>
        </div>
      </div>
      
      <p style="margin-top: 25px;"><strong>Important:</strong> You will be paired with ONE speaker for ${CONFIG.n_rounds} rounds. 
      Each speaker type is equally likely, but you won't know which type your speaker is.</p>
    </div>
  `,
  choices: ["Continue"],
  on_finish: updateProgress,
};

// CREDULOUS condition intro - told speaker is helpful
const listenerIntroCredulous = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="listener-intro-container">
      <h2>Your Role: Listener</h2>
      <p>You have been assigned to be a <strong>listener</strong> in this study.</p>
      <p>You will be paired with another participant who has been assigned the role of <strong>speaker</strong>. 
      The speaker will see clinical trial results and describe them to you.</p>
      
      <div class="speaker-type-card informative" style="margin-top: 25px;">
        <span class="speaker-type-icon">🔬</span>
        <div class="speaker-type-info">
          <div class="speaker-type-name">Your Speaker's Goal</div>
          <div class="speaker-type-goal">The speaker's goal is to <strong>help you correctly identify</strong> how effective the treatment is based on the trial data they see.</div>
        </div>
      </div>
      
      <div class="example-box" style="margin-top: 20px;">
        <p><strong>Your reward:</strong> You will receive a bonus based on how accurately your estimates match the true treatment effectiveness. The more accurate your guesses, the higher your bonus!</p>
      </div>
      
      <p style="margin-top: 25px;">You will communicate with this speaker for <strong>${CONFIG.n_rounds} rounds</strong>.</p>
    </div>
  `,
  choices: ["Continue"],
  on_finish: updateProgress,
};

// NAIVE condition intro - told nothing about goals
const listenerIntroNaturalistic = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="listener-intro-container">
      <h2>Your Role: Listener</h2>
      <p>You have been assigned to be a <strong>listener</strong> in this study.</p>
      <p>You will be paired with another participant who has been assigned the role of <strong>speaker</strong>. 
      The speaker will see clinical trial results and describe them to you.</p>
      
      <p style="margin-top: 25px;">You will receive descriptions from this speaker for <strong>${CONFIG.n_rounds} rounds</strong>.</p>
    </div>
  `,
  choices: ["Continue"],
  on_finish: updateProgress,
};

// Conditional intro based on belief condition
const listenerIntro = {
  timeline: [listenerIntroVigilant],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "vigilant";
  }
};

const listenerIntroCredulousCond = {
  timeline: [listenerIntroCredulous],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "credulous";
  }
};

const listenerIntroNaturalisticCond = {
  timeline: [listenerIntroNaturalistic],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "naturalistic";
  }
};

// Task explanation - varies slightly by condition
const listenerTaskExplanationVigilant = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="listener-intro-container">
      <h2>Your Task</h2>
      
      <p>For each round, the speaker will see a clinical trial result and send you a description. 
      <strong>You will NOT see the actual trial data</strong> — only the speaker's description.</p>
      
      <p style="margin-top: 20px;">After receiving each description, you will:</p>
      
      <ol style="line-height: 2;">
        <li><strong>Estimate the treatment's effectiveness</strong> — How likely is each possible effectiveness level (0% to 100%)?</li>
        <li><strong>Estimate the speaker's type</strong> — How likely is each speaker type (Anti-treatment, Neutral, Pro-treatment)?</li>
      </ol>
      
      <div class="example-box" style="margin-top: 25px;">
        <p><strong>Your bonus:</strong> You will receive a bonus up to <strong>${CONFIG.bonus_max}</strong> based on how accurately your effectiveness estimates match the true treatment effectiveness.</p>
        <p style="margin-top: 10px;">Try to be as accurate as possible!</p>
      </div>
      
      <p style="margin-top: 25px;"><strong>Remember:</strong> All descriptions the speaker sends are <strong>TRUE</strong> — but different speakers may choose different true descriptions based on their goals.</p>
    </div>
  `,
  choices: ["Continue"],
  on_finish: updateProgress,
};

const listenerTaskExplanationCredulous = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="listener-intro-container">
      <h2>Your Task</h2>
      
      <p>For each round, the speaker will see a clinical trial result and send you a description. 
      <strong>You will NOT see the actual trial data</strong> — only the speaker's description.</p>
      
      <p style="margin-top: 20px;">After receiving each description, you will:</p>
      
      <p style="margin-left: 20px; line-height: 2;">
        <strong>Estimate the treatment's effectiveness</strong> — How likely is each possible effectiveness level (0% to 100%)?
      </p>
      
      <div class="example-box" style="margin-top: 25px;">
        <p><strong>Your bonus:</strong> You will receive a bonus up to <strong>${CONFIG.bonus_max}</strong> based on how accurately your effectiveness estimates match the true treatment effectiveness.</p>
        <p style="margin-top: 10px;">Try to be as accurate as possible!</p>
      </div>
      
      <p style="margin-top: 25px;"><strong>Remember:</strong> All descriptions the speaker sends are <strong>TRUE</strong>.</p>
    </div>
  `,
  choices: ["Continue"],
  on_finish: updateProgress,
};

const listenerTaskExplanationNaturalistic = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="listener-intro-container">
      <h2>Your Task</h2>
      
      <p>For each round, the speaker will see a clinical trial result and send you a description. 
      <strong>You will NOT see the actual trial data</strong> — only the speaker's description.</p>
      
      <p style="margin-top: 20px;">After receiving each description, you will:</p>
      
      <p style="margin-left: 20px; line-height: 2;">
        <strong>Estimate the treatment's effectiveness</strong> — How likely is each possible effectiveness level (0% to 100%)?
      </p>
      
      <div class="example-box" style="margin-top: 25px;">
        <p><strong>Your bonus:</strong> You will receive a bonus up to <strong>${CONFIG.bonus_max}</strong> based on how accurately your effectiveness estimates match the true treatment effectiveness.</p>
        <p style="margin-top: 10px;">Try to be as accurate as possible!</p>
      </div>
      
      <p style="margin-top: 25px;"><strong>Note:</strong> All descriptions the speaker sends are <strong>TRUE</strong>.</p>
    </div>
  `,
  choices: ["Continue"],
  on_finish: updateProgress,
};

// Distribution builder explanation (shown to all conditions)
const distributionBuilderExplanation = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="listener-intro-container">
      <h2>How to Report Your Estimates</h2>
      
      <p>You will use a <strong>distribution builder</strong> to express your beliefs. You have <strong>20 tokens</strong> to distribute across the possible options.</p>
      
      <h3 style="margin-top: 25px;">How it works:</h3>
      <ul style="line-height: 1.8;">
        <li>Click on a column to add tokens, or use the +/− buttons</li>
        <li>Assign more tokens to options you think are more likely</li>
        <li>You must assign all 20 tokens before continuing</li>
      </ul>
      
      <h3 style="margin-top: 25px;">Examples:</h3>
      
      <div class="example-box">
        <p><strong>If you are certain the effectiveness is 80%:</strong></p>
        <p style="margin-left: 20px;">→ Put all 20 tokens in the "80%" column</p>
      </div>
      
      <div class="example-box" style="margin-top: 15px;">
        <p><strong>If you think it's equally likely to be anywhere from 0% to 100%:</strong></p>
        <p style="margin-left: 20px;">→ Spread tokens roughly evenly (about 2 tokens per column, though 20 doesn't divide evenly into 11 options, so some variation is fine)</p>
      </div>
      
      <div class="example-box" style="margin-top: 15px;">
        <p><strong>If you think it's probably around 50-70% but not certain:</strong></p>
        <p style="margin-left: 20px;">→ Put most tokens in 50%, 60%, and 70% columns, with fewer in nearby columns</p>
      </div>
      
      <p style="margin-top: 25px;">The more tokens you assign to an option, the more confident you are that it's the true value.</p>
    </div>
  `,
  choices: ["I Understand"],
  on_finish: updateProgress,
};

// Comprehension check: Descriptions are TRUE
const truthComprehensionCheck = {
  type: jsPsychSurveyMultiChoice,
  preamble: '<div class="comprehension-container"><h2>Quick Check</h2></div>',
  questions: [
    {
      prompt: '<strong>Are the descriptions you receive from the speaker true or false?</strong>',
      name: "truth_check",
      options: [
        "The descriptions are always TRUE",
        "The descriptions might be TRUE or FALSE",
        "The descriptions are always FALSE"
      ],
      required: true,
    },
  ],
  data: { task: "truth_comprehension" },
  on_finish: function (data) {
    data.truth_check_correct = data.response.truth_check === "The descriptions are always TRUE";
    updateProgress();
  },
};

const truthComprehensionFeedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data.get().filter({ task: "truth_comprehension" }).last(1).values()[0];
    if (data.truth_check_correct) {
      return `<div class="comprehension-container">
        <h2 style="color: #4CAF50;">✓ Correct!</h2>
        <p>All descriptions you receive from the speaker are <strong>TRUE</strong>.</p>
        <p style="margin-top: 15px;">The speaker can only choose from descriptions that are true for the trial data they see.</p>
        <p style="margin-top: 20px;">You're now ready to be paired with a speaker!</p>
      </div>`;
    } else {
      return `<div class="comprehension-container">
        <h2 style="color: #f44336;">✗ Incorrect</h2>
        <p>Actually, all descriptions you receive from the speaker are <strong>TRUE</strong>.</p>
        <p style="margin-top: 15px;">The speaker can only choose from descriptions that are true for the trial data they see. Please remember this as you make your estimates!</p>
        <p style="margin-top: 20px;">You're now ready to be paired with a speaker!</p>
      </div>`;
    }
  },
  choices: ["Find a Speaker"],
  on_finish: updateProgress,
};

// Conditional task explanations
const listenerTaskExplanationVigilantCond = {
  timeline: [listenerTaskExplanationVigilant],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "vigilant";
  }
};

const listenerTaskExplanationCredulousCond = {
  timeline: [listenerTaskExplanationCredulous],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "credulous";
  }
};

const listenerTaskExplanationNaturalisticCond = {
  timeline: [listenerTaskExplanationNaturalistic],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "naturalistic";
  }
};

// Pairing wait screen
const pairingWait = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <div class="waiting-container">
      <h2>Finding a speaker...</h2>
      <div class="spinner"></div>
      <p>Please wait while we pair you with another participant.</p>
    </div>
  `,
  choices: "NO_KEYS",
  trial_duration: () => randomInt(CONFIG.pairing_wait_min, CONFIG.pairing_wait_max),
  on_finish: updateProgress,
};

// Speaker matched confirmation - varies by condition
const speakerMatchedVigilant = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="listener-intro-container" style="text-align: center;">
      <h2 style="color: #4CAF50;">✓ Speaker Matched</h2>
      <p>You are now connected with a speaker.</p>
      <p style="margin-top: 15px;">You will receive <strong>${CONFIG.n_rounds} descriptions</strong> from this speaker.</p>
      <p>Remember: You don't know which of the three types your speaker is!</p>
    </div>
  `,
  choices: ["Start Listening"],
  on_finish: updateProgress,
};

const speakerMatchedCredulous = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="listener-intro-container" style="text-align: center;">
      <h2 style="color: #4CAF50;">✓ Speaker Matched</h2>
      <p>You are now connected with a speaker who will try to help you identify the treatment's effectiveness.</p>
      <p style="margin-top: 15px;">You will receive <strong>${CONFIG.n_rounds} descriptions</strong> from this speaker.</p>
    </div>
  `,
  choices: ["Start Listening"],
  on_finish: updateProgress,
};

const speakerMatchedNaturalistic = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="listener-intro-container" style="text-align: center;">
      <h2 style="color: #4CAF50;">✓ Speaker Matched</h2>
      <p>You are now connected with a speaker.</p>
      <p style="margin-top: 15px;">You will receive <strong>${CONFIG.n_rounds} descriptions</strong> from this speaker.</p>
    </div>
  `,
  choices: ["Start Listening"],
  on_finish: updateProgress,
};

// Conditional speaker matched screens
const speakerMatchedVigilantCond = {
  timeline: [speakerMatchedVigilant],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "vigilant";
  }
};

const speakerMatchedCredulousCond = {
  timeline: [speakerMatchedCredulous],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "credulous";
  }
};

const speakerMatchedNaturalisticCond = {
  timeline: [speakerMatchedNaturalistic],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "naturalistic";
  }
};

// ============================================================================
// 6. LISTENER TRIALS
// ============================================================================

// Effectiveness distribution page
function createEffectivenessPage(roundNum, isLastPage) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const utterance = experimentState.currentUtterance;
      const formattedUtterance = formatUtterance(utterance);
      const effDist = experimentState.effectivenessDistribution;
      
      const effectivenessBuilder = createDistributionBuilderHTML(
        "effectiveness",
        "How likely is each effectiveness level?",
        effDist
      );
      
      const buttonText = isLastPage ? "Submit Response" : "Continue";
      
      return `
        <div class="trial-container">
          <div class="trial-header">
            <span class="round-indicator">Round ${roundNum + 1} of ${CONFIG.n_rounds} — Effectiveness Estimate</span>
          </div>
          
          <div style="text-align: center; margin-bottom: 15px;">
            <p style="color: #666; font-size: 0.9em; margin-bottom: 10px;">The speaker received data of five patients' treatment result:</p>
            ${Stimuli.getUnknownDataHTML()}
          </div>
          
          <div class="utterance-display" style="margin-bottom: 20px;">
            <div class="label">The speaker described the trial result as:</div>
            <div class="utterance-text">${formattedUtterance.displayText}</div>
          </div>
          
          <div class="response-section">
            <h3>Based on this description, estimate the treatment's true effectiveness:</h3>
            <p style="text-align: center; color: #666; font-size: 0.9em;">
              Assign all 20 tokens across the possible effectiveness levels.
            </p>
            ${effectivenessBuilder}
            
            <button id="submit-btn" class="submit-btn" disabled>${buttonText}</button>
          </div>
        </div>
      `;
    },
    choices: [],
    data: {
      task: "effectiveness_measure",
      round: roundNum + 1,
    },
    on_load: function () {
      startInactivityTimer();
      experimentState.effectivenessChanged = false;
      
      const submitBtn = document.getElementById("submit-btn");
      
      function checkCanSubmit() {
        const effBuilder = window.effBuilderInstance;
        const effComplete = effBuilder && effBuilder.isComplete();
        const changed = experimentState.effectivenessChanged;
        submitBtn.disabled = !(effComplete && changed);
      }
      
      window.effBuilderInstance = initDistributionBuilder("effectiveness", checkCanSubmit);
      
      submitBtn.addEventListener("click", () => {
        clearInactivityTimer();
        
        const effDist = window.effBuilderInstance.getDistribution();
        
        jsPsych.finishTrial({
          task: "effectiveness_measure",
          round: roundNum + 1,
          speaker_condition: experimentState.speakerCondition,
          listener_belief_condition: experimentState.listenerBeliefCondition,
          sequence_idx: experimentState.sequenceIdx,
          measure_order: experimentState.measureOrder,
          utterance_predicate: experimentState.currentUtterance.predicate,
          utterance_quantifier: experimentState.currentUtterance.quantifier,
          utterance_text: formatUtterance(experimentState.currentUtterance).text,
          effectiveness_distribution: JSON.stringify(effDist),
          eff_0: effDist[0],
          eff_10: effDist[1],
          eff_20: effDist[2],
          eff_30: effDist[3],
          eff_40: effDist[4],
          eff_50: effDist[5],
          eff_60: effDist[6],
          eff_70: effDist[7],
          eff_80: effDist[8],
          eff_90: effDist[9],
          eff_100: effDist[10],
        });
      });
    },
    on_finish: function () {
      clearInactivityTimer();
      updateProgress();
    },
  };
}

// Speaker type distribution page (only shown for vigilant condition)
function createSpeakerTypePage(roundNum, isLastPage) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const utterance = experimentState.currentUtterance;
      const formattedUtterance = formatUtterance(utterance);
      const spkDist = experimentState.speakerTypeDistribution;
      
      const title = "How likely is each speaker type?";
      const instructions = "Based on the descriptions so far, how likely do you think each type is?";
      
      const speakerTypeBuilder = createDistributionBuilderHTML(
        "speaker_type",
        title,
        spkDist
      );
      
      const buttonText = isLastPage ? "Submit Response" : "Continue";
      
      return `
        <div class="trial-container">
          <div class="trial-header">
            <span class="round-indicator">Round ${roundNum + 1} of ${CONFIG.n_rounds} — Speaker Assessment</span>
          </div>
          
          <div style="text-align: center; margin-bottom: 15px;">
            <p style="color: #666; font-size: 0.9em; margin-bottom: 10px;">The speaker received data of five patients' treatment result:</p>
            ${Stimuli.getUnknownDataHTML()}
          </div>
          
          <div class="utterance-display" style="margin-bottom: 20px;">
            <div class="label">The speaker described the trial result as:</div>
            <div class="utterance-text">${formattedUtterance.displayText}</div>
          </div>
          
          <div class="response-section">
            <h3>${title}</h3>
            <p style="text-align: center; color: #666; font-size: 0.9em;">
              ${instructions}
            </p>
            ${speakerTypeBuilder}
            
            <button id="submit-btn" class="submit-btn" disabled>${buttonText}</button>
          </div>
        </div>
      `;
    },
    choices: [],
    data: {
      task: "speaker_type_measure",
      round: roundNum + 1,
    },
    on_load: function () {
      startInactivityTimer();
      experimentState.speakerTypeChanged = false;
      
      const submitBtn = document.getElementById("submit-btn");
      
      function checkCanSubmit() {
        const spkBuilder = window.spkBuilderInstance;
        const spkComplete = spkBuilder && spkBuilder.isComplete();
        const changed = experimentState.speakerTypeChanged;
        submitBtn.disabled = !(spkComplete && changed);
      }
      
      window.spkBuilderInstance = initDistributionBuilder("speaker_type", checkCanSubmit);
      
      submitBtn.addEventListener("click", () => {
        clearInactivityTimer();
        
        const spkDist = window.spkBuilderInstance.getDistribution();
        
        jsPsych.finishTrial({
          task: "speaker_type_measure",
          round: roundNum + 1,
          speaker_condition: experimentState.speakerCondition,
          listener_belief_condition: experimentState.listenerBeliefCondition,
          sequence_idx: experimentState.sequenceIdx,
          measure_order: experimentState.measureOrder,
          utterance_predicate: experimentState.currentUtterance.predicate,
          utterance_quantifier: experimentState.currentUtterance.quantifier,
          utterance_text: formatUtterance(experimentState.currentUtterance).text,
          speaker_type_distribution: JSON.stringify(spkDist),
          spk_anti: spkDist[0],
          spk_neutral: spkDist[1],
          spk_pro: spkDist[2],
        });
      });
    },
    on_finish: function () {
      clearInactivityTimer();
      updateProgress();
    },
  };
}

// Create full trial sequence for one round (utterance display + two measure pages)
// Wait screen between trials
function createSpeakerWait(roundNum) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div class="waiting-container">
        <h2>Speaker is receiving next trial data and responding...</h2>
        <div class="spinner"></div>
        <p>Waiting for description...</p>
      </div>
    `,
    choices: "NO_KEYS",
    trial_duration: () => randomInt(CONFIG.speaker_response_min, CONFIG.speaker_response_max),
  };
}

// ============================================================================
// 7. FINAL MEASURES
// ============================================================================

// Competence rating - framed differently by condition
const competenceRatingVigilant = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="feedback-container">
      <h2>Final Questions</h2>
      <p>Based on your belief about the speaker's goal, how well do you think they accomplished that goal?</p>
      
      <div class="slider-container">
        <div class="slider-wrapper">
          <span class="slider-label left">Very poorly</span>
          <input type="range" id="competence-slider" min="0" max="100" value="50">
          <span class="slider-label right">Very well</span>
        </div>
        <div class="slider-value" id="slider-value">50</div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <button id="competence-submit" class="jspsych-btn">Continue</button>
      </div>
    </div>
  `,
  choices: [],
  data: { task: "competence_rating" },
  on_load: function () {
    const slider = document.getElementById("competence-slider");
    const valueDisplay = document.getElementById("slider-value");
    const submitBtn = document.getElementById("competence-submit");
    
    slider.addEventListener("input", () => {
      valueDisplay.textContent = slider.value;
    });
    
    submitBtn.addEventListener("click", () => {
      jsPsych.finishTrial({
        task: "competence_rating",
        competence_score: parseInt(slider.value),
        competence_framing: "goal_accomplishment",
        speaker_condition: experimentState.speakerCondition,
        listener_belief_condition: experimentState.listenerBeliefCondition,
      });
    });
  },
  on_finish: updateProgress,
};

const competenceRatingCredulous = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="feedback-container">
      <h2>Final Questions</h2>
      <p>How well do you think the speaker did at being informative?</p>
      
      <div class="slider-container">
        <div class="slider-wrapper">
          <span class="slider-label left">Very poorly</span>
          <input type="range" id="competence-slider" min="0" max="100" value="50">
          <span class="slider-label right">Very well</span>
        </div>
        <div class="slider-value" id="slider-value">50</div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <button id="competence-submit" class="jspsych-btn">Continue</button>
      </div>
    </div>
  `,
  choices: [],
  data: { task: "competence_rating" },
  on_load: function () {
    const slider = document.getElementById("competence-slider");
    const valueDisplay = document.getElementById("slider-value");
    const submitBtn = document.getElementById("competence-submit");
    
    slider.addEventListener("input", () => {
      valueDisplay.textContent = slider.value;
    });
    
    submitBtn.addEventListener("click", () => {
      jsPsych.finishTrial({
        task: "competence_rating",
        competence_score: parseInt(slider.value),
        competence_framing: "informativeness",
        speaker_condition: experimentState.speakerCondition,
        listener_belief_condition: experimentState.listenerBeliefCondition,
      });
    });
  },
  on_finish: updateProgress,
};

const competenceRatingNaturalistic = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="feedback-container">
      <h2>Final Questions</h2>
      <p>How well do you think the speaker did as a communicator?</p>
      
      <div class="slider-container">
        <div class="slider-wrapper">
          <span class="slider-label left">Very poorly</span>
          <input type="range" id="competence-slider" min="0" max="100" value="50">
          <span class="slider-label right">Very well</span>
        </div>
        <div class="slider-value" id="slider-value">50</div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <button id="competence-submit" class="jspsych-btn">Continue</button>
      </div>
    </div>
  `,
  choices: [],
  data: { task: "competence_rating" },
  on_load: function () {
    const slider = document.getElementById("competence-slider");
    const valueDisplay = document.getElementById("slider-value");
    const submitBtn = document.getElementById("competence-submit");
    
    slider.addEventListener("input", () => {
      valueDisplay.textContent = slider.value;
    });
    
    submitBtn.addEventListener("click", () => {
      jsPsych.finishTrial({
        task: "competence_rating",
        competence_score: parseInt(slider.value),
        competence_framing: "communicator",
        speaker_condition: experimentState.speakerCondition,
        listener_belief_condition: experimentState.listenerBeliefCondition,
      });
    });
  },
  on_finish: updateProgress,
};

// Conditional competence ratings
const competenceRatingVigilantCond = {
  timeline: [competenceRatingVigilant],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "vigilant";
  }
};

const competenceRatingCredulousCond = {
  timeline: [competenceRatingCredulous],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "credulous";
  }
};

const competenceRatingNaturalisticCond = {
  timeline: [competenceRatingNaturalistic],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "naturalistic";
  }
};

const openEndedQuestionsVigilant = {
  type: jsPsychSurveyText,
  preamble: `<div class="feedback-container"><h2>Your Thoughts</h2></div>`,
  questions: [
    {
      prompt: "How did you decide what type of speaker you were paired with? What aspects of their descriptions influenced your judgment?",
      name: "speaker_evaluation_strategy",
      rows: 5,
      required: false,
    },
    {
      prompt: "Do you have any other comments or feedback about this experiment? Was anything confusing?",
      name: "feedback",
      rows: 4,
      required: false,
    },
  ],
  button_label: "Continue",
  on_finish: updateProgress,
};

const openEndedQuestionsOther = {
  type: jsPsychSurveyText,
  preamble: `<div class="feedback-container"><h2>Your Thoughts</h2></div>`,
  questions: [
    {
      prompt: "How did you use the speaker's descriptions to estimate the treatment's effectiveness?",
      name: "estimation_strategy",
      rows: 5,
      required: false,
    },
    {
      prompt: "Do you have any other comments or feedback about this experiment? Was anything confusing?",
      name: "feedback",
      rows: 4,
      required: false,
    },
  ],
  button_label: "Continue",
  on_finish: updateProgress,
};

// Conditional open-ended questions
const openEndedQuestionsVigilantCond = {
  timeline: [openEndedQuestionsVigilant],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "vigilant";
  }
};

const openEndedQuestionsOtherCond = {
  timeline: [openEndedQuestionsOther],
  conditional_function: function() {
    return experimentState.listenerBeliefCondition === "credulous" || 
           experimentState.listenerBeliefCondition === "naturalistic";
  }
};

// ============================================================================
// 8. DEBRIEF
// ============================================================================

const debrief = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const isProlific = prolificPID !== null;
    return `
      <div class="debrief-container">
        <h2>Thank You!</h2>
        <h3>Debriefing</h3>
        <p>Thank you for participating in this study!</p>
        <p>We want to let you know that the "speaker" in this study was <strong>simulated</strong> — 
        there was no real-time matching with another participant.</p>
        <p>However, your responses are still extremely valuable for our research on how people 
        interpret information from different types of sources.</p>
        <p><strong>You will receive the full compensation and bonus as described.</strong></p>
        ${isProlific
          ? '<p style="margin-top: 30px; color: #4CAF50; font-weight: bold;">Click below to complete the study and return to Prolific.</p>'
          : '<p style="margin-top: 30px;">If you have any questions about this research, please contact the research team.</p>'
        }
      </div>
    `;
  },
  choices: function () {
    return [prolificPID ? "Complete & Return to Prolific" : "Complete Study"];
  },
  on_finish: updateProgress,
};

// ============================================================================
// BUILD AND RUN TIMELINE
// ============================================================================

const timeline = [];

// Preload images (for comprehension checks)
timeline.push({
  type: jsPsychPreload,
  images: Stimuli.getAllImagePaths(),
  show_progress_bar: true,
  message: "<p>Loading experiment...</p>",
});

// Welcome and consent
timeline.push(welcome);
timeline.push(consent);

// Instructions
timeline.push(instructions);

// Comprehension checks
timeline.push(comp1_some);
timeline.push(comp1_some_feedback);
timeline.push(comp1_most);
timeline.push(comp1_most_feedback);
timeline.push(comp2_welcome);
timeline.push(comp2_trial_1);
timeline.push(comp2_feedback_1);
timeline.push(comp2_trial_2);
timeline.push(comp2_feedback_2);
timeline.push(comp3_trial);
timeline.push(comp3_feedback);

// Assign conditions BEFORE showing listener intro
timeline.push(assignConditions);

// Listener task introduction (condition-specific)
timeline.push(listenerIntro);
timeline.push(listenerIntroCredulousCond);
timeline.push(listenerIntroNaturalisticCond);
timeline.push(listenerTaskExplanationVigilantCond);
timeline.push(listenerTaskExplanationCredulousCond);
timeline.push(listenerTaskExplanationNaturalisticCond);

// Distribution builder explanation (shown to all)
timeline.push(distributionBuilderExplanation);

// Truth comprehension check (shown to all)
timeline.push(truthComprehensionCheck);
timeline.push(truthComprehensionFeedback);

// Pairing wait and matched screens
timeline.push(pairingWait);
timeline.push(speakerMatchedVigilantCond);
timeline.push(speakerMatchedCredulousCond);
timeline.push(speakerMatchedNaturalisticCond);

// Listener trials with wait screens
// Use a helper function to properly capture round number in closures
function addRoundToTimeline(roundNum) {
  // Wait for speaker response (except before first round)
  if (roundNum > 0) {
    timeline.push(createSpeakerWait(roundNum));
  }
  
  // Store the current utterance at the start of each round
  timeline.push({
    type: jsPsychCallFunction,
    func: function() {
      experimentState.currentRound = roundNum;
      experimentState.currentUtterance = experimentState.utteranceSequence[roundNum];
    }
  });
  
  // For VIGILANT condition: show both measures in randomized order
  // Case 1: Effectiveness first, then speaker type
  timeline.push({
    timeline: [createEffectivenessPage(roundNum, false)],  // not last page
    conditional_function: function() {
      return experimentState.listenerBeliefCondition === "vigilant" && 
             experimentState.measureOrder === "effectiveness_first";
    }
  });
  
  timeline.push({
    timeline: [createSpeakerTypePage(roundNum, true)],  // last page
    conditional_function: function() {
      return experimentState.listenerBeliefCondition === "vigilant" && 
             experimentState.measureOrder === "effectiveness_first";
    }
  });
  
  // Case 2: Speaker type first, then effectiveness
  timeline.push({
    timeline: [createSpeakerTypePage(roundNum, false)],  // not last page
    conditional_function: function() {
      return experimentState.listenerBeliefCondition === "vigilant" && 
             experimentState.measureOrder === "speaker_type_first";
    }
  });
  
  timeline.push({
    timeline: [createEffectivenessPage(roundNum, true)],  // last page
    conditional_function: function() {
      return experimentState.listenerBeliefCondition === "vigilant" && 
             experimentState.measureOrder === "speaker_type_first";
    }
  });
  
  // For CREDULOUS and NATURALISTIC conditions: effectiveness only (last page)
  timeline.push({
    timeline: [createEffectivenessPage(roundNum, true)],  // last page
    conditional_function: function() {
      return experimentState.listenerBeliefCondition === "credulous" || 
             experimentState.listenerBeliefCondition === "naturalistic";
    }
  });
}

// Add all rounds to timeline
for (let r = 0; r < CONFIG.n_rounds; r++) {
  addRoundToTimeline(r);
}

// Final measures (conditional based on condition)
timeline.push(competenceRatingVigilantCond);
timeline.push(competenceRatingCredulousCond);
timeline.push(competenceRatingNaturalisticCond);
timeline.push(openEndedQuestionsVigilantCond);
timeline.push(openEndedQuestionsOtherCond);

// Mark experiment as completed
timeline.push({
  type: jsPsychCallFunction,
  func: function () {
    jsPsych.data.addProperties({
      completion_status: "completed",
      completion_time: new Date().toISOString(),
      terminated_early: false,
      termination_reason: null,
      speaker_condition: experimentState.speakerCondition,
      listener_belief_condition: experimentState.listenerBeliefCondition,
      sequence_idx: experimentState.sequenceIdx,
      measure_order: experimentState.measureOrder,
    });
  },
});

// Save data
if (DATAPIPE_CONFIG.enabled) {
  timeline.push({
    type: jsPsychPipe,
    action: "save",
    experiment_id: DATAPIPE_CONFIG.experiment_id,
    filename: `${subjectId}.csv`,
    data_string: () => jsPsych.data.get().csv(),
  });
}

// Debrief
timeline.push(debrief);

// Run the experiment
jsPsych.run(timeline);
