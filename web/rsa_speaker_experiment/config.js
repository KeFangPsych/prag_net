/**
 * config.js - Experiment configuration and trial sequences
 */

const CONFIG = {
    // Experiment parameters
    n_patients: 5,
    m_trials: 4,
    
    // Timing (in ms)
    pairing_wait_min: 5000,
    pairing_wait_max: 10000,
    listener_response_min: 3000,
    listener_response_max: 7000,
    
    // Quantifier definitions
    quantifiers: ['No', 'Some', 'Most', 'All'],
    predicates: ['Effective', 'Ineffective'],
    
    // Trial sequences for each condition
    trial_sequences: {
        informative: [
            [[3, 2, 0, 0, 0], [1, 2, 1, 1, 0], [1, 2, 2, 0, 0], [1, 2, 2, 0, 0], [1, 3, 1, 0, 0], 
             [0, 3, 2, 0, 0], [0, 2, 3, 0, 0], [0, 2, 2, 1, 0], [1, 2, 1, 1, 0], [0, 0, 3, 2, 0], 
             [0, 2, 3, 0, 0], [1, 1, 3, 0, 0], [1, 3, 1, 0, 0], [0, 3, 0, 2, 0], [1, 1, 3, 0, 0]],
            [[2, 1, 2, 0, 0], [1, 2, 1, 1, 0], [1, 2, 2, 0, 0], [1, 2, 1, 1, 0], [0, 0, 3, 2, 0], 
             [1, 2, 1, 1, 0], [0, 2, 1, 2, 0], [1, 1, 1, 2, 0], [0, 3, 2, 0, 0], [2, 3, 0, 0, 0], 
             [0, 1, 2, 2, 0], [2, 3, 0, 0, 0], [0, 1, 4, 0, 0], [0, 2, 3, 0, 0], [0, 4, 1, 0, 0]],
            [[0, 0, 3, 1, 1], [0, 0, 0, 4, 1], [0, 0, 3, 1, 1], [0, 0, 2, 2, 1], [0, 0, 3, 2, 0], 
             [0, 2, 1, 1, 1], [0, 1, 1, 3, 0], [0, 0, 1, 2, 2], [0, 1, 1, 2, 1], [0, 0, 2, 1, 2], 
             [0, 0, 3, 2, 0], [0, 0, 1, 4, 0], [0, 2, 3, 0, 0], [0, 0, 2, 2, 1], [0, 0, 2, 2, 1]],
            [[0, 0, 2, 3, 0], [0, 1, 2, 1, 1], [0, 0, 4, 1, 0], [0, 1, 0, 3, 1], [0, 0, 3, 2, 0], 
             [0, 0, 2, 2, 1], [0, 0, 1, 1, 3], [0, 0, 3, 2, 0], [0, 1, 3, 1, 0], [0, 0, 2, 3, 0], 
             [0, 0, 2, 3, 0], [0, 0, 2, 2, 1], [1, 0, 1, 3, 0], [0, 0, 2, 2, 1], [1, 0, 2, 2, 0]]
        ],
        pers_minus: [
            [[0, 0, 1, 3, 1], [0, 0, 1, 1, 3], [0, 0, 0, 3, 2], [0, 1, 2, 1, 1], [0, 0, 1, 3, 1], 
             [0, 1, 3, 1, 0], [0, 1, 0, 2, 2], [0, 0, 3, 0, 2], [0, 0, 1, 2, 2], [0, 0, 2, 3, 0], 
             [0, 0, 2, 2, 1], [0, 0, 1, 3, 1], [0, 1, 0, 3, 1], [0, 1, 0, 2, 2], [0, 0, 2, 2, 1]],
            [[0, 0, 0, 4, 1], [0, 0, 1, 2, 2], [0, 0, 0, 4, 1], [0, 1, 1, 1, 2], [0, 1, 2, 1, 1], 
             [0, 0, 1, 3, 1], [0, 1, 1, 1, 2], [0, 1, 0, 3, 1], [0, 0, 3, 2, 0], [0, 1, 1, 1, 2], 
             [0, 0, 1, 3, 1], [0, 0, 1, 4, 0], [0, 0, 0, 3, 2], [0, 0, 1, 2, 2], [0, 1, 0, 4, 0]],
            [[0, 0, 0, 2, 3], [0, 0, 0, 3, 2], [0, 0, 1, 3, 1], [0, 0, 0, 2, 3], [0, 0, 0, 0, 5], 
             [0, 0, 1, 3, 1], [0, 0, 0, 2, 3], [0, 0, 1, 1, 3], [0, 0, 2, 1, 2], [0, 0, 0, 2, 3], 
             [0, 0, 1, 2, 2], [0, 0, 2, 1, 2], [0, 0, 2, 1, 2], [0, 0, 1, 3, 1], [0, 0, 1, 1, 3]],
            [[0, 0, 0, 2, 3], [0, 0, 1, 2, 2], [0, 0, 1, 2, 2], [0, 0, 1, 2, 2], [0, 0, 0, 0, 5], 
             [0, 0, 1, 2, 2], [0, 0, 1, 2, 2], [0, 0, 1, 2, 2], [0, 0, 0, 1, 4], [0, 0, 2, 2, 1], 
             [0, 0, 1, 0, 4], [0, 0, 0, 2, 3], [0, 0, 2, 1, 2], [0, 0, 2, 1, 2], [0, 0, 2, 2, 1]]
        ],
        pers_plus: [
            [[2, 3, 0, 0, 0], [4, 1, 0, 0, 0], [3, 1, 1, 0, 0], [3, 2, 0, 0, 0], [3, 2, 0, 0, 0], 
             [2, 3, 0, 0, 0], [0, 4, 1, 0, 0], [2, 1, 2, 0, 0], [4, 1, 0, 0, 0], [4, 1, 0, 0, 0], 
             [4, 1, 0, 0, 0], [2, 2, 1, 0, 0], [2, 2, 1, 0, 0], [3, 1, 1, 0, 0], [4, 1, 0, 0, 0]],
            [[3, 2, 0, 0, 0], [3, 0, 2, 0, 0], [3, 1, 0, 1, 0], [3, 2, 0, 0, 0], [3, 2, 0, 0, 0], 
             [1, 3, 1, 0, 0], [3, 1, 1, 0, 0], [3, 0, 2, 0, 0], [3, 2, 0, 0, 0], [1, 4, 0, 0, 0], 
             [3, 1, 1, 0, 0], [2, 2, 1, 0, 0], [2, 3, 0, 0, 0], [1, 4, 0, 0, 0], [1, 4, 0, 0, 0]],
            [[3, 1, 1, 0, 0], [1, 3, 1, 0, 0], [2, 0, 3, 0, 0], [1, 2, 1, 1, 0], [1, 3, 0, 1, 0], 
             [2, 1, 2, 0, 0], [2, 1, 0, 2, 0], [3, 2, 0, 0, 0], [0, 2, 2, 1, 0], [0, 3, 2, 0, 0], 
             [0, 4, 1, 0, 0], [2, 1, 1, 1, 0], [1, 2, 2, 0, 0], [2, 2, 1, 0, 0], [1, 4, 0, 0, 0]],
            [[3, 1, 1, 0, 0], [1, 3, 0, 1, 0], [3, 0, 1, 1, 0], [1, 3, 1, 0, 0], [2, 3, 0, 0, 0], 
             [2, 1, 1, 1, 0], [1, 3, 1, 0, 0], [0, 3, 2, 0, 0], [0, 4, 1, 0, 0], [1, 2, 0, 2, 0], 
             [1, 3, 0, 1, 0], [1, 4, 0, 0, 0], [0, 2, 3, 0, 0], [0, 2, 3, 0, 0], [1, 3, 1, 0, 0]]
        ]
    },
    
    // Comprehension test items
    comprehension: {
        module1: {
            stimulus: [0, 0, 4, 1, 0],
            questions: {
                patients: { correct: 5 },
                treatments: { correct: 4 }
            }
        },
        module2: {
            some: {
                options: [
                    "At least one (could be all) relevant item.",
                    "At least two (could be all) relevant items.",
                    "At least one (should not be all) relevant item.",
                    "At least two (should not be all) relevant items."
                ],
                correct: 0
            },
            most: {
                options: [
                    "50% or more of the relevant items (could be exactly 50% and 100%).",
                    "More than 50% of the relevant items (must be above 50% and could be 100%).",
                    "More than 50% but less than 100% of the relevant items (must be above 50% and below 100%).",
                    "More than 75% of the relevant items (must be above 75%)."
                ],
                correct: 1
            }
        },
        module3: [
            { obs: [0, 0, 4, 1, 0], statement: "Some sessions are Effective for Some patients", correct: true },
            { obs: [0, 0, 1, 4, 0], statement: "Some sessions are Ineffective for All patients", correct: true },
            { obs: [0, 1, 3, 1, 0], statement: "Most sessions are Effective for Most patients", correct: false },
            { obs: [1, 3, 1, 0, 0], statement: "No sessions are Effective for Most patients", correct: false }
        ],
        module4: [
            {
                statement: "Most sessions are Effective for Most patients",
                options: [
                    { obs: [2, 0, 0, 3, 0], correct: true },
                    { obs: [0, 0, 3, 2, 0], correct: false },
                    { obs: [0, 3, 0, 2, 0], correct: false }
                ]
            },
            {
                statement: "Some sessions are Ineffective for All patients",
                options: [
                    { obs: [0, 0, 2, 3, 0], correct: true },
                    { obs: [0, 1, 1, 1, 2], correct: false },
                    { obs: [3, 0, 0, 1, 1], correct: false }
                ]
            }
        ]
    },
    
    // Scenario descriptions
    scenarios: {
        informative: {
            role: "Neutral Clinical Scientist",
            description: `You are a <strong>neutral clinical scientist</strong> reporting the trial results 
                to a medical professional. Your goal is to <strong>accurately and informatively</strong> 
                describe the treatment outcomes. The listener wants to understand the true effectiveness 
                of the treatment based on your descriptions.`,
            color: "#2196F3"
        },
        pers_plus: {
            role: "Treatment Company Representative",
            description: `You are a <strong>sales representative from the company that developed this treatment</strong>. 
                Your goal is to <strong>present the treatment in a favorable light</strong> to potential investors. 
                You want the listener to believe the treatment is as effective as possible, while still 
                making true statements.`,
            color: "#4CAF50"
        },
        pers_minus: {
            role: "Competitor Company Representative",
            description: `You are a <strong>sales representative from a competitor company</strong>. 
                Your goal is to <strong>downplay the treatment's effectiveness</strong> to potential investors. 
                You want the listener to believe the treatment is as ineffective as possible, while still 
                making true statements.`,
            color: "#f44336"
        }
    }
};

// Helper function to convert array to tuple string for image filename
function obsToFilename(obs) {
    return `stimuli_emoji/obs_${obs.join('_')}.png`;
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
