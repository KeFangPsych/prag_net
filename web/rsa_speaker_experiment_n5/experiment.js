/**
 * experiment.js - Main experiment logic for N=5 patients, M=1 session
 * Updated version with all requested changes
 */

// ============================================================================
// SUBJECT ID AND PROLIFIC INTEGRATION
// ============================================================================

// Get URL parameters (for Prolific integration)
const urlParams = new URLSearchParams(window.location.search);
const prolificPID = urlParams.get("PROLIFIC_PID") || null;
const studyID = urlParams.get("STUDY_ID") || null;
const sessionID = urlParams.get("SESSION_ID") || null;

// Generate subject ID: use Prolific ID if available, otherwise generate random
function generateSubjectId() {
  if (prolificPID) {
    return prolificPID;
  }
  // Generate random ID for testing
  return (
    "test_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now()
  );
}

const subjectId = generateSubjectId();

// ============================================================================
// PROLIFIC CONFIGURATION - UPDATE THESE WITH YOUR ACTUAL CODES
// ============================================================================

const PROLIFIC_COMPLETION_CODE = "C3GA5EUH"; // For successful completion
const PROLIFIC_SCREENING_CODE = "C1C5BAEZ"; // For early termination (custom screening)

// Initialize jsPsych
const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: false,
  on_finish: function () {
    // Redirect to Prolific completion page if running on Prolific
    if (prolificPID) {
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

// Experiment state
const experimentState = {
  comp2_index: 0,
  comp2_items: [],
  currentScenario: null,
  currentSequence: [],
  currentSeqIdx: 0,
  blockOrder: [],
  blockNum: 0,
  attentionFailures: 0,
  attentionCheckRound: -1,
  totalTrials: 0,
  completedTrials: 0,
  roleCompOptions: [],
  currentTrialUtterances: [],
  currentStimulusInfo: null,
  // Inactivity timer state
  inactivityTimer: null,
  inactivityStartTime: null,
  warning1Shown: false,
  warning2Shown: false,
};

// Calculate total trials for progress bar
// Added role comprehension checks (3 checks + 3 feedbacks)
const TOTAL_PROGRESS_STEPS = 65;

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
  // Remove any existing warning
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
            ⚠️ ${isUrgent ? "Urgent: " : ""}Listener Waiting!
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

    // First warning at 30 seconds
    if (
      elapsed >= CONFIG.inactivity_warning_1 &&
      !experimentState.warning1Shown
    ) {
      experimentState.warning1Shown = true;
      showInactivityWarning(
        "Your listener is waiting for your response.<br>Please select a description soon.",
        false,
      );
    }

    // Second warning at 60 seconds (urgent)
    if (
      elapsed >= CONFIG.inactivity_warning_2 &&
      !experimentState.warning2Shown
    ) {
      experimentState.warning2Shown = true;
      showInactivityWarning(
        "Your listener has been waiting for over a minute!<br><strong>Please respond within 30 seconds or the study will end.</strong>",
        true,
      );
    }

    // Timeout at 90 seconds - terminate experiment
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
// EARLY TERMINATION WITH DATA SAVING
// ============================================================================

function getTerminationMessage(reason) {
  const isProlific = !!prolificPID;

  // For Prolific participants, show a button to return via screening path
  const prolificRedirect = isProlific
    ? `
        <div style="margin-top: 25px; padding: 20px; background: #e3f2fd; border: 2px solid #2196F3; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 15px 0; color: #1565c0;"><strong>Click the button below to return to Prolific and receive partial compensation:</strong></p>
            <button onclick="window.location.href='https://app.prolific.com/submissions/complete?cc=${PROLIFIC_SCREENING_CODE}'" 
                    style="padding: 12px 30px; font-size: 16px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer;">
                Return to Prolific
            </button>
        </div>
    `
    : "";

  if (reason === "attention_check_failure") {
    return `<div class="debrief-container">
            <h2 style="color: #f44336;">Study Ended</h2>
            <p>Unfortunately, the study has ended because attention checks were not passed.</p>
            <p style="margin-top: 15px; color: #666;">Your partial data has been saved. Thank you for your time.</p>
            ${prolificRedirect}
        </div>`;
  } else if (reason === "inactivity_timeout") {
    return `<div class="debrief-container">
            <h2 style="color: #f44336;">Study Ended Due to Inactivity</h2>
            <p>Unfortunately, the study has ended because no response was received within the time limit.</p>
            <p style="margin-top: 15px; color: #666;">Your partial data has been saved.</p>
            ${prolificRedirect}
        </div>`;
  } else {
    return `<div class="debrief-container">
            <h2 style="color: #f44336;">Study Ended</h2>
            <p>The study has ended unexpectedly.</p>
            <p style="margin-top: 15px; color: #666;">Your partial data has been saved.</p>
            ${prolificRedirect}
        </div>`;
  }
}

async function saveDataAndEndExperiment(reason, customMessage = null) {
  // Add termination info to data
  // completion_status values: 'completed', 'terminated_attention_check', 'terminated_inactivity'
  let completionStatus = "terminated_unknown";
  if (reason === "attention_check_failure") {
    completionStatus = "terminated_attention_check";
  } else if (reason === "inactivity_timeout") {
    completionStatus = "terminated_inactivity";
  }

  jsPsych.data.addProperties({
    completion_status: completionStatus,
    completion_time: new Date().toISOString(),
    terminated_early: true,
    termination_reason: reason,
  });

  // Try to save data to DataPipe before ending
  if (DATAPIPE_CONFIG.enabled) {
    try {
      const response = await fetch("https://pipe.jspsych.org/api/data/", {
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
      console.log("Data saved before early termination:", response.ok);
    } catch (error) {
      console.error("Failed to save data on early termination:", error);
    }
  }

  // Use custom message or generate appropriate message
  const message = customMessage || getTerminationMessage(reason);

  // End the experiment
  jsPsych.endExperiment(message);
}

// ============================================================================
// INSTRUCTION PAGES
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
        <p>You will describe results using sentences like this:</p>
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
            <p class="subtitle">This is a study about how we share information with others.</p>
            <p>This study takes approximately <strong>15-20 minutes</strong> to complete.</p>
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
                <p><strong>PAYMENTS:</strong> You will receive a base payment of <strong>${CONFIG.base_payment}</strong> for completing this study. Additionally, you may earn bonus payments of up to <strong>${CONFIG.block_bonus_max} per block</strong> (up to $3 total) based on your performance as described in the instructions. If you do not complete this study, you will receive prorated payment based on the time that you have spent. <strong>Please note:</strong> This study includes attention checks throughout. Failing attention checks may result in early termination of the study and forfeiture of compensation.</p>
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
    // Change button text on last page
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
// 4. COMPREHENSION TESTS
// ============================================================================

// --- Module 1: Quantifier Definitions (with immediate feedback, no retry) ---

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

// --- Module 2: True/False Judgments (with explanatory feedback, no retry) ---

const comp2_welcome = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="comprehension-container">
        <h2>Quick Check: True or False?</h2>
        <p>For each trial result shown, decide if the statement is <strong>TRUE</strong> or <strong>FALSE</strong>.</p>
    </div>`,
  choices: ["Begin"],
  on_finish: function () {
    experimentState.comp2_items = shuffleArray([
      ...CONFIG.comprehension.module2,
    ]);
    experimentState.comp2_index = 0;
    updateProgress();
  },
};

const comp2_trial_1 = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const item = experimentState.comp2_items[0];
    const imgPath = Stimuli.getImagePath(item.numEffective, 0); // Use variant 0 for comprehension
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
      jsPsych.finishTrial({
        task: "comp2",
        item_index: 0,
        item: item,
        response: true,
        comp2_correct: item.correct === true,
      });
    });

    document.getElementById("btn-false").addEventListener("click", () => {
      jsPsych.finishTrial({
        task: "comp2",
        item_index: 0,
        item: item,
        response: false,
        comp2_correct: item.correct === false,
      });
    });
  },
  on_finish: updateProgress,
};

const comp2_feedback_1 = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data
      .get()
      .filter({ task: "comp2", item_index: 0 })
      .last(1)
      .values()[0];
    const item = data.item;
    const numIneffective = 5 - item.numEffective;

    let explanation = "";
    // Check using lowercase since statements now use lowercase
    const statementLower = item.statement.toLowerCase();
    if (
      statementLower.includes("ineffective") &&
      statementLower.includes("some")
    ) {
      explanation = `<strong>SOME</strong> means at least 1. The treatment was ineffective for ${numIneffective} patient${numIneffective === 1 ? "" : "s"}.`;
    } else if (
      statementLower.includes("ineffective") &&
      statementLower.includes("all")
    ) {
      explanation = `<strong>ALL</strong> means all 5. The treatment was ineffective for only ${numIneffective} patient${numIneffective === 1 ? "" : "s"}.`;
    }

    if (data.comp2_correct) {
      return `<div class="comprehension-container">
                <h2 style="color: #4CAF50;">✓ Correct</h2>
                <p>${explanation}</p>
            </div>`;
    } else {
      return `<div class="comprehension-container">
                <h2 style="color: #f44336;">✗ Incorrect</h2>
                <p>The answer is <strong>${item.correct ? "TRUE" : "FALSE"}</strong>. ${explanation}</p>
            </div>`;
    }
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

const comp2_trial_2 = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const item = experimentState.comp2_items[1];
    const imgPath = Stimuli.getImagePath(item.numEffective, 0); // Use variant 0 for comprehension
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
      jsPsych.finishTrial({
        task: "comp2",
        item_index: 1,
        item: item,
        response: true,
        comp2_correct: item.correct === true,
      });
    });

    document.getElementById("btn-false").addEventListener("click", () => {
      jsPsych.finishTrial({
        task: "comp2",
        item_index: 1,
        item: item,
        response: false,
        comp2_correct: item.correct === false,
      });
    });
  },
  on_finish: updateProgress,
};

const comp2_feedback_2 = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const data = jsPsych.data
      .get()
      .filter({ task: "comp2", item_index: 1 })
      .last(1)
      .values()[0];
    const item = data.item;
    const numIneffective = 5 - item.numEffective;

    let explanation = "";
    // Check using lowercase since statements now use lowercase
    const statementLower = item.statement.toLowerCase();
    if (
      statementLower.includes("ineffective") &&
      statementLower.includes("some")
    ) {
      explanation = `<strong>SOME</strong> means at least 1. The treatment was ineffective for ${numIneffective} patient${numIneffective === 1 ? "" : "s"}.`;
    } else if (
      statementLower.includes("ineffective") &&
      statementLower.includes("all")
    ) {
      explanation = `<strong>ALL</strong> means all 5. The treatment was ineffective for only ${numIneffective} patient${numIneffective === 1 ? "" : "s"}.`;
    }

    if (data.comp2_correct) {
      return `<div class="comprehension-container">
                <h2 style="color: #4CAF50;">✓ Correct</h2>
                <p>${explanation}</p>
            </div>`;
    } else {
      return `<div class="comprehension-container">
                <h2 style="color: #f44336;">✗ Incorrect</h2>
                <p>The answer is <strong>${item.correct ? "TRUE" : "FALSE"}</strong>. ${explanation}</p>
            </div>`;
    }
  },
  choices: ["Continue"],
  on_finish: updateProgress,
};

// --- Module 3: Multiple Choice (with explanatory feedback, no retry) ---

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
      const imgPath = Stimuli.getImagePath(opt.numEffective, 0); // Use variant 0 for comprehension
      html += `<div class="checkbox-option" data-idx="${i}" id="opt-${i}">
                <img src="${imgPath}" style="max-width: 180px;">
                <div class="checkbox-label">
                    <span class="checkbox-marker"></span>
                </div>
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
// 5. MAIN SPEAKER TASK
// ============================================================================

const speakerIntro = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="scenario-container">
        <h2>The Speaker Task</h2>
        <p>Now you will play three different roles. For each role, you will describe the clinical trials you see to a different listener.</p>

        <div style="display: flex; flex-direction: column; gap: 12px; margin: 25px 0; text-align: left;">
            <div style="background: #e3f2fd; border-left: 4px solid #2196F3; padding: 12px 16px; border-radius: 4px;">
                <span style="font-size: 1.3em; margin-right: 8px;">🔬</span><strong style="color: #1565c0;">Unbiased Scientist</strong> — Help the listener identify the true outcome
            </div>
            <div style="background: #e8f5e9; border-left: 4px solid #4CAF50; padding: 12px 16px; border-radius: 4px;">
                <span style="font-size: 1.3em; margin-right: 8px;">👍</span><strong style="color: #2e7d32;">Treatment Company Rep</strong> — Make the treatment seem as effective as possible
            </div>
            <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 12px 16px; border-radius: 4px;">
                <span style="font-size: 1.3em; margin-right: 8px;">👎</span><strong style="color: #c62828;">Competitor Company Rep</strong> — Make the treatment seem as ineffective as possible
            </div>
        </div>

        <p>For each role, you will describe <strong>10 clinical trials</strong> to a listener.</p>
        <p>Your bonus (up to <strong>${PAYMENT.block_bonus_max} per role</strong>) depends on how well you achieve your goal.</p>
        <p style="margin-top: 20px;"><strong>Remember:</strong> You can only send descriptions that are TRUE.</p>
    </div>`,
  choices: ["Continue"],
  on_finish: function () {
    experimentState.blockOrder = shuffleArray([
      "informative",
      "pers_plus",
      "pers_minus",
    ]);
    experimentState.blockNum = 0;
    experimentState.attentionFailures = 0;
    updateProgress();
  },
};

function createBlock(blockIdx) {
  const timeline = [];

  // Randomly choose after which round (5-9) to insert attention check
  const attentionCheckAfterRound = Math.floor(Math.random() * 5) + 5; // 5, 6, 7, 8, or 9

  // Initialize block
  timeline.push({
    type: jsPsychCallFunction,
    func: function () {
      const key = experimentState.blockOrder[blockIdx];
      experimentState.currentScenario = key;
      const seqs = CONFIG.trial_sequences[key];
      experimentState.currentSeqIdx = Math.floor(Math.random() * seqs.length);
      experimentState.currentSequence = seqs[experimentState.currentSeqIdx];
      experimentState.attentionCheckAfterRound = attentionCheckAfterRound;
      // Counterbalance: randomly choose whether to show descriptions in original or reverse order
      experimentState.reverseDescriptionOrder = Math.random() < 0.5;
    },
  });

  // Scenario introduction (simplified)
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const s = CONFIG.scenarios[experimentState.currentScenario];
      const scenario = experimentState.currentScenario;

      let goalText = "";
      let icon = "";
      if (scenario === "informative") {
        goalText = "Help the listener identify the true outcome";
        icon = "🔬";
      } else if (scenario === "pers_plus") {
        goalText = "Make the treatment seem as effective as possible";
        icon = "👍";
      } else {
        goalText = "Make the treatment seem as ineffective as possible";
        icon = "👎";
      }

      return `<div class="scenario-container">
                <h2>Your Role</h2>
                <div class="role-badge" style="background:${s.color};">${icon} ${s.role}</div>
                <div style="background: ${s.color}20; border: 2px solid ${s.color}; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <p style="font-size: 1.3em; margin: 0; text-align: center;"><strong>Goal:</strong> ${goalText}</p>
                </div>
                <p>You will describe <strong>10 clinical trials</strong> of the same treatment to this listener.</p>
                <p>Your bonus depends on how well you achieve this goal.</p>
            </div>`;
    },
    choices: ["Continue"],
    on_finish: updateProgress,
  });

  // Role comprehension check
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const scenario = experimentState.currentScenario;
      const s = CONFIG.scenarios[scenario];

      let question = "";
      let options = [];
      let correctIndex = 0;

      if (scenario === "informative") {
        question = "How do you maximize your bonus in this role?";
        options = [
          "Help the listener correctly identify which trial outcome I observed",
          "Make the listener think the treatment is highly effective",
          "Make the listener think the treatment is ineffective",
        ];
        correctIndex = 0;
      } else if (scenario === "pers_plus") {
        question = "How do you maximize your bonus in this role?";
        options = [
          "Help the listener correctly identify which trial outcome I observed",
          "Make the listener rate the treatment as highly effective",
          "Make the listener rate the treatment as ineffective",
        ];
        correctIndex = 1;
      } else {
        // pers_minus
        question = "How do you maximize your bonus in this role?";
        options = [
          "Help the listener correctly identify which trial outcome I observed",
          "Make the listener rate the treatment as highly effective",
          "Make the listener rate the treatment as ineffective",
        ];
        correctIndex = 2;
      }

      // Shuffle options but track correct answer
      const shuffledOptions = options.map((opt, idx) => ({
        text: opt,
        isCorrect: idx === correctIndex,
      }));
      const shuffled = shuffleArray(shuffledOptions);
      experimentState.roleCompOptions = shuffled;

      let optionsHtml = '<div class="utterance-options">';
      shuffled.forEach((opt, i) => {
        optionsHtml += `<label class="utterance-option" data-idx="${i}">
                    <input type="radio" name="role-comp" value="${i}">
                    ${opt.text}
                </label>`;
      });
      optionsHtml += "</div>";

      const icon =
        experimentState.currentScenario === "informative"
          ? "🔬"
          : experimentState.currentScenario === "pers_plus"
            ? "👍"
            : "👎";
      return `<div class="comprehension-container">
                <h2>Quick Check</h2>
                <p style="margin-bottom: 5px;">You are about to play as:</p>
                <div class="role-badge" style="background:${s.color}; margin: 10px 0;">${icon} ${s.role}</div>
                <p style="margin-top: 20px; font-weight: bold;">${question}</p>
                ${optionsHtml}
                <div style="text-align: center; margin-top: 20px;">
                    <button id="role-comp-btn" class="jspsych-btn" disabled>Submit</button>
                </div>
            </div>`;
    },
    choices: [],
    data: { task: "role_comprehension", block: blockIdx },
    on_load: function () {
      const options = document.querySelectorAll(".utterance-option");
      const btn = document.getElementById("role-comp-btn");
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
        const isCorrect =
          experimentState.roleCompOptions[selectedIdx].isCorrect;
        jsPsych.finishTrial({
          task: "role_comprehension",
          block: blockIdx,
          scenario: experimentState.currentScenario,
          selected_option: experimentState.roleCompOptions[selectedIdx].text,
          role_comp_correct: isCorrect,
        });
      });
    },
    on_finish: updateProgress,
  });

  // Feedback for role comprehension
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const data = jsPsych.data
        .get()
        .filter({ task: "role_comprehension", block: blockIdx })
        .last(1)
        .values()[0];
      const s = CONFIG.scenarios[experimentState.currentScenario];

      let correctAnswer = "";
      if (experimentState.currentScenario === "informative") {
        correctAnswer =
          "Help the listener correctly identify which trial outcome you observed";
      } else if (experimentState.currentScenario === "pers_plus") {
        correctAnswer =
          "Make the listener rate the treatment as highly effective";
      } else {
        correctAnswer = "Make the listener rate the treatment as ineffective";
      }

      const icon =
        experimentState.currentScenario === "informative"
          ? "🔬"
          : experimentState.currentScenario === "pers_plus"
            ? "👍"
            : "👎";

      if (data.role_comp_correct) {
        return `<div class="comprehension-container">
                    <h2 style="color: #4CAF50;">✓ Correct</h2>
                    <p>As a <strong>${icon} ${s.role}</strong>, your goal is to:</p>
                    <p style="font-weight: bold; color: ${s.color};">${correctAnswer}</p>
                </div>`;
      } else {
        return `<div class="comprehension-container">
                    <h2 style="color: #f44336;">✗ Not quite</h2>
                    <p>As a <strong>${icon} ${s.role}</strong>, your goal is to:</p>
                    <p style="font-weight: bold; color: ${s.color};">${correctAnswer}</p>
                    <p style="margin-top: 15px; color: #666;">Remember this goal as you describe the trial results.</p>
                </div>`;
      }
    },
    choices: ["Find a Listener"],
    on_finish: updateProgress,
  });

  // Pairing wait screen (AFTER reading instructions and comprehension check)
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="waiting-container">
            <h2>Finding a listener...</h2>
            <div class="spinner"></div>
            <p>Please wait while we pair you with another participant.</p>
        </div>`,
    choices: "NO_KEYS",
    trial_duration: () =>
      randomInt(CONFIG.pairing_wait_min, CONFIG.pairing_wait_max),
    on_finish: updateProgress,
  });

  // Listener matched confirmation
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const s = CONFIG.scenarios[experimentState.currentScenario];
      const icon =
        experimentState.currentScenario === "informative"
          ? "🔬"
          : experimentState.currentScenario === "pers_plus"
            ? "👍"
            : "👎";
      return `<div class="scenario-container">
                <h2 style="color: #4CAF50;">✓ Listener Matched</h2>
                <p>You are now connected with a listener.</p>
                <div class="role-badge" style="background:${s.color};">${icon} ${s.role}</div>
                <p style="margin-top: 20px;"><strong>Goal:</strong> ${s.goalReminder}</p>
            </div>`;
    },
    choices: ["Start Communication"],
    on_finish: updateProgress,
  });

  // 10 regular trials with 1 attention check inserted after a random round (5-9)
  for (let r = 0; r < CONFIG.n_rounds; r++) {
    // Regular trial
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: function () {
        const numEffective = experimentState.currentSequence[r];
        const s = CONFIG.scenarios[experimentState.currentScenario];

        // Get random arrangement for this trial
        const stimulusInfo = Stimuli.getRandomImage(numEffective);
        experimentState.currentStimulusInfo = stimulusInfo;

        // Get all true utterances for this observation and shuffle
        let trueUtterances = shuffleArray(
          TruthChecker.getTrueUtterances(numEffective),
        );
        experimentState.currentTrialUtterances = trueUtterances;

        let optionsHtml = '<div class="utterance-options">';
        trueUtterances.forEach((u, i) => {
          optionsHtml += `<label class="utterance-option" data-idx="${i}">
                        <input type="radio" name="utterance" value="${i}">
                        ${u.displayText}
                    </label>`;
        });
        optionsHtml += "</div>";

        const roleIcon =
          experimentState.currentScenario === "informative"
            ? "🔬"
            : experimentState.currentScenario === "pers_plus"
              ? "👍"
              : "👎";

        return `<div class="trial-container">
                    <div class="trial-header">
                        <span class="round-indicator" style="background:${s.color};">${roleIcon} Round ${r + 1} of ${CONFIG.n_rounds} | ${s.role}</span>
                    </div>
                    <div class="stimulus-section">
                        <img src="${stimulusInfo.path}" class="stimulus-image" style="max-width: 400px;">
                    </div>
                    <div class="response-section" style="min-width: 500px; max-width: 600px;">
                        <p class="instruction-text">Describe these results to your listener:</p>
                        <p class="goal-reminder" style="background: ${s.color}15; border-left: 4px solid ${s.color};">
                            <strong>Goal:</strong> ${s.goalReminder}
                        </p>
                        <p style="text-align: center; font-weight: 500;">Select one of the following TRUE descriptions:</p>
                        ${optionsHtml}
                        <div style="text-align: center;">
                            <button id="send-btn" class="jspsych-btn submit-btn" disabled>Send Description</button>
                        </div>
                    </div>
                </div>`;
      },
      choices: [],
      data: { task: "speaker", block: blockIdx, round: r + 1 },
      on_load: function () {
        // Start inactivity timer
        startInactivityTimer();

        // Use the same shuffled order that was displayed
        const numEffective = experimentState.currentSequence[r];
        const stimulusInfo = experimentState.currentStimulusInfo;
        let trueUtterances = experimentState.currentTrialUtterances;
        const options = document.querySelectorAll(".utterance-option");
        const btn = document.getElementById("send-btn");
        let selectedIdx = -1;

        options.forEach((opt, i) => {
          opt.addEventListener("click", () => {
            // Reset timer on any interaction
            resetInactivityTimer();

            options.forEach((o) => o.classList.remove("selected"));
            opt.classList.add("selected");
            opt.querySelector("input").checked = true;
            selectedIdx = i;
            btn.disabled = false;
          });
        });

        btn.addEventListener("click", () => {
          if (selectedIdx >= 0) {
            // Clear timer before finishing
            clearInactivityTimer();

            const selected = trueUtterances[selectedIdx];
            jsPsych.finishTrial({
              task: "speaker",
              scenario: experimentState.currentScenario,
              seq_idx: experimentState.currentSeqIdx,
              round: r + 1,
              num_effective: numEffective,
              stimulus_variant: stimulusInfo.variant,
              stimulus_positions: JSON.stringify(stimulusInfo.positions),
              predicate: selected.predicate,
              quantifier: selected.quantifier,
              utterance: selected.text,
            });
          }
        });
      },
      on_finish: function () {
        clearInactivityTimer();
        updateProgress();
      },
    });

    // Listener wait after each regular trial (except after last round)
    if (r < CONFIG.n_rounds - 1) {
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `<div class="waiting-container">
                    <h2>Listener is responding based on your description...</h2>
                    <div class="spinner"></div>
                    <p>Description sent!</p>
                </div>`,
        choices: "NO_KEYS",
        trial_duration: () =>
          randomInt(CONFIG.listener_response_min, CONFIG.listener_response_max),
      });
    }

    // Insert attention check after the specified round (no listener wait after attention check)
    if (r + 1 === attentionCheckAfterRound) {
      // Attention check trial
      timeline.push(createAttentionCheck(blockIdx, r + 1));

      // Conditional warning after first failure
      timeline.push({
        timeline: [attentionWarning],
        conditional_function: function () {
          const lastAttnCheck = jsPsych.data
            .get()
            .filter({ task: "attention_check" })
            .last(1)
            .values()[0];
          // Show warning only if they just failed AND it's their first failure
          return (
            lastAttnCheck &&
            !lastAttnCheck.attention_passed &&
            experimentState.attentionFailures === 1
          );
        },
      });
    }
  }

  // Block completion
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const isLast = blockIdx === 2;
      const s = CONFIG.scenarios[experimentState.currentScenario];
      const icon =
        experimentState.currentScenario === "informative"
          ? "🔬"
          : experimentState.currentScenario === "pers_plus"
            ? "👍"
            : "👎";
      return `<div class="completion-container">
                <h2>Communication Complete</h2>
                <p>You have finished describing all 10 trials to this listener as a <strong>${icon} ${s.role}</strong>.</p>
                ${
                  isLast
                    ? "<p>You have completed all three roles.</p>"
                    : "<p>Click below to be paired with a <strong>new listener</strong> for a <strong>different role</strong>.</p>"
                }
            </div>`;
    },
    choices: function () {
      return [blockIdx === 2 ? "Continue to Feedback" : "Find Next Listener"];
    },
    on_finish: updateProgress,
  });

  return { timeline };
}

function createAttentionCheck(blockIdx, afterRound) {
  // Random image for attention check
  const randomNumEffective = Math.floor(Math.random() * 6);

  // Get random arrangement for this attention check
  const stimulusInfo = Stimuli.getRandomImage(randomNumEffective);

  // Get all true utterances for this image and pick one randomly
  const trueUtterances = TruthChecker.getTrueUtterances(randomNumEffective);
  const requiredUtterance =
    trueUtterances[Math.floor(Math.random() * trueUtterances.length)];
  const requiredDescription = requiredUtterance.text;
  const requiredDisplayText = requiredUtterance.displayText;

  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const s = CONFIG.scenarios[experimentState.currentScenario];

      // Shuffle utterances for display
      let displayUtterances = shuffleArray([...trueUtterances]);

      let optionsHtml = '<div class="utterance-options">';
      displayUtterances.forEach((u, i) => {
        optionsHtml += `<label class="utterance-option" data-idx="${i}" data-text="${u.text}">
                    <input type="radio" name="utterance" value="${i}">
                    ${u.displayText}
                </label>`;
      });
      optionsHtml += "</div>";

      const roleIcon =
        experimentState.currentScenario === "informative"
          ? "🔬"
          : experimentState.currentScenario === "pers_plus"
            ? "👍"
            : "👎";

      return `<div class="trial-container">
                <div class="trial-header">
                    <span class="round-indicator" style="background:${s.color};">${roleIcon} Round ${afterRound} of ${CONFIG.n_rounds} | ${s.role}</span>
                </div>
                <div class="stimulus-section">
                    <img src="${stimulusInfo.path}" class="stimulus-image" style="max-width: 400px;">
                </div>
                <div class="response-section" style="min-width: 500px; max-width: 600px;">
                    <p class="instruction-text">Describe these results to your listener:</p>
                    <p class="goal-reminder" style="background: ${s.color}15; border-left: 4px solid ${s.color};">
                        <strong>⚠️ Attention Check:</strong> Please select exactly this description: "${requiredDisplayText}"
                    </p>
                    <p style="text-align: center; font-weight: 500;">Select one of the following TRUE descriptions:</p>
                    ${optionsHtml}
                    <div style="text-align: center;">
                        <button id="send-btn" class="jspsych-btn submit-btn" disabled>Send Description</button>
                    </div>
                </div>
            </div>`;
    },
    choices: [],
    data: {
      task: "attention_check",
      block: blockIdx,
      round: afterRound,
      num_effective: randomNumEffective,
      stimulus_variant: stimulusInfo.variant,
      stimulus_positions: JSON.stringify(stimulusInfo.positions),
      required_description: requiredDescription,
    },
    on_load: function () {
      // Start inactivity timer for attention check too
      startInactivityTimer();

      const options = document.querySelectorAll(".utterance-option");
      const btn = document.getElementById("send-btn");
      let selectedText = "";

      options.forEach((opt, i) => {
        opt.addEventListener("click", () => {
          // Reset timer on interaction
          resetInactivityTimer();

          options.forEach((o) => o.classList.remove("selected"));
          opt.classList.add("selected");
          opt.querySelector("input").checked = true;
          selectedText = opt.dataset.text;
          btn.disabled = false;
        });
      });

      btn.addEventListener("click", () => {
        // Clear timer before finishing
        clearInactivityTimer();

        const passed = selectedText === requiredDescription;
        if (!passed) {
          experimentState.attentionFailures++;
        }
        jsPsych.finishTrial({
          task: "attention_check",
          block: blockIdx,
          round: afterRound,
          num_effective: randomNumEffective,
          stimulus_variant: stimulusInfo.variant,
          stimulus_positions: JSON.stringify(stimulusInfo.positions),
          required_description: requiredDescription,
          selected_description: selectedText,
          attention_passed: passed,
          total_failures: experimentState.attentionFailures,
        });
      });
    },
    on_finish: function (data) {
      clearInactivityTimer();
      updateProgress();
      // Check if we need to terminate (2 out of 3 failures)
      if (experimentState.attentionFailures >= 2) {
        saveDataAndEndExperiment("attention_check_failure");
      }
    },
  };
}

// Warning shown after first attention check failure
const attentionWarning = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="comprehension-container">
        <h2 style="color: #f44336;">⚠️ Attention Check Failed</h2>
        <p>You did not select the requested description in the attention check.</p>
        <p style="font-weight: bold; margin-top: 20px;">Please pay close attention to the instructions. 
        One more failed attention check will result in termination of the study and forfeiture of compensation.</p>
    </div>`,
  choices: ["I understand, continue"],
  data: { task: "attention_warning" },
};

// ============================================================================
// 6. FEEDBACK & DEBRIEF
// ============================================================================

const feedback = {
  type: jsPsychSurveyText,
  preamble: `<div class="feedback-container">
        <h2>Feedback (Optional)</h2>
        <p>We would appreciate any feedback you have about this experiment.</p>
    </div>`,
  questions: [
    {
      prompt: "Was anything confusing? Do you have any comments or concerns?",
      name: "feedback",
      rows: 5,
      required: false,
    },
  ],
  button_label: "Continue",
  on_finish: updateProgress,
};

const debrief = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    const isProlific = prolificPID !== null;
    return `<div class="debrief-container">
            <h2>Thank You!</h2>
            <h3>Debriefing</h3>
            <p>Thank you for participating in this study!</p>
            <p>We want to let you know that the "listeners" in this study were <strong>simulated</strong> — 
            there was no real-time matching with other participants.</p>
            <p>However, your responses are still extremely valuable for our research on how people 
            communicate information under different goals.</p>
            <p><strong>You will receive the full compensation and bonus as described.</strong></p>
            ${
              isProlific
                ? '<p style="margin-top: 30px; color: #4CAF50; font-weight: bold;">Click below to complete the study and return to Prolific.</p>'
                : '<p style="margin-top: 30px;">If you have any questions about this research, please contact the research team.</p>'
            }
        </div>`;
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

// Preload images
timeline.push({
  type: jsPsychPreload,
  images: Stimuli.getAllImagePaths(),
  show_progress_bar: true,
  message: "<p>Loading experiment images...</p>",
});

// Main experiment flow
timeline.push(welcome);
timeline.push(consent);
timeline.push(instructions);

// Comprehension checks - Module 1 (with immediate feedback, no retry)
timeline.push(comp1_some);
timeline.push(comp1_some_feedback);
timeline.push(comp1_most);
timeline.push(comp1_most_feedback);

// Comprehension checks - Module 2 (with feedback, no retry)
timeline.push(comp2_welcome);
timeline.push(comp2_trial_1);
timeline.push(comp2_feedback_1);
timeline.push(comp2_trial_2);
timeline.push(comp2_feedback_2);

// Comprehension checks - Module 3 (with feedback, no retry)
timeline.push(comp3_trial);
timeline.push(comp3_feedback);

// Speaker task
timeline.push(speakerIntro);
timeline.push(createBlock(0));
timeline.push(createBlock(1));
timeline.push(createBlock(2));

// Feedback
timeline.push(feedback);

// Mark experiment as completed before saving data
timeline.push({
  type: jsPsychCallFunction,
  func: function () {
    jsPsych.data.addProperties({
      completion_status: "completed",
      completion_time: new Date().toISOString(),
      terminated_early: false,
      termination_reason: null,
    });
  },
});

// Save data to DataPipe (before debrief)
if (DATAPIPE_CONFIG.enabled) {
  timeline.push({
    type: jsPsychPipe,
    action: "save",
    experiment_id: DATAPIPE_CONFIG.experiment_id,
    filename: `${subjectId}.csv`,
    data_string: () => jsPsych.data.get().csv(),
  });
}

// Debrief (final screen)
timeline.push(debrief);

// Run the experiment
jsPsych.run(timeline);
