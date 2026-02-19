/**
 * experiment.js — Study 1: Known Goal Discounting
 *
 * 3 (Goal) × 2 (Grounding) fully between-subjects design.
 *   Factor 1 – Goal: informative | pers_plus | pers_minus
 *   Factor 2 – Grounding: identification (utterance-space) | production (speaker task)
 *
 * Block 1 — Identification: identify all permitted utterances for each observation.
 *           Production: produce utterances under assigned goal (speaker task).
 * Block 2 — Receive pre-scripted utterances from a speaker with the known goal.
 *           Predictive posterior measured each round.
 */

// ============================================================================
// 1. PROLIFIC INTEGRATION
// ============================================================================

const urlParams = new URLSearchParams(window.location.search);
const prolificPID = urlParams.get("PROLIFIC_PID") || null;
const studyID = urlParams.get("STUDY_ID") || null;
const sessionID = urlParams.get("SESSION_ID") || null;

function generateSubjectId() {
  if (prolificPID) return prolificPID;
  return (
    "test_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now()
  );
}

const subjectId = generateSubjectId();

const PROLIFIC_COMPLETION_CODE = "C14LE684"; // Successful completion
const PROLIFIC_SCREENING_CODE = "CERAK4BX"; // Replace with Prolific screening/no-code value

// ============================================================================
// 2. JSPSYCH INITIALIZATION
// ============================================================================

const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: false,
  on_finish: function () {
    if (prolificPID && !experimentState.terminatedEarly) {
      window.location.href = `https://app.prolific.com/submissions/complete?cc=${PROLIFIC_COMPLETION_CODE}`;
    }
  },
});

jsPsych.data.addProperties({
  subject_id: subjectId,
  prolific_pid: prolificPID,
  study_id: studyID,
  session_id: sessionID,
  experiment_version: "1.0.0",
  experiment_name: "known_goal_discounting",
  start_time: new Date().toISOString(),
});

// ============================================================================
// 2b. COPY/PASTE PREVENTION
// ============================================================================

(function () {
  // Prevent copying, cutting, and context menu on the document
  // but allow normal interaction with text inputs and textareas
  document.addEventListener("copy", function (e) {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  });
  document.addEventListener("cut", function (e) {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  });
  document.addEventListener("contextmenu", function (e) {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  });
  // Disable text selection via CSS
  document.documentElement.style.userSelect = "none";
  document.documentElement.style.webkitUserSelect = "none";
  document.documentElement.style.msUserSelect = "none";

  // Re-enable selection inside text inputs and textareas
  const style = document.createElement("style");
  style.textContent = `
    input, textarea {
      -webkit-user-select: text !important;
      user-select: text !important;
    }
  `;
  document.head.appendChild(style);
})();

// ============================================================================
// 3. EXPERIMENT STATE
// ============================================================================

const experimentState = {
  // Condition assignments
  goalCondition: null, // "informative" | "pers_plus" | "pers_minus"
  groundingCondition: null, // "identification" | "production"
  _datapipeCondition: null, // 0–5, assigned by DataPipe

  // Sequences (selected at assignment time)
  block1Sequence: [],
  block1SequenceIdx: 0,
  block2Sequence: [],
  block2SequenceIdx: 0,

  // Round counters (used by loop_function)
  block1Round: 0,
  block2Round: 0,

  // Current-round scratch (written by trial on_load, read by feedback)
  currentStimulus: null, // { path, variant, positions }

  // Comprehension check scratch
  comp3a_options: [],
  comp3b_options: [],

  // Identification round scores (for bonus calculation)
  idRoundScores: [],

  // Block 2 image order counterbalance (true = 5→0, false = 0→5)
  imageOrderReversed: false,

  // Timer state
  inactivityTimer: null,
  inactivityStartTime: null,
  warning1Shown: false,
  warning2Shown: false,

  // Termination flag
  terminatedEarly: false,

  // Progress
  completedSteps: 0,
  totalSteps: 30, // recalculated after condition assignment
};

// ============================================================================
// 4. PROGRESS TRACKING
// ============================================================================

function updateProgress() {
  experimentState.completedSteps++;
  const progress = Math.min(
    experimentState.completedSteps / experimentState.totalSteps,
    1,
  );
  jsPsych.setProgressBar(progress);
}

// ============================================================================
// 5. INACTIVITY TIMER SYSTEM
// ============================================================================

function showInactivityWarning(message, isUrgent) {
  removeInactivityWarning();

  const overlay = document.createElement("div");
  overlay.id = "inactivity-warning-overlay";
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.7);display:flex;justify-content:center;
    align-items:center;z-index:10000;`;

  const box = document.createElement("div");
  box.style.cssText = `
    background:white;padding:30px 50px;border-radius:12px;text-align:center;
    max-width:500px;box-shadow:0 4px 20px rgba(0,0,0,0.3);
    border:4px solid ${isUrgent ? "#f44336" : "#ff9800"};`;

  box.innerHTML = `
    <h2 style="color:${isUrgent ? "#f44336" : "#ff9800"};margin-bottom:15px;">
      ⚠️ ${isUrgent ? "Urgent: " : ""}Please Respond
    </h2>
    <p style="font-size:1.1em;margin-bottom:20px;">${message}</p>
    <button id="dismiss-warning-btn" class="jspsych-btn"
      style="background:${isUrgent ? "#f44336" : "#ff9800"};color:white;padding:12px 30px;">
      I'm here – Continue
    </button>`;

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  document
    .getElementById("dismiss-warning-btn")
    .addEventListener("click", () => removeInactivityWarning());
}

function removeInactivityWarning() {
  const el = document.getElementById("inactivity-warning-overlay");
  if (el) el.remove();
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
// 6. EARLY TERMINATION
// ============================================================================

function getTerminationMessage(reason) {
  const isProlific = !!prolificPID;
  // Use screening code for terminated participants — NOT the completion code
  const redirect = isProlific
    ? `<div style="margin-top:25px;padding:20px;background:#fff3e0;border:2px solid #ff9800;border-radius:8px;text-align:center;">
        <p style="margin:0 0 15px;color:#e65100;"><strong>Click below to return to Prolific:</strong></p>
        <button onclick="window.location.href='https://app.prolific.com/submissions/complete?cc=${PROLIFIC_SCREENING_CODE}'"
          style="padding:12px 30px;font-size:16px;background:#ff9800;color:white;border:none;border-radius:6px;cursor:pointer;">
          Return to Prolific</button></div>`
    : "";

  const messages = {
    inactivity_timeout:
      '<h2 style="color:#f44336;">Study Ended Due to Inactivity</h2><p>Unfortunately, the study has ended because no response was received within the time limit.</p>',
    attention_check_failed:
      '<h2 style="color:#f44336;">Study Ended</h2><p>The study has ended because attention checks were not passed.</p>',
  };

  return `<div class="debrief-container">
    ${messages[reason] || '<h2 style="color:#f44336;">Study Ended</h2><p>The study has ended unexpectedly.</p>'}
    <p style="margin-top:15px;color:#666;">Thank you for your participation. You will not receive payment for this session.</p>
    ${redirect}
  </div>`;
}

async function saveDataAndEndExperiment(reason) {
  experimentState.terminatedEarly = true;

  jsPsych.data.addProperties({
    completion_status: "terminated_" + reason,
    completion_time: new Date().toISOString(),
    terminated_early: true,
    termination_reason: reason,
  });

  if (DATAPIPE_CONFIG.enabled) {
    try {
      await fetch("https://pipe.jspsych.org/api/data/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          experimentID: DATAPIPE_CONFIG.experiment_id,
          filename: `${subjectId}.csv`,
          data: jsPsych.data.get().csv(),
        }),
      });
    } catch (e) {
      console.error("Failed to save data:", e);
    }
  }

  jsPsych.endExperiment(getTerminationMessage(reason));
}

// ============================================================================
// 7. WELCOME + CONSENT
// ============================================================================

const welcome = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <div class="welcome-container">
      <h1>Welcome</h1>
      <p class="subtitle">This is a study about how we communicate and interpret information.</p>
      <p>This study takes approximately <strong>10–15 minutes</strong> to complete.</p>
      <p class="press-space">Press <strong>SPACE</strong> to continue</p>
    </div>`,
  choices: [" "],
  on_finish: updateProgress,
};

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
        <p style="margin-top:10px;"><strong>ATTENTION CHECKS:</strong> This study includes attention checks in each part. If you fail <strong>one</strong> attention check, the bonus for that part will not be awarded. If you fail <strong>both</strong> attention checks, your submission may be rejected.</p>
      </div>
      
      <div class="consent-section">
        <p><strong>PARTICIPANT'S RIGHTS:</strong> If you have read this form and have decided to participate in this project, please understand your participation is voluntary and you have the right to withdraw your consent or discontinue participation at any time without penalty or loss of benefits to which you are otherwise entitled. The alternative is not to participate. You have the right to refuse to answer particular questions. The results of this research study may be presented at scientific or professional meetings or published in scientific journals. Your individual privacy will be maintained in all published and written data resulting from the study. In accordance with scientific norms, the data from this study may be used or shared with other researchers for future research (after removing personally identifying information) without additional consent from you.</p>
      </div>
      
      <div class="consent-section">
        <p><strong>CONTACT INFORMATION:</strong></p>
        <p><em>Questions:</em> If you have any questions, concerns or complaints about this research, its procedures, risks and benefits, contact the Protocol Director, Robert Hawkins (rdhawkins@stanford.edu, 217-549-6923).</p>
        <p><em>Independent Contact:</em> If you are not satisfied with how this study is being conducted, or if you have any concerns, complaints, or general questions about the research or your rights as a participant, please contact the Stanford Institutional Review Board (IRB) to speak to someone independent of the research team at 650-723-2480 or toll free at 1-866-680-2906, or email at irbnonmed@stanford.edu. You can also write to the Stanford IRB, Stanford University, 1705 El Camino Real, Palo Alto, CA 94306.</p>
      </div>
      
      <p style="margin-top: 20px; font-style: italic;">Please save or print a copy of this page for your records (Ctrl or Command + P).</p>
      
      <p style="margin-top: 20px; font-weight: bold; text-align: center;">
        If you agree to participate in this research, please click "I Consent".
      </p>
    </div>
  `,
  choices: ["I Consent"],
  button_html:
    '<button class="jspsych-btn" style="background:#4CAF50;color:white;">%choice%</button>',
  on_finish: updateProgress,
};

// ============================================================================
// 8. INSTRUCTIONS (3 pages – Reporting Regulations framing)
// ============================================================================

const instructionPages = [
  // Page 1: Cover story
  `<div class="instructions-container">
    <h2>Clinical Trials</h2>
    <p>In this study, a <strong>speaker</strong> and a <strong>listener</strong> will communicate about results from clinical trials testing a new medical treatment.</p>
    <p>Only the speaker will be able to see the result of these trials.</p>
    <p>Each trial tests a treatment on <strong>5 patients</strong>. For each patient, the treatment can be:</p>
    <ul>
      <li><strong>EFFECTIVE</strong> (😃) — the treatment worked</li>
      <li><strong>INEFFECTIVE</strong> (🤒) — the treatment did not work</li>
    </ul>
    <p>Here's what a clinical trial result looks like:</p>
    <div class="example-box">
      <div style="text-align:center;">
        <img src="stimuli_emoji_n5m1/effective_2_v0.png" alt="Example trial" class="stimulus-image" style="max-width:400px;">
      </div>
      <p style="margin-top:15px;text-align:center;">The treatment worked for 2 patients (😃😃) and didn't work for 3 (🤒🤒🤒).</p>
    </div>
  </div>`,

  // Page 2: Treatment effectiveness — extremes
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
  </div>`,

  // Page 3: Treatment effectiveness — in between
  `<div class="instructions-container">
    <h2>Treatment Effectiveness (continued)</h2>
    <p>Treatment effectiveness can also fall <strong>in between</strong> 0% and 100%. Because each patient responds independently, the <strong>same effectiveness level can produce different trial results</strong> each time.</p>

    <div class="example-box" style="margin-top: 20px;">
      <p><strong>20% Effectiveness</strong> — the treatment rarely works, so most patients will not improve.</p>
      <p style="color:#666;font-size:0.92em;">Outcomes with fewer effective patients are more likely, but occasionally more patients improve by chance.</p>
      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 10px;">
        <div style="text-align: center; padding: 6px 10px; background: #e8f5e9; border-radius: 6px; border: 1px solid #c8e6c9;">
          <img src="stimuli_emoji_n5m1/effective_1_v0.png" alt="1 effective" style="max-width: 120px;">
          <div style="font-size: 0.85em; color: #4CAF50; font-weight: 500; margin-top: 4px;">More likely</div>
        </div>
        <div style="text-align: center; padding: 6px 10px; background: #fff3e0; border-radius: 6px; border: 1px solid #ffe0b2;">
          <img src="stimuli_emoji_n5m1/effective_2_v0.png" alt="2 effective" style="max-width: 120px;">
          <div style="font-size: 0.85em; color: #f5a623; font-weight: 500; margin-top: 4px;">Moderately likely</div>
        </div>
        <div style="text-align: center; padding: 6px 10px; background: #ffebee; border-radius: 6px; border: 1px solid #ffcdd2;">
          <img src="stimuli_emoji_n5m1/effective_4_v0.png" alt="4 effective" style="max-width: 120px;">
          <div style="font-size: 0.85em; color: #f57c00; font-weight: 500; margin-top: 4px;">Less likely</div>
        </div>
      </div>
    </div>
    
    <div class="example-box" style="margin-top: 15px;">
      <p><strong>50% Effectiveness</strong> — the treatment works about half the time, so results are mixed.</p>
      <p style="color:#666;font-size:0.92em;">Results near 2–3 effective are most common, but more extreme outcomes (0 or 5) can still happen.</p>
      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 10px;">
        <div style="text-align: center; padding: 6px 10px; background: #e8f5e9; border-radius: 6px; border: 1px solid #c8e6c9;">
          <img src="stimuli_emoji_n5m1/effective_2_v0.png" alt="2 effective" style="max-width: 120px;">
          <div style="font-size: 0.85em; color: #4CAF50; font-weight: 500; margin-top: 4px;">More likely</div>
        </div>
        <div style="text-align: center; padding: 6px 10px; background: #fff3e0; border-radius: 6px; border: 1px solid #ffe0b2;">
          <img src="stimuli_emoji_n5m1/effective_4_v0.png" alt="4 effective" style="max-width: 120px;">
          <div style="font-size: 0.85em; color: #f5a623; font-weight: 500; margin-top: 4px;">Moderately likely</div>
        </div>
        <div style="text-align: center; padding: 6px 10px; background: #ffebee; border-radius: 6px; border: 1px solid #ffcdd2;">
          <img src="stimuli_emoji_n5m1/effective_0_v0.png" alt="0 effective" style="max-width: 120px;">
          <div style="font-size: 0.85em; color: #f57c00; font-weight: 500; margin-top: 4px;">Less likely</div>
        </div>
      </div>
    </div>
    
    <div class="example-box" style="margin-top: 15px;">
      <p><strong>70% Effectiveness</strong> — the treatment usually works, so most patients will improve.</p>
      <p style="color:#666;font-size:0.92em;">Outcomes with more effective patients are most likely, but sometimes fewer patients respond.</p>
      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 10px;">
        <div style="text-align: center; padding: 6px 10px; background: #e8f5e9; border-radius: 6px; border: 1px solid #c8e6c9;">
          <img src="stimuli_emoji_n5m1/effective_4_v0.png" alt="4 effective" style="max-width: 120px;">
          <div style="font-size: 0.85em; color: #4CAF50; font-weight: 500; margin-top: 4px;">More likely</div>
        </div>
        <div style="text-align: center; padding: 6px 10px; background: #fff3e0; border-radius: 6px; border: 1px solid #ffe0b2;">
          <img src="stimuli_emoji_n5m1/effective_2_v0.png" alt="2 effective" style="max-width: 120px;">
          <div style="font-size: 0.85em; color: #f5a623; font-weight: 500; margin-top: 4px;">Moderately likely</div>
        </div>
        <div style="text-align: center; padding: 6px 10px; background: #ffebee; border-radius: 6px; border: 1px solid #ffcdd2;">
          <img src="stimuli_emoji_n5m1/effective_1_v0.png" alt="1 effective" style="max-width: 120px;">
          <div style="font-size: 0.85em; color: #f57c00; font-weight: 500; margin-top: 4px;">Less likely</div>
        </div>
      </div>
    </div>
    
    <p style="margin-top: 20px;">The clinical trial result gives you <strong>evidence</strong> about the treatment's true effectiveness level.</p>
  </div>`,

  // Page 3: Reporting Regulations
  `<div class="instructions-container">
    <h2>Reporting Regulations</h2>
    <p>In this study, all speakers must follow the <strong>Official Reporting Regulations</strong> when describing trial results to listeners. These Regulations ensure that every description is factually accurate.</p>
    <p>Under the Reporting Regulations, the speaker must describe each trial using this format:</p>
    <div class="regulations-box" style="text-align:center;font-size:1.1em;padding:20px;">
      "The treatment was <strong>[effective / ineffective]</strong> for <strong>[no / some / most / all]</strong> patients."
    </div>
    <p style="margin-top:20px;">The Regulations define when each term is <strong>permitted</strong>:</p>
    <ul style="font-size:1.05em;line-height:1.8;">
      <li><strong>NO</strong> — permitted only when <strong>0 patients</strong> had that outcome</li>
      <li><strong>SOME</strong> — permitted when <strong>1, 2, 3, 4, or 5 patients</strong> had that outcome (at least one)</li>
      <li><strong>MOST</strong> — permitted when <strong>3, 4, or 5 patients</strong> had that outcome (more than half)</li>
      <li><strong>ALL</strong> — permitted only when <strong>all 5 patients</strong> had that outcome</li>
    </ul>
    <p>The speaker must choose a description that satisfies the Regulations — they cannot violate the Regulations. However, for any given trial result, the Regulations often <strong>permit multiple descriptions at the same time</strong>. The speaker <strong>chooses</strong> which permitted description to give you.</p>
  </div>`,
];

const instructions = {
  type: jsPsychInstructions,
  pages: instructionPages,
  show_clickable_nav: true,
  button_label_previous: "Back",
  button_label_next: "Continue",
  allow_backward: true,
  on_finish: updateProgress,
};

// ============================================================================
// 9. COMPREHENSION CHECKS (Reporting Regulations framing)
// ============================================================================

// ---- Module 1a: SOME ----
const comp1a = {
  type: jsPsychSurveyMultiChoice,
  preamble: '<div class="comprehension-container"><h2>Check 1 of 5</h2></div>',
  questions: [
    {
      prompt:
        '<strong>Under the Reporting Regulations, when is the speaker permitted to use "SOME"?</strong>',
      name: "some_def",
      options: CONFIG.comprehension.module1.some.options,
      required: true,
    },
  ],
  data: { task: "comp1a" },
  on_finish: function (data) {
    const idx = CONFIG.comprehension.module1.some.options.indexOf(
      data.response.some_def,
    );
    data.comp_correct = idx === CONFIG.comprehension.module1.some.correct;
    updateProgress();
  },
};

const comp1a_feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const d = jsPsych.data.get().filter({ task: "comp1a" }).last(1).values()[0];
    if (d.comp_correct) {
      return `<div class="comprehension-container">
        <h2 style="color:#4CAF50;">✓ Correct!</h2>
        <p><strong>SOME</strong> is permitted when <strong>1 or more patients</strong> had that outcome, including all 5.</p></div>`;
    }
    return `<div class="comprehension-container">
      <h2 style="color:#f44336;">✗ Incorrect</h2>
      <p><strong>SOME</strong> is actually permitted when <strong>1 or more patients</strong> had that outcome, including all 5.</p>
      <p>"The treatment was <b><u>effective</u></b> for <b><u>some</u></b> patients" is permitted when 1, 2, 3, 4, or all 5 patients had effective treatment.</p></div>`;
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// ---- Module 1b: MOST ----
const comp1b = {
  type: jsPsychSurveyMultiChoice,
  preamble: '<div class="comprehension-container"><h2>Check 2 of 5</h2></div>',
  questions: [
    {
      prompt:
        '<strong>Under the Reporting Regulations, when is the speaker permitted to use "MOST"?</strong>',
      name: "most_def",
      options: CONFIG.comprehension.module1.most.options,
      required: true,
    },
  ],
  data: { task: "comp1b" },
  on_finish: function (data) {
    const idx = CONFIG.comprehension.module1.most.options.indexOf(
      data.response.most_def,
    );
    data.comp_correct = idx === CONFIG.comprehension.module1.most.correct;
    updateProgress();
  },
};

const comp1b_feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const d = jsPsych.data.get().filter({ task: "comp1b" }).last(1).values()[0];
    if (d.comp_correct) {
      return `<div class="comprehension-container">
        <h2 style="color:#4CAF50;">✓ Correct!</h2>
        <p><strong>MOST</strong> is permitted when <strong>more than half</strong> (3, 4, or 5) patients had that outcome.</p></div>`;
    }
    return `<div class="comprehension-container">
      <h2 style="color:#f44336;">✗ Incorrect</h2>
      <p><strong>MOST</strong> is actually permitted when <strong>more than half</strong> (3, 4, or 5) patients had that outcome.</p></div>`;
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// ---- Module 2: True/False ----
const comp2 = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const imgPath = Stimuli.getImagePath(3, 0);
    return `<div class="comprehension-container">
      <h3>Check 3 of 5 — Is this description permitted?</h3>
      <div class="stimulus-container">
        <img src="${imgPath}" class="stimulus-image" style="max-width:400px;">
      </div>
      <div class="regulations-box" style="text-align:center;font-size:1.2em;">
        "The treatment was <b><u>ineffective</u></b> for <b><u>some</u></b> patients."
      </div>
      <div style="margin-top:30px;text-align:center;">
        <button class="jspsych-btn tf-btn true-btn" id="btn-true">PERMITTED</button>
        <button class="jspsych-btn tf-btn false-btn" id="btn-false">NOT PERMITTED</button>
      </div>
    </div>`;
  },
  choices: [],
  data: { task: "comp2" },
  on_load: function () {
    const trialStartTime = performance.now();
    document.getElementById("btn-true").addEventListener("click", () => {
      jsPsych.finishTrial({
        task: "comp2",
        response: true,
        comp_correct: true,
        rt: Math.round(performance.now() - trialStartTime),
      });
    });
    document.getElementById("btn-false").addEventListener("click", () => {
      jsPsych.finishTrial({
        task: "comp2",
        response: false,
        comp_correct: false,
        rt: Math.round(performance.now() - trialStartTime),
      });
    });
  },
  on_finish: updateProgress,
};

const comp2_feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const d = jsPsych.data.get().filter({ task: "comp2" }).last(1).values()[0];
    if (d.comp_correct) {
      return `<div class="comprehension-container">
        <h2 style="color:#4CAF50;">✓ Correct!</h2>
        <p><strong>SOME</strong> is permitted when at least 1 patient had that outcome. Since 2 patients were ineffective, this description is <strong>permitted</strong>.</p></div>`;
    }
    return `<div class="comprehension-container">
      <h2 style="color:#f44336;">✗ Incorrect</h2>
      <p>The answer is <strong>PERMITTED</strong>. <strong>SOME</strong> is permitted when at least 1 patient had that outcome. Here, 2 patients were ineffective (🤒🤒), so the description is permitted.</p></div>`;
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// ---- Explanation: Multiple Permitted Descriptions ----
const explanationMultiplePermitted = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="instructions-container">
      <h2>Multiple Permitted Descriptions, One Result</h2>
      <p>For any clinical trial, <strong>multiple descriptions can be permitted</strong> by the Regulations even though they may give different impressions. Consider this one:</p>

      <div style="text-align: center; margin: 20px 0;">
        <img src="stimuli_emoji_n5m1/effective_3_v0.png" alt="Example" class="stimulus-image" style="max-width: 300px;">
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="background: #e8f5e9; border-left: 4px solid #4CAF50; padding: 12px 16px; border-radius: 4px;">
          <strong style="color: #2e7d32;">✓ PERMITTED:</strong> "The treatment was <b><u>ineffective</u></b> for <b><u>some</u></b> patients." <span style="color: #666;">(2 is at least 1)</span>
        </div>
        <div style="background: #e8f5e9; border-left: 4px solid #4CAF50; padding: 12px 16px; border-radius: 4px;">
          <strong style="color: #2e7d32;">✓ PERMITTED:</strong> "The treatment was <b><u>effective</u></b> for <b><u>most</u></b> patients." <span style="color: #666;">(3 is more than half)</span>
        </div>
        <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 12px 16px; border-radius: 4px;">
          <strong style="color: #c62828;">✗ NOT PERMITTED:</strong> "The treatment was <b><u>ineffective</u></b> for <b><u>most</u></b> patients." <span style="color: #666;">(2 is less than half)</span>
        </div>
        <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 12px 16px; border-radius: 4px;">
          <strong style="color: #c62828;">✗ NOT PERMITTED:</strong> "The treatment was <b><u>effective</u></b> for <b><u>all</u></b> patients." <span style="color: #666;">(only 3, not 5)</span>
        </div>
      </div>

      <p style="margin-top: 15px;">The speaker <strong>chooses</strong> which permitted description to give.</p>
    </div>
  `,
  choices: ["Continue"],
  on_finish: updateProgress,
};

// ---- Module 3a: Which descriptions are permitted? (text checkboxes) ----
const comp3a = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const imgPath = Stimuli.getImagePath(5, 0);
    const options = shuffleArray(
      CONFIG.comprehension.module3a.options.map((o, i) => ({
        ...o,
        origIdx: i,
      })),
    );
    experimentState.comp3a_options = options;

    let html = "";
    options.forEach((opt, i) => {
      html += `<div class="checkbox-option-text" data-idx="${i}" id="c3a-opt-${i}">
        <span class="checkbox-marker"></span>${opt.text}</div>`;
    });

    return `<div class="comprehension-container">
      <h3>Check 4 of 5 — Which descriptions are permitted?</h3>
      <div class="stimulus-container">
        <img src="${imgPath}" class="stimulus-image" style="max-width:350px;">
      </div>
      <p style="text-align:center;color:#666;margin:15px 0;">Select <strong>all</strong> that are permitted under the Regulations:</p>
      <div style="max-width:580px;margin:0 auto;">${html}</div>
      <div style="margin-top:20px;text-align:center;">
        <button id="c3a-submit" class="jspsych-btn" disabled>Submit Answer</button>
      </div>
    </div>`;
  },
  choices: [],
  data: { task: "comp3a" },
  on_load: function () {
    const trialStartTime = performance.now();
    const sel = new Set();
    const opts = document.querySelectorAll(".checkbox-option-text");
    const btn = document.getElementById("c3a-submit");

    opts.forEach((el, i) => {
      el.addEventListener("click", () => {
        if (sel.has(i)) {
          sel.delete(i);
          el.classList.remove("selected");
        } else {
          sel.add(i);
          el.classList.add("selected");
        }
        btn.disabled = sel.size === 0;
      });
    });

    btn.addEventListener("click", () => {
      const shuffled = experimentState.comp3a_options;
      const correctIdxs = shuffled
        .map((o, i) => (o.correct ? i : -1))
        .filter((i) => i >= 0);
      const isCorrect =
        correctIdxs.every((i) => sel.has(i)) && sel.size === correctIdxs.length;
      jsPsych.finishTrial({
        task: "comp3a",
        selected: Array.from(sel).map((i) => shuffled[i].id),
        comp_correct: isCorrect,
        rt: Math.round(performance.now() - trialStartTime),
      });
    });
  },
  on_finish: updateProgress,
};

const comp3a_feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const d = jsPsych.data.get().filter({ task: "comp3a" }).last(1).values()[0];
    if (d.comp_correct) {
      return `<div class="comprehension-container">
        <h2 style="color:#4CAF50;">✓ Correct!</h2>
        <div style="text-align:left;max-width:500px;margin:15px auto;">
          <p style="color:#2e7d32;">✓ "…effective for <strong>ALL</strong>" — PERMITTED (5 = 5)</p>
          <p style="color:#2e7d32;">✓ "…effective for <strong>SOME</strong>" — PERMITTED (5 ≥ 1)</p>
          <p style="color:#c62828;">✗ "…ineffective for <strong>SOME</strong>" — NOT PERMITTED (0 is not ≥ 1)</p>
        </div></div>`;
    }
    return `<div class="comprehension-container">
      <h2 style="color:#f44336;">✗ Incorrect</h2>
      <div style="text-align:left;max-width:500px;margin:15px auto;">
        <p style="color:#2e7d32;">✓ "…effective for <strong>ALL</strong>" — PERMITTED (5 = 5)</p>
        <p style="color:#2e7d32;">✓ "…effective for <strong>SOME</strong>" — PERMITTED (5 ≥ 1)</p>
        <p style="color:#c62828;">✗ "…ineffective for <strong>SOME</strong>" — NOT PERMITTED (0 patients were ineffective; 0 is not ≥ 1)</p>
      </div></div>`;
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// ---- Explanation: Multiple Results, One Description ----
const explanationMultipleResults = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="instructions-container">
      <h2>One Permitted Description, Multiple Results</h2>
      <p>From the listener's perspective, <strong>multiple different trial results</strong> may be consistent with the same description:</p>
      <div class="regulations-box" style="text-align:center;font-size:1.1em;padding:15px;margin:20px 0;">
        "The treatment was <b><u>ineffective</u></b> for <b><u>most</u></b> patients."
      </div>
      <p style="text-align:center;margin-bottom:15px;">This description is permitted for all of these trials:</p>
      <div style="display:flex;justify-content:center;gap:20px;flex-wrap:wrap;">
        <div style="text-align:center;">
          <img src="stimuli_emoji_n5m1/effective_0_v0.png" alt="0" style="max-width:150px;">
          <p style="color:#666;font-size:0.9em;">5 ineffective (5 > half)</p>
        </div>
        <div style="text-align:center;">
          <img src="stimuli_emoji_n5m1/effective_1_v0.png" alt="1" style="max-width:150px;">
          <p style="color:#666;font-size:0.9em;">4 ineffective (4 > half)</p>
        </div>
        <div style="text-align:center;">
          <img src="stimuli_emoji_n5m1/effective_2_v0.png" alt="2" style="max-width:150px;">
          <p style="color:#666;font-size:0.9em;">3 ineffective (3 > half)</p>
        </div>
      </div>
    </div>`,
  choices: ["Continue"],
  on_finish: updateProgress,
};

// ---- Module 3b: Which trials permit this description? (image checkboxes) ----
const comp3b = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const item = CONFIG.comprehension.module3b;
    const shuffled = shuffleArray(
      item.options.map((o, i) => ({ ...o, origIdx: i })),
    );
    experimentState.comp3b_options = shuffled;

    let html = `<div class="comprehension-container">
      <h3>Check 5 of 5 — Which trials permit this description?</h3>
      <div class="regulations-box" style="text-align:center;font-size:1.2em;">"${item.statement}"</div>
      <p style="text-align:center;color:#666;margin-top:20px;">Select all that apply:</p>
      <div class="checkbox-options">`;
    shuffled.forEach((opt, i) => {
      html += `<div class="checkbox-option" data-idx="${i}" id="c3b-opt-${i}">
        <img src="${Stimuli.getImagePath(opt.numEffective, 0)}" style="max-width:180px;">
        <div class="checkbox-label"><span class="checkbox-marker"></span></div>
      </div>`;
    });
    html += `</div><div style="margin-top:20px;text-align:center;">
      <button id="c3b-submit" class="jspsych-btn">Submit Answer</button></div></div>`;
    return html;
  },
  choices: [],
  data: { task: "comp3b" },
  on_load: function () {
    const trialStartTime = performance.now();
    const sel = new Set();
    const opts = document.querySelectorAll(".checkbox-option");
    opts.forEach((el, i) => {
      el.addEventListener("click", () => {
        if (sel.has(i)) {
          sel.delete(i);
          el.classList.remove("selected");
        } else {
          sel.add(i);
          el.classList.add("selected");
        }
      });
    });
    document.getElementById("c3b-submit").addEventListener("click", () => {
      const shuffled = experimentState.comp3b_options;
      const correctIdxs = shuffled
        .map((o, i) => (o.correct ? i : -1))
        .filter((i) => i >= 0);
      const isCorrect =
        correctIdxs.every((i) => sel.has(i)) &&
        sel.size === correctIdxs.length &&
        sel.size > 0;
      jsPsych.finishTrial({
        task: "comp3b",
        selected: Array.from(sel).map((i) => shuffled[i].numEffective),
        comp_correct: isCorrect,
        rt: Math.round(performance.now() - trialStartTime),
      });
    });
  },
  on_finish: updateProgress,
};

const comp3b_feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const d = jsPsych.data.get().filter({ task: "comp3b" }).last(1).values()[0];
    if (d.comp_correct) {
      return `<div class="comprehension-container">
        <h2 style="color:#4CAF50;">✓ Correct!</h2>
        <p><strong>MOST</strong> means "more than half". The description "ineffective for most" is permitted when 3 or more patients were ineffective (i.e., 0, 1, or 2 effective).</p></div>`;
    }
    return `<div class="comprehension-container">
      <h2 style="color:#f44336;">✗ Incorrect</h2>
      <p>"Ineffective for <strong>MOST</strong>" is permitted when 3+ patients were ineffective.</p>
      <div style="margin-top:20px;">
        <div style="display:flex;align-items:center;gap:15px;margin-bottom:15px;padding:10px;background:#e8f5e9;border-radius:8px;">
          <img src="${Stimuli.getImagePath(0, 0)}" style="max-width:120px;">
          <div><strong style="color:#2e7d32;">✓ PERMITTED</strong><p style="margin:5px 0;color:#666;">5 ineffective (5 > half)</p></div>
        </div>
        <div style="display:flex;align-items:center;gap:15px;margin-bottom:15px;padding:10px;background:#e8f5e9;border-radius:8px;">
          <img src="${Stimuli.getImagePath(2, 0)}" style="max-width:120px;">
          <div><strong style="color:#2e7d32;">✓ PERMITTED</strong><p style="margin:5px 0;color:#666;">3 ineffective (3 > half)</p></div>
        </div>
        <div style="display:flex;align-items:center;gap:15px;padding:10px;background:#ffebee;border-radius:8px;">
          <img src="${Stimuli.getImagePath(3, 0)}" style="max-width:120px;">
          <div><strong style="color:#c62828;">✗ NOT PERMITTED</strong><p style="margin:5px 0;color:#666;">Only 2 ineffective (2 < half)</p></div>
        </div>
      </div></div>`;
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// ============================================================================
// 10. CONDITION ASSIGNMENT (DataPipe balanced)
// ============================================================================

// Comprehension summary: compute total correct across all 5 checks
const comprehensionSummary = {
  type: jsPsychCallFunction,
  func: function () {
    const allData = jsPsych.data.get();
    const comp1a = allData.filter({ task: "comp1a" }).last(1).values()[0];
    const comp1b = allData.filter({ task: "comp1b" }).last(1).values()[0];
    const comp2 = allData.filter({ task: "comp2" }).last(1).values()[0];
    const comp3a = allData.filter({ task: "comp3a" }).last(1).values()[0];
    const comp3b = allData.filter({ task: "comp3b" }).last(1).values()[0];

    const results = [
      comp1a?.comp_correct,
      comp1b?.comp_correct,
      comp2?.comp_correct,
      comp3a?.comp_correct,
      comp3b?.comp_correct,
    ];
    const totalCorrect = results.filter((r) => r === true).length;

    jsPsych.data.addProperties({
      comp_total_correct: totalCorrect,
      comp_total_items: 5,
      comp_passed: totalCorrect >= 3, // fail threshold: more than 2 wrong
      comp_results: JSON.stringify(results),
    });
  },
};

// Condition mapping: 6 cells (0–5)
// 0: informative × identification   1: informative × production
// 2: pers_plus × identification      3: pers_plus × production
// 4: pers_minus × identification     5: pers_minus × production
const CONDITION_MAP = [
  { goal: "informative", grounding: "identification" },
  { goal: "informative", grounding: "production" },
  { goal: "pers_plus", grounding: "identification" },
  { goal: "pers_plus", grounding: "production" },
  { goal: "pers_minus", grounding: "identification" },
  { goal: "pers_minus", grounding: "production" },
];

// DataPipe condition assignment (fetched early for balanced allocation)
const fetchCondition = {
  type: jsPsychPipe,
  action: "condition",
  experiment_id: DATAPIPE_CONFIG.experiment_id,
  data: { task: "condition_assignment" },
  on_finish: function (data) {
    // jsPsychPipe may store condition in data.condition or data.result depending on version
    const raw_condition = data.condition;
    const raw_result = data.result;
    const condNum = parseInt(data.condition ?? data.result);
    if (!isNaN(condNum) && condNum >= 0 && condNum < 6) {
      experimentState._datapipeCondition = condNum;
    } else {
      // Fallback to random if DataPipe fails
      experimentState._datapipeCondition = Math.floor(Math.random() * 6);
      console.warn(
        "DataPipe condition assignment failed, using random fallback. Raw data:",
        raw_condition,
        raw_result,
      );
    }
    console.log(
      "DataPipe raw: condition=",
      raw_condition,
      "result=",
      raw_result,
      "→ using",
      experimentState._datapipeCondition,
    );
  },
};

// Fallback for when DataPipe is disabled (e.g., local testing)
const fetchConditionFallback = {
  type: jsPsychCallFunction,
  func: function () {
    experimentState._datapipeCondition = Math.floor(Math.random() * 6);
    console.log(
      "DataPipe disabled — random condition:",
      experimentState._datapipeCondition,
    );
  },
};

const assignConditions = {
  type: jsPsychCallFunction,
  func: function () {
    // Use DataPipe-assigned condition number
    const condNum = experimentState._datapipeCondition;
    const cond = CONDITION_MAP[condNum];
    experimentState.goalCondition = cond.goal;
    experimentState.groundingCondition = cond.grounding;

    // Select Block 1 sequence
    let b1Pool;
    if (experimentState.groundingCondition === "identification") {
      b1Pool = CONFIG.block1_sequences.identification;
      experimentState.block1SequenceIdx = 0; // only one template
      // Shuffle the [0,1,2,3,4,5] outcomes randomly for this participant
      experimentState.block1Sequence = shuffleArray([...b1Pool[0]]);
    } else {
      b1Pool =
        CONFIG.block1_sequences.production[experimentState.goalCondition];
      experimentState.block1SequenceIdx = Math.floor(
        Math.random() * b1Pool.length,
      );
      experimentState.block1Sequence = [
        ...b1Pool[experimentState.block1SequenceIdx],
      ];
    }

    // Select Block 2 sequence
    const b2Pool = CONFIG.block2_sequences[experimentState.goalCondition];
    experimentState.block2SequenceIdx = Math.floor(
      Math.random() * b2Pool.length,
    );
    experimentState.block2Sequence = b2Pool[experimentState.block2SequenceIdx];

    // Counterbalance image order in Block 2 (0→5 or 5→0)
    experimentState.imageOrderReversed = Math.random() < 0.5;

    // Compute total progress steps
    const b1Len = experimentState.block1Sequence.length;
    const b2Len = experimentState.block2Sequence.length;
    const compSteps = 12; // comprehension checks + explanation pages
    const isProd = experimentState.groundingCondition === "production";
    // identification: intro(1) + bonus(1) + rounds(b1Len*2 for trial+feedback) + completion(1) + transition(1)
    // production: intro(1) + goal(1) + goalComp(2) + pairing(2) + bonus(1) + rounds(b1Len) + attnCheck(1) + completion(1) + strategy(1) + transition(1)
    const b1Steps = isProd ? 11 + b1Len : 4 + b1Len * 2;
    const b2Steps = 2 + 1 + b2Len + 1 + 3 + 1; // pairing(2) + bonus(1) + rounds + attnCheck + listenerStrategy+completion+feedback + debrief
    experimentState.totalSteps = 2 + 1 + compSteps + b1Steps + b2Steps; // welcome+consent + instructions
    experimentState.completedSteps = 2 + 1 + compSteps; // already completed by this point

    // Add properties to all data
    jsPsych.data.addProperties({
      datapipe_raw_condition: experimentState._datapipeCondition,
      condition_number: condNum,
      goal_condition: experimentState.goalCondition,
      grounding_condition: experimentState.groundingCondition,
      block1_sequence_idx: experimentState.block1SequenceIdx,
      block2_sequence_idx: experimentState.block2SequenceIdx,
      block1_sequence: JSON.stringify(experimentState.block1Sequence),
      block2_sequence: JSON.stringify(experimentState.block2Sequence),
      image_order_reversed: experimentState.imageOrderReversed,
    });

    console.log(
      "Assigned condition",
      condNum + ":",
      experimentState.goalCondition,
      "×",
      experimentState.groundingCondition,
    );
  },
};

// ============================================================================
// 11. BLOCK 1 — IDENTIFICATION (utterance-space)
// ============================================================================

const block1IdentificationIntro = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="intro-container">
      <h2>Practice: Identifying Permitted Descriptions</h2>
      <p>Before being paired with another participant, you'll first practice identifying which descriptions are <strong>permitted under the Regulations</strong> for different trial results.</p>
      <p>For each trial result, you will see all 8 possible descriptions. Your job is to select <strong>all descriptions that are permitted</strong>.</p>
      <p>You will receive feedback after each round.</p>
    </div>`,
  choices: ["Continue"],
  on_finish: updateProgress,
};

// --- Identification round template (used inside loop) ---
const identificationTrialTemplate = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const round = experimentState.block1Round;
    const numEff = experimentState.block1Sequence[round];
    const imgData = Stimuli.getRandomImage(numEff);
    experimentState.currentStimulus = imgData;

    const structured = getStructuredUtterances();
    const ordered = structured.utterances.map((u, i) => ({ ...u, origIdx: i }));
    experimentState._idShuffledUtterances = ordered;
    experimentState._idGridOrder = structured;

    let gridHtml = "";
    ordered.forEach((u, i) => {
      const fmt = formatUtterance(u);
      gridHtml += `<div class="id-utterance-item" data-idx="${i}" id="id-utt-${i}">
        <span class="id-checkbox"></span>
        <span>${fmt.shortDisplayText}</span>
      </div>`;
    });

    return `
      <div class="trial-container">
        <div class="trial-header">
          <span class="round-indicator">Practice Round ${round + 1} of ${experimentState.block1Sequence.length}</span>
        </div>
        <div class="stimulus-container">
          <img src="${imgData.path}" class="stimulus-image" style="max-width:350px;">
        </div>
        <p style="text-align:center;margin:15px 0;">Select <strong>all descriptions</strong> that are <strong>permitted</strong> under the Reporting Regulations:</p>
        <div class="regulations-box" style="text-align:center;font-size:0.95em;padding:10px 15px;margin:0 auto 15px auto;max-width:550px;">
          "The treatment was <strong>[effective / ineffective]</strong> for <strong>[no / some / most / all]</strong> patients."
        </div>
        <div class="id-utterance-grid">${gridHtml}</div>
        <div style="margin-top:20px;text-align:center;">
          <button id="id-submit" class="submit-btn" disabled>Submit</button>
          <p style="margin-top:8px;font-size:0.85em;color:#888;">Select at least one description.</p>
        </div>
      </div>`;
  },
  choices: [],
  data: { task: "block1_identification" },
  on_load: function () {
    const trialStartTime = performance.now();
    startInactivityTimer();
    const sel = new Set();
    const items = document.querySelectorAll(".id-utterance-item");
    const btn = document.getElementById("id-submit");

    items.forEach((el, i) => {
      el.addEventListener("click", () => {
        resetInactivityTimer();
        if (sel.has(i)) {
          sel.delete(i);
          el.classList.remove("selected");
        } else {
          sel.add(i);
          el.classList.add("selected");
        }
        btn.disabled = sel.size === 0;
      });
    });

    btn.addEventListener("click", () => {
      clearInactivityTimer();
      const round = experimentState.block1Round;
      const numEff = experimentState.block1Sequence[round];
      const shuffled = experimentState._idShuffledUtterances;

      // Compute correctness for each utterance
      const results = shuffled.map((u, i) => {
        const permitted = TruthChecker.checkUtterance(
          numEff,
          u.predicate,
          u.quantifier,
        );
        const selected = sel.has(i);
        return {
          predicate: u.predicate,
          quantifier: u.quantifier,
          permitted,
          selected,
          correct: permitted === selected,
        };
      });

      // Store for feedback page
      experimentState._idResults = results;

      const nCorrect = results.filter((r) => r.correct).length;

      jsPsych.finishTrial({
        task: "block1_identification",
        round: round + 1,
        num_effective: numEff,
        stimulus_variant: experimentState.currentStimulus.variant,
        stimulus_positions: JSON.stringify(
          experimentState.currentStimulus.positions,
        ),
        grid_pred_reversed: experimentState._idGridOrder.predReversed,
        grid_quant_reversed: experimentState._idGridOrder.quantReversed,
        results: JSON.stringify(results),
        n_correct: nCorrect,
        n_total: 8,
        all_correct: nCorrect === 8,
        rt: Math.round(performance.now() - trialStartTime),
      });
    });
  },
  on_finish: function () {
    clearInactivityTimer();
    updateProgress();
  },
};

// --- Identification feedback template ---
const identificationFeedbackTemplate = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const results = experimentState._idResults;
    const round = experimentState.block1Round;
    const numEff = experimentState.block1Sequence[round];
    const imgPath = experimentState.currentStimulus.path;
    const nCorrect = results.filter((r) => r.correct).length;
    const allCorrect = nCorrect === 8;

    // Store score for this round
    experimentState.idRoundScores.push(nCorrect);

    // Compute potential bonus for this round
    const roundBonus = ((nCorrect / 8) * 1.0).toFixed(2);

    let header;
    if (allCorrect) {
      header = `<h2 style="color:#4CAF50;">✓ All Correct! (${nCorrect}/8)</h2>`;
    } else {
      header = `<h2 style="color:#f44336;">You got ${nCorrect} of 8 correct</h2>`;
    }

    // Show stimulus image
    const imgHtml = `<div style="text-align:center;margin-bottom:15px;">
      <img src="${imgPath}" class="stimulus-image" style="max-width:300px;">
    </div>`;

    // Only show the ones they got wrong
    const wrong = results.filter((r) => !r.correct);

    let feedbackHtml = "";
    let reviewBtn = "";
    if (allCorrect) {
      feedbackHtml = `<p style="text-align:center;color:#4CAF50;">You correctly identified all permitted and non-permitted descriptions.</p>`;
    } else {
      feedbackHtml = `<p style="text-align:center;color:#666;margin-bottom:10px;">Here's what you got wrong:</p>`;
      wrong.forEach((r) => {
        const fmt = formatUtterance(r);
        let cssClass, icon;
        if (r.permitted) {
          cssClass = "missed";
          icon = "⚠ Permitted — you missed this";
        } else {
          cssClass = "incorrect";
          icon = "✗ Not permitted — you selected this";
        }
        feedbackHtml += `<div class="id-feedback-item ${cssClass}">
          <strong style="min-width:260px;">${icon}</strong>
          <span>${fmt.shortDisplayText}</span>
        </div>`;
      });
      reviewBtn = `<div style="text-align:center;margin-top:15px;">
        <button id="review-regs-btn" class="jspsych-btn" style="background:#9c27b0;color:white;padding:8px 20px;font-size:0.95em;">Review Regulations</button>
      </div>`;
    }

    // Bonus info for this round
    const bonusHtml = `<div style="text-align:center;margin-top:15px;padding:10px;background:#f5f5f5;border-radius:6px;">
      <p style="margin:0;color:#555;">If this round is selected, you will earn <strong>$${roundBonus}</strong></p>
    </div>`;

    return `<div class="comprehension-container">
      ${header}
      ${imgHtml}
      <div style="max-width:650px;margin:0 auto;">${feedbackHtml}</div>
      ${reviewBtn}
      ${bonusHtml}
    </div>`;
  },
  choices: ["Continue"],
  on_load: function () {
    const btn = document.getElementById("review-regs-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        const regText =
          "REPORTING REGULATIONS\n" +
          "When each term is permitted:\n" +
          "• NO — 0 patients had that outcome\n" +
          "• SOME — 1, 2, 3, 4 or 5 patients had that outcome (at least one)\n" +
          "• MOST — 3, 4, or 5 patients had that outcome (more than half)\n" +
          "• ALL — all 5 patients had that outcome";
        alert(regText);
      });
    }
  },
  on_finish: updateProgress,
};

// ============================================================================
// 12. BLOCK 1 — PRODUCTION (speaker task)
// ============================================================================

const block1ProductionIntro = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="intro-container">
      <h2>Your Role: Speaker</h2>
      <p>You will first play the role of a <strong>speaker</strong>. You will be paired with a listener and describe clinical trial results to them.</p>
      <p>You will see the trial result and choose a description to send to your listener, following the Reporting Regulations.</p>
    </div>`,
  choices: ["Continue"],
  on_finish: updateProgress,
};

const block1GoalAssignment = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const goal = experimentState.goalCondition;
    const color = CONFIG.goal_colors[goal];
    const descHtml = renderGoalHtml(goal, "speaker");
    return `
      <div class="intro-container">
        <h2>Your Goal</h2>
        <div style="background:${color}11;border:2px solid ${color};border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
          <p style="font-size:1.15em;">Your goal is to ${descHtml}.</p>
        </div>
        <p>Remember: you can only use descriptions that satisfy the Reporting Regulations, but you <strong>choose</strong> which permitted description to give your listener.</p>
      </div>`;
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// --- Goal Comprehension Check (production only) ---
const block1GoalCompCheck = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const goal = experimentState.goalCondition;
    const color = CONFIG.goal_colors[goal];

    let question = "What is your goal as a speaker?";
    let options = [];
    let correctIndex = 0;

    if (goal === "informative") {
      options = [
        "Give the listener the <strong>most informative</strong> description of each trial result",
        "Make the listener think the treatment is <strong>as effective as possible</strong>",
        "Make the listener think the treatment is <strong>as ineffective as possible</strong>",
      ];
      correctIndex = 0;
    } else if (goal === "pers_plus") {
      options = [
        "Give the listener the <strong>most informative</strong> description of each trial result",
        "Make the treatment sound <strong>as effective as possible</strong> to the listener",
        "Make the treatment sound <strong>as ineffective as possible</strong> to the listener",
      ];
      correctIndex = 1;
    } else {
      // pers_minus
      options = [
        "Give the listener the <strong>most informative</strong> description of each trial result",
        "Make the treatment sound <strong>as effective as possible</strong> to the listener",
        "Make the treatment sound <strong>as ineffective as possible</strong> to the listener",
      ];
      correctIndex = 2;
    }

    // Shuffle options but track correct answer
    const shuffledOptions = options.map((opt, idx) => ({
      text: opt,
      isCorrect: idx === correctIndex,
    }));
    const shuffled = shuffleArray(shuffledOptions);
    experimentState._goalCompOptions = shuffled;

    let optionsHtml = '<div class="utterance-options">';
    shuffled.forEach((opt, i) => {
      optionsHtml += `<label class="utterance-option" data-idx="${i}">
        <input type="radio" name="goal-comp" value="${i}">
        ${opt.text}
      </label>`;
    });
    optionsHtml += "</div>";

    return `<div class="comprehension-container">
      <h2>Quick Check</h2>
      <p style="margin-top:20px;font-weight:bold;">${question}</p>
      ${optionsHtml}
      <div style="text-align:center;margin-top:20px;">
        <button id="goal-comp-btn" class="jspsych-btn" disabled>Submit</button>
      </div>
    </div>`;
  },
  choices: [],
  data: { task: "goal_comprehension" },
  on_load: function () {
    const trialStartTime = performance.now();
    const options = document.querySelectorAll(".utterance-option");
    const btn = document.getElementById("goal-comp-btn");
    let selectedIdx = -1;

    options.forEach((opt, i) => {
      opt.addEventListener("click", () => {
        options.forEach((o) => o.classList.remove("selected"));
        opt.classList.add("selected");
        opt.querySelector("input").checked = true;
        selectedIdx = i;
        btn.disabled = false;
      });
    });

    btn.addEventListener("click", () => {
      const isCorrect = experimentState._goalCompOptions[selectedIdx].isCorrect;
      jsPsych.finishTrial({
        task: "goal_comprehension",
        goal_condition: experimentState.goalCondition,
        selected_option: experimentState._goalCompOptions[selectedIdx].text,
        goal_comp_correct: isCorrect,
        rt: Math.round(performance.now() - trialStartTime),
      });
    });
  },
  on_finish: updateProgress,
};

const block1GoalCompFeedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const d = jsPsych.data
      .get()
      .filter({ task: "goal_comprehension" })
      .last(1)
      .values()[0];
    const goal = experimentState.goalCondition;
    const color = CONFIG.goal_colors[goal];
    const descHtml = renderGoalHtml(goal, "speaker");

    if (d.goal_comp_correct) {
      return `<div class="comprehension-container">
        <h2 style="color:#4CAF50;">✓ Correct</h2>
        <p>Your goal is to:</p>
        <p style="font-size:1.05em;">${descHtml}</p>
      </div>`;
    }
    return `<div class="comprehension-container">
      <h2 style="color:#f44336;">✗ Not quite</h2>
      <p>Your goal is actually to:</p>
      <p style="font-size:1.05em;">${descHtml}</p>
      <p style="margin-top:15px;color:#666;">Remember this goal as you describe the trial results.</p>
    </div>`;
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

const block1PairingWait = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <div class="waiting-container">
      <h2>Finding a listener…</h2>
      <div class="spinner"></div>
      <p>Please wait while we pair you with another participant.</p>
    </div>`,
  choices: "NO_KEYS",
  trial_duration: () =>
    randomInt(CONFIG.pairing_wait_min, CONFIG.pairing_wait_max),
  on_finish: updateProgress,
};

const block1ListenerMatched = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const goal = experimentState.goalCondition;
    const color = CONFIG.goal_colors[goal];
    const descHtml = renderGoalHtml(goal, "speaker");
    return `
      <div class="intro-container" style="text-align:center;">
        <h2 style="color:#4CAF50;">✓ Listener Matched</h2>
        <p>You are now connected with a listener.</p>
        <p style="margin-top:15px;">You will describe <strong>${experimentState.block1Sequence.length} trial results</strong> to this listener.</p>
        <div style="background:${color}11;border:2px solid ${color};border-radius:8px;padding:12px;margin:15px auto;max-width:500px;">
          <p style="margin:0;">Your goal: ${descHtml}</p>
        </div>
      </div>`;
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// --- Production round template ---
const productionTrialTemplate = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const round = experimentState.block1Round;
    const numEff = experimentState.block1Sequence[round];
    const imgData = Stimuli.getRandomImage(numEff);
    experimentState.currentStimulus = imgData;

    const goal = experimentState.goalCondition;
    const color = CONFIG.goal_colors[goal];
    const descHtml = renderGoalHtml(goal, "speaker_round");

    // Get permitted (true) utterances and shuffle
    const trueUtts = TruthChecker.getTrueUtterances(numEff);
    const shuffled = shuffleArray(trueUtts);
    experimentState._prodShuffledUtterances = shuffled;

    let optionsHtml = "";
    shuffled.forEach((u, i) => {
      optionsHtml += `<div class="utterance-option" data-idx="${i}" id="prod-opt-${i}">
        <input type="radio" name="prod-utt" value="${i}">
        ${u.displayText}
      </div>`;
    });

    return `
      <div class="trial-container">
        <div class="trial-header">
          <span class="round-indicator">Round ${round + 1} of ${experimentState.block1Sequence.length}</span>
        </div>
        <div class="stimulus-container">
          <img src="${imgData.path}" class="stimulus-image" style="max-width:400px;">
        </div>
        <div class="goal-reminder" style="background:${color}11;border:2px solid ${color};text-align:center;padding:8px 15px;min-height:auto;margin:10px auto 15px auto;max-width:700px;">
          Your goal: ${descHtml}
        </div>
        <div class="response-section">
          <p style="text-align:center;font-weight:500;margin-bottom:15px;">Choose a permitted description to send:</p>
          <div class="utterance-options">${optionsHtml}</div>
          <button id="prod-submit" class="submit-btn" disabled style="margin-top:20px;">Send Description</button>
        </div>
      </div>`;
  },
  choices: [],
  data: { task: "block1_production" },
  on_load: function () {
    const trialStartTime = performance.now();
    startInactivityTimer();
    const opts = document.querySelectorAll(".utterance-option");
    const btn = document.getElementById("prod-submit");
    let selected = null;

    opts.forEach((el, i) => {
      el.addEventListener("click", () => {
        resetInactivityTimer();
        opts.forEach((o) => o.classList.remove("selected"));
        el.classList.add("selected");
        selected = i;
        btn.disabled = false;
      });
    });

    btn.addEventListener("click", () => {
      clearInactivityTimer();
      const round = experimentState.block1Round;
      const numEff = experimentState.block1Sequence[round];
      const shuffled = experimentState._prodShuffledUtterances;
      const chosen = shuffled[selected];

      jsPsych.finishTrial({
        task: "block1_production",
        round: round + 1,
        goal_condition: experimentState.goalCondition,
        num_effective: numEff,
        stimulus_variant: experimentState.currentStimulus.variant,
        stimulus_positions: JSON.stringify(
          experimentState.currentStimulus.positions,
        ),
        predicate: chosen.predicate,
        quantifier: chosen.quantifier,
        utterance: chosen.text,
        display_order: JSON.stringify(shuffled.map((u) => u.text)),
        selected_position: selected,
        rt: Math.round(performance.now() - trialStartTime),
      });
    });
  },
  on_finish: function () {
    clearInactivityTimer();
    updateProgress();
  },
};

// --- Listener wait between production rounds ---
const productionListenerWait = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <div class="waiting-container">
      <h2>Listener is responding…</h2>
      <div class="spinner"></div>
    </div>`,
  choices: "NO_KEYS",
  trial_duration: () =>
    randomInt(CONFIG.inter_trial_wait_min / 2, CONFIG.inter_trial_wait_max / 2),
};

// --- Block 1 production attention check (3 fixed utterances, same as original speaker experiment) ---
const block1AttentionCheck = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const seqLen = experimentState.block1Sequence.length;
    const goal = experimentState.goalCondition;
    const color = CONFIG.goal_colors[goal];

    // Fixed 3 utterances (matching original speaker experiment)
    const attentionUtterances = [
      {
        text: "The treatment was effective for most patients.",
        displayText:
          "The treatment was <b><u>effective</u></b> for <b><u>most</u></b> patients.",
      },
      {
        text: "The treatment was ineffective for some patients.",
        displayText:
          "The treatment was <b><u>ineffective</u></b> for <b><u>some</u></b> patients.",
      },
      {
        text: "The treatment was effective for some patients.",
        displayText:
          "The treatment was <b><u>effective</u></b> for <b><u>some</u></b> patients.",
      },
    ];

    const requiredDisplayText =
      "The treatment was effective for some patients.";

    const shuffled = shuffleArray([...attentionUtterances]);
    experimentState._attnShuffledUtterances = shuffled;

    let optionsHtml = '<div class="utterance-options">';
    shuffled.forEach((u, i) => {
      optionsHtml += `<label class="utterance-option" data-idx="${i}" data-text="${u.text}">
        <input type="radio" name="attn-utt" value="${i}">
        ${u.displayText}
      </label>`;
    });
    optionsHtml += "</div>";

    return `
      <div class="trial-container">
        <div class="trial-header">
          <span class="round-indicator" style="background:${color};">Round ${seqLen + 1} of ${seqLen + 1}</span>
        </div>
        <div class="stimulus-container" style="min-height:92px;">
          <div style="width:400px;height:92px;background:white;border:2px solid #ddd;border-radius:8px;margin:0 auto;"></div>
        </div>
        <div class="goal-reminder" style="background:${color}11;border:2px solid ${color};text-align:center;padding:8px 15px;min-height:auto;margin:10px auto 15px auto;max-width:700px;">
          Your goal: ${renderGoalHtml(goal, "speaker_round")}
        </div>
        <div class="response-section" style="min-width:500px;max-width:600px;">
          <p style="text-align:center;font-weight:500;margin-bottom:15px;">Please select exactly this description: "${requiredDisplayText}"</p>
          ${optionsHtml}
          <div style="text-align:center;">
            <button id="attn-submit" class="submit-btn" disabled>Send Description</button>
          </div>
        </div>
      </div>`;
  },
  choices: [],
  data: { task: "block1_attention_check" },
  on_load: function () {
    const trialStartTime = performance.now();
    startInactivityTimer();
    const requiredText = "The treatment was effective for some patients.";
    const options = document.querySelectorAll(".utterance-option");
    const btn = document.getElementById("attn-submit");
    let selectedText = "";

    options.forEach((opt) => {
      opt.addEventListener("click", () => {
        resetInactivityTimer();
        options.forEach((o) => o.classList.remove("selected"));
        opt.classList.add("selected");
        opt.querySelector("input").checked = true;
        selectedText = opt.dataset.text;
        btn.disabled = false;
      });
    });

    btn.addEventListener("click", () => {
      clearInactivityTimer();
      const passed = selectedText === requiredText;
      jsPsych.finishTrial({
        task: "block1_attention_check",
        required_description: requiredText,
        selected_description: selectedText,
        attention_check_passed: passed,
        rt: Math.round(performance.now() - trialStartTime),
      });
    });
  },
  on_finish: function () {
    clearInactivityTimer();
    updateProgress();
  },
};

const block1CompletionProduction = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="completion-container">
      <h2>✓ First Part Complete</h2>
      <p>You have finished describing all trials to your listener.</p>
      <p>Next, you will switch to a different role and be paired with a <strong>new partner</strong>.</p>
    </div>`,
  choices: ["Continue"],
  on_finish: updateProgress,
};

const block1ProductionStrategy = {
  type: jsPsychSurveyText,
  preamble: `<div class="feedback-container"><h2>Your Strategy</h2></div>`,
  questions: [
    {
      prompt:
        "Please describe the strategy you used when choosing descriptions for the listener. How did you try to achieve your goal?",
      name: "block1_strategy",
      rows: 5,
      required: false,
    },
  ],
  button_label: "Continue",
  data: { task: "block1_strategy" },
  on_finish: updateProgress,
};

const block1CompletionIdentification = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const scores = experimentState.idRoundScores;
    const selectedRound = Math.floor(Math.random() * scores.length);
    const nCorrect = scores[selectedRound];
    const bonus = ((nCorrect / 8) * 1.0).toFixed(2);

    // Store for data recording
    experimentState._idBonusRound = selectedRound;
    experimentState._idBonusAmount = parseFloat(bonus);

    return `
      <div class="completion-container">
        <h2>✓ Practice Complete</h2>
        <p>Great — you've completed the practice rounds on identifying permitted descriptions.</p>
        <div style="background:#f0f7ff;border:2px solid #2196F3;border-radius:8px;padding:15px;margin:20px 0;text-align:center;">
          <p style="margin:0 0 8px 0;">Round <strong>${selectedRound + 1}</strong> was randomly selected for your bonus.</p>
          <p style="margin:0;font-size:1.2em;">You scored ${nCorrect}/8 correct → Bonus: <strong style="color:#4CAF50;">$${bonus}</strong></p>
        </div>
        <p>Now you're ready to play the actual communication game.</p>
      </div>`;
  },
  choices: ["Continue"],
  data: { task: "block1_identification_completion" },
  on_finish: function () {
    // Record the bonus info
    jsPsych.data.addProperties({
      id_bonus_round: experimentState._idBonusRound + 1,
      id_bonus_score:
        experimentState.idRoundScores[experimentState._idBonusRound],
      id_bonus_amount: experimentState._idBonusAmount,
    });
    updateProgress();
  },
};

// ============================================================================
// 13. TRANSITION SCREENS
// ============================================================================

const transitionIdentification = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="intro-container">
      <h2>Your Role: Listener</h2>
      <p>You will now be paired with a <strong>participant</strong> who is playing the speaker.</p>
      <p>The speaker will receive 6 trial results and send you a description for each result.</p>
      <p>After receiving each description, you will predict for the next 5 new patients that the speaker will see how many would have an effective outcome.</p>
      <p>Your best strategy is to base each prediction on <strong>all the descriptions you have seen at that point</strong>, not just the current one.</p>
    </div>`,
  choices: ["Find a Speaker"],
  on_finish: updateProgress,
};

const transitionProduction = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="intro-container">
      <h2>Your New Role: Listener</h2>
      <p>You will now be paired with a <strong>different participant</strong> who is playing the speaker.</p>
      <p>The speaker will receive 6 trial results and send you a description for each result.</p>
      <p>After receiving each description, you will predict for the next 5 new patients that the speaker will see how many would have an effective outcome.</p>
      <p>Your best strategy is to base each prediction on <strong>all the descriptions you have seen at that point</strong>, not just the current one.</p>
    </div>`,
  choices: ["Find a Speaker"],
  on_finish: updateProgress,
};

// ============================================================================
// 14. BLOCK 2 — LISTENER TRIALS
// ============================================================================

const block2PairingWait = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <div class="waiting-container">
      <h2>Finding a speaker…</h2>
      <div class="spinner"></div>
      <p>Please wait while we pair you with another participant.</p>
    </div>`,
  choices: "NO_KEYS",
  trial_duration: () =>
    randomInt(CONFIG.pairing_wait_min, CONFIG.pairing_wait_max),
  on_finish: updateProgress,
};

const block2SpeakerMatched = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const goal = experimentState.goalCondition;
    const color = CONFIG.goal_colors[goal];
    const descHtml = renderGoalHtml(goal, "listener");
    return `
      <div class="intro-container" style="text-align:center;">
        <h2 style="color:#4CAF50;">✓ Speaker Matched</h2>
        <p>You are now connected with a speaker whose goal is:</p>
        <div style="background:${color}11;border:2px solid ${color};border-radius:8px;padding:12px;margin:15px auto;max-width:500px;">
          <p style="margin:0;">Your speaker's goal: ${descHtml}</p>
        </div>
        <p>Remember: the speaker can only use descriptions that satisfy the Reporting Regulations, but the speaker <strong>chooses</strong> which permitted description to give you.</p>
      </div>`;
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// --- Speaker wait between Block 2 rounds ---
const block2SpeakerWait = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: function () {
    const round = experimentState.block2Round;
    const msg =
      round === 0
        ? "Speaker is receiving the first trial result and responding…"
        : "Speaker is receiving next trial result and responding…";
    return `
      <div class="waiting-container">
        <h2>${msg}</h2>
        <div class="spinner"></div>
        <p>Waiting for description…</p>
      </div>`;
  },
  choices: "NO_KEYS",
  trial_duration: () =>
    randomInt(CONFIG.inter_trial_wait_min, CONFIG.inter_trial_wait_max),
};

// --- Block 2 trial template (predictive posterior only, 6 image options) ---
const block2TrialTemplate = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const round = experimentState.block2Round;
    const utt = experimentState.block2Sequence[round];
    const fmtUtt = formatUtterance(utt);
    const goal = experimentState.goalCondition;
    const color = CONFIG.goal_colors[goal];
    const descHtml = renderGoalHtml(goal, "listener_round");
    const b2Len = experimentState.block2Sequence.length;

    // Generate 6 image cards (counterbalanced order)
    const order = experimentState.imageOrderReversed
      ? [5, 4, 3, 2, 1, 0]
      : [0, 1, 2, 3, 4, 5];

    let imgHtml = "";
    order.forEach((k) => {
      const imgPath = Stimuli.getImagePath(k, 0);
      imgHtml += `<div class="observation-card" data-pred="${k}" id="pred-card-${k}">
        <img src="${imgPath}">
        <div class="obs-label">${k} effective</div>
      </div>`;
    });

    return `
      <div class="trial-container">
        <div class="trial-header">
          <span class="round-indicator">Round ${round + 1} of ${b2Len}</span>
        </div>

        <div class="utterance-display" style="margin-bottom:20px;">
          <div class="label">The speaker described the trial result as:</div>
          <div class="utterance-text">${fmtUtt.displayText}</div>
        </div>

        <div class="response-section">
          <p style="text-align:center;color:#555;margin-bottom:6px;font-size:0.95em;">Think about the <strong>speaker's goal</strong> and <strong>all the descriptions you've received so far</strong>.</p>
          <h4 style="text-align:center;">For the 5 new patients the speaker will see next round, how many effective cases do you think there would be?</h4>
          <div class="observation-options">${imgHtml}</div>

          <div class="goal-reminder" style="background:${color}11;border:2px solid ${color};text-align:center;font-size:0.95em;padding:8px 12px;margin:20px auto 10px auto;max-width:520px;">
            Your speaker's goal: ${descHtml}
          </div>

          <button id="b2-submit" class="submit-btn" disabled style="margin-top:15px;">Submit Response</button>
        </div>
      </div>`;
  },
  choices: [],
  data: { task: "block2_trial" },
  on_load: function () {
    const trialStartTime = performance.now();
    startInactivityTimer();

    const btn = document.getElementById("b2-submit");
    let selectedPred = null;

    // Image card handlers
    document.querySelectorAll(".observation-card").forEach((card) => {
      card.addEventListener("click", () => {
        resetInactivityTimer();
        document
          .querySelectorAll(".observation-card")
          .forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        selectedPred = parseInt(card.dataset.pred);
        btn.disabled = false;
      });
    });

    // Submit
    btn.addEventListener("click", () => {
      clearInactivityTimer();
      const round = experimentState.block2Round;
      const utt = experimentState.block2Sequence[round];
      const possibleObs = getPossibleObservations(
        utt.predicate,
        utt.quantifier,
      );

      jsPsych.finishTrial({
        task: "block2_trial",
        round: round + 1,
        goal_condition: experimentState.goalCondition,
        grounding_condition: experimentState.groundingCondition,
        utterance_predicate: utt.predicate,
        utterance_quantifier: utt.quantifier,
        utterance_text: formatUtterance(utt).text,
        possible_observations: JSON.stringify(possibleObs),
        predictive_posterior: selectedPred,
        image_order_reversed: experimentState.imageOrderReversed,
        rt: Math.round(performance.now() - trialStartTime),
      });
    });
  },
  on_finish: function () {
    clearInactivityTimer();
    updateProgress();
  },
};

// ============================================================================
// 15. BLOCK 2 — ATTENTION CHECK (disguised as round N+1)
// ============================================================================

const block2AttentionCheckWait = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <div class="waiting-container">
      <h2>Speaker is receiving next trial result and responding…</h2>
      <div class="spinner"></div>
      <p>Waiting for description…</p>
    </div>`,
  choices: "NO_KEYS",
  trial_duration: () =>
    randomInt(CONFIG.inter_trial_wait_min, CONFIG.inter_trial_wait_max),
};

const block2AttentionCheck = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const b2Len = experimentState.block2Sequence.length;
    const ac = CONFIG.block2_attention_check;
    const goal = experimentState.goalCondition;
    const color = CONFIG.goal_colors[goal];
    const descHtml = renderGoalHtml(goal, "listener_round");

    // Same 6 images as regular trials, counterbalanced order
    const order = experimentState.imageOrderReversed
      ? [5, 4, 3, 2, 1, 0]
      : [0, 1, 2, 3, 4, 5];

    let imgHtml = "";
    order.forEach((k) => {
      const imgPath = Stimuli.getImagePath(k, 0);
      imgHtml += `<div class="observation-card" data-pred="${k}" id="ac-pred-${k}">
        <img src="${imgPath}">
        <div class="obs-label">${k} effective</div>
      </div>`;
    });

    return `
      <div class="trial-container">
        <div class="trial-header">
          <span class="round-indicator">Round ${b2Len + 1} of ${b2Len + 1}</span>
        </div>

        <div class="utterance-display" style="margin-bottom:20px;">
          <div class="label">The speaker described the trial result as:</div>
          <div class="utterance-text">${ac.instruction_text}</div>
        </div>

        <div class="response-section">
          <p style="text-align:center;color:#555;margin-bottom:6px;font-size:0.95em;">Think about the <strong>speaker's goal</strong> and <strong>all the descriptions you've received so far</strong>.</p>
          <h4 style="text-align:center;">For the 5 new patients the speaker will see next round, how many effective cases do you think there would be?</h4>
          <div class="observation-options">${imgHtml}</div>

          <div class="goal-reminder" style="background:${color}11;border:2px solid ${color};text-align:center;font-size:0.95em;padding:8px 12px;margin:20px auto 10px auto;max-width:520px;">
            Your speaker's goal: ${descHtml}
          </div>

          <button id="ac-submit" class="submit-btn" disabled style="margin-top:15px;">Submit Response</button>
        </div>
      </div>`;
  },
  choices: [],
  data: { task: "block2_attention_check" },
  on_load: function () {
    const trialStartTime = performance.now();
    startInactivityTimer();

    const btn = document.getElementById("ac-submit");
    let selectedPred = null;

    document.querySelectorAll(".observation-card").forEach((card) => {
      card.addEventListener("click", () => {
        resetInactivityTimer();
        document
          .querySelectorAll(".observation-card")
          .forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        selectedPred = parseInt(card.dataset.pred);
        btn.disabled = false;
      });
    });

    btn.addEventListener("click", () => {
      clearInactivityTimer();
      const ac = CONFIG.block2_attention_check;
      const predPassed = selectedPred === ac.correct_prediction;

      jsPsych.finishTrial({
        task: "block2_attention_check",
        prediction_selected: selectedPred,
        prediction_correct: predPassed,
        attention_check_passed: predPassed,
        rt: Math.round(performance.now() - trialStartTime),
      });
    });
  },
  on_finish: function () {
    clearInactivityTimer();
    updateProgress();
  },
};

// Record attention check result and add to global data properties
const block2AttentionCheckRecord = {
  type: jsPsychCallFunction,
  func: function () {
    const d = jsPsych.data
      .get()
      .filter({ task: "block2_attention_check" })
      .last(1)
      .values()[0];

    // Also check block1 attention check if production condition
    let b1Passed = null;
    if (experimentState.groundingCondition === "production") {
      const b1d = jsPsych.data
        .get()
        .filter({ task: "block1_attention_check" })
        .last(1)
        .values()[0];
      b1Passed = b1d ? b1d.attention_check_passed : null;
    }

    jsPsych.data.addProperties({
      block1_attention_passed: b1Passed,
      block2_attention_passed: d ? d.attention_check_passed : null,
    });
  },
};

// ============================================================================
// 15b. BONUS EXPLANATION PAGES
// ============================================================================

const block1IdentificationBonus = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="intro-container">
      <h2>Bonus for This Task</h2>
      <p>After you complete all practice rounds, <strong>one round will be randomly selected</strong> to determine your bonus.</p>
      <p>For that round, your bonus depends on how many of the 8 descriptions you correctly classified:</p>
      <div class="regulations-box" style="text-align:center;padding:15px;margin:15px 0;">
        <p style="margin:0;font-size:1.1em;"><strong>You earn $0.125 for each description you classify correctly</strong></p>
        <p style="margin:8px 0 0 0;color:#666;">8 out of 8 correct → <strong>$1.00</strong> &nbsp;|&nbsp; 6 out of 8 → <strong>$0.75</strong> &nbsp;|&nbsp; 4 out of 8 → <strong>$0.50</strong></p>
      </div>
      <p>Try to be as accurate as possible on every round!</p>
    </div>`,
  choices: ["Got it — Start Practice"],
  on_finish: updateProgress,
};

const block1ProductionBonus = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const goal = experimentState.goalCondition;
    const color = CONFIG.goal_colors[goal];

    let bonusExplanation;
    if (goal === "informative") {
      bonusExplanation = `
        <p>After each round, the listener will predict <strong>how many out of the next 5 new patients</strong> would have an effective outcome.</p>
        <p>After all rounds, <strong>one round will be randomly selected</strong>. Your bonus depends on how accurate the listener's prediction is:</p>
        <div style="background:${color}11;border:2px solid ${color};border-radius:8px;text-align:center;padding:15px;margin:15px 0;">
          <p style="margin:0;font-size:1.1em;"><strong>You earn $0.20 for each patient the listener predicts correctly</strong></p>
          <p style="margin:8px 0 0 0;color:#666;">You saw 3 effective and listener predicts 3 → <strong>$1.00</strong> (5 out of 5 correct)</p>
          <p style="margin:4px 0 0 0;color:#666;">Predicts 4 (off by 1) → <strong>$0.80</strong> &nbsp;|&nbsp; Predicts 5 (off by 2) → <strong>$0.60</strong></p>
        </div>
        <p>The more informative your descriptions, the more accurate the listener's predictions will be!</p>`;
    } else if (goal === "pers_plus") {
      bonusExplanation = `
        <p>After each round, the listener will predict <strong>how many out of the next 5 new patients</strong> would have an effective outcome.</p>
        <p>After all rounds, <strong>one round will be randomly selected</strong>. Your bonus depends on the listener's prediction for that round:</p>
        <div style="background:${color}11;border:2px solid ${color};border-radius:8px;text-align:center;padding:15px;margin:15px 0;">
          <p style="margin:0;font-size:1.1em;"><strong>You earn $0.20 for each effective patient the listener predicts</strong></p>
          <p style="margin:8px 0 0 0;color:#666;">Listener predicts 5 effective → <strong>$1.00</strong> &nbsp;|&nbsp; Predicts 4 → <strong>$0.80</strong> &nbsp;|&nbsp; Predicts 2 → <strong>$0.40</strong></p>
        </div>
        <p>The more effective the listener thinks the treatment is, the higher your bonus!</p>`;
    } else {
      // pers_minus
      bonusExplanation = `
        <p>After each round, the listener will predict <strong>how many out of the next 5 new patients</strong> would have an effective outcome.</p>
        <p>After all rounds, <strong>one round will be randomly selected</strong>. Your bonus depends on the listener's prediction for that round:</p>
        <div style="background:${color}11;border:2px solid ${color};border-radius:8px;text-align:center;padding:15px;margin:15px 0;">
          <p style="margin:0;font-size:1.1em;"><strong>You earn $0.20 for each ineffective patient the listener predicts</strong></p>
          <p style="margin:8px 0 0 0;color:#666;">Listener predicts 0 effective (= 5 ineffective) → <strong>$1.00</strong> &nbsp;|&nbsp; Predicts 1 effective → <strong>$0.80</strong> &nbsp;|&nbsp; Predicts 3 effective → <strong>$0.40</strong></p>
        </div>
        <p>The less effective the listener thinks the treatment is, the higher your bonus!</p>`;
    }

    return `
      <div class="intro-container">
        <h2>Bonus for This Task</h2>
        ${bonusExplanation}
      </div>`;
  },
  choices: ["Got it — Start Describing"],
  on_finish: updateProgress,
};

const block2ListenerBonus = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const goal = experimentState.goalCondition;
    const color = CONFIG.goal_colors[goal];
    return `
    <div class="intro-container">
      <h2>Bonus for This Task</h2>
      <p>After each round, you will predict how many out of the <strong>next 5 new patients the speaker will see</strong> would have an effective outcome.</p>
      <p>After all rounds, <strong>one round will be randomly selected</strong>. Your bonus depends on how accurate your prediction is:</p>
      <div style="background:${color}11;border:2px solid ${color};border-radius:8px;text-align:center;padding:15px;margin:15px 0;">
        <p style="margin:0;font-size:1.1em;"><strong>You earn $0.20 for each patient you predict correctly</strong></p>
        <p style="margin:8px 0 0 0;color:#666;">True outcome is 3 effective and you predict 3 → <strong>$1.00</strong> (5 out of 5 correct)</p>
        <p style="margin:4px 0 0 0;color:#666;">Predict 4 (off by 1) → <strong>$0.80</strong> &nbsp;|&nbsp; Predict 5 (off by 2) → <strong>$0.60</strong></p>
      </div>
      <p>For each round, think carefully about <strong>the speaker's goal</strong> and <strong>all the descriptions you have received at that point</strong> to make the best prediction.</p>
    </div>`;
  },
  choices: ["Got it"],
  on_finish: updateProgress,
};

// Listener comprehension check: predict next 5, not infer current
const listenerCompOptions = {
  correct:
    "Based on <strong>all descriptions up to this round</strong>, how many of the 5 patients <strong>will</strong> have effective outcomes in <strong>the upcoming trial</strong>?",
  incorrect:
    "Based on <strong>the description of this round</strong>, how many of the 5 patients <strong>had</strong> effective outcomes in <strong>the trial just described</strong>?",
};
let listenerCompCorrectIndex = 0; // will be set at runtime

const listenerCompCheck = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="intro-container">
      <h2>Quick Check</h2>
      <p>After the speaker sends a description each round, what are you asked to predict?</p>
    </div>`,
  choices: function () {
    const reversed = Math.random() < 0.5;
    listenerCompCorrectIndex = reversed ? 1 : 0;
    return reversed
      ? [listenerCompOptions.incorrect, listenerCompOptions.correct]
      : [listenerCompOptions.correct, listenerCompOptions.incorrect];
  },
  button_html:
    '<button class="jspsych-btn" style="max-width:500px;white-space:normal;text-align:left;line-height:1.5;padding:12px 18px;margin:6px 0;">%choice%</button>',
  data: { task: "listener_comp_check" },
  on_finish: function (data) {
    data.listener_comp_correct = data.response === listenerCompCorrectIndex;
    updateProgress();
  },
};

const listenerCompFeedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const d = jsPsych.data
      .get()
      .filter({ task: "listener_comp_check" })
      .last(1)
      .values()[0];
    if (d && d.listener_comp_correct) {
      return `
        <div class="intro-container">
          <div style="background:#e8f5e9;border:2px solid #4CAF50;border-radius:8px;padding:15px;margin:15px 0;">
            <p style="margin:0;color:#2e7d32;"><strong>✓ Correct!</strong></p>
            <p style="margin:8px 0 0 0;">Based on <strong>all descriptions up to this round</strong>, you predict how many of the five patients <strong>will</strong> have effective outcomes in <strong>the upcoming trial</strong>.</p>
            <p style="margin:8px 0 0 0;">The more accurate your prediction, the higher your bonus.</p>
          </div>
        </div>`;
    } else {
      return `
        <div class="intro-container">
          <div style="background:#ffebee;border:2px solid #f44336;border-radius:8px;padding:15px;margin:15px 0;">
            <p style="margin:0;color:#c62828;"><strong>✗ Not quite.</strong></p>
            <p style="margin:8px 0 0 0;">You are <strong>not</strong> trying to figure out what the speaker saw in the trial they just described.</p>
            <p style="margin:8px 0 0 0;">Instead, based on <strong>all descriptions up to this round</strong>, you predict how many of the five patients <strong>will</strong> have effective outcomes in <strong>the upcoming trial</strong>.</p>
            <p style="margin:8px 0 0 0;">The more accurate your prediction, the higher your bonus.</p>
          </div>
        </div>`;
    }
  },
  choices: ["Start Listening"],
  on_finish: updateProgress,
};

// ============================================================================
// 16. POST-TASK MEASURES
// ============================================================================

const listenerStrategyQuestion = {
  type: jsPsychSurveyText,
  preamble: `<div class="feedback-container"><h2>Your Strategy</h2></div>`,
  questions: [
    {
      prompt:
        "How did you use the speaker's goal and descriptions to predict how effective the treatment was?",
      name: "listener_strategy",
      rows: 5,
      required: false,
    },
  ],
  button_label: "Continue",
  data: { task: "listener_strategy" },
  on_finish: updateProgress,
};

const block2Completion = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="completion-container">
      <h2>✓ Listener Task Complete</h2>
      <p>You have finished all rounds of the listener task.</p>
      <p>You're almost done — just a couple of final questions.</p>
    </div>`,
  choices: ["Continue"],
  on_finish: updateProgress,
};

const generalFeedback = {
  type: jsPsychSurveyText,
  preamble: `<div class="feedback-container"><h2>Final Feedback</h2></div>`,
  questions: [
    {
      prompt:
        "Do you have any other comments or feedback about this experiment? Was anything confusing?",
      name: "general_feedback",
      rows: 4,
      required: false,
    },
  ],
  button_label: "Continue",
  data: { task: "general_feedback" },
  on_finish: updateProgress,
};

// ============================================================================
// 17. DEBRIEF
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
        <p>We want to let you know that the "speaker" and "listener" in this study were <strong>simulated</strong> — there was no real-time matching with another participant.</p>
        <p>However, your responses are extremely valuable for our research on how people interpret information from different types of sources.</p>
        <p><strong>You will receive the full compensation and bonus as described.</strong></p>
        ${
          isProlific
            ? '<p style="margin-top:30px;color:#4CAF50;font-weight:bold;">Click below to complete the study and return to Prolific.</p>'
            : '<p style="margin-top:30px;">If you have questions, please contact the research team.</p>'
        }
      </div>`;
  },
  choices: function () {
    return [prolificPID ? "Complete & Return to Prolific" : "Complete Study"];
  },
  on_finish: updateProgress,
};

// ============================================================================
// 18. TIMELINE CONSTRUCTION
// ============================================================================

const timeline = [];

// --- Preload all images ---
timeline.push({
  type: jsPsychPreload,
  images: Stimuli.getAllImagePaths(),
  show_progress_bar: true,
  message: "<p>Loading experiment…</p>",
});

// --- Welcome + Consent ---
timeline.push(welcome);
timeline.push(consent);

// --- DataPipe Condition Assignment (fetch early for balanced allocation) ---
if (DATAPIPE_CONFIG.enabled) {
  timeline.push(fetchCondition);
} else {
  timeline.push(fetchConditionFallback);
}

// --- Instructions ---
timeline.push(instructions);

// --- Comprehension Checks ---
timeline.push(comp1a);
timeline.push(comp1a_feedback);
timeline.push(comp1b);
timeline.push(comp1b_feedback);
timeline.push(comp2);
timeline.push(comp2_feedback);
timeline.push(explanationMultiplePermitted);
timeline.push(comp3a);
timeline.push(comp3a_feedback);
timeline.push(explanationMultipleResults);
timeline.push(comp3b);
timeline.push(comp3b_feedback);

// --- Comprehension Summary ---
timeline.push(comprehensionSummary);

// --- Condition Assignment ---
timeline.push(assignConditions);

// --- Block 1: Identification path ---
timeline.push({
  timeline: [block1IdentificationIntro, block1IdentificationBonus],
  conditional_function: () =>
    experimentState.groundingCondition === "identification",
});

// Identification looping rounds (initialize counter → loop)
timeline.push({
  type: jsPsychCallFunction,
  func: () => {
    experimentState.block1Round = 0;
  },
  conditional_function: () =>
    experimentState.groundingCondition === "identification",
});

timeline.push({
  timeline: [identificationTrialTemplate, identificationFeedbackTemplate],
  loop_function: function () {
    experimentState.block1Round++;
    return experimentState.block1Round < experimentState.block1Sequence.length;
  },
  conditional_function: () =>
    experimentState.groundingCondition === "identification",
});

// Transition (identification)
timeline.push({
  timeline: [block1CompletionIdentification, transitionIdentification],
  conditional_function: () =>
    experimentState.groundingCondition === "identification",
});

// --- Block 1: Production path ---
timeline.push({
  timeline: [
    block1ProductionIntro,
    block1GoalAssignment,
    block1GoalCompCheck,
    block1GoalCompFeedback,
    block1PairingWait,
    block1ListenerMatched,
    block1ProductionBonus,
  ],
  conditional_function: () =>
    experimentState.groundingCondition === "production",
});

// Production looping rounds
timeline.push({
  type: jsPsychCallFunction,
  func: () => {
    experimentState.block1Round = 0;
  },
  conditional_function: () =>
    experimentState.groundingCondition === "production",
});

timeline.push({
  timeline: [productionTrialTemplate, productionListenerWait],
  loop_function: function () {
    experimentState.block1Round++;
    return experimentState.block1Round < experimentState.block1Sequence.length;
  },
  conditional_function: () =>
    experimentState.groundingCondition === "production",
});

// Production attention check + strategy + completion
timeline.push({
  timeline: [
    block1AttentionCheck,
    block1ProductionStrategy,
    block1CompletionProduction,
  ],
  conditional_function: () =>
    experimentState.groundingCondition === "production",
});

// Transition (production)
timeline.push({
  timeline: [transitionProduction],
  conditional_function: () =>
    experimentState.groundingCondition === "production",
});

// --- Block 2: Listener trials (all participants) ---
timeline.push(block2PairingWait);
timeline.push(block2SpeakerMatched);
timeline.push(block2ListenerBonus);
timeline.push(listenerCompCheck);
timeline.push(listenerCompFeedback);

// Initialize Block 2 round counter
timeline.push({
  type: jsPsychCallFunction,
  func: () => {
    experimentState.block2Round = 0;
  },
});

// Block 2 looping rounds
timeline.push({
  timeline: [block2SpeakerWait, block2TrialTemplate],
  loop_function: function () {
    experimentState.block2Round++;
    return experimentState.block2Round < experimentState.block2Sequence.length;
  },
});

// Block 2 attention check
timeline.push(block2AttentionCheckWait);
timeline.push(block2AttentionCheck);
timeline.push(block2AttentionCheckRecord);

// --- Post-Block 2: Listener strategy → Completion → General feedback → Debrief ---
timeline.push(listenerStrategyQuestion);
timeline.push(block2Completion);
timeline.push(generalFeedback);

// Mark completed
timeline.push({
  type: jsPsychCallFunction,
  func: function () {
    jsPsych.data.addProperties({
      completion_status: "completed",
      completion_time: new Date().toISOString(),
      terminated_early: false,
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

timeline.push(debrief);

// --- Run ---
jsPsych.run(timeline);
