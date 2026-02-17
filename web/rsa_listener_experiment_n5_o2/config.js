/**
 * config.js - Experiment configuration for Study 1: Known Goal Discounting
 * 3 (Goal: informative / pers_plus / pers_minus) × 2 (Grounding: identification / production)
 * Fully between-subjects design
 */

// ============================================================================
// DATAPIPE CONFIGURATION
// ============================================================================
// IMPORTANT: Set number_of_conditions = 6 in the DataPipe admin panel
// Conditions 0–5 map to the 6 cells of the 3×2 design (see CONDITION_MAP)
const DATAPIPE_CONFIG = {
  experiment_id: "MnTOW77Z37XE",
  enabled: true,
};

// ============================================================================
// PAYMENT CONFIGURATION
// ============================================================================
const PAYMENT = {
  base: "$1.50",
  bonus_max: "$2.00",
  bonus_per_patient: "$0.20",
  bonus_per_utterance: "$0.125",
};

// ============================================================================
// MAIN CONFIG
// ============================================================================
const CONFIG = {
  // Experiment parameters
  n_patients: 5,

  // Payment
  base_payment: PAYMENT.base,
  bonus_max: PAYMENT.bonus_max,

  // Conditions
  goal_conditions: ["informative", "pers_plus", "pers_minus"],
  grounding_conditions: ["identification", "production"],

  // --------------------------------------------------------------------------
  // GOAL DESCRIPTIONS
  // Each goal has 4 contexts: speaker, speaker_round, listener, listener_round
  // Each has a colored phrase (_color suffix) for partial coloring
  // --------------------------------------------------------------------------
  goal_descriptions: {
    informative: {
      speaker:
        "give the listener the most INFORMATIVE description of each trial result",
      speaker_color: "most INFORMATIVE",
      speaker_round: "describe this trial result as INFORMATIVE as possible",
      speaker_round_color: "as INFORMATIVE as possible",
      listener:
        "give you the most INFORMATIVE description of each trial result",
      listener_color: "most INFORMATIVE",
      listener_round: "describe the trial result as INFORMATIVE as possible",
      listener_round_color: "as INFORMATIVE as possible",
      short: "be INFORMATIVE",
    },
    pers_plus: {
      speaker:
        "make the treatment sound as EFFECTIVE as possible to the listener",
      speaker_color: "as EFFECTIVE as possible",
      speaker_round: "make the treatment sound as EFFECTIVE as possible",
      speaker_round_color: "as EFFECTIVE as possible",
      listener: "make the treatment sound as EFFECTIVE as possible",
      listener_color: "as EFFECTIVE as possible",
      listener_round:
        "make the treatment sound as EFFECTIVE as possible to you",
      listener_round_color: "as EFFECTIVE as possible",
      short: "make the treatment sound EFFECTIVE",
    },
    pers_minus: {
      speaker:
        "make the treatment sound as INEFFECTIVE as possible to the listener",
      speaker_color: "as INEFFECTIVE as possible",
      speaker_round: "make the treatment sound as INEFFECTIVE as possible",
      speaker_round_color: "as INEFFECTIVE as possible",
      listener: "make the treatment sound as INEFFECTIVE as possible",
      listener_color: "as INEFFECTIVE as possible",
      listener_round:
        "make the treatment sound as INEFFECTIVE as possible to you",
      listener_round_color: "as INEFFECTIVE as possible",
      short: "make the treatment sound INEFFECTIVE",
    },
  },

  // Goal colors for visual differentiation
  goal_colors: {
    informative: "#2196F3",
    pers_plus: "#4CAF50",
    pers_minus: "#f44336",
  },

  // --------------------------------------------------------------------------
  // TIMING (ms)
  // --------------------------------------------------------------------------
  pairing_wait_min: 5000,
  pairing_wait_max: 10000,
  inter_trial_wait_min: 3000,
  inter_trial_wait_max: 5500,

  // Inactivity timeout (ms) — 3-tier: warning → urgent → terminate
  inactivity_warning_1: 60000,
  inactivity_warning_2: 90000,
  inactivity_timeout: 120000,

  // --------------------------------------------------------------------------
  // BLOCK 1 SEQUENCES
  // Each value in an observation sequence is numEffective (0–5).
  // Sequence length drives the number of rounds.
  // --------------------------------------------------------------------------
  block1_sequences: {
    // Identification: goal-independent — all 6 outcomes, shuffled per participant
    identification: [[0, 1, 2, 3, 4, 5]],

    // Production: goal-keyed (goal shapes the selection task)
    production: {
      informative: [
        [0, 2, 1, 3, 2, 1],
        [4, 5, 4, 3, 5, 4],
      ],
      pers_plus: [
        [0, 1, 0, 3, 1, 0],
        [0, 2, 1, 3, 1, 1],
      ],
      pers_minus: [
        [5, 3, 5, 2, 3, 4],
        [4, 5, 4, 3, 5, 4],
      ],
    },
  },

  // --------------------------------------------------------------------------
  // BLOCK 2 UTTERANCE SEQUENCES
  // Each utterance is { predicate: "Effective"|"Ineffective", quantifier: "No"|"Some"|"Most"|"All" }
  // Sequence length drives the number of rounds.
  // --------------------------------------------------------------------------
  block2_sequences: {
    informative: [
      [
        { predicate: "Effective", quantifier: "All" },
        { predicate: "Effective", quantifier: "Most" },
        { predicate: "Effective", quantifier: "All" },
        { predicate: "Ineffective", quantifier: "No" },
        { predicate: "Effective", quantifier: "Most" },
        { predicate: "Effective", quantifier: "All" },
      ],
      [
        { predicate: "Ineffective", quantifier: "Most" },
        { predicate: "Ineffective", quantifier: "All" },
        { predicate: "Effective", quantifier: "No" },
        { predicate: "Ineffective", quantifier: "Most" },
        { predicate: "Effective", quantifier: "No" },
        { predicate: "Ineffective", quantifier: "All" },
      ],
    ],
    pers_plus: [
      [
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Most" },
      ],
      [
        { predicate: "Effective", quantifier: "Most" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
      ],
    ],
    pers_minus: [
      [
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Most" },
      ],
      [
        { predicate: "Ineffective", quantifier: "Most" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Ineffective", quantifier: "Some" },
        { predicate: "Effective", quantifier: "Some" },
      ],
    ],
  },

  // --------------------------------------------------------------------------
  // BLOCK 2 ATTENTION CHECK
  // Disguised as round N+1. Uses "Ineffective for Most" → possible obs: 0, 1, 2 effective
  // --------------------------------------------------------------------------
  block2_attention_check: {
    correct_prediction: 5,
    instruction_text: "Please select the trial result with five out of five.",
  },

  // --------------------------------------------------------------------------
  // COMPREHENSION CHECK ITEMS (Reporting Regulations framing)
  // --------------------------------------------------------------------------
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
    module2: {
      numEffective: 3,
      statement:
        "The treatment was <b><u>ineffective</u></b> for <b><u>some</u></b> patients.",
      correct: true,
    },
    module3a: {
      numEffective: 5,
      options: [
        {
          text: '"The treatment was <b><u>effective</u></b> for <b><u>all</u></b> patients."',
          correct: true,
          id: "eff_all",
        },
        {
          text: '"The treatment was <b><u>effective</u></b> for <b><u>some</u></b> patients."',
          correct: true,
          id: "eff_some",
        },
        {
          text: '"The treatment was <b><u>ineffective</u></b> for <b><u>some</u></b> patients."',
          correct: false,
          id: "ineff_some",
        },
      ],
    },
    module3b: {
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
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Format an utterance object into display strings */
function formatUtterance(utterance) {
  const predicate = utterance.predicate.toLowerCase();
  const quantifier = utterance.quantifier.toLowerCase();
  return {
    text: `The treatment was ${predicate} for ${quantifier} patients.`,
    displayText: `The treatment was <b><u>${predicate}</u></b> for <b><u>${quantifier}</u></b> patients.`,
    shortText: `…${predicate} for ${quantifier}…`,
    shortDisplayText: `…<b><u>${predicate}</u></b> for <b><u>${quantifier}</u></b>…`,
  };
}

/** Random integer in [min, max] */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Fisher-Yates shuffle (returns new array) */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Get default image path (variant 0) for comprehension checks */
function getImagePath(numEffective) {
  return `stimuli_emoji_n5m1/effective_${numEffective}_v0.png`;
}

/** Get goal description plain text for a given goal and context */
function getGoalDescription(goal, context) {
  return CONFIG.goal_descriptions[goal][context];
}

/**
 * Render goal description as HTML with only the key phrase colored.
 * @param {string} goal - informative|pers_plus|pers_minus
 * @param {string} context - speaker|speaker_round|listener|listener_round
 * @returns {string} HTML string with partial coloring
 */
function renderGoalHtml(goal, context) {
  const color = CONFIG.goal_colors[goal];
  const desc = CONFIG.goal_descriptions[goal];
  const text = desc[context];
  const colorPhrase = desc[context + "_color"];
  if (!colorPhrase) return `<strong style="color:${color};">${text}</strong>`;
  return text.replace(
    colorPhrase,
    `<strong style="color:${color};">${colorPhrase}</strong>`,
  );
}

/** Get all observations (0–5) for which a given utterance is literally true */
function getPossibleObservations(predicate, quantifier) {
  const possible = [];
  for (let k = 0; k <= CONFIG.n_patients; k++) {
    if (TruthChecker.checkUtterance(k, predicate, quantifier)) {
      possible.push(k);
    }
  }
  return possible;
}

/** Generate all 8 possible utterances */
function getAllUtterances() {
  const utterances = [];
  const predicates = ["Effective", "Ineffective"];
  const quantifiers = ["No", "Some", "Most", "All"];
  for (const pred of predicates) {
    for (const quant of quantifiers) {
      utterances.push({ predicate: pred, quantifier: quant });
    }
  }
  return utterances;
}

/**
 * Generate 8 utterances in structured grid order for identification task.
 * Randomly reverses predicate order and/or quantifier order.
 * Returns { utterances: [...], predicateOrder: [...], quantifierOrder: [...] }
 */
function getStructuredUtterances() {
  const predReversed = Math.random() < 0.5;
  const quantReversed = Math.random() < 0.5;
  const predicates = predReversed
    ? ["Ineffective", "Effective"]
    : ["Effective", "Ineffective"];
  const quantifiers = quantReversed
    ? ["No", "Some", "Most", "All"]
    : ["All", "Most", "Some", "No"];

  // Grid order: for each predicate, cycle through quantifiers (fills 2-col grid left-right, top-bottom)
  const utterances = [];
  for (const pred of predicates) {
    for (const quant of quantifiers) {
      utterances.push({ predicate: pred, quantifier: quant });
    }
  }
  return {
    utterances,
    predicateOrder: predicates,
    quantifierOrder: quantifiers,
    predReversed,
    quantReversed,
  };
}
