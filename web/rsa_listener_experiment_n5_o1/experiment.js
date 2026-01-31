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
  return (
    "test_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now()
  );
}

const subjectId = generateSubjectId();

// ============================================================================
// PROLIFIC CONFIGURATION
// ============================================================================

const PROLIFIC_COMPLETION_CODE = "C14LE684"; // Replace with actual code
const PROLIFIC_SCREENING_CODE = "CNFUH4X1"; // Replace with actual code

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
// COPY PROTECTION - Prevent copying content to external tools
// ============================================================================

// Disable right-click context menu
document.addEventListener("contextmenu", function (e) {
  e.preventDefault();
  return false;
});

// Disable copy event
document.addEventListener("copy", function (e) {
  e.preventDefault();
  return false;
});

// Disable cut event
document.addEventListener("cut", function (e) {
  e.preventDefault();
  return false;
});

// Disable keyboard shortcuts for copy/cut/select all
document.addEventListener("keydown", function (e) {
  // Check for Ctrl+C, Ctrl+X, Ctrl+A (Windows/Linux) or Cmd+C, Cmd+X, Cmd+A (Mac)
  if (
    (e.ctrlKey || e.metaKey) &&
    (e.key === "c" ||
      e.key === "C" ||
      e.key === "x" ||
      e.key === "X" ||
      e.key === "a" ||
      e.key === "A")
  ) {
    e.preventDefault();
    return false;
  }
  // Also block F12 (dev tools) and Ctrl+Shift+I/J/C (dev tools shortcuts)
  if (
    e.key === "F12" ||
    ((e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      (e.key === "I" ||
        e.key === "i" ||
        e.key === "J" ||
        e.key === "j" ||
        e.key === "C" ||
        e.key === "c"))
  ) {
    e.preventDefault();
    return false;
  }
  // Block Ctrl+P (print)
  if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
    e.preventDefault();
    return false;
  }
  // Block Ctrl+S (save)
  if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
    e.preventDefault();
    return false;
  }
  // Block Ctrl+U (view source)
  if ((e.ctrlKey || e.metaKey) && (e.key === "u" || e.key === "U")) {
    e.preventDefault();
    return false;
  }
});

// Disable drag events (prevents dragging text/images)
document.addEventListener("dragstart", function (e) {
  e.preventDefault();
  return false;
});

// Disable selection via mouse
document.addEventListener("selectstart", function (e) {
  // Allow selection in input fields
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    return true;
  }
  e.preventDefault();
  return false;
});

// ============================================================================
// EXPERIMENT STATE
// ============================================================================

const experimentState = {
  // Condition assignments (between-subjects)
  speakerCondition: null, // "informative", "pers_plus", or "pers_minus" (utterances received)
  listenerBeliefCondition: null, // "vigilant", "credulous", or "naturalistic" (what they're told)
  utteranceSequence: [],
  sequenceIdx: 0,

  // Order randomization
  measureOrder: null, // "effectiveness_first" or "speaker_type_first"

  // Distribution states (carry over between rounds)
  effectivenessDistribution: null, // Array of 11 values
  speakerTypeDistribution: null, // Array of 3 values

  // Track if distributions were changed this round
  effectivenessChanged: false,
  speakerTypeChanged: false,

  // Round tracking
  currentRound: 0,
  currentUtterance: null, // Store current utterance for use across pages

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

  // DataPipe condition assignment
  datapipeCondition: null,
  cellIdx: null,
};

// ============================================================================
// WEIGHTED CONDITION MAPPING FOR BALANCED DESIGN
// ============================================================================
// This maps DataPipe conditions (0-612) to experimental cells (0-23)
// Each cell has a number of "slots" equal to how many more participants it needs
// to reach the target of 30 per cell (accounting for existing data from run 1)

// CELL_MAP: 24 experimental cells
const CELL_MAP = [
  { listener: "vigilant", speaker: "informative", seq: 0 }, // Cell 0: need 26
  { listener: "vigilant", speaker: "informative", seq: 1 }, // Cell 1: need 21
  { listener: "vigilant", speaker: "pers_plus", seq: 0 }, // Cell 2: need 27
  { listener: "vigilant", speaker: "pers_plus", seq: 1 }, // Cell 3: need 25
  { listener: "vigilant", speaker: "pers_plus", seq: 2 }, // Cell 4: need 26
  { listener: "vigilant", speaker: "pers_minus", seq: 0 }, // Cell 5: need 24
  { listener: "vigilant", speaker: "pers_minus", seq: 1 }, // Cell 6: need 30
  { listener: "vigilant", speaker: "pers_minus", seq: 2 }, // Cell 7: need 25
  { listener: "credulous", speaker: "informative", seq: 0 }, // Cell 8: need 27
  { listener: "credulous", speaker: "informative", seq: 1 }, // Cell 9: need 16
  { listener: "credulous", speaker: "pers_plus", seq: 0 }, // Cell 10: need 29
  { listener: "credulous", speaker: "pers_plus", seq: 1 }, // Cell 11: need 25
  { listener: "credulous", speaker: "pers_plus", seq: 2 }, // Cell 12: need 24
  { listener: "credulous", speaker: "pers_minus", seq: 0 }, // Cell 13: need 28
  { listener: "credulous", speaker: "pers_minus", seq: 1 }, // Cell 14: need 29
  { listener: "credulous", speaker: "pers_minus", seq: 2 }, // Cell 15: need 28
  { listener: "naturalistic", speaker: "informative", seq: 0 }, // Cell 16: need 19
  { listener: "naturalistic", speaker: "informative", seq: 1 }, // Cell 17: need 24
  { listener: "naturalistic", speaker: "pers_plus", seq: 0 }, // Cell 18: need 27
  { listener: "naturalistic", speaker: "pers_plus", seq: 1 }, // Cell 19: need 24
  { listener: "naturalistic", speaker: "pers_plus", seq: 2 }, // Cell 20: need 28
  { listener: "naturalistic", speaker: "pers_minus", seq: 0 }, // Cell 21: need 27
  { listener: "naturalistic", speaker: "pers_minus", seq: 1 }, // Cell 22: need 27
  { listener: "naturalistic", speaker: "pers_minus", seq: 2 }, // Cell 23: need 27
];

// WEIGHTED_CONDITION_MAP: 613 slots mapping DataPipe conditions to cell indices
// DataPipe will assign 0-612, this maps each to the appropriate cell (0-23)
const WEIGHTED_CONDITION_MAP = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2,
  2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3,
  3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4,
  4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5,
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8,
  8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9,
  9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
  10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
  11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11,
  11, 11, 11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12,
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 13, 13, 13, 13, 13, 13, 13, 13,
  13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13,
  13, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14,
  14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 15, 15, 15, 15, 15, 15, 15, 15,
  15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
  15, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16,
  16, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17,
  17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18,
  18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19, 19, 19, 19, 19,
  19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19,
  20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20,
  20, 20, 20, 20, 20, 20, 20, 20, 20, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21,
  21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22,
  22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22,
  22, 22, 22, 22, 22, 22, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
  23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
];

// Calculate total progress steps
// Welcome(1) + Consent(1) + Instructions(1) + Comp checks(11) + Intro pages(2) +
// Pairing(1) + Matched(1) + Trials(5 rounds × 1-2 point estimate pages) + Attention(1) + Final(2) ≈ 25
const TOTAL_PROGRESS_STEPS = 25;

function updateProgress() {
  experimentState.completedTrials++;
  const progress = Math.min(
    experimentState.completedTrials / TOTAL_PROGRESS_STEPS,
    1,
  );
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

  document
    .getElementById("dismiss-warning-btn")
    .addEventListener("click", () => {
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

    if (
      elapsed >= CONFIG.inactivity_warning_1 &&
      !experimentState.warning1Shown
    ) {
      experimentState.warning1Shown = true;
      showInactivityWarning(
        "Please complete your response.<br>The experiment will end if no response is received.",
        false,
      );
    }

    if (
      elapsed >= CONFIG.inactivity_warning_2 &&
      !experimentState.warning2Shown
    ) {
      experimentState.warning2Shown = true;
      showInactivityWarning(
        "Please respond soon!<br><strong>The experiment will end in 30 seconds.</strong>",
        true,
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
  } else if (reason === "attention_check_failed") {
    return `<div class="debrief-container">
      <h2 style="color: #f44336;">Study Ended</h2>
      <p>Unfortunately, the study has ended because attention checks were not passed.</p>
      <p style="margin-top: 15px; color: #666;">Thank you for your time. If you believe this is an error, please contact the researcher.</p>
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
  } else if (reason === "attention_check_failed") {
    completionStatus = "terminated_attention_check";
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
function createDistributionBuilderHTML(
  type,
  title,
  initialDistribution = null,
) {
  const nTokens = CONFIG.n_tokens;
  let options, labels;

  if (type === "effectiveness") {
    options = CONFIG.effectiveness_options;
    labels = options.map((v) => `${v}%`);
  } else {
    options = CONFIG.speaker_types;
    labels = options.map((t) => `${t.icon}<br>${t.label}`);
  }

  const nOptions = options.length;
  const builderClass =
    type === "speaker_type"
      ? "distribution-builder speaker-type"
      : "distribution-builder";

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
          <button class="column-btn minus" data-col="${i}" ${initialCount === 0 ? "disabled" : ""}>−</button>
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
  const nOptions =
    type === "effectiveness"
      ? CONFIG.effectiveness_options.length
      : CONFIG.speaker_types.length;

  // IMPORTANT: Reset change flags FIRST, before anything else
  if (type === "effectiveness") {
    experimentState.effectivenessChanged = false;
  } else {
    experimentState.speakerTypeChanged = false;
  }

  // Get current distribution from state or initialize to zeros
  let distribution;
  if (type === "effectiveness") {
    distribution =
      experimentState.effectivenessDistribution || new Array(nOptions).fill(0);
  } else {
    distribution =
      experimentState.speakerTypeDistribution || new Array(nOptions).fill(0);
  }

  function getTokensUsed() {
    return distribution.reduce((a, b) => a + b, 0);
  }

  function getTokensLeft() {
    return nTokens - getTokensUsed();
  }

  // Update display only - does NOT set changed flag or call callback
  function updateDisplayOnly() {
    const tokensLeft = getTokensLeft();
    const summaryEl = document.getElementById(`${type}-summary`);

    // Update column counts and grid displays
    for (let i = 0; i < nOptions; i++) {
      const countEl = document.getElementById(`${type}-count-${i}`);
      if (countEl) {
        countEl.textContent = `${distribution[i]} assigned`;
      }

      // Update grid cells
      const gridCells = document.querySelectorAll(
        `.distribution-builder[data-type="${type}"] .distribution-column[data-col="${i}"] .grid-cell`,
      );
      gridCells.forEach((cell, j) => {
        if (j < distribution[i]) {
          cell.classList.add("filled");
        } else {
          cell.classList.remove("filled");
        }
      });

      // Update button states
      const minusBtn = document.querySelector(
        `.distribution-builder[data-type="${type}"] .column-btn.minus[data-col="${i}"]`,
      );
      const plusBtn = document.querySelector(
        `.distribution-builder[data-type="${type}"] .column-btn.plus[data-col="${i}"]`,
      );

      if (minusBtn) minusBtn.disabled = distribution[i] === 0;
      if (plusBtn) plusBtn.disabled = tokensLeft === 0;
    }

    // Update summary
    if (summaryEl) {
      if (tokensLeft === 0) {
        summaryEl.textContent = "All tokens assigned. ✓";
        summaryEl.className = "distribution-summary complete";
      } else {
        summaryEl.textContent = `You have ${tokensLeft} token${tokensLeft !== 1 ? "s" : ""} left. Please assign all tokens.`;
        summaryEl.className = "distribution-summary incomplete";
      }
    }

    // Save distribution to state
    if (type === "effectiveness") {
      experimentState.effectivenessDistribution = [...distribution];
    } else {
      experimentState.speakerTypeDistribution = [...distribution];
    }
  }

  // Called ONLY on user click - marks as changed, updates display, AND calls callback
  function onUserClick() {
    // Mark as changed
    if (type === "effectiveness") {
      experimentState.effectivenessChanged = true;
    } else {
      experimentState.speakerTypeChanged = true;
    }

    // Update display
    updateDisplayOnly();

    // Call callback to check if submit should be enabled
    if (onChangeCallback) onChangeCallback();
  }

  function showWarning(message) {
    const summaryEl = document.getElementById(`${type}-summary`);
    if (summaryEl) {
      summaryEl.textContent = message;
      summaryEl.className = "distribution-summary warning";
      setTimeout(() => updateDisplayOnly(), 2000);
    }
  }

  // Add click handlers for plus/minus buttons
  document
    .querySelectorAll(
      `.distribution-builder[data-type="${type}"] .column-btn.plus`,
    )
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        resetInactivityTimer();
        const col = parseInt(e.target.dataset.col);
        if (getTokensLeft() > 0) {
          distribution[col]++;
          onUserClick();
        } else {
          showWarning(
            "You have 0 tokens left. Please adjust other options to add more here.",
          );
        }
      });
    });

  document
    .querySelectorAll(
      `.distribution-builder[data-type="${type}"] .column-btn.minus`,
    )
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        resetInactivityTimer();
        const col = parseInt(e.target.dataset.col);
        if (distribution[col] > 0) {
          distribution[col]--;
          onUserClick();
        }
      });
    });

  // Add click handlers for grid columns (click to set height)
  document
    .querySelectorAll(`.distribution-builder[data-type="${type}"] .column-grid`)
    .forEach((grid) => {
      grid.addEventListener("click", (e) => {
        resetInactivityTimer();
        const col = parseInt(grid.dataset.col);
        const cell = e.target.closest(".grid-cell");

        if (cell) {
          const targetHeight = parseInt(cell.dataset.row) + 1;
          const currentHeight = distribution[col];
          const tokensNeeded = targetHeight - currentHeight;

          if (tokensNeeded > 0 && tokensNeeded > getTokensLeft()) {
            showWarning(
              `Not enough tokens. You need ${tokensNeeded} but only have ${getTokensLeft()} left.`,
            );
            return;
          }

          distribution[col] = targetHeight;
          onUserClick();
        }
      });
    });

  // Initial display only - NO callback, NO changed flag
  updateDisplayOnly();

  // Call callback once after setup to set initial button state (disabled since changed=false)
  if (onChangeCallback) onChangeCallback();

  return {
    getDistribution: () => [...distribution],
    isComplete: () => getTokensLeft() === 0,
  };
}

// ============================================================================
// INSTRUCTION PAGES (same as speaker experiment)
// ============================================================================

const instructionPages = [
  // Page 1: Cover story and data representation (without effectiveness explanation)
  `<div class="instructions-container">
    <h2>Clinical Trials</h2>
    <p>In this study, a speaker and a listener will be communicating about results from 5 clinical trials testing a new medical treatment.</p>
    <p>Only the speaker will be able to see the result of these trials.</p>
    <p>Each trial tests a treatment on <strong>5 patients</strong>. For each patient, the treatment can be:</p>
    <ul>
      <li><strong>EFFECTIVE</strong> (😃) — the treatment worked</li>
      <li><strong>INEFFECTIVE</strong> (🤒) — the treatment did not work</li>
    </ul>
    <p>Here's what a clinical trial result looks like:</p>
    <div class="example-box">
      <div style="text-align: center;">
        <img src="stimuli_emoji_n5m1/effective_2_v0.png" alt="Example trial" class="stimulus-image" style="max-width: 400px;">
      </div>
      <p style="margin-top: 15px; text-align: center;">The treatment worked for 2 patients (😃😃) and didn't work for 3 (🤒🤒🤒).</p>
    </div>
  </div>`,

  // Page 2: Treatment Effectiveness explanation
  `<div class="instructions-container">
    <h2>Treatment Effectiveness</h2>
    <p>The treatment has an underlying <strong>effectiveness level</strong> (from 0% to 100%) that determines how likely it is to work for any patient.</p>
    
    <div class="example-box" style="margin-top: 20px;">
      <div style="display: flex; align-items: center; gap: 20px;">
        <img src="stimuli_emoji_n5m1/effective_5_v0.png" alt="100% effective" style="max-width: 200px;">
        <div>
          <p><strong>100% Effectiveness ("Golden Treatment")</strong></p>
          <p style="color: #666;">The treatment works for every patient. All 5 patients show improvement.</p>
        </div>
      </div>
    </div>
    
    <div class="example-box" style="margin-top: 15px;">
      <div style="display: flex; align-items: center; gap: 20px;">
        <img src="stimuli_emoji_n5m1/effective_0_v0.png" alt="0% effective" style="max-width: 200px;">
        <div>
          <p><strong>0% Effectiveness ("Useless Treatment")</strong></p>
          <p style="color: #666;">The treatment never works. No patients show improvement.</p>
        </div>
      </div>
    </div>
    
    <div class="example-box" style="margin-top: 15px;">
      <p><strong>In Between: The same effectiveness level can produce different results</strong></p>
      <p style="color: #666; margin-bottom: 15px;">Here are some possible outcomes at different effectiveness levels:</p>
      
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <!-- Header row with axis -->
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px 8px 12px 8px;">
          <span style="min-width: 120px;"></span>
          <div style="display: flex; gap: 8px; flex: 1; align-items: center; justify-content: center;">
            <span style="font-size: 0.9em; color: #4CAF50; font-weight: 500;">More likely</span>
            <span style="font-size: 1.2em; color: #888; margin: 0 10px;">→</span>
            <span style="font-size: 0.9em; color: #f57c00; font-weight: 500;">Less likely</span>
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f5f5f5; border-radius: 6px;">
          <span style="min-width: 120px; font-weight: 500;">20% Effectiveness:</span>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; flex: 1; justify-content: center;">
            <div style="text-align: center; padding: 4px 8px; background: #e8f5e9; border-radius: 4px;">
              <img src="stimuli_emoji_n5m1/effective_1_v0.png" alt="1 effective" style="max-width: 100px;">
            </div>
            <div style="text-align: center; padding: 4px 8px; background: #fff3e0; border-radius: 4px;">
              <img src="stimuli_emoji_n5m1/effective_2_v0.png" alt="2 effective" style="max-width: 100px;">
            </div>
            <div style="text-align: center; padding: 4px 8px; background: #ffebee; border-radius: 4px;">
              <img src="stimuli_emoji_n5m1/effective_4_v0.png" alt="4 effective" style="max-width: 100px;">
            </div>
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f5f5f5; border-radius: 6px;">
          <span style="min-width: 120px; font-weight: 500;">50% Effectiveness:</span>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; flex: 1; justify-content: center;">
            <div style="text-align: center; padding: 4px 8px; background: #e8f5e9; border-radius: 4px;">
              <img src="stimuli_emoji_n5m1/effective_2_v0.png" alt="2 effective" style="max-width: 100px;">
            </div>
            <div style="text-align: center; padding: 4px 8px; background: #fff3e0; border-radius: 4px;">
              <img src="stimuli_emoji_n5m1/effective_1_v0.png" alt="1 effective" style="max-width: 100px;">
            </div>
            <div style="text-align: center; padding: 4px 8px; background: #ffebee; border-radius: 4px;">
              <img src="stimuli_emoji_n5m1/effective_4_v0.png" alt="4 effective" style="max-width: 100px;">
            </div>
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f5f5f5; border-radius: 6px;">
          <span style="min-width: 120px; font-weight: 500;">70% Effectiveness:</span>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; flex: 1; justify-content: center;">
            <div style="text-align: center; padding: 4px 8px; background: #e8f5e9; border-radius: 4px;">
              <img src="stimuli_emoji_n5m1/effective_4_v0.png" alt="4 effective" style="max-width: 100px;">
            </div>
            <div style="text-align: center; padding: 4px 8px; background: #fff3e0; border-radius: 4px;">
              <img src="stimuli_emoji_n5m1/effective_2_v0.png" alt="2 effective" style="max-width: 100px;">
            </div>
            <div style="text-align: center; padding: 4px 8px; background: #ffebee; border-radius: 4px;">
              <img src="stimuli_emoji_n5m1/effective_1_v0.png" alt="1 effective" style="max-width: 100px;">
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <p style="margin-top: 20px;">The clinical trial result gives you <strong>evidence</strong> about the treatment's true effectiveness level.</p>
  </div>`,

  // Page 3: Description structure
  `<div class="instructions-container">
    <h2>Descriptions of Trials</h2>
    <p>The speaker is then responsible for describing the trial results to the listener who <strong>cannot see the results</strong>.</p>
    <p>The descriptions are structured like this:</p>
    <div class="definition-box" style="text-align: center; font-size: 1.1em; padding: 20px;">
      "The treatment was <strong>[effective / ineffective]</strong> for <strong>[no / some / most / all]</strong> patients."
    </div>
    <p style="margin-top: 20px;">To ensure a shared understanding of the descriptions, each word is defined by the minimal conditions under which it is factually true:</p>
    <ul style="font-size: 1.05em; line-height: 1.8;">
      <li><strong>NO</strong> — 0 patients</li>
      <li><strong>SOME</strong> — 1, 2, 3, 4, or 5 patients (at least one)</li>
      <li><strong>MOST</strong> — 3, 4, or 5 patients (more than half)</li>
      <li><strong>ALL</strong> — 5 patients</li>
    </ul>
    <p>These definitions set the <strong>minimum rules for using each word</strong>. A description may be used if it satisfies the definition, and may not be used otherwise.</p>
  </div>`,
];

// Page showing which descriptions are true (shown after SOME/MOST checks)
const whichDescriptionsTrue = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="instructions-container">
      <h2>Speaker: Multiple True Descriptions, One Result</h2>
      <p>For any clinical trial, <strong>multiple descriptions can be used</strong> by the speaker even though they may give different impressions. Consider this one:</p>

      <div style="text-align: center; margin: 20px 0;">
        <img src="stimuli_emoji_n5m1/effective_3_v0.png" alt="Example" class="stimulus-image" style="max-width: 300px;">
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="background: #e8f5e9; border-left: 4px solid #4CAF50; padding: 12px 16px; border-radius: 4px;">
          <strong style="color: #2e7d32;">✓ TRUE:</strong> "The treatment was <b><u>ineffective</u></b> for <b><u>some</u></b> patients." <span style="color: #666;">(2 is at least 1)</span>
        </div>
        <div style="background: #e8f5e9; border-left: 4px solid #4CAF50; padding: 12px 16px; border-radius: 4px;">
          <strong style="color: #2e7d32;">✓ TRUE:</strong> "The treatment was <b><u>effective</u></b> for <b><u>most</u></b> patients." <span style="color: #666;">(3 is more than half)</span>
        </div>
        <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 12px 16px; border-radius: 4px;">
          <strong style="color: #c62828;">✗ FALSE:</strong> "The treatment was <b><u>ineffective</u></b> for <b><u>most</u></b> patients." <span style="color: #666;">(2 is less than half)</span>
        </div>
        <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 12px 16px; border-radius: 4px;">
          <strong style="color: #c62828;">✗ FALSE:</strong> "The treatment was <b><u>effective</u></b> for <b><u>all</u></b> patients." <span style="color: #666;">(only 3, not 5)</span>
        </div>
      </div>
    </div>
  `,
  choices: ["Continue"],
  on_finish: updateProgress,
};

// Page showing multiple results can underlie one description
const multipleResultsOneTruth = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="instructions-container">
      <h2>Listener: One True Description, Multiple Results</h2>
      <p>From the listener’s perspective, <strong>multiple different clinical trial results</strong> may be consistent with the same description:</p>

      <div class="definition-box" style="text-align: center; font-size: 1.1em; padding: 15px; margin: 20px 0;">
        "The treatment was <b><u>ineffective</u></b> for <b><u>most</u></b> patients."
      </div>

      <p style="text-align: center; margin-bottom: 15px;">This statement is TRUE for all of these trials:</p>

      <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
        <div style="text-align: center;">
          <img src="stimuli_emoji_n5m1/effective_0_v0.png" alt="0 effective" style="max-width: 150px;">
          <p style="color: #666; font-size: 0.9em;">5 ineffective<br>(5 > half)</p>
        </div>
        <div style="text-align: center;">
          <img src="stimuli_emoji_n5m1/effective_1_v0.png" alt="1 effective" style="max-width: 150px;">
          <p style="color: #666; font-size: 0.9em;">4 ineffective<br>(4 > half)</p>
        </div>
        <div style="text-align: center;">
          <img src="stimuli_emoji_n5m1/effective_2_v0.png" alt="2 effective" style="max-width: 150px;">
          <p style="color: #666; font-size: 0.9em;">3 ineffective<br>(3 > half)</p>
        </div>
      </div>

    </div>
  `,
  choices: ["Continue"],
  on_finish: updateProgress,
};

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
  button_html:
    '<button class="jspsych-btn" style="background: #4CAF50; color: white;">%choice%</button>',
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
      const currentPage = document.querySelector(
        ".jspsych-instructions-pagenum",
      );
      if (currentPage && currentPage.textContent.includes("3/3")) {
        const nextBtn = document.querySelector(
          'button[id="jspsych-instructions-next"]',
        );
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
    const selectedIndex = CONFIG.comprehension.module1.some.options.indexOf(
      data.response.some_def,
    );
    data.comp1_some_correct =
      selectedIndex === CONFIG.comprehension.module1.some.correct;
    updateProgress();
  },
};

const comp1_some_feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data
      .get()
      .filter({ task: "comp1_some" })
      .last(1)
      .values()[0];
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
  preamble:
    '<div class="comprehension-container"><h2>Quick Check (continued)</h2></div>',
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
    const selectedIndex = CONFIG.comprehension.module1.most.options.indexOf(
      data.response.most_def,
    );
    data.comp1_most_correct =
      selectedIndex === CONFIG.comprehension.module1.most.correct;
    updateProgress();
  },
};

const comp1_most_feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data
      .get()
      .filter({ task: "comp1_most" })
      .last(1)
      .values()[0];
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

// Module 2: Single True/False judgment (reduced from 2)
const comp2_welcome = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="comprehension-container">
    <h2>Quick Check: True or False?</h2>
    <p>Look at the clinical trial result and decide if the statement is <strong>TRUE</strong> or <strong>FALSE</strong>.</p>
  </div>`,
  choices: ["Begin"],
  on_finish: updateProgress,
};

const comp2_trial = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    // Fixed item: 3 effective, "ineffective for some" = TRUE
    const imgPath = Stimuli.getImagePath(3, 0);
    return `<div class="comprehension-container">
      <h3>Is this statement TRUE or FALSE?</h3>
      <div class="stimulus-container">
        <img src="${imgPath}" class="stimulus-image" style="max-width: 400px;">
      </div>
      <div class="definition-box" style="text-align: center; font-size: 1.2em;">
        "The treatment was <b><u>ineffective</u></b> for <b><u>some</u></b> patients."
      </div>
      <div style="margin-top: 30px; text-align: center;">
        <button class="jspsych-btn tf-btn true-btn" id="btn-true">TRUE</button>
        <button class="jspsych-btn tf-btn false-btn" id="btn-false">FALSE</button>
      </div>
    </div>`;
  },
  choices: [],
  data: { task: "comp2_tf" },
  on_load: function () {
    document.getElementById("btn-true").addEventListener("click", () => {
      jsPsych.finishTrial({
        task: "comp2_tf",
        response: true,
        comp2_correct: true,
      });
    });
    document.getElementById("btn-false").addEventListener("click", () => {
      jsPsych.finishTrial({
        task: "comp2_tf",
        response: false,
        comp2_correct: false,
      });
    });
  },
  on_finish: updateProgress,
};

const comp2_feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data
      .get()
      .filter({ task: "comp2_tf" })
      .last(1)
      .values()[0];
    const imgPath = Stimuli.getImagePath(3, 0);
    if (data.comp2_correct) {
      return `<div class="comprehension-container">
        <h2 style="color: #4CAF50;">✓ Correct!</h2>
        <p><strong>SOME</strong> means "at least 1". Since 2 patients were ineffective, the statement is TRUE.</p>
      </div>`;
    } else {
      return `<div class="comprehension-container">
        <h2 style="color: #f44336;">✗ Incorrect</h2>
        <div style="text-align: center; margin: 15px 0;">
          <img src="${imgPath}" class="stimulus-image" style="max-width: 300px;">
        </div>
        <p>The answer is <strong>TRUE</strong>.</p>
        <p><strong>SOME</strong> means "at least 1". Looking at the trial, 2 patients were ineffective (🤒🤒). Since 2 ≥ 1, the statement "The treatment was ineffective for <b>some</b> patients" is TRUE.</p>
      </div>`;
    }
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// New comprehension: Multiple descriptions can be true for one result
const comp_multipleDescriptions = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const imgPath = Stimuli.getImagePath(5, 0); // 5 effective

    // Options: first two are TRUE, third is FALSE
    const options = [
      {
        text: '"The treatment was <b><u>effective</u></b> for <b><u>all</u></b> patients."',
        correct: true,
        id: "all",
      },
      {
        text: '"The treatment was <b><u>effective</u></b> for <b><u>some</u></b> patients."',
        correct: true,
        id: "some",
      },
      {
        text: '"The treatment was <b><u>ineffective</u></b> for <b><u>some</u></b> patients."',
        correct: false,
        id: "ineff_some",
      },
    ];

    // Shuffle options
    const shuffled = shuffleArray(
      options.map((opt, idx) => ({ ...opt, origIdx: idx })),
    );
    experimentState.comp_multiDesc_options = shuffled;

    let optionsHtml = "";
    shuffled.forEach((opt, i) => {
      optionsHtml += `<div class="checkbox-option-text" data-idx="${i}" data-correct="${opt.correct}" id="opt-${i}">
        <span class="checkbox-marker"></span>
        ${opt.text}
      </div>`;
    });

    return `<div class="comprehension-container">
      <h3>Which descriptions are TRUE for this trial?</h3>
      <div class="stimulus-container">
        <img src="${imgPath}" class="stimulus-image" style="max-width: 350px;">
      </div>
      <p style="text-align: center; color: #666; margin: 15px 0;">Select <strong>all</strong> that are TRUE:</p>
      <div style="max-width: 580px; margin: 0 auto;">
        ${optionsHtml}
      </div>
      <div style="margin-top: 20px; text-align: center;">
        <button id="comp-submit" class="jspsych-btn" disabled>Submit Answer</button>
      </div>
    </div>`;
  },
  choices: [],
  data: { task: "comp_multiple_desc" },
  on_load: function () {
    const selectedIndices = new Set();
    const options = document.querySelectorAll(".checkbox-option-text");
    const submitBtn = document.getElementById("comp-submit");
    const shuffledOpts = experimentState.comp_multiDesc_options;

    options.forEach((opt, i) => {
      opt.addEventListener("click", () => {
        if (selectedIndices.has(i)) {
          selectedIndices.delete(i);
          opt.classList.remove("selected");
        } else {
          selectedIndices.add(i);
          opt.classList.add("selected");
        }
        submitBtn.disabled = selectedIndices.size === 0;
      });
    });

    submitBtn.addEventListener("click", () => {
      // Check if exactly the two correct options are selected
      const correctIndices = shuffledOpts
        .map((opt, i) => (opt.correct ? i : -1))
        .filter((i) => i >= 0);
      const selectedCorrectly =
        correctIndices.every((i) => selectedIndices.has(i)) &&
        selectedIndices.size === correctIndices.length;

      jsPsych.finishTrial({
        task: "comp_multiple_desc",
        selected: Array.from(selectedIndices).map((i) => shuffledOpts[i].id),
        comp_correct: selectedCorrectly,
      });
    });
  },
  on_finish: updateProgress,
};

const comp_multipleDescriptions_feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data
      .get()
      .filter({ task: "comp_multiple_desc" })
      .last(1)
      .values()[0];
    const imgPath = Stimuli.getImagePath(5, 0);
    if (data.comp_correct) {
      return `<div class="comprehension-container">
        <h2 style="color: #4CAF50;">✓ Correct!</h2>
        <p style="text-align: center;">You correctly identified which descriptions are TRUE!</p>
        <div style="text-align: left; max-width: 500px; margin: 15px auto;">
          <p style="margin-bottom: 8px; color: #2e7d32;">✓ "...effective for <strong>ALL</strong>" — TRUE (5 = 5)</p>
          <p style="margin-bottom: 8px; color: #2e7d32;">✓ "...effective for <strong>SOME</strong>" — TRUE (5 ≥ 1)</p>
          <p style="margin-bottom: 8px; color: #c62828;">✗ "...ineffective for <strong>SOME</strong>" — FALSE (0 is not ≥ 1)</p>
        </div>
        <p style="text-align: center;">Multiple descriptions can be true for the same result, but not all!</p>
      </div>`;
    } else {
      return `<div class="comprehension-container">
        <h2 style="color: #f44336;">✗ Incorrect</h2>
        <div style="text-align: center; margin: 15px 0;">
          <img src="${imgPath}" class="stimulus-image" style="max-width: 250px;">
        </div>
        <p style="text-align: center;">Let's check each description:</p>
        <div style="text-align: left; max-width: 500px; margin: 15px auto;">
          <p style="margin-bottom: 8px; color: #2e7d32;">✓ "...effective for <strong>ALL</strong>" — TRUE (5 = 5)</p>
          <p style="margin-bottom: 8px; color: #2e7d32;">✓ "...effective for <strong>SOME</strong>" — TRUE (5 ≥ 1)</p>
          <p style="margin-bottom: 8px; color: #c62828;">✗ "...ineffective for <strong>SOME</strong>" — FALSE (0 patients were ineffective, and 0 is not ≥ 1)</p>
        </div>
        <p style="text-align: center;">Multiple descriptions can be true, but "ineffective for some" requires at least 1 ineffective patient.</p>
      </div>`;
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
    const shuffledOptions = shuffleArray(
      item.options.map((opt, idx) => ({ ...opt, origIdx: idx })),
    );
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
      const selectedOptions = experimentState.comp3_options.filter((_, i) =>
        selectedIndices.has(i),
      );
      const correctOptions = experimentState.comp3_options.filter(
        (opt) => opt.correct,
      );
      const allCorrectSelected = correctOptions.every((opt) =>
        selectedIndices.has(experimentState.comp3_options.indexOf(opt)),
      );
      const noIncorrectSelected = selectedOptions.every((opt) => opt.correct);
      const isCorrect =
        allCorrectSelected && noIncorrectSelected && selectedIndices.size > 0;

      jsPsych.finishTrial({
        task: "comp3",
        selected: Array.from(selectedIndices).map(
          (i) => experimentState.comp3_options[i].numEffective,
        ),
        comp3_correct: isCorrect,
      });
    });
  },
  on_finish: updateProgress,
};

const comp3_feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data
      .get()
      .filter({ task: "comp3" })
      .last(1)
      .values()[0];
    const item = CONFIG.comprehension.module3;

    if (data.comp3_correct) {
      return `<div class="comprehension-container">
        <h2 style="color: #4CAF50;">✓ Correct!</h2>
        <p><strong>MOST</strong> means "more than half". Since there are 5 patients, MOST means 3 or more.</p>
        <p>The statement "The treatment was <b>ineffective</b> for <b>most</b> patients" is TRUE when 3+ patients were ineffective.</p>
      </div>`;
    } else {
      // Show detailed feedback with each option explained
      const img0 = Stimuli.getImagePath(0, 0); // 0 effective = 5 ineffective ✓
      const img2 = Stimuli.getImagePath(2, 0); // 2 effective = 3 ineffective ✓
      const img3 = Stimuli.getImagePath(3, 0); // 3 effective = 2 ineffective ✗

      return `<div class="comprehension-container">
        <h2 style="color: #f44336;">✗ Incorrect</h2>
        <p>The statement is: "<b>The treatment was ineffective for MOST patients.</b>"</p>
        <p><strong>MOST</strong> means "more than half". For 5 patients, that's 3 or more.</p>
        
        <div style="margin-top: 20px;">
          <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; padding: 10px; background: #e8f5e9; border-radius: 8px;">
            <img src="${img0}" style="max-width: 120px;">
            <div>
              <strong style="color: #2e7d32;">✓ TRUE</strong>
              <p style="margin: 5px 0; color: #666;">5 patients ineffective (5 > half of 5)</p>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; padding: 10px; background: #e8f5e9; border-radius: 8px;">
            <img src="${img2}" style="max-width: 120px;">
            <div>
              <strong style="color: #2e7d32;">✓ TRUE</strong>
              <p style="margin: 5px 0; color: #666;">3 patients ineffective (3 > half of 5)</p>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 15px; padding: 10px; background: #ffebee; border-radius: 8px;">
            <img src="${img3}" style="max-width: 120px;">
            <div>
              <strong style="color: #c62828;">✗ FALSE</strong>
              <p style="margin: 5px 0; color: #666;">Only 2 patients ineffective (2 < half of 5)</p>
            </div>
          </div>
        </div>
      </div>`;
    }
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// ============================================================================
// 5. LISTENER TASK INTRODUCTION (varies by belief condition)
// ============================================================================

// Get condition assignment from DataPipe (for balanced design)
// DataPipe will assign condition 0-612, which maps to cells 0-23 via WEIGHTED_CONDITION_MAP
const getDataPipeCondition = {
  type: jsPsychPipe,
  action: "condition",
  experiment_id: DATAPIPE_CONFIG.experiment_id,
  on_finish: function (data) {
    // Store the assigned condition (0-612)
    experimentState.datapipeCondition = data.condition;
    console.log("DataPipe assigned condition:", data.condition);
  },
};

// Initial assignment of conditions (uses DataPipe weighted condition mapping)
const assignConditions = {
  type: jsPsychCallFunction,
  func: function () {
    // Use DataPipe condition assignment with weighted mapping
    if (
      experimentState.datapipeCondition !== null &&
      experimentState.datapipeCondition >= 0 &&
      experimentState.datapipeCondition < WEIGHTED_CONDITION_MAP.length
    ) {
      // Map DataPipe condition (0-612) to cell index (0-23)
      experimentState.cellIdx =
        WEIGHTED_CONDITION_MAP[experimentState.datapipeCondition];

      // Get the experimental conditions from the cell
      const cell = CELL_MAP[experimentState.cellIdx];
      experimentState.listenerBeliefCondition = cell.listener;
      experimentState.speakerCondition = cell.speaker;
      experimentState.sequenceIdx = cell.seq;

      console.log("DataPipe condition:", experimentState.datapipeCondition);
      console.log("Mapped to cell:", experimentState.cellIdx);
      console.log("Assigned:", cell);
    } else {
      // Fallback to random assignment if DataPipe fails
      console.warn("DataPipe condition not available, using random assignment");

      // Randomly assign listener belief condition
      const beliefConditions = CONFIG.listener_belief_conditions;
      experimentState.listenerBeliefCondition =
        beliefConditions[Math.floor(Math.random() * beliefConditions.length)];

      // Randomly assign utterance sequence condition
      const utteranceConditions = CONFIG.utterance_conditions;
      experimentState.speakerCondition =
        utteranceConditions[
          Math.floor(Math.random() * utteranceConditions.length)
        ];

      // Select utterance sequence randomly
      const sequences =
        CONFIG.utterance_sequences[experimentState.speakerCondition];
      experimentState.sequenceIdx = Math.floor(
        Math.random() * sequences.length,
      );
    }

    // Get the utterance sequence based on assigned condition
    experimentState.utteranceSequence =
      CONFIG.utterance_sequences[experimentState.speakerCondition][
        experimentState.sequenceIdx
      ];

    // Randomize measure order (between-participants, fixed within)
    experimentState.measureOrder =
      Math.random() < 0.5 ? "effectiveness_first" : "speaker_type_first";

    // Initialize distributions as null (unassigned)
    experimentState.effectivenessDistribution = null;
    experimentState.speakerTypeDistribution = null;

    // Add condition info to data
    jsPsych.data.addProperties({
      datapipe_condition: experimentState.datapipeCondition,
      cell_idx: experimentState.cellIdx,
    });
  },
};

// VIGILANT condition - navigable intro pages
const listenerIntroVigilantPages = {
  type: jsPsychInstructions,
  pages: function () {
    return [
      `<div class="instructions-container">
        <h2>Your Role: Listener</h2>
        <p>You have been assigned to be a <strong>listener</strong>.</p>
        <p>You will be paired with another participant who has been assigned the role of <strong>speaker</strong>.</p>
        <p>You will communicate with this speaker regarding <strong>${CONFIG.n_rounds}</strong> clinical trial results for a new treatment.</p>
        <p>For each round, the speaker will see a new clinical trial result for this treatment and send you a description. <strong>You will NOT see the results</strong> — only the speaker's description.</p>
        <p style="margin-top: 15px; color: #666;"><em>Note: Each round, the description corresponds to a new trial result for this treatment. Your goal is to incrementally figure out how effective this treatment truly is and the speaker's real goal through the ${CONFIG.n_rounds} interactions.</em></p>
      </div>`,
      `<div class="instructions-container">
        <h2>Speaker Types</h2>
        <p>There are three types of speakers:</p>
        
        <div class="example-box" style="margin: 20px auto; text-align: left; max-width: 450px;">
          <p style="margin-bottom: 12px;">🔬 <strong>Scientist</strong> — tells you what's most informative</p>
          <p style="margin-bottom: 12px;">👍 <strong>Promoter</strong> — makes treatment sound good</p>
          <p style="margin-bottom: 0;">👎 <strong>Skeptic</strong> — makes treatment sound bad</p>
        </div>
        
        <p style="margin-top: 20px;">Your speaker is one of these types. <strong>You will not know which one.</strong> All of their descriptions are factually consistent with the trial results, <strong>but which true description they choose to give depends on their goal.</strong></p>
        
        <p style="margin-top: 20px;">After receiving each description, you will estimate the treatment's effectiveness (0% to 100%) and the speaker's potential goal.</p>
        
        <div class="example-box" style="margin-top: 25px;">
          <p><strong>Your Bonus:</strong> You will receive a bonus of up to <strong>${CONFIG.bonus_max}</strong>, based on how closely your effectiveness estimates after each round match the true treatment effectiveness.</p>
          <p style="margin-top: 10px;"><strong>Try to be as accurate as possible!</strong></p>
        </div>
        
        <p style="margin-top: 20px; padding: 12px; background: #fff3e0; border-left: 4px solid #FF9800; font-size: 0.95em;">
          <strong>Important:</strong> To submit your response each round, you must click or drag each slider — if you want to keep the same value, you can simply click it or move it but leave it at the original place.
        </p>
      </div>`,
    ];
  },
  show_clickable_nav: true,
  button_label_previous: "Back",
  button_label_next: "Continue",
  on_finish: updateProgress,
};

// CREDULOUS condition - navigable intro pages
const listenerIntroCredulousPagesObj = {
  type: jsPsychInstructions,
  pages: function () {
    return [
      `<div class="instructions-container">
        <h2>Your Role: Listener</h2>
        <p>You have been assigned to be a <strong>listener</strong>.</p>
        <p>You will be paired with another participant who has been assigned the role of <strong>speaker</strong>.</p>
        <p>You will communicate with this speaker regarding <strong>${CONFIG.n_rounds}</strong> clinical trial results for a new treatment.</p>
        <p>For each round, the speaker will see a new clinical trial result for this treatment and send you a description. <strong>You will NOT see the results</strong> — only the speaker's description.</p>
        <p style="margin-top: 15px;">After receiving each description, you will estimate the treatment's effectiveness (0% to 100%).</p>
        <p style="margin-top: 15px; color: #666;"><em>Note: Each round, the description corresponds to a new trial result for this treatment. Your goal is to incrementally figure out how effective this treatment truly is through the ${CONFIG.n_rounds} interactions.</em></p>
      </div>`,
      `<div class="instructions-container">
        <h2>Bonus Structure</h2>
        
        <div class="example-box" style="margin: 20px auto;">
          <p><strong>Instruction Your Partner Speaker Received:</strong></p>
          <p style="margin-top: 10px; font-style: italic;">"Be as informative and accurate as possible regarding which trial outcome you observed, help the listener best learn the effectiveness."</p>
        </div>
        
        <div class="example-box" style="margin-top: 20px;">
          <p><strong>Your Bonus:</strong> You will receive a bonus of up to <strong>${CONFIG.bonus_max}</strong>, based on how closely your effectiveness estimates after each round match the true treatment effectiveness.</p>
          <p style="margin-top: 10px;">The more accurate your guesses, the higher your bonus!</p>
          <p style="margin-top: 10px;"><strong>Try to be as accurate as possible!</strong></p>
        </div>
        
        <p style="margin-top: 20px; padding: 12px; background: #fff3e0; border-left: 4px solid #FF9800; font-size: 0.95em;">
          <strong>Important:</strong> To submit your response each round, you must click or drag each slider — if you want to keep the same value, you can simply click it or move it but leave it at the original place.
        </p>
      </div>`,
    ];
  },
  show_clickable_nav: true,
  button_label_previous: "Back",
  button_label_next: "Continue",
  on_finish: updateProgress,
};

// NATURALISTIC condition - single page (no navigation needed)
const listenerIntroNaturalistic = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    return `
    <div class="listener-intro-container">
      <h2>Your Role: Listener</h2>
      <p>You have been assigned to be a <strong>listener</strong>.</p>
      <p>You will be paired with another participant who has been assigned the role of <strong>speaker</strong>.</p>
      <p>You will communicate with this speaker regarding <strong>${CONFIG.n_rounds}</strong> clinical trial results for a new treatment.</p>
      <p>For each round, the speaker will see a new clinical trial result for this treatment and send you a description. <strong>You will NOT see the results</strong> — only the speaker's description.</p>
      <p style="margin-top: 15px;">After receiving each description, you will estimate the treatment's effectiveness (0% to 100%).</p>
      
      <p style="margin-top: 15px; color: #666;"><em>Note: Each round, the description corresponds to a new trial for this treatment. Your goal is to incrementally figure out how effective this treatment truly is through the ${CONFIG.n_rounds} interactions.</em></p>
      
      <div class="example-box" style="margin-top: 20px;">
        <p><strong>Bonus:</strong> You will receive a bonus of up to <strong>${CONFIG.bonus_max}</strong>, based on how closely your effectiveness estimates after each round match the true treatment effectiveness.</p>
        <p style="margin-top: 10px;"><strong>Try to be as accurate as possible!</strong></p>
      </div>
      
      <p style="margin-top: 20px; padding: 12px; background: #fff3e0; border-left: 4px solid #FF9800; font-size: 0.95em;">
        <strong>Important:</strong> To submit your response each round, you must click or drag each slider — if you want to keep the same value, you can simply click it or move it but leave it at the original place.
      </p>
    </div>
  `;
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// Conditional wrappers
const listenerIntroVigilantCond = {
  timeline: [listenerIntroVigilantPages],
  conditional_function: function () {
    return experimentState.listenerBeliefCondition === "vigilant";
  },
};

const listenerIntroCredulousCond = {
  timeline: [listenerIntroCredulousPagesObj],
  conditional_function: function () {
    return experimentState.listenerBeliefCondition === "credulous";
  },
};

const listenerIntroNaturalisticCond = {
  timeline: [listenerIntroNaturalistic],
  conditional_function: function () {
    return experimentState.listenerBeliefCondition === "naturalistic";
  },
};

// Distribution builder explanation (shown to all conditions)
const distributionBuilderExplanation = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="listener-intro-container">
      <h2>How to Report Your Estimates</h2>
      
      <p>You will use a <strong>distribution builder</strong> to express your beliefs. You have <strong>20 tokens</strong> to distribute across the possible options.</p>
      
      <h3 style="margin-top: 25px;">How it works:</h3>
      <div style="text-align: left; max-width: 550px; margin: 15px auto;">
        <p style="margin-bottom: 10px;">• Click on a column to add tokens, or use the +/− buttons</p>
        <p style="margin-bottom: 10px;">• Assign more tokens to options you think are more likely</p>
        <p style="margin-bottom: 10px;">• You must assign all 20 tokens before continuing</p>
      </div>
      
      <h3 style="margin-top: 25px;">Examples:</h3>
      
      <div class="example-box">
        <p><strong>If you are certain the effectiveness is 80%:</strong></p>
        <p style="color: #666; margin: 10px 0;">Put all 20 tokens in the "80%" column</p>
        <div class="demo-builder" style="display: flex; justify-content: center; gap: 4px; margin-top: 10px;">
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>0%</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>10%</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>20%</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>30%</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>40%</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>50%</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>60%</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>70%</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 100px; background: #4CAF50;"></div></div><span>80%</span><span class="demo-count">20</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>90%</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>100%</span></div>
        </div>
      </div>
      
      <div class="example-box" style="margin-top: 15px;">
        <p><strong>If you think it's equally likely to be anywhere from 0% to 100%:</strong></p>
        <p style="color: #666; margin: 10px 0;">Spread tokens roughly evenly (about 2 per column)</p>
        <div class="demo-builder" style="display: flex; justify-content: center; gap: 4px; margin-top: 10px;">
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 10px; background: #2196F3;"></div></div><span>0%</span><span class="demo-count">2</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 10px; background: #2196F3;"></div></div><span>10%</span><span class="demo-count">2</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 10px; background: #2196F3;"></div></div><span>20%</span><span class="demo-count">2</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 10px; background: #2196F3;"></div></div><span>30%</span><span class="demo-count">2</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 10px; background: #2196F3;"></div></div><span>40%</span><span class="demo-count">2</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 10px; background: #2196F3;"></div></div><span>50%</span><span class="demo-count">2</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 10px; background: #2196F3;"></div></div><span>60%</span><span class="demo-count">2</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 10px; background: #2196F3;"></div></div><span>70%</span><span class="demo-count">2</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 10px; background: #2196F3;"></div></div><span>80%</span><span class="demo-count">2</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 5px; background: #2196F3;"></div></div><span>90%</span><span class="demo-count">1</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 5px; background: #2196F3;"></div></div><span>100%</span><span class="demo-count">1</span></div>
        </div>
      </div>
      
      <div class="example-box" style="margin-top: 15px;">
        <p><strong>If you think it's probably around 50-70% but not certain:</strong></p>
        <p style="color: #666; margin: 10px 0;">Put most tokens in 50%, 60%, and 70% columns</p>
        <div class="demo-builder" style="display: flex; justify-content: center; gap: 4px; margin-top: 10px;">
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>0%</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>10%</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>20%</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 5px; background: #FF9800;"></div></div><span>30%</span><span class="demo-count">1</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 15px; background: #FF9800;"></div></div><span>40%</span><span class="demo-count">3</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 30px; background: #FF9800;"></div></div><span>50%</span><span class="demo-count">6</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 25px; background: #FF9800;"></div></div><span>60%</span><span class="demo-count">5</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 20px; background: #FF9800;"></div></div><span>70%</span><span class="demo-count">4</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 5px; background: #FF9800;"></div></div><span>80%</span><span class="demo-count">1</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>90%</span></div>
          <div class="demo-col"><div class="demo-bar-container"><div class="demo-bar" style="height: 2px;"></div></div><span>100%</span></div>
        </div>
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
      prompt:
        "<strong>Are the descriptions you receive from the speaker true or false?</strong>",
      name: "truth_check",
      options: [
        "The descriptions are always TRUE",
        "The descriptions might be TRUE or FALSE",
        "The descriptions are always FALSE",
      ],
      required: true,
    },
  ],
  data: { task: "truth_comprehension" },
  on_finish: function (data) {
    data.truth_check_correct =
      data.response.truth_check === "The descriptions are always TRUE";
    updateProgress();
  },
};

const truthComprehensionFeedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data
      .get()
      .filter({ task: "truth_comprehension" })
      .last(1)
      .values()[0];
    if (data.truth_check_correct) {
      return `<div class="comprehension-container">
        <h2 style="color: #4CAF50;">✓ Correct!</h2>
        <p>All descriptions you receive from the speaker are <strong>TRUE</strong>.</p>
        <p style="margin-top: 15px;">The speaker can only choose from descriptions that are true for the trial result they see.</p>
        <p style="margin-top: 20px;">You're now ready to be paired with a speaker!</p>
      </div>`;
    } else {
      return `<div class="comprehension-container">
        <h2 style="color: #f44336;">✗ Incorrect</h2>
        <p>Actually, all descriptions you receive from the speaker are <strong>TRUE</strong>.</p>
        <p style="margin-top: 15px;">The speaker can only choose from descriptions that are true for the trial result they see. Please remember this as you make your estimates!</p>
        <p style="margin-top: 20px;">You're now ready to be paired with a speaker!</p>
      </div>`;
    }
  },
  choices: ["Find a Speaker"],
  on_finish: updateProgress,
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
  trial_duration: () =>
    randomInt(CONFIG.pairing_wait_min, CONFIG.pairing_wait_max),
  on_finish: updateProgress,
};

// Speaker matched confirmation - varies by condition
const speakerMatchedVigilant = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="listener-intro-container" style="text-align: center;">
      <h2 style="color: #4CAF50;">✓ Speaker Matched</h2>
      <p>You are now connected with a speaker with an unknown goal.</p>
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
  conditional_function: function () {
    return experimentState.listenerBeliefCondition === "vigilant";
  },
};

const speakerMatchedCredulousCond = {
  timeline: [speakerMatchedCredulous],
  conditional_function: function () {
    return experimentState.listenerBeliefCondition === "credulous";
  },
};

const speakerMatchedNaturalisticCond = {
  timeline: [speakerMatchedNaturalistic],
  conditional_function: function () {
    return experimentState.listenerBeliefCondition === "naturalistic";
  },
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
        effDist,
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

      window.effBuilderInstance = initDistributionBuilder(
        "effectiveness",
        checkCanSubmit,
      );

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
          utterance_text: formatUtterance(experimentState.currentUtterance)
            .text,
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
      const instructions =
        "Based on the descriptions so far, how likely do you think each type is?";

      const speakerTypeBuilder = createDistributionBuilderHTML(
        "speaker_type",
        title,
        spkDist,
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

      window.spkBuilderInstance = initDistributionBuilder(
        "speaker_type",
        checkCanSubmit,
      );

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
          utterance_text: formatUtterance(experimentState.currentUtterance)
            .text,
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

// Point estimate page - effectiveness only (shown for ALL conditions)
// Uses sliders for effectiveness only (confidence removed)
function createPointEstimatePage(roundNum) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const utterance = experimentState.currentUtterance;
      const formattedUtterance = formatUtterance(utterance);

      // Get previous value or default
      const prevEffectiveness =
        experimentState.lastEffectivenessPointEstimate ?? 50;

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
            <div class="point-estimate-section">
              <h4>How effective do you think this treatment is?</h4>
              <div class="slider-container" style="margin: 20px auto;">
                <div class="slider-wrapper">
                  <span class="slider-label left">0%</span>
                  <input type="range" id="effectiveness-slider" min="0" max="100" value="${prevEffectiveness}" step="5">
                  <span class="slider-label right">100%</span>
                </div>
                <div class="slider-value" id="effectiveness-value">${prevEffectiveness}%</div>
              </div>
            </div>
            
            <button id="submit-btn" class="submit-btn" disabled>Continue</button>
            <p style="margin-top: 10px; font-size: 0.85em; color: #888; text-align: center;">You must click or drag the slider to enable the button.</p>
          </div>
        </div>
      `;
    },
    choices: [],
    data: {
      task: "point_estimate_effectiveness",
      round: roundNum + 1,
    },
    on_load: function () {
      startInactivityTimer();

      const submitBtn = document.getElementById("submit-btn");
      const effectivenessSlider = document.getElementById(
        "effectiveness-slider",
      );
      const effectivenessValue = document.getElementById("effectiveness-value");

      let effectivenessInteracted = false;

      function checkCanSubmit() {
        submitBtn.disabled = !effectivenessInteracted;
      }

      // Effectiveness slider handlers - track interaction (click/touch), not just change
      effectivenessSlider.addEventListener("mousedown", () => {
        effectivenessInteracted = true;
        checkCanSubmit();
      });
      effectivenessSlider.addEventListener("touchstart", () => {
        effectivenessInteracted = true;
        checkCanSubmit();
      });
      effectivenessSlider.addEventListener("input", () => {
        resetInactivityTimer();
        effectivenessValue.textContent = effectivenessSlider.value + "%";
      });

      // Submit handler
      submitBtn.addEventListener("click", () => {
        clearInactivityTimer();

        // Store values for carryover to next round
        experimentState.lastEffectivenessPointEstimate = parseInt(
          effectivenessSlider.value,
        );

        jsPsych.finishTrial({
          task: "point_estimate_effectiveness",
          round: roundNum + 1,
          speaker_condition: experimentState.speakerCondition,
          listener_belief_condition: experimentState.listenerBeliefCondition,
          sequence_idx: experimentState.sequenceIdx,
          measure_order: experimentState.measureOrder,
          utterance_predicate: experimentState.currentUtterance.predicate,
          utterance_quantifier: experimentState.currentUtterance.quantifier,
          utterance_text: formatUtterance(experimentState.currentUtterance)
            .text,
          effectiveness_point_estimate: parseInt(effectivenessSlider.value),
        });
      });
    },
    on_finish: function () {
      clearInactivityTimer();
      updateProgress();
    },
  };
}

// Speaker goal page - VIGILANT condition only
// Separate page asking about speaker type (confidence removed)
// Note: This function is kept for reference but vigilant now uses combined page
function createSpeakerGoalPage(roundNum) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const utterance = experimentState.currentUtterance;
      const formattedUtterance = formatUtterance(utterance);

      // Speaker type options start unselected (all grey) each round

      return `
        <div class="trial-container">
          <div class="trial-header">
            <span class="round-indicator">Round ${roundNum + 1} of ${CONFIG.n_rounds} — Speaker Goal Estimate</span>
          </div>
          
          <div class="utterance-display" style="margin-bottom: 25px;">
            <div class="label">The speaker described the trial result as:</div>
            <div class="utterance-text">${formattedUtterance.displayText}</div>
          </div>
          
          <div class="response-section">
            <div class="point-estimate-section">
              <h4>What type of speaker do you think this is?</h4>
              <div class="point-estimate-options speaker-favor-options" style="margin: 20px auto;">
                <label class="point-estimate-option favor-option">
                  <input type="radio" name="speaker_type" value="anti">
                  <span>👎 Skeptic</span>
                </label>
                <label class="point-estimate-option favor-option">
                  <input type="radio" name="speaker_type" value="neutral">
                  <span>🔬 Scientist</span>
                </label>
                <label class="point-estimate-option favor-option">
                  <input type="radio" name="speaker_type" value="pro">
                  <span>👍 Promoter</span>
                </label>
              </div>
            </div>
            
            <button id="submit-btn" class="submit-btn" disabled>Continue</button>
            <p style="margin-top: 10px; font-size: 0.85em; color: #888; text-align: center;">You must select a speaker type to enable the button.</p>
          </div>
        </div>
      `;
    },
    choices: [],
    data: {
      task: "point_estimate_speaker_goal",
      round: roundNum + 1,
    },
    on_load: function () {
      startInactivityTimer();

      const submitBtn = document.getElementById("submit-btn");
      const speakerRadios = document.querySelectorAll(
        'input[name="speaker_type"]',
      );

      let speakerTypeInteracted = false;

      function checkCanSubmit() {
        submitBtn.disabled = !speakerTypeInteracted;
      }

      // Speaker type radio handlers - track clicks on radio options
      speakerRadios.forEach((radio) => {
        radio.addEventListener("click", () => {
          resetInactivityTimer();
          speakerTypeInteracted = true;
          checkCanSubmit();
        });
      });

      // Submit handler
      submitBtn.addEventListener("click", () => {
        clearInactivityTimer();

        const selectedSpeaker = document.querySelector(
          'input[name="speaker_type"]:checked',
        ).value;

        // Store values for carryover to next round
        experimentState.lastSpeakerTypeEstimate = selectedSpeaker;

        jsPsych.finishTrial({
          task: "point_estimate_speaker_goal",
          round: roundNum + 1,
          speaker_condition: experimentState.speakerCondition,
          listener_belief_condition: experimentState.listenerBeliefCondition,
          sequence_idx: experimentState.sequenceIdx,
          measure_order: experimentState.measureOrder,
          utterance_predicate: experimentState.currentUtterance.predicate,
          utterance_quantifier: experimentState.currentUtterance.quantifier,
          utterance_text: formatUtterance(experimentState.currentUtterance)
            .text,
          speaker_type_point_estimate: selectedSpeaker,
        });
      });
    },
    on_finish: function () {
      clearInactivityTimer();
      updateProgress();
    },
  };
}

// Combined page for VIGILANT condition - both effectiveness and speaker type on same page
// Order is randomized between participants but consistent within participant
function createCombinedMeasurePage(roundNum) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const utterance = experimentState.currentUtterance;
      const formattedUtterance = formatUtterance(utterance);

      // Get previous value for effectiveness carryover
      const prevEffectiveness =
        experimentState.lastEffectivenessPointEstimate ?? 50;

      // Speaker type options start unselected (all grey) each round

      // Determine order based on measureOrder (randomized between participants)
      const effectivenessFirst =
        experimentState.measureOrder === "effectiveness_first";

      const effectivenessSection = `
        <div class="measure-block" style="margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #ddd;">
          <h4>How effective do you think this treatment is?</h4>
          <div class="slider-container" style="margin: 20px auto;">
            <div class="slider-wrapper">
              <span class="slider-label left">0%</span>
              <input type="range" id="effectiveness-slider" min="0" max="100" value="${prevEffectiveness}" step="5">
              <span class="slider-label right">100%</span>
            </div>
            <div class="slider-value" id="effectiveness-value">${prevEffectiveness}%</div>
          </div>
        </div>
      `;

      const speakerTypeSection = `
        <div class="measure-block">
          <h4>What type of speaker do you think this is?</h4>
          <div class="point-estimate-options speaker-favor-options" style="margin: 20px auto;">
            <label class="point-estimate-option favor-option">
              <input type="radio" name="speaker_type" value="anti">
              <span>👎 Skeptic</span>
            </label>
            <label class="point-estimate-option favor-option">
              <input type="radio" name="speaker_type" value="neutral">
              <span>🔬 Scientist</span>
            </label>
            <label class="point-estimate-option favor-option">
              <input type="radio" name="speaker_type" value="pro">
              <span>👍 Promoter</span>
            </label>
          </div>
        </div>
      `;

      const measures = effectivenessFirst
        ? effectivenessSection + speakerTypeSection
        : speakerTypeSection + effectivenessSection;

      return `
        <div class="trial-container">
          <div class="trial-header">
            <span class="round-indicator">Round ${roundNum + 1} of ${CONFIG.n_rounds}</span>
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
            <div class="point-estimate-section">
              ${measures}
            </div>
            
            <button id="submit-btn" class="submit-btn" disabled>Submit Response</button>
            <p style="margin-top: 10px; font-size: 0.85em; color: #888; text-align: center;">You must interact with the slider and select a speaker type to enable the button.</p>
          </div>
        </div>
      `;
    },
    choices: [],
    data: {
      task: "combined_measure",
      round: roundNum + 1,
    },
    on_load: function () {
      startInactivityTimer();

      const submitBtn = document.getElementById("submit-btn");
      const effectivenessSlider = document.getElementById(
        "effectiveness-slider",
      );
      const effectivenessValue = document.getElementById("effectiveness-value");
      const speakerRadios = document.querySelectorAll(
        'input[name="speaker_type"]',
      );

      let effectivenessInteracted = false;
      let speakerTypeInteracted = false;

      function checkCanSubmit() {
        submitBtn.disabled = !(
          effectivenessInteracted && speakerTypeInteracted
        );
      }

      // Effectiveness slider handlers
      effectivenessSlider.addEventListener("mousedown", () => {
        effectivenessInteracted = true;
        checkCanSubmit();
      });
      effectivenessSlider.addEventListener("touchstart", () => {
        effectivenessInteracted = true;
        checkCanSubmit();
      });
      effectivenessSlider.addEventListener("input", () => {
        resetInactivityTimer();
        effectivenessValue.textContent = effectivenessSlider.value + "%";
      });

      // Speaker type radio handlers
      speakerRadios.forEach((radio) => {
        radio.addEventListener("click", () => {
          resetInactivityTimer();
          speakerTypeInteracted = true;
          checkCanSubmit();
        });
      });

      // Submit handler
      submitBtn.addEventListener("click", () => {
        clearInactivityTimer();

        const selectedSpeaker = document.querySelector(
          'input[name="speaker_type"]:checked',
        ).value;

        // Store values for carryover
        experimentState.lastEffectivenessPointEstimate = parseInt(
          effectivenessSlider.value,
        );
        experimentState.lastSpeakerTypeEstimate = selectedSpeaker;

        jsPsych.finishTrial({
          task: "combined_measure",
          round: roundNum + 1,
          speaker_condition: experimentState.speakerCondition,
          listener_belief_condition: experimentState.listenerBeliefCondition,
          sequence_idx: experimentState.sequenceIdx,
          measure_order: experimentState.measureOrder,
          utterance_predicate: experimentState.currentUtterance.predicate,
          utterance_quantifier: experimentState.currentUtterance.quantifier,
          utterance_text: formatUtterance(experimentState.currentUtterance)
            .text,
          effectiveness_point_estimate: parseInt(effectivenessSlider.value),
          speaker_type_point_estimate: selectedSpeaker,
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
        <h2>Speaker is receiving next trial result and responding...</h2>
        <div class="spinner"></div>
        <p>Waiting for description...</p>
      </div>
    `,
    choices: "NO_KEYS",
    trial_duration: () =>
      randomInt(CONFIG.speaker_response_min, CONFIG.speaker_response_max),
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
      
      <div class="slider-container" style="max-width: 500px; margin: 30px auto;">
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
      
      <div class="slider-container" style="max-width: 500px; margin: 30px auto;">
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
      
      <div class="slider-container" style="max-width: 500px; margin: 30px auto;">
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
  conditional_function: function () {
    return experimentState.listenerBeliefCondition === "vigilant";
  },
};

const competenceRatingCredulousCond = {
  timeline: [competenceRatingCredulous],
  conditional_function: function () {
    return experimentState.listenerBeliefCondition === "credulous";
  },
};

const competenceRatingNaturalisticCond = {
  timeline: [competenceRatingNaturalistic],
  conditional_function: function () {
    return experimentState.listenerBeliefCondition === "naturalistic";
  },
};

const openEndedQuestionsVigilant = {
  type: jsPsychSurveyText,
  preamble: `<div class="feedback-container"><h2>Your Thoughts</h2></div>`,
  questions: [
    {
      prompt:
        "How did you decide what type of speaker you were paired with? What aspects of their descriptions influenced your judgment?",
      name: "speaker_evaluation_strategy",
      rows: 5,
      required: false,
    },
    {
      prompt:
        "Do you have any other comments or feedback about this experiment? Was anything confusing?",
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
      prompt:
        "How did you use the speaker's descriptions to estimate the treatment's effectiveness?",
      name: "estimation_strategy",
      rows: 5,
      required: false,
    },
    {
      prompt:
        "Do you have any other comments or feedback about this experiment? Was anything confusing?",
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
  conditional_function: function () {
    return experimentState.listenerBeliefCondition === "vigilant";
  },
};

// Persuasive speaker reveal page (shown to vigilant condition with persuasive speakers)
const persuasiveSpeakerReveal = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const speakerCondition = experimentState.speakerCondition;
    const isProTreatment = speakerCondition === "pers_plus";

    const goalDescription = isProTreatment
      ? "make the treatment sound <strong>good</strong> (Pro-treatment / Promoter)"
      : "make the treatment sound <strong>bad</strong> (Anti-treatment / Skeptic)";

    const icon = isProTreatment ? "👍" : "👎";
    const goalColor = isProTreatment ? "#4CAF50" : "#f44336";

    return `
      <div class="feedback-container" style="max-width: 700px;">
        <h2>About Your Speaker</h2>
        
        <div style="text-align: center; margin: 25px 0;">
          <span style="font-size: 3em;">${icon}</span>
        </div>
        
        <p style="text-align: center; font-size: 1.1em;">
          The speaker you were paired with was a <strong style="color: ${goalColor};">Persuasive Speaker</strong> whose goal was to ${goalDescription}.
        </p>
        
        <div class="example-box" style="margin-top: 25px;">
          <h3 style="margin-top: 0;">How Persuasive Speakers Communicate</h3>
          <p>Persuasive speakers strategically choose which true descriptions to give. They often:</p>
          <ul style="line-height: 1.8;">
            <li>Use <strong>vaguer language</strong> like "<em>some</em>" rather than more specific terms like "<em>most</em>" or "<em>all</em>"</li>
            <li>Frame the same data differently depending on their goal — for example, saying "effective for <em>some</em>" vs "ineffective for <em>some</em>" for the same trial</li>
            <li>Avoid descriptions that would clearly contradict their persuasive goal</li>
          </ul>
          <p style="margin-top: 15px; color: #666;">
            <em>Note: All descriptions were still factually true — the speaker just chose which true description to share based on their goal.</em>
          </p>
        </div>
      </div>
    `;
  },
  choices: ["Continue"],
  data: { task: "persuasive_speaker_reveal" },
  on_finish: updateProgress,
};

const persuasiveSpeakerRevealCond = {
  timeline: [persuasiveSpeakerReveal],
  conditional_function: function () {
    // Show only for vigilant condition AND persuasive speakers (pers_plus or pers_minus)
    return (
      experimentState.listenerBeliefCondition === "vigilant" &&
      (experimentState.speakerCondition === "pers_plus" ||
        experimentState.speakerCondition === "pers_minus")
    );
  },
};

const openEndedQuestionsOtherCond = {
  timeline: [openEndedQuestionsOther],
  conditional_function: function () {
    return (
      experimentState.listenerBeliefCondition === "credulous" ||
      experimentState.listenerBeliefCondition === "naturalistic"
    );
  },
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
        ${
          isProlific
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

// Instructions (3 pages: Clinical Trial, Treatment Effectiveness, Descriptions)
timeline.push(instructions);

// Comprehension checks for SOME and MOST definitions
timeline.push(comp1_some);
timeline.push(comp1_some_feedback);
timeline.push(comp1_most);
timeline.push(comp1_most_feedback);

// Single True/False check (ineffective for some) - moved here after SOME/MOST definitions
timeline.push(comp2_trial);
timeline.push(comp2_feedback);

// Show "Which Descriptions Are True?" explanation page
timeline.push(whichDescriptionsTrue);

// Multiple descriptions can be true for one result
timeline.push(comp_multipleDescriptions);
timeline.push(comp_multipleDescriptions_feedback);

// Show "Multiple Results, One Description" explanation page
timeline.push(multipleResultsOneTruth);

// Which trials make statement TRUE (comp3)
timeline.push(comp3_trial);
timeline.push(comp3_feedback);

// Get condition from DataPipe for weighted balanced assignment
timeline.push(getDataPipeCondition);

// Assign conditions BEFORE showing listener intro (uses DataPipe weighted mapping)
timeline.push(assignConditions);

// Listener introduction (condition-specific, with navigation for multi-page conditions)
timeline.push(listenerIntroVigilantCond);
timeline.push(listenerIntroCredulousCond);
timeline.push(listenerIntroNaturalisticCond);

// Pairing wait and matched screens
timeline.push(pairingWait);
timeline.push(speakerMatchedVigilantCond);
timeline.push(speakerMatchedCredulousCond);
timeline.push(speakerMatchedNaturalisticCond);

// Listener trials with wait screens
// Use a helper function to properly capture round number in closures
function addRoundToTimeline(roundNum) {
  // Wait for speaker response (including before first round)
  if (roundNum === 0) {
    // Special message for first round
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        <div class="waiting-container">
          <h2>Speaker is receiving the first trial result and responding...</h2>
          <div class="spinner"></div>
          <p>Waiting for description...</p>
        </div>
      `,
      choices: "NO_KEYS",
      trial_duration: () =>
        randomInt(CONFIG.speaker_response_min, CONFIG.speaker_response_max),
    });
  } else {
    timeline.push(createSpeakerWait(roundNum));
  }

  // Store the current utterance at the start of each round
  timeline.push({
    type: jsPsychCallFunction,
    func: function () {
      experimentState.currentRound = roundNum;
      experimentState.currentUtterance =
        experimentState.utteranceSequence[roundNum];
    },
  });

  // For VIGILANT condition: combined page with both effectiveness and speaker type
  timeline.push({
    timeline: [createCombinedMeasurePage(roundNum)],
    conditional_function: function () {
      return experimentState.listenerBeliefCondition === "vigilant";
    },
  });

  // For NON-VIGILANT conditions (credulous, naturalistic): effectiveness only page
  timeline.push({
    timeline: [createPointEstimatePage(roundNum)],
    conditional_function: function () {
      return experimentState.listenerBeliefCondition !== "vigilant";
    },
  });
}

// Add all rounds to timeline
for (let r = 0; r < CONFIG.n_rounds; r++) {
  addRoundToTimeline(r);
}

// ============================================================================
// ATTENTION CHECK ROUND (Round 6)
// ============================================================================

// Wait screen before attention check
timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <div class="waiting-container">
      <h2>Speaker is receiving next trial result and responding...</h2>
      <div class="spinner"></div>
      <p>Waiting for description...</p>
    </div>
  `,
  choices: "NO_KEYS",
  trial_duration: () =>
    randomInt(CONFIG.speaker_response_min, CONFIG.speaker_response_max),
});

// Attention check using point estimate sliders
// Adapts based on condition: vigilant has both measures, others only have effectiveness
const attentionCheckPage = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const isVigilant = experimentState.listenerBeliefCondition === "vigilant";

    if (isVigilant) {
      // Vigilant condition: both effectiveness and speaker type
      // Use the same order as determined by measureOrder for the main trials
      const effectivenessFirst =
        experimentState.measureOrder === "effectiveness_first";

      const effectivenessSection = `
        <div class="measure-block" style="margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #ddd;">
          <h4>Effectiveness:</h4>
          <div class="slider-container" style="margin: 20px auto;">
            <div class="slider-wrapper">
              <span class="slider-label left">0%</span>
              <input type="range" id="effectiveness-slider" min="0" max="100" value="50" step="5">
              <span class="slider-label right">100%</span>
            </div>
            <div class="slider-value" id="effectiveness-value">50%</div>
          </div>
        </div>
      `;

      const speakerTypeSection = `
        <div class="measure-block">
          <h4>Speaker type:</h4>
          <div class="point-estimate-options speaker-favor-options" style="margin: 20px auto;">
            <label class="point-estimate-option favor-option">
              <input type="radio" name="speaker_type" value="anti">
              <span>👎 Skeptic</span>
            </label>
            <label class="point-estimate-option favor-option">
              <input type="radio" name="speaker_type" value="neutral">
              <span>🔬 Scientist</span>
            </label>
            <label class="point-estimate-option favor-option">
              <input type="radio" name="speaker_type" value="pro">
              <span>👍 Promoter</span>
            </label>
          </div>
        </div>
      `;

      const measures = effectivenessFirst
        ? effectivenessSection + speakerTypeSection
        : speakerTypeSection + effectivenessSection;

      return `
        <div class="trial-container">
          <div class="trial-header">
            <span class="round-indicator">Round ${CONFIG.n_rounds + 1} of ${CONFIG.n_rounds + 1}</span>
          </div>
          
          <div class="utterance-display" style="margin-bottom: 25px;">
            <div class="label" style="font-weight: bold; color: #f44336;">Attention Check</div>
            <div class="utterance-text" style="font-size: 1.1em;">
              Please drag the effectiveness to <strong>100%</strong> and select <strong>Skeptic</strong>.
            </div>
          </div>
          
          <div class="response-section">
            <div class="point-estimate-section">
              ${measures}
            </div>
            
            <button id="submit-btn" class="submit-btn" disabled>Submit Response</button>
          </div>
        </div>
      `;
    } else {
      // Credulous/Naturalistic conditions: effectiveness only
      return `
        <div class="trial-container">
          <div class="trial-header">
            <span class="round-indicator">Round ${CONFIG.n_rounds + 1} of ${CONFIG.n_rounds + 1}</span>
          </div>
          
          <div class="utterance-display" style="margin-bottom: 25px;">
            <div class="label" style="font-weight: bold; color: #f44336;">Attention Check</div>
            <div class="utterance-text" style="font-size: 1.1em;">
              Please drag the effectiveness to <strong>100%</strong>.
            </div>
          </div>
          
          <div class="response-section">
            <div class="point-estimate-section">
              <h4>Effectiveness:</h4>
              <div class="slider-container" style="margin: 20px auto;">
                <div class="slider-wrapper">
                  <span class="slider-label left">0%</span>
                  <input type="range" id="effectiveness-slider" min="0" max="100" value="50" step="5">
                  <span class="slider-label right">100%</span>
                </div>
                <div class="slider-value" id="effectiveness-value">50%</div>
              </div>
            </div>
            
            <button id="submit-btn" class="submit-btn" disabled>Submit Response</button>
          </div>
        </div>
      `;
    }
  },
  choices: [],
  data: {
    task: "attention_check",
    round: CONFIG.n_rounds + 1,
  },
  on_load: function () {
    startInactivityTimer();

    const isVigilant = experimentState.listenerBeliefCondition === "vigilant";
    const submitBtn = document.getElementById("submit-btn");
    const effectivenessSlider = document.getElementById("effectiveness-slider");
    const effectivenessValue = document.getElementById("effectiveness-value");

    let effectivenessInteracted = false;
    let speakerTypeInteracted = !isVigilant; // Auto-true for non-vigilant conditions

    function checkCanSubmit() {
      submitBtn.disabled = !(effectivenessInteracted && speakerTypeInteracted);
    }

    // Effectiveness slider handlers - track interaction
    effectivenessSlider.addEventListener("mousedown", () => {
      effectivenessInteracted = true;
      checkCanSubmit();
    });
    effectivenessSlider.addEventListener("touchstart", () => {
      effectivenessInteracted = true;
      checkCanSubmit();
    });
    effectivenessSlider.addEventListener("input", () => {
      resetInactivityTimer();
      effectivenessValue.textContent = effectivenessSlider.value + "%";
    });

    // Speaker type radio handlers (only for vigilant)
    if (isVigilant) {
      const speakerRadios = document.querySelectorAll(
        'input[name="speaker_type"]',
      );
      speakerRadios.forEach((radio) => {
        radio.addEventListener("click", () => {
          resetInactivityTimer();
          speakerTypeInteracted = true;
          checkCanSubmit();
        });
      });
    }

    // Submit handler
    submitBtn.addEventListener("click", () => {
      clearInactivityTimer();

      const effValue = parseInt(effectivenessSlider.value);

      let attentionCheckPassed;
      let selectedSpeaker = null;

      if (isVigilant) {
        selectedSpeaker = document.querySelector(
          'input[name="speaker_type"]:checked',
        ).value;
        // Vigilant: effectiveness = 100 AND speaker = anti/Skeptic
        attentionCheckPassed = effValue === 100 && selectedSpeaker === "anti";
      } else {
        // Non-vigilant: effectiveness = 100 only
        attentionCheckPassed = effValue === 100;
      }

      jsPsych.finishTrial({
        task: "attention_check",
        round: CONFIG.n_rounds + 1,
        speaker_condition: experimentState.speakerCondition,
        listener_belief_condition: experimentState.listenerBeliefCondition,
        sequence_idx: experimentState.sequenceIdx,
        measure_order: experimentState.measureOrder,
        effectiveness_point_estimate: effValue,
        speaker_type_point_estimate: selectedSpeaker,
        attention_check_passed: attentionCheckPassed,
      });
    });
  },
  on_finish: function () {
    clearInactivityTimer();
    updateProgress();
  },
};

timeline.push(attentionCheckPage);

// Check attention check result and terminate if failed
timeline.push({
  type: jsPsychCallFunction,
  func: function () {
    const attentionData = jsPsych.data
      .get()
      .filter({ task: "attention_check" })
      .last(1)
      .values()[0];
    if (attentionData && !attentionData.attention_check_passed) {
      // Failed attention check - terminate early
      saveDataAndEndExperiment("attention_check_failed");
    }
  },
});

// Final measures (conditional based on condition)
timeline.push(competenceRatingVigilantCond);
timeline.push(competenceRatingCredulousCond);
timeline.push(competenceRatingNaturalisticCond);
timeline.push(persuasiveSpeakerRevealCond);
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
