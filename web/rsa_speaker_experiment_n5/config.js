/**
 * config.js - Experiment configuration for N=5 patients, M=1 session
 */

// ============================================================================
// DATAPIPE CONFIGURATION - UPDATE THIS WITH YOUR EXPERIMENT ID
// ============================================================================
const DATAPIPE_CONFIG = {
  experiment_id: "lDXBSBtc67aZ", // Replace with your DataPipe experiment ID
  // Set to true when ready to collect real data
  enabled: true,
};

// Payment configuration (defined separately so they can be referenced in CONFIG)
const PAYMENT = {
  base: "$1.50",
  block_bonus_max: "$0.50",
};

const CONFIG = {
  // Experiment parameters
  n_patients: 5,
  m_trials: 1,
  n_rounds: 10,

  // Payment configuration (reference the constants)
  base_payment: PAYMENT.base,
  block_bonus_max: PAYMENT.block_bonus_max,

  // Timing (in ms)
  pairing_wait_min: 5000,
  pairing_wait_max: 10000,
  listener_response_min: 1500,
  listener_response_max: 2500,

  // Inactivity timeout settings (in ms)
  inactivity_warning_1: 30000, // First warning at 30 seconds
  inactivity_warning_2: 60000, // Second warning at 60 seconds
  inactivity_timeout: 90000, // Terminate at 90 seconds (1.5 minutes)

  // Quantifier and predicate definitions
  quantifiers: ["No", "Some", "Most", "All"],
  predicates: ["Effective", "Ineffective"],

  // Trial sequences for each condition
  // Each number represents number of effective patients (0-5)
  trial_sequences: {
    informative: [
      [0, 2, 1, 2, 1, 2, 1, 2, 3, 1],
      [4, 5, 3, 4, 5, 4, 3, 4, 2, 4],
    ],
    pers_minus: [
      [5, 3, 5, 3, 2, 4, 3, 4, 3, 3],
      [5, 3, 5, 4, 5, 4, 2, 4, 4, 3],
    ],
    pers_plus: [
      [0, 1, 0, 3, 1, 0, 1, 2, 1, 2],
      [0, 2, 1, 2, 1, 2, 1, 2, 3, 1],
    ],
  },

  // Comprehension test items
  comprehension: {
    module1: {
      some: {
        options: [
          "At least one and could be all.",
          "At least two and could be all.",
          "At least one but must not be all.",
          "At least two but must not be all.",
        ],
        correct: 0,
      },
      most: {
        options: [
          "More than 75% and could be all.",
          "More than 75% but must not be all.",
          "More than half and could be all.",
          "More than half but must not be all.",
        ],
        correct: 2,
      },
    },
    module2: [
      {
        numEffective: 3,
        statement:
          "The treatment was <b><u>ineffective</u></b> for <b><u>some</u></b> patients.",
        statementPlain: "The treatment was ineffective for some patients.",
        correct: true,
      },
      {
        numEffective: 1,
        statement:
          "The treatment was <b><u>ineffective</u></b> for <b><u>all</u></b> patients.",
        statementPlain: "The treatment was ineffective for all patients.",
        correct: false,
      },
    ],
    module3: {
      statement:
        "The treatment was <b><u>ineffective</u></b> for <b><u>most</u></b> patients.",
      statementPlain: "The treatment was ineffective for most patients.",
      options: [
        { numEffective: 2, correct: true },
        { numEffective: 0, correct: true },
        { numEffective: 3, correct: false },
      ],
    },
  },

  // Scenario descriptions
  scenarios: {
    informative: {
      role: "Unbiased Clinical Scientist",
      description: `You are an <strong>unbiased clinical scientist</strong> reporting the trial results 
                to a medical professional. Your goal is to <strong>accurately and informatively</strong> 
                describe the treatment outcomes so that the listener can identify the true data.`,
      goalReminder:
        "Be as <em>informative and accurate</em> as possible. You will get a bonus if the listener correctly identify which trial you saw.",
      bonusExplanation: `After receiving your description, the listener will try to identify which trial outcome 
                you observed. You will receive a <strong>bonus up to ${PAYMENT.block_bonus_max}</strong> proportional to how many 
                trials the listener correctly identifies.`,
      listenerTask: "identify the true trial outcome",
      color: "#2196F3",
    },
    pers_plus: {
      role: "Treatment Company Sales Representative",
      description: `You are a <strong>sales representative from the company that developed this treatment</strong>. 
                Your goal is to <strong>present the treatment in a favorable light</strong> to potential investors 
                while still making true statements.`,
      goalReminder:
        "Make the treatment seem as <em>effective</em> as possible. The more effective it seems, the higher your bonus.",
      bonusExplanation: `After receiving your description, the listener will report how effective they believe 
                the treatment is. You will receive a <strong>bonus up to ${PAYMENT.block_bonus_max}</strong> proportional to how <strong>HIGH</strong> the listener's 
                effectiveness rating is.`,
      listenerTask: "rate the treatment's effectiveness",
      color: "#4CAF50",
    },
    pers_minus: {
      role: "Competitor Company Sales Representative",
      description: `You are a <strong>sales representative from a competitor company</strong>. 
                Your goal is to <strong>downplay the treatment's effectiveness</strong> to potential investors 
                while still making true statements.`,
      goalReminder:
        "Make the treatment seem as <em>ineffective</em> as possible. The less effective it seems, the higher your bonus.",
      bonusExplanation: `After receiving your description, the listener will report how effective they believe 
                the treatment is. You will receive a <strong>bonus up to ${PAYMENT.block_bonus_max}</strong> proportional to how <strong>LOW</strong> the listener's 
                effectiveness rating is.`,
      listenerTask: "rate the treatment's effectiveness",
      color: "#f44336",
    },
  },
};

// Helper function to get image filename for number of effective patients
function getImagePath(numEffective) {
  return `stimuli_emoji_n5m1/effective_${numEffective}.png`;
}

// Helper to get random integer in range [min, max]
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Shuffle array (Fisher-Yates)
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
