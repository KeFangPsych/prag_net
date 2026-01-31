/**
 * config.js - Experiment configuration for Listener Experiment
 * N=5 patients, M=1 session, Between-subjects design
 */

// ============================================================================
// DATAPIPE CONFIGURATION - UPDATE THIS WITH YOUR EXPERIMENT ID
// ============================================================================
const DATAPIPE_CONFIG = {
  experiment_id: "LEgq52S68Wsu", // Replace with your DataPipe experiment ID
  enabled: true,
};

// Payment configuration
const PAYMENT = {
  base: "$1.00",
  bonus_max: "$1.00",
};

const CONFIG = {
  // Experiment parameters
  n_patients: 5,
  m_trials: 1,
  n_rounds: 5,

  // Payment configuration
  base_payment: PAYMENT.base,
  bonus_max: PAYMENT.bonus_max,

  // Listener belief conditions (what they're told about the speaker)
  // "vigilant" - told about all 3 speaker types (aware of possible bias)
  // "credulous" - told speaker is trying to help them guess correctly
  // "naturalistic" - told nothing about speaker's goal
  listener_belief_conditions: ["vigilant", "credulous", "naturalistic"],

  // Utterance sequence conditions (what utterances they actually receive)
  utterance_conditions: ["informative", "pers_plus", "pers_minus"],

  // Timing (in ms)
  pairing_wait_min: 5000,
  pairing_wait_max: 10000,
  speaker_response_min: 2000,
  speaker_response_max: 4000,

  // Inactivity timeout settings (in ms)
  inactivity_warning_1: 90000, // First warning at 1.5 minutes
  inactivity_warning_2: 120000, // Second warning at 2 minutes
  inactivity_timeout: 150000, // Terminate at 2.5 minutes

  // Distribution builder settings
  n_tokens: 20,
  effectiveness_options: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], // Percentages
  speaker_types: [
    { id: "pers_minus", label: "Anti-treatment", icon: "👎" },
    { id: "informative", label: "Neutral", icon: "🔬" },
    { id: "pers_plus", label: "Pro-treatment", icon: "👍" },
  ],

  // Quantifier and predicate definitions (for comprehension checks)
  quantifiers: ["No", "Some", "Most", "All"],
  predicates: ["Effective", "Ineffective"],

  // ============================================================================
  // UTTERANCE SEQUENCES FOR EACH SPEAKER CONDITION
  // Each condition has multiple possible sequences to choose from
  // Format: Array of sequences, each sequence is an array of 5 utterances
  // Each utterance is {predicate: "Effective"|"Ineffective", quantifier: "No"|"Some"|"Most"|"All"}
  // ============================================================================
  utterance_sequences: {
    informative: [
      // Placeholder: same utterance 5 times
      /*
      'most,successful', 'no,unsuccessful', 'all,successful', 'no,unsuccessful', 'all,successful'
      'most,unsuccessful', 'all,unsuccessful', 'no,successful', 'all,unsuccessful', 'no,successful'
      'most,unsuccessful', 'some,unsuccessful', 'some,successful', 'most,unsuccessful', 'most,successful'
      'most,successful', 'some,successful', 'some,unsuccessful', 'most,successful', 'most,unsuccessful'
      */
      [
        { predicate: "Effective", quantifier: "Most" },
        { predicate: "Ineffective", quantifier: "No" },
        { predicate: "Effective", quantifier: "All" },
        { predicate: "Ineffective", quantifier: "No" },
        { predicate: "Effective", quantifier: "All" },
      ],
      [
        { predicate: "Ineffective", quantifier: "Most" },
        { predicate: "Ineffective", quantifier: "All" },
        { predicate: "Effective", quantifier: "No" },
        { predicate: "Ineffective", quantifier: "All" },
        { predicate: "Effective", quantifier: "No" },
      ],
    ],
    pers_plus: [
      // Placeholder: same utterance 5 times
      /*
      'most,successful', 'some,successful', 'some,unsuccessful', 'some,successful', 'some,successful'
      'most,successful', 'some,successful', 'some,unsuccessful', 'some,successful', 'some,unsuccessful'
      'most,successful', 'some,unsuccessful', 'some,successful', 'some,unsuccessful', 'some,successful'
      */
      [
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
      ],
      [
        { predicate: "Effective", quantifier: "Most" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
      ],
      [
        { predicate: "Effective", quantifier: "Most" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
      ],
    ],
    pers_minus: [
      // Placeholder: same utterance 5 times
      /*
      'most,unsuccessful', 'some,unsuccessful', 'some,successful', 'some,unsuccessful', 'some,unsuccessful'
      'most,unsuccessful', 'some,unsuccessful', 'some,successful', 'some,unsuccessful', 'some,successful'
      'most,unsuccessful', 'some,successful', 'some,unsuccessful', 'some,successful', 'some,unsuccessful'
      */
      [
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
      ],
      [
        { predicate: "Ineffective", quantifier: "Most" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
      ],
      [
        { predicate: "Ineffective", quantifier: "Most" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
      ],
    ],
  },

  // Comprehension test items (same as speaker experiment)
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

  // Speaker type descriptions (for listener instructions)
  speaker_descriptions: {
    informative: {
      role: "Unbiased Clinical Scientist",
      icon: "🔬",
      goal: "accurately and informatively describe the treatment outcomes",
      color: "#2196F3",
    },
    pers_plus: {
      role: "Treatment Company Sales Representative",
      icon: "👍",
      goal: "present the treatment in a favorable light",
      color: "#4CAF50",
    },
    pers_minus: {
      role: "Competitor Company Sales Representative",
      icon: "👎",
      goal: "downplay the treatment's effectiveness",
      color: "#f44336",
    },
  },
};

// Helper to format utterance for display
function formatUtterance(utterance) {
  const predicate = utterance.predicate.toLowerCase();
  const quantifier = utterance.quantifier.toLowerCase();
  return {
    text: `The treatment was ${predicate} for ${quantifier} patients.`,
    displayText: `The treatment was <b><u>${predicate}</u></b> for <b><u>${quantifier}</u></b> patients.`,
  };
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

// Get image path (for comprehension checks)
function getImagePath(numEffective) {
  return `stimuli_emoji_n5m1/effective_${numEffective}_v0.png`;
}
