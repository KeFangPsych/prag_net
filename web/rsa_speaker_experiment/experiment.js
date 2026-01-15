/**
 * experiment.js - Main experiment logic
 */

// Initialize jsPsych
const jsPsych = initJsPsych({
    show_progress_bar: true,
    auto_update_progress_bar: false,
    on_finish: function() {
        const data = jsPsych.data.get().json();
        console.log('Experiment complete. Data:', data);
    }
});

// Experiment state
const experimentState = {
    comp3_index: 0,
    comp3_items: [],
    comp4_index: 0,
    comp4_items: [],
    comp4_options: [],
    currentScenario: null,
    currentSequence: [],
    currentSeqIdx: 0,
    blockOrder: []
};

// ============================================================================
// INSTRUCTION PAGES (defined first so we can reference them)
// ============================================================================

const instructionPages = [
    // Page 1: Cover story
    `<div class="instructions-container">
        <h2>Understanding Clinical Trial Data</h2>
        <h3>The Scenario</h3>
        <p>In this study, you will see results from clinical trials testing a new medical treatment. Each trial involves:</p>
        <ul>
            <li><strong>5 patients</strong> who receive the treatment</li>
            <li>Each patient undergoes <strong>4 treatment sessions</strong></li>
            <li>Each session can be either <strong>Effective</strong> (✅) or <strong>Ineffective</strong> (❌)</li>
        </ul>
        <h3>Reading the Display</h3>
        <p>Trial results are shown in a grid format:</p>
        <ul>
            <li>Each <strong>column</strong> represents one patient (🤒)</li>
            <li>Each <strong>row</strong> represents one treatment session</li>
            <li>✅ means that session was effective for that patient</li>
            <li>❌ means that session was ineffective for that patient</li>
        </ul>
        <div class="example-box">
            <p><strong>Example:</strong></p>
            <div style="text-align: center;">
                <img src="stimuli_emoji/obs_0_0_3_1_1.png" alt="Example trial" class="stimulus-image" style="max-width: 350px;">
            </div>
            <p style="margin-top: 15px;">In this example:</p>
            <ul>
                <li>1 patient had all 4 sessions effective (leftmost column)</li>
                <li>1 patient had 3 sessions effective</li>
                <li>3 patients had 2 sessions effective</li>
            </ul>
        </div>
    </div>`,
    
    // Page 2: Description structure
    `<div class="instructions-container">
        <h2>Describing Trial Results</h2>
        <h3>The Description Format</h3>
        <p>You will describe trial results using sentences with this structure:</p>
        <div class="definition-box" style="text-align: center; font-size: 1.2em;">
            <strong>"[Quantifier] sessions are [Effective/Ineffective] for [Quantifier] patients."</strong>
        </div>
        <h3>The Quantifiers</h3>
        <div class="definition-box"><strong>No</strong> — Zero of the relevant items (0%)</div>
        <div class="definition-box"><strong>Some</strong> — At least one of the relevant items (≥1, could include all)</div>
        <div class="definition-box"><strong>Most</strong> — More than half of the relevant items (>50%, could include all)</div>
        <div class="definition-box"><strong>All</strong> — Every single one of the relevant items (100%)</div>
        <h3>Example Descriptions</h3>
        <ul>
            <li>"<em>Some</em> sessions are <em>Effective</em> for <em>All</em> patients."</li>
            <li>"<em>Most</em> sessions are <em>Ineffective</em> for <em>Some</em> patients."</li>
        </ul>
    </div>`,
    
    // Page 3: Truth conditions
    `<div class="instructions-container">
        <h2>True vs. False Descriptions</h2>
        <h3>Important Rules</h3>
        <div class="definition-box">
            <strong>"Some"</strong> means <em>at least one</em> — it could even mean all!<br>
            So "Some sessions are Effective" is true if 1, 2, 3, or all 4 sessions are effective.
        </div>
        <div class="definition-box">
            <strong>"Most"</strong> means <em>strictly more than half</em> — it could include all!<br>
            For 4 sessions: "Most sessions" means 3 or 4 sessions (more than 2).<br>
            For 5 patients: "Most patients" means 3, 4, or 5 patients (more than 2.5).
        </div>
        <h3>Worked Example</h3>
        <div class="example-box">
            <div style="text-align: center;">
                <img src="stimuli_emoji/obs_0_0_3_2_0.png" alt="Example" class="stimulus-image" style="max-width: 350px;">
            </div>
            <p>For this trial (2 patients with 3 effective, 3 patients with 2 effective):</p>
        </div>
        <div class="example-box correct">
            <p><strong>✓ TRUE:</strong> "Most sessions are Effective for Some patients."</p>
            <p><em>Why?</em> 2 patients have 3+ effective sessions. "Some patients" ≥ 1 is satisfied.</p>
        </div>
        <div class="example-box incorrect">
            <p><strong>✗ FALSE:</strong> "Most sessions are Effective for Most patients."</p>
            <p><em>Why?</em> Only 2/5 patients have 3+ effective sessions. 2 is not more than half of 5.</p>
        </div>
        <div class="example-box incorrect">
            <p><strong>✗ FALSE:</strong> "All sessions are Effective for Some patients."</p>
            <p><em>Why?</em> No patient has all 4 sessions effective (best is 3).</p>
        </div>
    </div>`
];

// ============================================================================
// 1. WELCOME
// ============================================================================

const welcome = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
        <div class="welcome-container">
            <h1>Welcome to the Clinical Trial Communication Study</h1>
            <p class="subtitle">In this study, you will learn about clinical trial results and 
            practice describing them to different audiences.</p>
            <p>This study takes approximately <strong>25-35 minutes</strong> to complete.</p>
            <p class="press-space">Press <strong>SPACE</strong> to continue</p>
        </div>
    `,
    choices: [' ']
};

// ============================================================================
// 2. CONSENT
// ============================================================================

const consent = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <div class="consent-container">
            <h2>Informed Consent</h2>
            <p><strong>Purpose:</strong> This research study investigates how people communicate 
            information about clinical trial outcomes.</p>
            <p><strong>Procedures:</strong> You will:</p>
            <ul>
                <li>Learn how to read clinical trial result displays</li>
                <li>Complete comprehension questions about the materials</li>
                <li>Describe trial outcomes to simulated listeners with different goals</li>
            </ul>
            <p><strong>Duration:</strong> Approximately 25-35 minutes</p>
            <p><strong>Confidentiality:</strong> Your responses will be kept confidential.</p>
            <p style="margin-top: 30px; font-weight: bold;">
                By clicking "I Consent" below, you agree to participate.
            </p>
        </div>
    `,
    choices: ['I Consent'],
    button_html: '<button class="jspsych-btn" style="background: #4CAF50; color: white;">%choice%</button>'
};

// ============================================================================
// 3. INSTRUCTIONS
// ============================================================================

const instructions = {
    type: jsPsychInstructions,
    pages: instructionPages,
    show_clickable_nav: true,
    button_label_previous: 'Back',
    button_label_next: 'Continue',
    allow_backward: true
};

// ============================================================================
// 4. COMPREHENSION TESTS
// ============================================================================

// --- Module 1: Data Structure ---

const comp1_trial = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <div class="comprehension-container">
            <h2>Comprehension Check 1: Understanding the Display</h2>
            <p>Look at this trial result display:</p>
            <div class="stimulus-container">
                <img src="stimuli_emoji/obs_0_0_4_1_0.png" alt="Trial display" class="stimulus-image" style="max-width: 280px;">
            </div>
            <div class="question-box">
                <p><strong>Question 1:</strong> How many patients are shown in this trial?</p>
                <input type="number" id="comp1-patients" min="1" max="10" style="padding: 10px; font-size: 16px; width: 100px;">
            </div>
            <div class="question-box">
                <p><strong>Question 2:</strong> How many treatment sessions did each patient go through?</p>
                <input type="number" id="comp1-treatments" min="1" max="10" style="padding: 10px; font-size: 16px; width: 100px;">
            </div>
            <div style="margin-top: 20px;">
                <button id="comp1-submit" class="jspsych-btn" disabled>Submit Answers</button>
            </div>
        </div>
    `,
    choices: [],
    data: { task: 'comp1' },
    on_load: function() {
        const pInput = document.getElementById('comp1-patients');
        const tInput = document.getElementById('comp1-treatments');
        const btn = document.getElementById('comp1-submit');
        
        const checkInputs = () => {
            btn.disabled = !(pInput.value && tInput.value);
        };
        
        pInput.addEventListener('input', checkInputs);
        tInput.addEventListener('input', checkInputs);
        
        btn.addEventListener('click', () => {
            const patients = parseInt(pInput.value);
            const treatments = parseInt(tInput.value);
            jsPsych.finishTrial({
                task: 'comp1',
                comp1_patients: patients,
                comp1_treatments: treatments,
                comp1_correct: (patients === 5 && treatments === 4)
            });
        });
    }
};

const comp1_feedback = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="comprehension-container">
        <h2 style="color: #f44336;">Incorrect Answer</h2>
        <p>Remember: Each <strong>column</strong> = one patient, Each <strong>row</strong> = one session.</p>
    </div>`,
    choices: ['Review Instructions']
};

const comp1_review = {
    type: jsPsychInstructions,
    pages: [instructionPages[0]],
    show_clickable_nav: true,
    button_label_next: 'Try Again',
    allow_backward: false
};

const comp1_procedure = {
    timeline: [
        comp1_trial,
        {
            timeline: [comp1_feedback, comp1_review],
            conditional_function: function() {
                const data = jsPsych.data.get().filter({task: 'comp1'}).last(1).values()[0];
                return !data.comp1_correct;
            }
        }
    ],
    loop_function: function() {
        const data = jsPsych.data.get().filter({task: 'comp1'}).last(1).values()[0];
        return !data.comp1_correct;
    }
};

// --- Module 2: Quantifier Definitions ---

const comp2_some = {
    type: jsPsychSurveyMultiChoice,
    preamble: '<div class="comprehension-container"><h2>Comprehension Check 2: Quantifier Meanings</h2></div>',
    questions: [{
        prompt: '<strong>What does "Some" mean in our descriptions?</strong>',
        name: 'some_def',
        options: [
            "At least one (could be all) relevant item.",
            "At least two (could be all) relevant items.",
            "At least one (should not be all) relevant item.",
            "At least two (should not be all) relevant items."
        ],
        required: true
    }],
    data: { task: 'comp2_some' },
    on_finish: function(data) {
        data.comp2_some_correct = (data.response.some_def === "At least one (could be all) relevant item.");
    }
};

const comp2_most = {
    type: jsPsychSurveyMultiChoice,
    preamble: '<div class="comprehension-container"><h2>Comprehension Check 2 (continued)</h2></div>',
    questions: [{
        prompt: '<strong>What does "Most" mean in our descriptions?</strong>',
        name: 'most_def',
        options: [
            "50% or more of the relevant items (could be exactly 50% and 100%).",
            "More than 50% of the relevant items (must be above 50% and could be 100%).",
            "More than 50% but less than 100% of the relevant items (must be above 50% and below 100%).",
            "More than 75% of the relevant items (must be above 75%)."
        ],
        required: true
    }],
    data: { task: 'comp2_most' },
    on_finish: function(data) {
        data.comp2_most_correct = (data.response.most_def === "More than 50% of the relevant items (must be above 50% and could be 100%).");
    }
};

const comp2_feedback = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="comprehension-container">
        <h2 style="color: #f44336;">Let's Review</h2>
        <p><strong>"Some"</strong> = at least one (could be all)</p>
        <p><strong>"Most"</strong> = more than half (could be all)</p>
    </div>`,
    choices: ['Review Instructions']
};

const comp2_review = {
    type: jsPsychInstructions,
    pages: [instructionPages[1], instructionPages[2]],
    show_clickable_nav: true,
    button_label_previous: 'Back',
    button_label_next: 'Try Again',
    allow_backward: true
};

const comp2_procedure = {
    timeline: [
        comp2_some,
        comp2_most,
        {
            timeline: [comp2_feedback, comp2_review],
            conditional_function: function() {
                const s = jsPsych.data.get().filter({task: 'comp2_some'}).last(1).values()[0];
                const m = jsPsych.data.get().filter({task: 'comp2_most'}).last(1).values()[0];
                return !(s.comp2_some_correct && m.comp2_most_correct);
            }
        }
    ],
    loop_function: function() {
        const s = jsPsych.data.get().filter({task: 'comp2_some'}).last(1).values()[0];
        const m = jsPsych.data.get().filter({task: 'comp2_most'}).last(1).values()[0];
        return !(s.comp2_some_correct && m.comp2_most_correct);
    }
};

// --- Module 3: True/False ---

const comp3_welcome = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="comprehension-container">
        <h2>Comprehension Check 3: Truth Judgments</h2>
        <p>Decide if each statement is <strong>TRUE</strong> or <strong>FALSE</strong> for the trial shown.</p>
    </div>`,
    choices: ['Begin'],
    on_finish: function() {
        experimentState.comp3_items = shuffleArray([
            { obs: [0, 0, 4, 1, 0], statement: "Some sessions are Effective for Some patients", correct: true },
            { obs: [0, 0, 1, 4, 0], statement: "Some sessions are Ineffective for All patients", correct: true },
            { obs: [0, 1, 3, 1, 0], statement: "Most sessions are Effective for Most patients", correct: false },
            { obs: [1, 3, 1, 0, 0], statement: "No sessions are Effective for Most patients", correct: false }
        ]);
        experimentState.comp3_index = 0;
    }
};

const comp3_trial = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const item = experimentState.comp3_items[experimentState.comp3_index];
        const imgPath = Stimuli.getImagePath(item.obs);
        return `<div class="comprehension-container">
            <p class="progress-indicator">Question ${experimentState.comp3_index + 1} of 4</p>
            <h3>Is this statement TRUE or FALSE?</h3>
            <div class="stimulus-container">
                <img src="${imgPath}" class="stimulus-image" style="max-width: 280px;">
            </div>
            <div class="definition-box" style="text-align: center; font-size: 1.3em;">"${item.statement}"</div>
            <div style="margin-top: 30px;">
                <button class="jspsych-btn tf-btn" id="btn-true" style="min-width: 150px; padding: 15px 40px; margin: 10px; background: #4CAF50; color: white;">TRUE</button>
                <button class="jspsych-btn tf-btn" id="btn-false" style="min-width: 150px; padding: 15px 40px; margin: 10px; background: #f44336; color: white;">FALSE</button>
            </div>
        </div>`;
    },
    choices: [],
    data: { task: 'comp3' },
    on_load: function() {
        const item = experimentState.comp3_items[experimentState.comp3_index];
        
        document.getElementById('btn-true').addEventListener('click', () => {
            const correct = (item.correct === true);
            if (correct) experimentState.comp3_index++;
            jsPsych.finishTrial({
                task: 'comp3',
                item: item,
                response: true,
                comp3_correct: correct
            });
        });
        
        document.getElementById('btn-false').addEventListener('click', () => {
            const correct = (item.correct === false);
            if (correct) experimentState.comp3_index++;
            jsPsych.finishTrial({
                task: 'comp3',
                item: item,
                response: false,
                comp3_correct: correct
            });
        });
    }
};

const comp3_feedback = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const item = experimentState.comp3_items[experimentState.comp3_index];
        return `<div class="comprehension-container">
            <h2 style="color: #f44336;">Incorrect</h2>
            <p>The correct answer was: <strong>${item.correct ? 'TRUE' : 'FALSE'}</strong></p>
        </div>`;
    },
    choices: ['Review Instructions']
};

const comp3_review = {
    type: jsPsychInstructions,
    pages: [instructionPages[1], instructionPages[2]],
    show_clickable_nav: true,
    button_label_previous: 'Back',
    button_label_next: 'Try Again',
    allow_backward: true
};

const comp3_procedure = {
    timeline: [
        comp3_trial,
        {
            timeline: [comp3_feedback, comp3_review],
            conditional_function: function() {
                const data = jsPsych.data.get().filter({task: 'comp3'}).last(1).values()[0];
                return !data.comp3_correct;
            }
        }
    ],
    loop_function: function() {
        return experimentState.comp3_index < 4;
    }
};

// --- Module 4: Match Description ---

const comp4_welcome = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="comprehension-container">
        <h2>Comprehension Check 4: Matching Descriptions</h2>
        <p>Select which trial result makes the description TRUE.</p>
    </div>`,
    choices: ['Begin'],
    on_finish: function() {
        experimentState.comp4_items = shuffleArray([
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
        ]);
        experimentState.comp4_index = 0;
    }
};

const comp4_trial = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const item = experimentState.comp4_items[experimentState.comp4_index];
        const shuffled = shuffleArray(item.options.map((o, i) => ({...o, origIdx: i})));
        experimentState.comp4_options = shuffled;
        
        let html = `<div class="comprehension-container">
            <p class="progress-indicator">Question ${experimentState.comp4_index + 1} of 2</p>
            <h3>Which trial makes this statement TRUE?</h3>
            <div class="definition-box" style="text-align: center; font-size: 1.2em;">"${item.statement}"</div>
            <p style="text-align: center; color: #666; margin-top: 20px;">Click on the correct trial result:</p>
            <div class="image-options">`;
        
        shuffled.forEach((opt, i) => {
            const imgPath = Stimuli.getImagePath(opt.obs);
            html += `<div class="image-option" data-idx="${i}" id="opt-${i}">
                <img src="${imgPath}" style="max-width: 150px;">
                <div class="image-option-label">Option ${String.fromCharCode(65 + i)}</div>
            </div>`;
        });
        
        html += `</div>
            <div style="margin-top: 20px;">
                <button id="comp4-submit" class="jspsych-btn" disabled>Submit Answer</button>
            </div>
        </div>`;
        return html;
    },
    choices: [],
    data: { task: 'comp4' },
    on_load: function() {
        let selectedIdx = -1;
        const options = document.querySelectorAll('.image-option');
        const submitBtn = document.getElementById('comp4-submit');
        
        options.forEach((opt, i) => {
            opt.addEventListener('click', () => {
                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                selectedIdx = i;
                submitBtn.disabled = false;
            });
        });
        
        submitBtn.addEventListener('click', () => {
            const selected = experimentState.comp4_options[selectedIdx];
            const correct = selected.correct;
            if (correct) experimentState.comp4_index++;
            jsPsych.finishTrial({
                task: 'comp4',
                selected_obs: selected.obs,
                comp4_correct: correct
            });
        });
    }
};

const comp4_feedback = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="comprehension-container">
        <h2 style="color: #f44336;">Incorrect</h2>
        <p>That trial doesn't match the description.</p>
    </div>`,
    choices: ['Review Instructions']
};

const comp4_review = {
    type: jsPsychInstructions,
    pages: [instructionPages[1], instructionPages[2]],
    show_clickable_nav: true,
    button_label_previous: 'Back',
    button_label_next: 'Try Again',
    allow_backward: true
};

const comp4_procedure = {
    timeline: [
        comp4_trial,
        {
            timeline: [comp4_feedback, comp4_review],
            conditional_function: function() {
                const data = jsPsych.data.get().filter({task: 'comp4'}).last(1).values()[0];
                return !data.comp4_correct;
            }
        }
    ],
    loop_function: function() {
        return experimentState.comp4_index < 2;
    }
};

// ============================================================================
// 5. MAIN SPEAKER TASK
// ============================================================================

const speakerIntro = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="scenario-container">
        <h2>Main Study: The Speaker Task</h2>
        <p>You will describe clinical trial results to <strong>three different listeners</strong>, 
        each with a different communication goal.</p>
        <p>For each listener: 15 trial descriptions.</p>
        <p><strong>Remember:</strong> Only TRUE statements can be sent!</p>
    </div>`,
    choices: ['Begin Speaker Task'],
    on_finish: function() {
        experimentState.blockOrder = shuffleArray(['informative', 'pers_plus', 'pers_minus']);
    }
};

function createBlock(blockIdx) {
    const timeline = [];
    
    // Initialize
    timeline.push({
        type: jsPsychCallFunction,
        func: function() {
            const key = experimentState.blockOrder[blockIdx];
            experimentState.currentScenario = key;
            const seqs = CONFIG.trial_sequences[key];
            experimentState.currentSeqIdx = Math.floor(Math.random() * seqs.length);
            experimentState.currentSequence = seqs[experimentState.currentSeqIdx];
        }
    });
    
    // Pairing wait
    timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `<div class="waiting-container">
            <h2>Finding a listener...</h2>
            <div class="spinner"></div>
        </div>`,
        choices: "NO_KEYS",
        trial_duration: () => randomInt(CONFIG.pairing_wait_min, CONFIG.pairing_wait_max)
    });
    
    // Scenario intro
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            const s = CONFIG.scenarios[experimentState.currentScenario];
            return `<div class="scenario-container">
                <h2>Listener Matched!</h2>
                <div class="role-badge" style="background:${s.color};">${s.role}</div>
                <div class="scenario-description">${s.description}</div>
                <p>You will describe <strong>15 trial results</strong>.</p>
            </div>`;
        },
        choices: ['Start Communication']
    });
    
    // 15 trials
    for (let r = 0; r < 15; r++) {
        timeline.push({
            type: jsPsychHtmlButtonResponse,
            stimulus: function() {
                const obs = experimentState.currentSequence[r];
                const s = CONFIG.scenarios[experimentState.currentScenario];
                const imgPath = Stimuli.getImagePath(obs);
                
                // Goal reminder based on scenario
                let goalReminder = '';
                if (experimentState.currentScenario === 'informative') {
                    goalReminder = '<p class="goal-reminder" style="background: #e3f2fd; border-left: 4px solid #2196F3;"><strong>Goal:</strong> Be as <em>informative</em> and accurate as possible.</p>';
                } else if (experimentState.currentScenario === 'pers_plus') {
                    goalReminder = '<p class="goal-reminder" style="background: #e8f5e9; border-left: 4px solid #4CAF50;"><strong>Goal:</strong> Make the treatment seem as <em>effective</em> as possible (while being truthful).</p>';
                } else if (experimentState.currentScenario === 'pers_minus') {
                    goalReminder = '<p class="goal-reminder" style="background: #ffebee; border-left: 4px solid #f44336;"><strong>Goal:</strong> Make the treatment seem as <em>ineffective</em> as possible (while being truthful).</p>';
                }
                
                return `<div class="trial-container">
                    <div class="trial-header">
                        <span class="round-indicator" style="background:${s.color};">Round ${r+1} of 15 | ${s.role}</span>
                    </div>
                    <div class="stimulus-section">
                        <img src="${imgPath}" class="stimulus-image" style="max-width: 320px;">
                    </div>
                    <div class="response-section">
                        <p class="instruction-text">Describe these results to your listener:</p>
                        ${goalReminder}
                        <div class="utterance-builder" style="white-space: nowrap;">
                            <select id="sel-q1" class="utterance-select">
                                <option value="">Select…</option>
                                <option value="No">No</option>
                                <option value="Some">Some</option>
                                <option value="Most">Most</option>
                                <option value="All">All</option>
                            </select>
                            <span class="utterance-text"> sessions are </span>
                            <select id="sel-pred" class="utterance-select">
                                <option value="">Select…</option>
                                <option value="Effective">Effective</option>
                                <option value="Ineffective">Ineffective</option>
                            </select>
                            <span class="utterance-text"> for </span>
                            <select id="sel-q2" class="utterance-select">
                                <option value="">Select…</option>
                                <option value="No">No</option>
                                <option value="Some">Some</option>
                                <option value="Most">Most</option>
                                <option value="All">All</option>
                            </select>
                            <span class="utterance-text"> patients.</span>
                        </div>
                        <div id="val-msg" class="validation-message"></div>
                        <button id="send-btn" class="jspsych-btn submit-btn">Send Description</button>
                    </div>
                </div>`;
            },
            choices: [],
            data: { task: 'speaker', block: blockIdx, round: r + 1 },
            on_load: function() {
                const obs = experimentState.currentSequence[r];
                const q1 = document.getElementById('sel-q1');
                const pred = document.getElementById('sel-pred');
                const q2 = document.getElementById('sel-q2');
                const msg = document.getElementById('val-msg');
                const btn = document.getElementById('send-btn');
                
                // Track false attempts (only when submit is clicked with false statement)
                let falseAttemptCount = 0;
                const falseAttempts = [];
                
                btn.addEventListener('click', () => {
                    // Check if all fields are filled
                    if (!q1.value || !pred.value || !q2.value) {
                        msg.textContent = 'Please complete all selections before submitting.';
                        msg.className = 'validation-message error';
                        return;
                    }
                    
                    const utterance = `${q1.value} sessions are ${pred.value} for ${q2.value} patients.`;
                    const isTrue = TruthChecker.isValidUtterance(obs, q1.value, pred.value, q2.value);
                    
                    if (isTrue) {
                        // Success - submit the trial
                        jsPsych.finishTrial({
                            task: 'speaker',
                            scenario: experimentState.currentScenario,
                            seq_idx: experimentState.currentSeqIdx,
                            round: r + 1,
                            observation: obs,
                            q1: q1.value,
                            predicate: pred.value,
                            q2: q2.value,
                            utterance: utterance,
                            false_attempt_count: falseAttemptCount,
                            false_attempts: falseAttempts
                        });
                    } else {
                        // False attempt - record and show error
                        falseAttemptCount++;
                        falseAttempts.push({
                            q1: q1.value,
                            predicate: pred.value,
                            q2: q2.value,
                            utterance: utterance,
                            timestamp: Date.now()
                        });
                        msg.textContent = '✗ This statement is FALSE. Please choose a true description and try again.';
                        msg.className = 'validation-message error';
                    }
                });
            }
        });
        
        // Listener wait (except last)
        if (r < 14) {
            timeline.push({
                type: jsPsychHtmlKeyboardResponse,
                stimulus: `<div class="waiting-container"><h2>Listener reading...</h2><div class="spinner"></div></div>`,
                choices: "NO_KEYS",
                trial_duration: () => randomInt(CONFIG.listener_response_min, CONFIG.listener_response_max)
            });
        }
    }
    
    // Block done
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            const last = (blockIdx === 2);
            return `<div class="completion-container">
                <h2>Communication Complete!</h2>
                <p>${last ? "All scenarios finished!" : "Click to find next listener."}</p>
            </div>`;
        },
        choices: function() { return [blockIdx === 2 ? 'Continue to Feedback' : 'Find Next Listener']; }
    });
    
    return { timeline };
}

// ============================================================================
// 6. FEEDBACK & DEBRIEF
// ============================================================================

const feedback = {
    type: jsPsychSurveyText,
    preamble: '<h2>Feedback (Optional)</h2>',
    questions: [{ prompt: 'Any comments or feedback?', name: 'feedback', rows: 5, required: false }],
    button_label: 'Continue'
};

const debrief = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="debrief-container">
        <h2>Thank You!</h2>
        <h3>Debriefing</h3>
        <p>The "listeners" were simulated—no real-time matching occurred.</p>
        <p>Your responses are valuable for our research. Thank you!</p>
    </div>`,
    choices: ['Complete Study']
};

// ============================================================================
// BUILD AND RUN
// ============================================================================

const timeline = [];

timeline.push({
    type: jsPsychPreload,
    images: Stimuli.getAllImagePaths(),
    show_progress_bar: true,
    message: '<p>Loading images...</p>'
});

timeline.push(welcome);
timeline.push(consent);
timeline.push(instructions);
timeline.push(comp1_procedure);
timeline.push(comp2_procedure);
timeline.push(comp3_welcome);
timeline.push(comp3_procedure);
timeline.push(comp4_welcome);
timeline.push(comp4_procedure);
timeline.push(speakerIntro);
timeline.push(createBlock(0));
timeline.push(createBlock(1));
timeline.push(createBlock(2));
timeline.push(feedback);
timeline.push(debrief);

jsPsych.run(timeline);
