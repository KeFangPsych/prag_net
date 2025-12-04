// console.log(`Hello, Experiment 1!`);

const params = {
  nStudents: 16,
  maxExamples: 70,
  completionMinutes: 30,
  basePay: 5,
  maxBonus: 12,
  perTrialBonus: 0.7,
  perTrialBonusThreshold: 0.08,
  exampleCost: 0.01,
};

const quantities = ["all", "most", "some", "none"];
const predicates = ["effective", "ineffective"];

/* Initialize jsPsych */

let jsPsych = initJsPsych(); // Initialize jsPsych

let timeline = []; // Initialize timeline array

/* Experiment */

// Welcome Trial
let WelcomeTrial = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <h1>Welcome to the Language Choice Experiment</h1>
    <p >Press any key to begin.</p>`, //TODO: add Stanford Logo
  choices: "ALL_KEYS", //[" "],
  trial_duration: 10000, // 10 seconds max
};

timeline.push(WelcomeTrial);

// Consent Trial
let ConsentTrial = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
        <div style="text-align:left; margin:0 auto; max-width:800px;">
          <h3>Please read this consent agreement carefully before deciding whether to participate in this experiment.</h3>
          <p><b>Purpose of the research:</b> To examine how people use language to describe complicated data and use other's description to learn about the data.</p>
          <p><b>What you will do in this research:</b> You will send short descriptions of hypothetical medical trial data and use other people’s descriptions to learn about the results.</p>
          <p><b>Time required:</b> This experiment will take 20 minutes to complete.</p>
          <p><b>Risks:</b> There are no anticipated risks associated with participating in this study. \
              The effects of participating should be comparable to those you would experience from viewing a computer monitor \
              and using a mouse and keyboard for the duration of the experiment.</p>
          <p><b>Benefits:</b> The study provides important information about the nature of language use.</p>
          <p><b>Compensation:</b> You will receive <b>$${params.basePay}</b> for completing the experiment and a performance bonus of up to <b>$${params.maxBonus}</b>.</p>
          <p><b>Confidentiality:</b> Your participation in this study will remain confidential. \
              No personally identifiable information will be associated with your data. \
              Your de-identified data may be shared with other researchers and used in future projects.</p>
          <p><b>Participation and withdrawal:</b> Your participation in this study is completely voluntary and \
              you may refuse to participate or you may choose to withdraw at any time without penalty or loss of
              benefits to which you are otherwise entitled.</p>
          <p><b>How to contact the researcher:</b> If you have questions or concerns about your participation\
              or payment, or want to request a summary of research findings, please contact
              Ke Fang, fangke@stanford.edu.</p>
          <p><b>Whom to contact about your rights in this research:</b> For questions, concerns, suggestions, \
              or complaints that have not been or cannot be addressed by the researcher, or to report \
              research-related harm, please contact the XXXXXXXX at Stanford University, \
              XXXXXX. Phone: XXXXX. Email: XXXXX.</p>
        </div>
        `,
  choices: ["I consent"],
};

timeline.push(ConsentTrial);

// Instructions Trial
const instructionPages = [
  `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>About This Study</h2>
      <p>In this study, you will take part in a communication game about hypothetical medical trials.</p>
      <p>A new medication is being tested in a series of small clinical trials.</p>
      <p>In each trial:</p>
      <ul>
        <li>There are 6 patients in the study.</li>
        <li>Each patient completes 5 treatment sessions.</li>
        <li>In each session, the patient either shows improvement (marked with ✅) or no improvement (marked with ❌).</li>
      </ul>
      <p>For example, a trial outcome might look like this:</p>
      <div style="text-align:center; margin:16px 0;">
        <img src="images/trial_example_6_5.png" alt="Example showing 6 patients with 5 sessions each" style="max-width:50%; height:auto;">
      </div>
      <p>Press “Continue” when you are ready to begin.</p>
    </div>
  `,
  `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>How To Describe A Trial</h2>
      <div style="text-align:center; margin: 20px 0;">
        <img src="images/trial_example_6_5_reordered.png" alt="Example showing 6 patients with 5 sessions each" style="max-width:100%; height:auto; border: 2px solid #dee2e6; border-radius: 8px;">
        <div style="background-color: #f0f0f0; border: 2px solid #888; border-radius: 8px; padding: 14px; margin: 20px auto; max-width: 800px;">
          <p style="margin: 0; font-size: 13px; color: #444;">
            <strong>📌 Note:</strong> The data remained the same, patients are just re-ordered by how many effective sessions they had.
          </p>
        </div>
      </div>
      <p>Given a trial outcome, a speaker will describe it using a sentence such as:</p>
      <p><em>"<u>Most</u> sessions are <u>ineffective</u> for <u>most</u> patients."</em></p>
      <p>In general, every description follows the template: </p>
      <div style="border: 2px solid #333; background-color: #f5f5f5; padding: 16px; margin: 20px auto; max-width: 500px; border-radius: 8px;">
        <p style="font-size: 18px; line-height: 2; margin: 0; text-align: center;">
          <strong>"<span style="color: #0066cc;">[All / Most / Some / No]</span> sessions are <span style="color: #cc0000;">[effective / ineffective]</span> for <span style="color: #0066cc;">[all / most / some / no]</span> patients."</strong>
        </p>
      </div>
      <p>Press "Continue" when you understand the structure of the descriptions.</p>
    </div>
  `,
  `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2 style="text-align:center;">How To Truthfully Describe A Trial</h2>

      <!-- Truth Constraint -->
      <div style="background-color: #fff3cd; border-left: 5px solid #ffc107; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; font-weight: bold;">⚠️ Important Constraint:</p>
        <p style="margin: 8px 0 0 0;">All descriptions must be <strong>true</strong> of the trial outcome observed.</p>
      </div>

      <!-- Template Box -->
      <div style="border: 3px solid #0066cc; background-color: #e3f2fd; padding: 20px; margin: 24px 0; border-radius: 10px;">
        <p style="font-size: 15.5px; line-height: 2.2; margin: 0; text-align: center;">
          <strong>"<span style="color: #0066cc;">[All / Most / Some / No]</span> sessions are <span style="color: #cc0000;">[effective / ineffective]</span> for <span style="color: #0066cc;">[all / most / some / no]</span> patients."</strong>
        </p>
      </div>

      <!-- Definitions Section -->
      <h3 style="margin-top: 32px; margin-bottom: 16px;">Definitions of Truth:</h3>
      <div style="background-color: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <ul style="margin: 0; padding-left: 24px; line-height: 1.8;">
          <li><strong style="color: #0066cc;">"All"</strong> means <strong>100%</strong> of the relevant items.</li>
          <li><strong style="color: #0066cc;">"Most"</strong> means <strong>strictly more than 50%</strong> of the relevant items.</li>
          <li><strong style="color: #0066cc;">"Some"</strong> means <strong>at least 1</strong> relevant item (could be all).</li>
          <li><strong style="color: #0066cc;">"No"</strong> means <strong>0%</strong> of the relevant items.</li>
        </ul>
      </div>

      <!-- Example Image -->
      <h3 style="margin-top: 32px; margin-bottom: 16px; text-align: center;">Example Trial Outcome:</h3>
      <div style="text-align:center; margin: 20px 0;">
        <img src="images/trial_example_6_5_ordered.png" alt="Example showing 6 patients with 5 sessions each" style="max-width:50%; height:auto; border: 2px solid #dee2e6; border-radius: 8px;">
      </div>

      <!-- True Statements -->
      <div style="background-color: #d4edda; border-left: 5px solid #28a745; padding: 16px; margin: 24px 0; border-radius: 6px;">
        <p style="margin: 0 0 12px 0; font-weight: bold; color: #155724;">✓ TRUE Descriptions:</p>
        <ul style="margin: 0; padding-left: 24px;">
          <li style="margin: 8px 0;"><em>"Most sessions are ineffective for most patients."</em><br/>
          <span style="font-size: 14px; color: #155724;">→ 5 of 6 patients (id.2-6) had 3 or more ineffective sessions.</span></li>
          <li style="margin: 8px 0;"><em>"Most sessions are effective for some patients."</em><br/>
          <span style="font-size: 14px; color: #155724;">→ 1 patient (id.1) had 3 or more effective sessions.</span></li>
        </ul>
      </div>

      <!-- False Statements -->
      <div style="background-color: #f8d7da; border-left: 5px solid #dc3545; padding: 16px; margin: 24px 0; border-radius: 6px;">
        <p style="margin: 0 0 12px 0; font-weight: bold; color: #721c24;">✗ FALSE Descriptions:</p>
        <ul style="margin: 0; padding-left: 24px;">
          <li style="margin: 8px 0;"><em>"Some sessions are effective for all patients."</em><br/>
          <span style="font-size: 14px; color: #721c24;">→ 1 patient (id.6) had 0 effective sessions.</span></li>
          <li style="margin: 8px 0;"><em>"Most sessions are ineffective for all patients."</em><br/>
          <span style="font-size: 14px; color: #721c24;">→ 1 patient (id.2) had 3 or more effective sessions.</span></li>
        </ul>
      </div>

      <p style="text-align: center; margin-top: 32px; font-size: 16px;">
        <strong>When you understand these truth conditions, press "Continue" to start the practice trials.</strong>
      </p>
    </div>
  `,
];

let InstructionTrials = {
  type: jsPsychInstructions,
  pages: instructionPages,
  show_clickable_nav: true,
  allow_backward: true,
  button_label_next: "Continue",
  button_label_previous: "Back",
};

timeline.push(InstructionTrials);

// Speaker Practice Trials
const instructionPackageOne = {
  id: "instruction_package_one",
  pages: [instructionPages[0]],
};

const instructionPackageTwo = {
  id: "instruction_package_three",
  pages: [instructionPages[2]],
};

// Comprehension Question 1: Number of patients and sessions
let ComprehensionQ1 = {
  type: jsPsychSurveyHtmlForm,
  preamble: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Comprehension Check 1</h2>
      <p>Let's make sure we understand the trial structure.</p>
      <p>Look at this trial outcome:</p>
      <div style="text-align:center; margin:16px 0;">
        <img src="images/practice_trial_1.png" style="max-width:50%; height:auto;">
      </div>
      <p><strong>How many patients were in this trial and how many sessions did each of them go through?</strong></p>
    </div>
  `,
  html: `
    <div style="text-align:center; margin:16px 0;">
      <input type="number" name="patients" required min="1" max="20" style="width:60px; text-align:center;"> patients each went through
      <input type="number" name="sessions" required min="1" max="20" style="width:60px; text-align:center;"> sessions.
    </div>
  `,
  button_label: "Submit",
  data: { task: "comprehension_q1" },
};

// Feedback for Q1 (incorrect)
let ComprehensionQ1Feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    let lastResponse = jsPsych.data
      .get()
      .filter({ task: "comprehension_q1" })
      .last(1)
      .values()[0].response;
    return `
      <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
        <h2>Not quite right</h2>
        <p>You answered: <strong>${lastResponse.patients} patients</strong> and <strong>${lastResponse.sessions} sessions</strong>.</p>
        <p>Let's review the instructions again and try once more.</p>
      </div>
    `;
  },
  choices: ["Review Instructions"],
  data: { task: "comprehension_q1_feedback" },
};

// Review instructions for Q1
let ReviewInstructionsQ1 = {
  type: jsPsychInstructions,
  pages: instructionPackageOne.pages,
  show_clickable_nav: true,
  allow_backward: false,
  button_label_next: "Continue to Question",
};

// Conditional feedback and review for Q1 (only if incorrect)
let Q1FeedbackConditional = {
  timeline: [ComprehensionQ1Feedback, ReviewInstructionsQ1],
  conditional_function: function () {
    let response = jsPsych.data
      .get()
      .filter({ task: "comprehension_q1" })
      .last(1)
      .values()[0].response;
    return response.patients != 6 || response.sessions != 5;
  },
};

// Q1 Loop: repeat until correct
let Q1Loop = {
  timeline: [ComprehensionQ1, Q1FeedbackConditional],
  loop_function: function (data) {
    let response = data
      .filter({ task: "comprehension_q1" })
      .last(1)
      .values()[0].response;
    return response.patients != 6 || response.sessions != 5;
  },
};

timeline.push(Q1Loop);

// Comprehension Question 2: Definitions
let ComprehensionQ2 = {
  type: jsPsychSurveyMultiChoice,
  preamble: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Comprehension Check 2</h2>
      <p>Let's make sure we understand the meaning of the quantifiers.</p>
    </div>
  `,
  questions: [
    {
      prompt: "<strong>What does 'some' mean?</strong>",
      name: "some_definition",
      options: [
        "At least one (could be all) relevant item.",
        "At least two (could be all) relevant items.",
        "At least one (should not be all) relevant item.",
        "At least two (should not be all) relevant items.",
      ],
      required: true,
    },
    {
      prompt: "<strong>What does 'most' mean?</strong>",
      name: "most_definition",
      options: [
        "50% or more of the relevant items (could be exactly 50%).",
        "More than 50% of the relevant items (must be above 50%).",
        "75% or more of the relevant items (could be exactly 75%).",
        "More than 75% of the relevant items (must be above 75%).",
      ],
      required: true,
    },
  ],
  data: { task: "comprehension_q2" },
};

// Feedback for Q2 (incorrect)
let ComprehensionQ2Feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Not quite right</h2>
      <p>Let's review the definitions again and try once more.</p>
    </div>
  `,
  choices: ["Review Instructions"],
  data: { task: "comprehension_q2_feedback" },
};

// Review instructions for Q2
let ReviewInstructionsQ2 = {
  type: jsPsychInstructions,
  pages: instructionPackageTwo.pages,
  show_clickable_nav: true,
  allow_backward: true,
  button_label_next: "Continue",
  button_label_previous: "Back",
};

// Conditional feedback and review for Q2 (only if incorrect)
let Q2FeedbackConditional = {
  timeline: [ComprehensionQ2Feedback, ReviewInstructionsQ2],
  conditional_function: function () {
    let response = jsPsych.data
      .get()
      .filter({ task: "comprehension_q2" })
      .last(1)
      .values()[0].response;
    return (
      response.some_definition !==
        "At least one (could be all) relevant item." ||
      response.most_definition !==
        "More than 50% of the relevant items (must be above 50%)."
    );
  },
};

// Q2 Loop: repeat until correct
let Q2Loop = {
  timeline: [ComprehensionQ2, Q2FeedbackConditional],
  loop_function: function (data) {
    let response = data
      .filter({ task: "comprehension_q2" })
      .last(1)
      .values()[0].response;
    return (
      response.some_definition !==
        "At least one (could be all) relevant item." ||
      response.most_definition !==
        "More than 50% of the relevant items (must be above 50%)."
    );
  },
};

timeline.push(Q2Loop);

// Comprehension Question 3: Introduction
let ComprehensionQ3Intro = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Comprehension Check 3</h2>
      <p>You will now see several statements about a trial outcome.</p>
      <p>For each statement, indicate whether it is TRUE or FALSE.</p>
    </div>
  `,
  choices: ["Begin"],
};

timeline.push(ComprehensionQ3Intro);

// Comprehension Question 3a
let ComprehensionQ3a = {
  type: jsPsychSurveyMultiChoice,
  preamble: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h3>Comprehension Check 3 (1 of 6)</h3>
      <p>Given this trial outcome:</p>
      <div style="text-align:center; margin:16px 0;">
        <img src="images/practice_trial_1.png" style="max-width:50%; height:auto;">
      </div>
    </div>
  `,
  questions: [
    {
      prompt:
        "<strong>Is this statement TRUE or FALSE?</strong><br/><em>All sessions are effective for some patients.</em>",
      name: "q3a",
      options: ["True", "False"],
      required: true,
    },
  ],
  data: { task: "comprehension_q3a" },
};

let ComprehensionQ3aFeedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Not quite right</h2>
      <p>Let's review the truth conditions again and try once more.</p>
    </div>
  `,
  choices: ["Review Instructions"],
};

let Q3aFeedbackConditional = {
  timeline: [ComprehensionQ3aFeedback, ReviewInstructionsQ2],
  conditional_function: function () {
    let response = jsPsych.data
      .get()
      .filter({ task: "comprehension_q3a" })
      .last(1)
      .values()[0].response;
    return response.q3a !== "True";
  },
};

let Q3aLoop = {
  timeline: [ComprehensionQ3a, Q3aFeedbackConditional],
  loop_function: function (data) {
    let response = data
      .filter({ task: "comprehension_q3a" })
      .last(1)
      .values()[0].response;
    return response.q3a !== "True";
  },
};

timeline.push(Q3aLoop);

// Comprehension Question 3b
let ComprehensionQ3b = {
  type: jsPsychSurveyMultiChoice,
  preamble: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h3>Comprehension Check 3 (2 of 6)</h3>
      <p>Given this trial outcome:</p>
      <div style="text-align:center; margin:16px 0;">
        <img src="images/practice_trial_1.png" style="max-width:50%; height:auto;">
      </div>
    </div>
  `,
  questions: [
    {
      prompt:
        "<strong>Is this statement TRUE or FALSE?</strong><br/><em>Most sessions are effective for most patients.</em>",
      name: "q3b",
      options: ["True", "False"],
      required: true,
    },
  ],
  data: { task: "comprehension_q3b" },
};

let ComprehensionQ3bFeedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Not quite right</h2>
      <p>Let's review the truth conditions again and try once more.</p>
    </div>
  `,
  choices: ["Review Instructions"],
};

let Q3bFeedbackConditional = {
  timeline: [ComprehensionQ3bFeedback, ReviewInstructionsQ2],
  conditional_function: function () {
    let response = jsPsych.data
      .get()
      .filter({ task: "comprehension_q3b" })
      .last(1)
      .values()[0].response;
    return response.q3b !== "True";
  },
};

let Q3bLoop = {
  timeline: [ComprehensionQ3b, Q3bFeedbackConditional],
  loop_function: function (data) {
    let response = data
      .filter({ task: "comprehension_q3b" })
      .last(1)
      .values()[0].response;
    return response.q3b !== "True";
  },
};

timeline.push(Q3bLoop);

// Comprehension Question 3c
let ComprehensionQ3c = {
  type: jsPsychSurveyMultiChoice,
  preamble: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h3>Comprehension Check 3 (3 of 6)</h3>
      <p>Given this trial outcome:</p>
      <div style="text-align:center; margin:16px 0;">
        <img src="images/practice_trial_1.png" style="max-width:50%; height:auto;">
      </div>
    </div>
  `,
  questions: [
    {
      prompt:
        "<strong>Is this statement TRUE or FALSE?</strong><br/><em>Most sessions are ineffective for some patients.</em>",
      name: "q3c",
      options: ["True", "False"],
      required: true,
    },
  ],
  data: { task: "comprehension_q3c" },
};

let ComprehensionQ3cFeedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Not quite right</h2>
      <p>Let's review the truth conditions again and try once more.</p>
    </div>
  `,
  choices: ["Review Instructions"],
};

let Q3cFeedbackConditional = {
  timeline: [ComprehensionQ3cFeedback, ReviewInstructionsQ2],
  conditional_function: function () {
    let response = jsPsych.data
      .get()
      .filter({ task: "comprehension_q3c" })
      .last(1)
      .values()[0].response;
    return response.q3c !== "True";
  },
};

let Q3cLoop = {
  timeline: [ComprehensionQ3c, Q3cFeedbackConditional],
  loop_function: function (data) {
    let response = data
      .filter({ task: "comprehension_q3c" })
      .last(1)
      .values()[0].response;
    return response.q3c !== "True";
  },
};

timeline.push(Q3cLoop);

// Comprehension Question 3d
let ComprehensionQ3d = {
  type: jsPsychSurveyMultiChoice,
  preamble: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h3>Comprehension Check 3 (4 of 6)</h3>
      <p>Given this trial outcome:</p>
      <div style="text-align:center; margin:16px 0;">
        <img src="images/practice_trial_1.png" style="max-width:50%; height:auto;">
      </div>
    </div>
  `,
  questions: [
    {
      prompt:
        "<strong>Is this statement TRUE or FALSE?</strong><br/><em>All sessions are ineffective for some patients.</em>",
      name: "q3d",
      options: ["True", "False"],
      required: true,
    },
  ],
  data: { task: "comprehension_q3d" },
};

let ComprehensionQ3dFeedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Not quite right</h2>
      <p>Let's review the truth conditions again and try once more.</p>
    </div>
  `,
  choices: ["Review Instructions"],
};

let Q3dFeedbackConditional = {
  timeline: [ComprehensionQ3dFeedback, ReviewInstructionsQ2],
  conditional_function: function () {
    let response = jsPsych.data
      .get()
      .filter({ task: "comprehension_q3d" })
      .last(1)
      .values()[0].response;
    return response.q3d !== "False";
  },
};

let Q3dLoop = {
  timeline: [ComprehensionQ3d, Q3dFeedbackConditional],
  loop_function: function (data) {
    let response = data
      .filter({ task: "comprehension_q3d" })
      .last(1)
      .values()[0].response;
    return response.q3d !== "False";
  },
};

timeline.push(Q3dLoop);

// Comprehension Question 3e
let ComprehensionQ3e = {
  type: jsPsychSurveyMultiChoice,
  preamble: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h3>Comprehension Check 3 (5 of 6)</h3>
      <p>Given this trial outcome:</p>
      <div style="text-align:center; margin:16px 0;">
        <img src="images/practice_trial_1.png" style="max-width:50%; height:auto;">
      </div>
    </div>
  `,
  questions: [
    {
      prompt:
        "<strong>Is this statement TRUE or FALSE?</strong><br/><em>No sessions are effective for some patients.</em>",
      name: "q3e",
      options: ["True", "False"],
      required: true,
    },
  ],
  data: { task: "comprehension_q3e" },
};

let ComprehensionQ3eFeedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Not quite right</h2>
      <p>Let's review the truth conditions again and try once more.</p>
    </div>
  `,
  choices: ["Review Instructions"],
};

let Q3eFeedbackConditional = {
  timeline: [ComprehensionQ3eFeedback, ReviewInstructionsQ2],
  conditional_function: function () {
    let response = jsPsych.data
      .get()
      .filter({ task: "comprehension_q3e" })
      .last(1)
      .values()[0].response;
    return response.q3e !== "False";
  },
};

let Q3eLoop = {
  timeline: [ComprehensionQ3e, Q3eFeedbackConditional],
  loop_function: function (data) {
    let response = data
      .filter({ task: "comprehension_q3e" })
      .last(1)
      .values()[0].response;
    return response.q3e !== "False";
  },
};

timeline.push(Q3eLoop);

// Comprehension Question 3f
let ComprehensionQ3f = {
  type: jsPsychSurveyMultiChoice,
  preamble: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h3>Comprehension Check 3 (6 of 6)</h3>
      <p>Given this trial outcome:</p>
      <div style="text-align:center; margin:16px 0;">
        <img src="images/practice_trial_1.png" style="max-width:50%; height:auto;">
      </div>
    </div>
  `,
  questions: [
    {
      prompt:
        "<strong>Is this statement TRUE or FALSE?</strong><br/><em>Most sessions are ineffective for most patients.</em>",
      name: "q3f",
      options: ["True", "False"],
      required: true,
    },
  ],
  data: { task: "comprehension_q3f" },
};

let ComprehensionQ3fFeedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Not quite right</h2>
      <p>Let's review the truth conditions again and try once more.</p>
    </div>
  `,
  choices: ["Review Instructions"],
};

let Q3fFeedbackConditional = {
  timeline: [ComprehensionQ3fFeedback, ReviewInstructionsQ2],
  conditional_function: function () {
    let response = jsPsych.data
      .get()
      .filter({ task: "comprehension_q3f" })
      .last(1)
      .values()[0].response;
    return response.q3f !== "False";
  },
};

let Q3fLoop = {
  timeline: [ComprehensionQ3f, Q3fFeedbackConditional],
  loop_function: function (data) {
    let response = data
      .filter({ task: "comprehension_q3f" })
      .last(1)
      .values()[0].response;
    return response.q3f !== "False";
  },
};

timeline.push(Q3fLoop);

// Comprehension Question 4: Match description to outcome
let ComprehensionQ4 = {
  type: jsPsychSurveyMultiChoice,
  preamble: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Comprehension Check 4</h2>
      <p>Given the description: <em>"Most sessions are ineffective for most patients."</em></p>
      <p><strong>Which of the following trial outcomes could have produced this description?</strong></p>
    </div>
  `,
  questions: [
    {
      prompt: `
        <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:20px; margin:20px 0;">
          <div style="flex:1; min-width:200px; max-width:300px; text-align:center;">
            <p><strong>Option A:</strong></p>
            <img src="images/practice_trial_Q4A.png" style="width:100%; height:auto;">
          </div>
          <div style="flex:1; min-width:200px; max-width:300px; text-align:center;">
            <p><strong>Option B:</strong></p>
            <img src="images/practice_trial_Q4B.png" style="width:100%; height:auto;">
          </div>
          <div style="flex:1; min-width:200px; max-width:300px; text-align:center;">
            <p><strong>Option C:</strong></p>
            <img src="images/practice_trial_Q4C.png" style="width:100%; height:auto;">
          </div>
        </div>
      `,
      name: "trial_match",
      options: ["Option A", "Option B", "Option C"],
      required: true,
    },
  ],
  data: { task: "comprehension_q4" },
};

// Feedback for Q4 (incorrect)
let ComprehensionQ4Feedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Not quite right</h2>
      <p>That's not the correct trial outcome. Let's review the truth conditions again and try once more.</p>
    </div>
  `,
  choices: ["Review Instructions"],
  data: { task: "comprehension_q4_feedback" },
};

// Conditional feedback and review for Q4 (only if incorrect)
let Q4FeedbackConditional = {
  timeline: [ComprehensionQ4Feedback, ReviewInstructionsQ2],
  conditional_function: function () {
    let response = jsPsych.data
      .get()
      .filter({ task: "comprehension_q4" })
      .last(1)
      .values()[0].response;
    return response.trial_match !== "Option A";
  },
};

// Q4 Loop: repeat until correct
let Q4Loop = {
  timeline: [ComprehensionQ4, Q4FeedbackConditional],
  loop_function: function (data) {
    let response = data
      .filter({ task: "comprehension_q4" })
      .last(1)
      .values()[0].response;
    return response.trial_match !== "Option A";
  },
};

timeline.push(Q4Loop);

// Success message after all comprehension checks
let ComprehensionSuccess = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Great job!</h2>
      <p>You've successfully completed all the comprehension checks.</p>
      <p>Now let's proceed to the main experiment.</p>
    </div>
  `,
  choices: ["Continue to Experiment"],
};

timeline.push(ComprehensionSuccess);

// Speaker Experiment Trials

// General introduction to speaker task
let SpeakerIntroduction = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Part 2: Speaker Task</h2>
      <p>In this part of the experiment, you will act as a <strong>speaker</strong> who sees trial outcomes and must choose <strong>true descriptions</strong> to communicate to a listener.</p>
      <p>You will complete three different communication scenarios, each with a different listener and communication goal.</p>
      <p><strong>Important:</strong> All descriptions you provide must be <em>true</em> according to the definitions you learned earlier.</p>
      <p><strong>Bonus:</strong> You have a chance to win a $2 bonus each scenarios depending on your performance.</p>
      <p>Press "Continue" when you're ready to begin the first scenario.</p>
    </div>
  `,
  choices: ["Continue"],
};

timeline.push(SpeakerIntroduction);

// Condition-specific instructions
const conditionInstructions = {
  informative: `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Scenario: Scientific Communication</h2>

      <div style="background-color: #e3f2fd; border-left: 5px solid #2196F3; padding: 16px; margin: 20px 0; border-radius: 6px;">
        <p style="margin: 0; font-weight: bold; color: #1565C0;">Your Role: Research Scientist</p>
      </div>

      <p>In this scenario, you are a <strong>research scientist</strong> who has observed trial outcomes and must communicate them as accurate as possible to a listener.</p>

      <h3>Your Task:</h3>
      <ul>
        <li>You will see trial outcomes from medical studies</li>
        <li>For each outcome, choose a <strong>true description</strong> to communicate to the listener</li>
        <li>The listener will use your description to select the correct trial outcome from several options</li>
      </ul>

      <h3>How the Listener Will Respond:</h3>
      <p>After receiving your description, the listener will see a screen like this:</p>
      <div style="text-align:center; margin: 24px 0;">
        <img src="images/speaker_instruction_inf.png" style="max-width:100%; height:auto; border: 2px solid #dee2e6; border-radius: 8px;">
      </div>

      <h3>To Get a Bonus:</h3>
      <p><strong>Both you and the listener will receive a bonus</strong> if the listener successfully identifies the correct trial outcome based on your description.</p>

      <p style="margin-top: 24px;">Press "Ready" to begin this session.</p>
    </div>
  `,
  "persuasive-up": `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Scenario: Promoting Treatment</h2>

      <div style="background-color: #e8f5e9; border-left: 5px solid #4CAF50; padding: 16px; margin: 20px 0; border-radius: 6px;">
        <p style="margin: 0; font-weight: bold; color: #2E7D32;">Your Role: Treatment Advocate / Salesperson</p>
      </div>

      <p>In this scenario, you are a <strong>salesperson</strong> advocating for a treatment. You have observed trial outcomes and must communicate them to convince the listener that the treatment is effective.</p>

      <h3>Your Task:</h3>
      <ul>
        <li>You will see trial outcomes from medical studies</li>
        <li>For each outcome, choose a <strong>true description</strong> that presents the results favorably</li>
        <li>The listener will rate how likely they think the treatment is to be effective based on your description</li>
      </ul>

      <h3>How the Listener Will Respond:</h3>
      <p>After receiving your description, the listener will see a screen like this:</p>
      <div style="text-align:center; margin: 24px 0;">
        <img src="images/speaker_instruction_pers.png" style="max-width:100%; height:auto; border: 2px solid #dee2e6; border-radius: 8px;">
      </div>

      <h3>To Get a Bonus:</h3>
      <p><strong>You will receive a bonus</strong> if the listener rates the treatment as <em>likely to be effective</em> (allocates more points to higher effectiveness levels).</p>

      <p style="margin-top: 24px;">Press "Ready" to begin this session.</p>
    </div>
  `,
  "persuasive-down": `
    <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
      <h2>Scenario: Critiquing Treatment</h2>

      <div style="background-color: #ffebee; border-left: 5px solid #f44336; padding: 16px; margin: 20px 0; border-radius: 6px;">
        <p style="margin: 0; font-weight: bold; color: #C62828;">Your Role: Skeptical Critic</p>
      </div>

      <p>In this scenario, you are a <strong>skeptical critic</strong> who has observed trial outcomes and must communicate them to convince the listener that the treatment should be avoided.</p>

      <h3>Your Task:</h3>
      <ul>
        <li>You will see trial outcomes from medical studies</li>
        <li>For each outcome, choose a <strong>true description</strong> that presents the results unfavorably</li>
        <li>The listener will rate how likely they think the treatment is to be effective based on your description</li>
      </ul>

      <h3>How the Listener Will Respond:</h3>
      <p>After receiving your description, the listener will see a screen like this:</p>
      <div style="text-align:center; margin: 24px 0;">
        <img src="images/speaker_instruction_pers.png" style="max-width:100%; height:auto; border: 2px solid #dee2e6; border-radius: 8px;">
      </div>

      <h3>To Get a Bonus:</h3>
      <p><strong>You will receive a bonus</strong> if the listener rates the treatment as <em>unlikely to be effective</em> (allocates more points to lower effectiveness levels).</p>

      <p style="margin-top: 24px;">Press "Ready" to begin this session.</p>
    </div>
  `,
};

// Waiting screen (simulates waiting for listener)
function createWaitingScreen(conditionName) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div style="text-align:center; margin:0 auto; max-width:600px; line-height:1.6;">
        <div style="margin: 40px 0;">
          <div style="display: inline-block; width: 60px; height: 60px; border: 6px solid #f3f3f3; border-top: 6px solid #2196F3; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
        <h2>Pairing with a New Listener...</h2>
        <p>Please wait while we match you with a new listener for this session.</p>
        <p style="color: #666; font-size: 14px; margin-top: 32px;">This usually takes no more than 30 seconds.</p>
      </div>
    `,
    choices: [],
    trial_duration: function () {
      // Random duration between 10-20 seconds (10000-20000 ms)
      return Math.floor(Math.random() * 10000) + 10000;
    },
    on_finish: function () {
      // Auto-advance after duration
    },
  };
}

// Waiting screen after each round (simulates listener responding)
function createRoundWaitingScreen() {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div style="text-align:center; margin:0 auto; max-width:600px; line-height:1.6;">
        <div style="margin: 40px 0;">
          <div style="display: inline-block; width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #4CAF50; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
        <h2>Message Sent!</h2>
        <p>Waiting for the listener's response...</p>
      </div>
    `,
    choices: [],
    trial_duration: function () {
      // Random duration between 4-8 seconds (4000-8000 ms)
      return Math.floor(Math.random() * 4000) + 4000;
    },
    on_finish: function () {
      // Auto-advance after duration
    },
  };
}

// Helper function to create condition instruction trial
function createConditionInstructions(condition) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: conditionInstructions[condition],
    choices: ["Ready"],
    data: {
      task: "speaker_condition_instructions",
      condition: condition,
    },
  };
}

// Helper function to create speaker trial
const quantifierOptions = quantities
  .map((quantity) => `<option value="${quantity}">${quantity}</option>`)
  .join("");

const predicateOptions = predicates
  .map((predicate) => `<option value="${predicate}">${predicate}</option>`)
  .join("");

function createSpeakerTrial(condition, roundNumber, imagePath) {
  return {
    type: jsPsychSurveyHtmlForm,
    preamble: function () {
      return `
        <div style="text-align:center; max-width:900px; margin:0 auto;">
          <h3>Round ${roundNumber}</h3>
          <p>Describe the trial outcome below:</p>
          <div style="margin: 20px 0;">
            <img src="${imagePath}" style="max-width:60%; height:auto; border: 2px solid #dee2e6; border-radius: 8px;">
          </div>
        </div>
      `;
    },
    html: `
      <div style="display:flex; gap:8px; align-items:center; justify-content:center; flex-wrap:wrap; font-size:18px; max-width:700px; margin:0 auto;">
        <label>
          <select name="quantifier_sessions" required style="font-size:18px; padding:4px 8px;">
            <option value="" disabled selected>Select...</option>
            ${quantifierOptions}
          </select>
        </label>
        <span>sessions are</span>
        <label>
          <select name="predicate" required style="font-size:18px; padding:4px 8px;">
            <option value="" disabled selected>Select...</option>
            ${predicateOptions}
          </select>
        </label>
        <span>for</span>
        <label>
          <select name="quantifier_patients" required style="font-size:18px; padding:4px 8px;">
            <option value="" disabled selected>Select...</option>
            ${quantifierOptions}
          </select>
        </label>
        <span>patients.</span>
      </div>
    `,
    button_label: "Submit Description",
    data: {
      task: "speaker_trial",
      condition: condition,
      round_number: roundNumber,
      trial_image: imagePath,
    },
  };
}

// Session completion message
function createSessionCompletionMessage() {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div style="text-align:center; margin:0 auto; max-width:700px; line-height:1.6;">
        <div style="background-color: #d4edda; border: 2px solid #28a745; border-radius: 10px; padding: 32px; margin: 40px 0;">
          <h2 style="color: #155724; margin: 0 0 16px 0;">✓ Session Complete!</h2>
          <p style="margin: 0; font-size: 16px; color: #155724;">You have finished communicating with this listener.</p>
        </div>
        <p><strong>Ready to proceed to the next session?</strong></p>
        <p style="color: #666; font-size: 14px;">Press "Continue" when you're ready.</p>
      </div>
    `,
    choices: ["Continue"],
    data: {
      task: "session_completion",
    },
  };
}

// Randomize condition order
const conditions = jsPsych.randomization.shuffle([
  "informative",
  "persuasive-up",
  "persuasive-down",
]);

// Create blocks for each condition
conditions.forEach((condition, blockIndex) => {
  // Add waiting screen
  timeline.push(createWaitingScreen(condition));

  // Add condition instructions
  timeline.push(createConditionInstructions(condition));

  // Add rounds for this condition (using practice images as examples for now)
  // TODO: Replace with actual trial images
  const trialImages = [
    "images/practice_trial_1.png",
    "images/practice_trial_Q4A.png",
    "images/practice_trial_Q4B.png",
    "images/practice_trial_Q4C.png",
  ];

  trialImages.forEach((imagePath, roundIndex) => {
    // Add speaker trial
    timeline.push(createSpeakerTrial(condition, roundIndex + 1, imagePath));

    // Add waiting screen after each round
    timeline.push(createRoundWaitingScreen());
  });

  // Add session completion message after all rounds in this condition
  timeline.push(createSessionCompletionMessage());
});

// Listener Trials (randomized trials)

// Helper function to create listener image selection trial
function createListenerImageSelectionTrial(
  description,
  imageA,
  imageB,
  imageC,
  correctOption
) {
  return {
    type: jsPsychSurveyMultiChoice,
    preamble: `
      <div style="text-align:left; margin:0 auto; max-width:900px; line-height:1.6;">
        <h2>Listener Task: Identify Trial Outcome</h2>

        <div style="background-color: #e3f2fd; border: 3px solid #2196F3; border-radius: 10px; padding: 24px; margin: 24px 0; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #1976D2; text-transform: uppercase; letter-spacing: 1px;">Description Received:</p>
          <p style="margin: 0; font-size: 22px; font-weight: bold; color: #0d47a1; line-height: 1.4;">
            "${description}"
          </p>
        </div>

        <p style="margin-top: 24px;">Which one of these three trial outcomes is most likely what the speaker described?</p>
      </div>
    `,
    questions: [
      {
        prompt: `
          <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:20px; margin:20px 0;">
            <div style="flex:1; min-width:200px; max-width:300px; text-align:center;">
              <p><strong>Option A:</strong></p>
              <img src="${imageA}" style="width:100%; height:auto; border: 2px solid #dee2e6; border-radius: 8px;">
            </div>
            <div style="flex:1; min-width:200px; max-width:300px; text-align:center;">
              <p><strong>Option B:</strong></p>
              <img src="${imageB}" style="width:100%; height:auto; border: 2px solid #dee2e6; border-radius: 8px;">
            </div>
            <div style="flex:1; min-width:200px; max-width:300px; text-align:center;">
              <p><strong>Option C:</strong></p>
              <img src="${imageC}" style="width:100%; height:auto; border: 2px solid #dee2e6; border-radius: 8px;">
            </div>
          </div>
          <p style="text-align:center; margin-top:32px; font-size:16px;"><strong>Please select the trial outcome that you believe the speaker is describing based on the message you received.</strong></p>
        `,
        name: "trial_outcome_selection",
        options: ["Option A", "Option B", "Option C"],
        required: true,
      },
    ],
    data: {
      task: "listener_image_selection",
      description: description,
      correct_option: correctOption,
      image_a: imageA,
      image_b: imageB,
      image_c: imageC,
    },
    on_finish: function (data) {
      // Record whether the selection was correct
      data.correct = data.response.trial_outcome_selection === correctOption;
    },
  };
}

// Example listener image selection trial
let ListenerImageSelectionTrial = createListenerImageSelectionTrial(
  "Most sessions are effective for some patients.",
  "images/practice_trial_Q4A.png",
  "images/practice_trial_Q4B.png",
  "images/practice_trial_Q4C.png",
  "Option A"
);

timeline.push(ListenerImageSelectionTrial);

/*
Implement a scale that the listener will have 100 points to assign to effectiveness of 0.1, 0.2, ..., 0.9 based on the description provided by the speaker.
The listener will distribute the 100 points across the 9 effectiveness levels.
It would be the best if there could be corresponding histogram bars that grow/shrink as the listener allocates points to each effectiveness level.
And a running total of allocated points to ensure they do not exceed 100 points.
*/

// Listener trial: Distribute points across effectiveness levels
let ListenerTrial = {
  type: jsPsychSurveyHtmlForm,
  preamble: `
    <div style="text-align:left; margin:0 auto; max-width:900px; line-height:1.6;">
      <h2>Listener Task: Estimate Treatment Effectiveness</h2>

      <div style="background-color: #e3f2fd; border: 3px solid #2196F3; border-radius: 10px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #1976D2; text-transform: uppercase; letter-spacing: 1px;">Description Received:</p>
        <p style="margin: 0; font-size: 22px; font-weight: bold; color: #0d47a1; line-height: 1.4;">
          "Most sessions are ineffective for most patients."
        </p>
      </div>

      <p><strong>Distribute 100 points across the effectiveness levels below to indicate your belief about the treatment's effectiveness.</strong></p>
      <p>The more points you assign to a rate, the more confident you are that the treatment has that effectiveness.</p>
    </div>
  `,
  html: `
    <div style="max-width:900px; margin:0 auto;">
      <style>
        .effectiveness-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 20px 0;
        }
        .effectiveness-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .effectiveness-label {
          min-width: 140px;
          font-weight: bold;
          text-align: right;
        }
        .effectiveness-input {
          width: 80px;
          padding: 6px;
          font-size: 16px;
          text-align: center;
          border: 2px solid #dee2e6;
          border-radius: 4px;
        }
        .effectiveness-bar-container {
          flex: 1;
          height: 30px;
          background-color: #f0f0f0;
          border: 1px solid #ccc;
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }
        .effectiveness-bar {
          height: 100%;
          background: linear-gradient(to right, #4CAF50, #2196F3);
          transition: width 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 8px;
          color: white;
          font-weight: bold;
          font-size: 14px;
        }
        .total-display {
          margin-top: 24px;
          padding: 16px;
          background-color: #f8f9fa;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          text-align: center;
          font-size: 18px;
          font-weight: bold;
        }
        .total-valid {
          background-color: #d4edda;
          border-color: #28a745;
          color: #155724;
        }
        .total-invalid {
          background-color: #f8d7da;
          border-color: #dc3545;
          color: #721c24;
        }
      </style>

      <div class="effectiveness-container">
        ${[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
          .map(
            (level) => `
          <div class="effectiveness-row">
            <div class="effectiveness-label">${Math.round(
              level * 100
            )}% Effective:</div>
            <input
              type="number"
              name="eff_${level}"
              class="effectiveness-input"
              min="0"
              max="100"
              value="0"
              step="1"
            >
            <div class="effectiveness-bar-container">
              <div class="effectiveness-bar" id="bar_${level}"></div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>

      <div class="total-display" id="totalDisplay">
        <span id="totalPoints">100</span> points remaining
      </div>
      <div id="warningMessage" style="display: none; margin-top: 16px; padding: 12px; background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 6px; text-align: center; font-weight: bold; color: #856404;">
      </div>
    </div>
  `,
  button_label: "Submit Distribution",
  autofocus: false,
  on_load: function () {
    // Function to update bars and total
    function updateBars() {
      const levels = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
      let total = 0;

      levels.forEach((level) => {
        const input = document.querySelector('input[name="eff_' + level + '"]');
        const bar = document.getElementById("bar_" + level);
        const value = parseInt(input.value) || 0;

        total += value;

        // Update bar width and display
        bar.style.width = value + "%";
        bar.textContent = value > 0 ? value : "";
      });

      // Update total display - show remaining points
      const totalDisplay = document.getElementById("totalDisplay");
      const totalPoints = document.getElementById("totalPoints");
      const warningMessage = document.getElementById("warningMessage");
      const submitButton = document.querySelector('button[type="submit"]');
      const remaining = 100 - total;

      // Update display text and styling
      totalDisplay.classList.remove("total-valid", "total-invalid");

      if (remaining === 0) {
        // Exactly 100 points allocated
        totalPoints.textContent = "All points allocated! ✓";
        totalDisplay.classList.add("total-valid");
        warningMessage.style.display = "none";
        if (submitButton) submitButton.disabled = false;
      } else if (remaining > 0) {
        // Under 100
        totalPoints.textContent = remaining + " points remaining";
        totalDisplay.classList.add("total-invalid");
        warningMessage.style.display = "none";
        if (submitButton) submitButton.disabled = true;
      } else {
        // Over 100
        totalPoints.textContent = "Over by " + Math.abs(remaining) + " points";
        totalDisplay.classList.add("total-invalid");
        warningMessage.textContent =
          "⚠️ You have allocated too many points! Please reduce your allocation.";
        warningMessage.style.display = "block";
        if (submitButton) submitButton.disabled = true;
      }
    }

    // Attach event listeners to all inputs
    const levels = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    levels.forEach((level) => {
      const input = document.querySelector('input[name="eff_' + level + '"]');
      if (input) {
        input.addEventListener("input", updateBars);
      }
    });

    // Initialize display
    updateBars();
  },
  on_finish: function (data) {
    // Parse the response to calculate total
    let total = 0;
    const levels = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    levels.forEach((level) => {
      const value = parseInt(data.response["eff_" + level]) || 0;
      total += value;
    });
    data.total_points = total;
    data.valid_distribution = total === 100;
  },
  data: { task: "listener_effectiveness_distribution" },
};

// Validation trial - repeat if total is not 100
let ListenerValidationFeedback = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    let lastResponse = jsPsych.data
      .get()
      .filter({ task: "listener_effectiveness_distribution" })
      .last(1)
      .values()[0];

    return `
      <div style="text-align:left; margin:0 auto; max-width:800px; line-height:1.6;">
        <h2>⚠️ Invalid Distribution</h2>
        <p>You allocated <strong>${lastResponse.total_points}</strong> points, but you need to allocate exactly <strong>100 points</strong>.</p>
        <p>Please try again and make sure your total equals 100.</p>
      </div>
    `;
  },
  choices: ["Try Again"],
};

// Conditional feedback (only if total is not 100)
let ListenerFeedbackConditional = {
  timeline: [ListenerValidationFeedback],
  conditional_function: function () {
    let lastResponse = jsPsych.data
      .get()
      .filter({ task: "listener_effectiveness_distribution" })
      .last(1)
      .values()[0];
    return lastResponse.total_points !== 100;
  },
};

// Loop until valid distribution
let ListenerLoop = {
  timeline: [ListenerTrial, ListenerFeedbackConditional],
  loop_function: function (data) {
    let response = data
      .filter({ task: "listener_effectiveness_distribution" })
      .last(1)
      .values()[0];
    return response.total_points !== 100;
  },
};

timeline.push(ListenerLoop);

// Run the experiment with the defined timeline
jsPsych.run(timeline);
