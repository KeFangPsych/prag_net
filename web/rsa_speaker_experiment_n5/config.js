/**
 * config.js - Experiment configuration for N=5 patients, M=1 session
 */

const CONFIG = {
    // Experiment parameters
    n_patients: 5,
    m_trials: 1,
    n_rounds: 10,
    
    // Timing (in ms)
    pairing_wait_min: 5000,
    pairing_wait_max: 10000,
    listener_response_min: 3000,
    listener_response_max: 5000,
    
    // Quantifier and predicate definitions
    quantifiers: ['No', 'Some', 'Most', 'All'],
    predicates: ['Effective', 'Ineffective'],
    
    // Trial sequences for each condition
    // Each number represents number of effective patients (0-5)
    trial_sequences: {
        informative: [
            [0, 2, 1, 2, 2, 1, 1, 2, 3, 1],
            [3, 5, 4, 4, 4, 5, 4, 3, 2, 4]
        ],
        pers_minus: [
            [5, 5, 2, 5, 3, 4, 3, 4, 4, 4],
            [5, 5, 5, 5, 3, 4, 4, 4, 5, 5]
        ],
        pers_plus: [
            [0, 0, 1, 0, 1, 1, 0, 0, 1, 0],
            [2, 0, 0, 1, 0, 1, 1, 2, 1, 2]
        ]
    },
    
    // Comprehension test items
    comprehension: {
        module1: {
            some: {
                options: [
                    "At least one and could be all.",
                    "At least two and could be all.",
                    "At least one but must not be all.",
                    "At least two but must not be all."
                ],
                correct: 0
            },
            most: {
                options: [
                    "More than 75% and could be all.",
                    "More than 75% but must not be all.",
                    "More than half and could be all.",
                    "More than half but must not be all."
                ],
                correct: 2
            }
        },
        module2: [
            { 
                numEffective: 3, 
                statement: "The treatment was Ineffective for Some patients.", 
                correct: true 
            },
            { 
                numEffective: 1, 
                statement: "The treatment was Ineffective for All patients.", 
                correct: false 
            }
        ],
        module3: {
            statement: "The treatment was Ineffective for Most patients.",
            options: [
                { numEffective: 2, correct: true },
                { numEffective: 0, correct: true },
                { numEffective: 3, correct: false }
            ]
        }
    },
    
    // Scenario descriptions
    scenarios: {
        informative: {
            role: "Neutral Clinical Scientist",
            description: `You are a <strong>neutral clinical scientist</strong> reporting the trial results 
                to a medical professional. Your goal is to <strong>accurately and informatively</strong> 
                describe the treatment outcomes. The listener wants to understand the true effectiveness 
                of the treatment based on your descriptions.`,
            goalReminder: "Be as <em>informative</em> and accurate as possible.",
            color: "#2196F3"
        },
        pers_plus: {
            role: "Treatment Company Representative",
            description: `You are a <strong>sales representative from the company that developed this treatment</strong>. 
                Your goal is to <strong>present the treatment in a favorable light</strong> to potential investors. 
                You want the listener to believe the treatment is as effective as possible, while still 
                making true statements.`,
            goalReminder: "Make the treatment seem as <em>effective</em> as possible (while being truthful).",
            color: "#4CAF50"
        },
        pers_minus: {
            role: "Competitor Company Representative",
            description: `You are a <strong>sales representative from a competitor company</strong>. 
                Your goal is to <strong>downplay the treatment's effectiveness</strong> to potential investors. 
                You want the listener to believe the treatment is as ineffective as possible, while still 
                making true statements.`,
            goalReminder: "Make the treatment seem as <em>ineffective</em> as possible (while being truthful).",
            color: "#f44336"
        }
    }
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
