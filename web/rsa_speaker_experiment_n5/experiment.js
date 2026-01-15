/**
 * experiment.js - Main experiment logic for N=5 patients, M=1 session
 */

// Initialize jsPsych
const jsPsych = initJsPsych({
    show_progress_bar: true,
    auto_update_progress_bar: false,
    on_finish: function() {
        const data = jsPsych.data.get().json();
        console.log('Experiment complete. Data:', data);
        // In production, you would send this to your server
    }
});

// Experiment state
const experimentState = {
    comp2_index: 0,
    comp2_items: [],
    currentScenario: null,
    currentSequence: [],
    currentSeqIdx: 0,
    blockOrder: [],
    blockNum: 0
};

// ============================================================================
// INSTRUCTION PAGES
// ============================================================================

const instructionPages = [
    // Page 1: Cover story and data representation
    `<div class="instructions-container">
        <h2>Understanding Clinical Trial Data</h2>
        <h3>The Scenario</h3>
        <p>In this study, you will see results from clinical trials testing a new medical treatment. Each trial involves:</p>
        <ul>
            <li><strong>5 patients</strong> who receive the treatment</li>
            <li>Each patient undergoes <strong>1 treatment session</strong></li>
            <li>The treatment session can be either <strong>Effective</strong> (😃) or <strong>Ineffective</strong> (🤒) for each patient</li>
        </ul>
        <h3>Reading the Display</h3>
        <p>Trial results are shown as a row of 5 emoji faces:</p>
        <ul>
            <li>😃 means the treatment was <strong>effective</strong> for that patient</li>
            <li>🤒 means the treatment was <strong>ineffective</strong> for that patient</li>
        </ul>
        <div class="example-box">
            <p><strong>Example:</strong></p>
            <div style="text-align: center;">
                <img src="stimuli_emoji_n5m1/effective_2.png" alt="Example trial" class="stimulus-image" style="max-width: 400px;">
            </div>
            <p style="margin-top: 15px;">In this example:</p>
            <ul>
                <li>2 patients had <strong>effective</strong> treatment (😃😃)</li>
                <li>3 patients had <strong>ineffective</strong> treatment (🤒🤒🤒)</li>
            </ul>
        </div>
    </div>`,
    
    // Page 2: Description structure
    `<div class="instructions-container">
        <h2>Describing Trial Results</h2>
        <h3>The Description Format</h3>
        <p>You will describe trial results using sentences with this structure:</p>
        <div class="definition-box" style="text-align: center; font-size: 1.2em;">
            <strong>"The treatment was [Effective/Ineffective] for [Quantifier] patients."</strong>
        </div>
        <h3>The Quantifiers</h3>
        <div class="definition-box"><strong>No</strong> — Zero patients (0 out of 5)</div>
        <div class="definition-box"><strong>Some</strong> — At least one patient (1 or more, could include all 5)</div>
        <div class="definition-box"><strong>Most</strong> — More than half of the patients (3, 4, or 5 out of 5)</div>
        <div class="definition-box"><strong>All</strong> — Every patient (5 out of 5)</div>
        <h3>Example Descriptions</h3>
        <ul>
            <li>"The treatment was <em>Effective</em> for <em>Some</em> patients."</li>
            <li>"The treatment was <em>Ineffective</em> for <em>Most</em> patients."</li>
        </ul>
    </div>`,
    
    // Page 3: Truth conditions
    `<div class="instructions-container">
        <h2>True vs. False Descriptions</h2>
        <h3>Important Rules</h3>
        <div class="definition-box">
            <strong>"Some"</strong> means <em>at least one</em> — it could even mean all!<br>
            So "The treatment was Effective for Some patients" is true if 1, 2, 3, 4, or all 5 patients had effective treatment.
        </div>
        <div class="definition-box">
            <strong>"Most"</strong> means <em>strictly more than half</em> — it could include all!<br>
            For 5 patients: "Most patients" means 3, 4, or 5 patients (more than 2.5).
        </div>
        <h3>Worked Example</h3>
        <div class="example-box">
            <div style="text-align: center;">
                <img src="stimuli_emoji_n5m1/effective_3.png" alt="Example" class="stimulus-image" style="max-width: 400px;">
            </div>
            <p>For this trial (3 patients effective, 2 patients ineffective):</p>
        </div>
        <div class="example-box correct">
            <p><strong>✓ TRUE:</strong> "The treatment was Effective for Some patients."</p>
            <p><em>Why?</em> 3 patients had effective treatment. "Some" means ≥1, so this is satisfied.</p>
        </div>
        <div class="example-box correct">
            <p><strong>✓ TRUE:</strong> "The treatment was Effective for Most patients."</p>
            <p><em>Why?</em> 3 patients had effective treatment. 3 > 2.5 (half of 5), so "Most" is satisfied.</p>
        </div>
        <div class="example-box incorrect">
            <p><strong>✗ FALSE:</strong> "The treatment was Effective for All patients."</p>
            <p><em>Why?</em> Only 3 patients had effective treatment, not all 5.</p>
        </div>
        <div class="example-box incorrect">
            <p><strong>✗ FALSE:</strong> "The treatment was Ineffective for Most patients."</p>
            <p><em>Why?</em> Only 2 patients had ineffective treatment. 2 is not more than half of 5.</p>
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
            <p>This study takes approximately <strong>15-20 minutes</strong> to complete.</p>
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
            <p><strong>Duration:</strong> Approximately 15-20 minutes</p>
            <p><strong>Confidentiality:</strong> Your responses will be kept confidential and anonymous.</p>
            <p><strong>Compensation:</strong> You will receive the agreed compensation for completing this study, plus any bonus associated with listener performance.</p>
            <p style="margin-top: 30px; font-weight: bold;">
                By clicking "I Consent" below, you agree to participate in this study.
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

// --- Module 1: Quantifier Definitions ---

const comp1_some = {
    type: jsPsychSurveyMultiChoice,
    preamble: '<div class="comprehension-container"><h2>Comprehension Check: Quantifier Meanings</h2></div>',
    questions: [{
        prompt: '<strong>What does "Some" mean in our descriptions?</strong>',
        name: 'some_def',
        options: CONFIG.comprehension.module1.some.options,
        required: true
    }],
    data: { task: 'comp1_some' },
    on_finish: function(data) {
        const selectedIndex = CONFIG.comprehension.module1.some.options.indexOf(data.response.some_def);
        data.comp1_some_correct = (selectedIndex === CONFIG.comprehension.module1.some.correct);
    }
};

const comp1_most = {
    type: jsPsychSurveyMultiChoice,
    preamble: '<div class="comprehension-container"><h2>Comprehension Check (continued)</h2></div>',
    questions: [{
        prompt: '<strong>What does "Most" mean in our descriptions?</strong>',
        name: 'most_def',
        options: CONFIG.comprehension.module1.most.options,
        required: true
    }],
    data: { task: 'comp1_most' },
    on_finish: function(data) {
        const selectedIndex = CONFIG.comprehension.module1.most.options.indexOf(data.response.most_def);
        data.comp1_most_correct = (selectedIndex === CONFIG.comprehension.module1.most.correct);
    }
};

const comp1_feedback = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="comprehension-container">
        <h2 style="color: #f44336;">Let's Review</h2>
        <p>Let's go over the quantifier definitions again:</p>
        <p><strong>"Some"</strong> = at least one (and could be all)</p>
        <p><strong>"Most"</strong> = more than half (and could be all)</p>
    </div>`,
    choices: ['Review Instructions']
};

const comp1_review = {
    type: jsPsychInstructions,
    pages: [instructionPages[1], instructionPages[2]],
    show_clickable_nav: true,
    button_label_previous: 'Back',
    button_label_next: 'Try Again',
    allow_backward: true
};

const comp1_procedure = {
    timeline: [
        comp1_some,
        comp1_most,
        {
            timeline: [comp1_feedback, comp1_review],
            conditional_function: function() {
                const s = jsPsych.data.get().filter({task: 'comp1_some'}).last(1).values()[0];
                const m = jsPsych.data.get().filter({task: 'comp1_most'}).last(1).values()[0];
                return !(s.comp1_some_correct && m.comp1_most_correct);
            }
        }
    ],
    loop_function: function() {
        const s = jsPsych.data.get().filter({task: 'comp1_some'}).last(1).values()[0];
        const m = jsPsych.data.get().filter({task: 'comp1_most'}).last(1).values()[0];
        return !(s.comp1_some_correct && m.comp1_most_correct);
    }
};

// --- Module 2: True/False Judgments ---

const comp2_welcome = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="comprehension-container">
        <h2>Comprehension Check: Truth Judgments</h2>
        <p>For each trial result shown, decide if the statement is <strong>TRUE</strong> or <strong>FALSE</strong>.</p>
    </div>`,
    choices: ['Begin'],
    on_finish: function() {
        experimentState.comp2_items = shuffleArray([...CONFIG.comprehension.module2]);
        experimentState.comp2_index = 0;
    }
};

const comp2_trial = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const item = experimentState.comp2_items[experimentState.comp2_index];
        const imgPath = Stimuli.getImagePath(item.numEffective);
        return `<div class="comprehension-container">
            <p class="progress-indicator">Question ${experimentState.comp2_index + 1} of ${CONFIG.comprehension.module2.length}</p>
            <h3>Is this statement TRUE or FALSE?</h3>
            <div class="stimulus-container">
                <img src="${imgPath}" class="stimulus-image" style="max-width: 400px;">
            </div>
            <div class="definition-box" style="text-align: center; font-size: 1.2em;">"${item.statement}"</div>
            <div style="margin-top: 30px;">
                <button class="jspsych-btn tf-btn true-btn" id="btn-true">TRUE</button>
                <button class="jspsych-btn tf-btn false-btn" id="btn-false">FALSE</button>
            </div>
        </div>`;
    },
    choices: [],
    data: { task: 'comp2' },
    on_load: function() {
        const item = experimentState.comp2_items[experimentState.comp2_index];
        
        document.getElementById('btn-true').addEventListener('click', () => {
            const correct = (item.correct === true);
            if (correct) experimentState.comp2_index++;
            jsPsych.finishTrial({
                task: 'comp2',
                item: item,
                response: true,
                comp2_correct: correct
            });
        });
        
        document.getElementById('btn-false').addEventListener('click', () => {
            const correct = (item.correct === false);
            if (correct) experimentState.comp2_index++;
            jsPsych.finishTrial({
                task: 'comp2',
                item: item,
                response: false,
                comp2_correct: correct
            });
        });
    }
};

const comp2_feedback = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const item = experimentState.comp2_items[experimentState.comp2_index];
        return `<div class="comprehension-container">
            <h2 style="color: #f44336;">Incorrect</h2>
            <p>The correct answer was: <strong>${item.correct ? 'TRUE' : 'FALSE'}</strong></p>
            <p>Let's review the instructions on how to evaluate statements.</p>
        </div>`;
    },
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
        comp2_trial,
        {
            timeline: [comp2_feedback, comp2_review],
            conditional_function: function() {
                const data = jsPsych.data.get().filter({task: 'comp2'}).last(1).values()[0];
                return !data.comp2_correct;
            }
        }
    ],
    loop_function: function() {
        return experimentState.comp2_index < CONFIG.comprehension.module2.length;
    }
};

// --- Module 3: Multiple Choice ---

const comp3_trial = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const item = CONFIG.comprehension.module3;
        const shuffledOptions = shuffleArray(item.options.map((opt, idx) => ({...opt, origIdx: idx})));
        experimentState.comp3_options = shuffledOptions;
        
        let html = `<div class="comprehension-container">
            <h2>Comprehension Check: Matching Descriptions</h2>
            <h3>Which trial result(s) make this statement TRUE?</h3>
            <div class="definition-box" style="text-align: center; font-size: 1.2em;">"${item.statement}"</div>
            <p style="text-align: center; color: #666; margin-top: 20px;">Select ALL trial results that make the statement true:</p>
            <div class="checkbox-options">`;
        
        shuffledOptions.forEach((opt, i) => {
            const imgPath = Stimuli.getImagePath(opt.numEffective);
            html += `<div class="checkbox-option" data-idx="${i}" id="opt-${i}">
                <div class="checkbox-marker"></div>
                <img src="${imgPath}" style="max-width: 180px;">
                <div class="image-option-label">Option ${String.fromCharCode(65 + i)}</div>
            </div>`;
        });
        
        html += `</div>
            <div style="margin-top: 20px;">
                <button id="comp3-submit" class="jspsych-btn">Submit Answer</button>
            </div>
        </div>`;
        return html;
    },
    choices: [],
    data: { task: 'comp3' },
    on_load: function() {
        const selectedIndices = new Set();
        const options = document.querySelectorAll('.checkbox-option');
        const submitBtn = document.getElementById('comp3-submit');
        
        options.forEach((opt, i) => {
            opt.addEventListener('click', () => {
                if (selectedIndices.has(i)) {
                    selectedIndices.delete(i);
                    opt.classList.remove('selected');
                } else {
                    selectedIndices.add(i);
                    opt.classList.add('selected');
                }
            });
        });
        
        submitBtn.addEventListener('click', () => {
            // Check if the selection matches correct answers
            const selectedOptions = experimentState.comp3_options.filter((_, i) => selectedIndices.has(i));
            const correctOptions = experimentState.comp3_options.filter(opt => opt.correct);
            
            // Check if all correct options are selected and no incorrect ones
            const allCorrectSelected = correctOptions.every(opt => 
                selectedIndices.has(experimentState.comp3_options.indexOf(opt))
            );
            const noIncorrectSelected = selectedOptions.every(opt => opt.correct);
            const isCorrect = allCorrectSelected && noIncorrectSelected && selectedIndices.size > 0;
            
            jsPsych.finishTrial({
                task: 'comp3',
                selected: Array.from(selectedIndices).map(i => experimentState.comp3_options[i].numEffective),
                comp3_correct: isCorrect
            });
        });
    }
};

const comp3_feedback = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const item = CONFIG.comprehension.module3;
        const correctOpts = item.options.filter(o => o.correct).map(o => `effective_${o.numEffective}`);
        return `<div class="comprehension-container">
            <h2 style="color: #f44336;">Incorrect</h2>
            <p>The correct answer(s) were: <strong>${correctOpts.join(' and ')}</strong></p>
            <p>Remember: "${item.statement}" is true when more than half (3, 4, or 5) of the patients had <em>ineffective</em> treatment.</p>
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
        const data = jsPsych.data.get().filter({task: 'comp3'}).last(1).values()[0];
        return !data.comp3_correct;
    }
};

// ============================================================================
// 5. MAIN SPEAKER TASK
// ============================================================================

const speakerIntro = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="scenario-container">
        <h2>Main Study: The Speaker Task</h2>
        <p>Now you will describe clinical trial results to <strong>three different listeners</strong>.</p>
        <p>Each listener is curious about the treatment's effectiveness, but you will have a <strong>different communication goal</strong> for each one.</p>
        <p>For each listener, you will describe <strong>10 trial results</strong>.</p>
        <p><strong>Important:</strong> You can only send descriptions that are <strong>TRUE</strong>!</p>
    </div>`,
    choices: ['Begin Speaker Task'],
    on_finish: function() {
        experimentState.blockOrder = shuffleArray(['informative', 'pers_plus', 'pers_minus']);
        experimentState.blockNum = 0;
    }
};

function createBlock(blockIdx) {
    const timeline = [];
    
    // Initialize block
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
    
    // Pairing wait screen
    timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `<div class="waiting-container">
            <h2>Finding a listener...</h2>
            <div class="spinner"></div>
            <p>Please wait while we pair you with another participant.</p>
        </div>`,
        choices: "NO_KEYS",
        trial_duration: () => randomInt(CONFIG.pairing_wait_min, CONFIG.pairing_wait_max)
    });
    
    // Scenario introduction
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            const s = CONFIG.scenarios[experimentState.currentScenario];
            return `<div class="scenario-container">
                <h2>Listener Matched!</h2>
                <div class="role-badge" style="background:${s.color};">${s.role}</div>
                <div class="scenario-description">${s.description}</div>
                <p>You will describe <strong>10 trial results</strong> to this listener.</p>
                <p><strong>Remember:</strong> Only TRUE statements can be sent!</p>
            </div>`;
        },
        choices: ['Start Communication']
    });
    
    // 10 trials
    for (let r = 0; r < CONFIG.n_rounds; r++) {
        timeline.push({
            type: jsPsychHtmlButtonResponse,
            stimulus: function() {
                const numEffective = experimentState.currentSequence[r];
                const s = CONFIG.scenarios[experimentState.currentScenario];
                const imgPath = Stimuli.getImagePath(numEffective);
                
                return `<div class="trial-container">
                    <div class="trial-header">
                        <span class="round-indicator" style="background:${s.color};">Round ${r+1} of ${CONFIG.n_rounds} | ${s.role}</span>
                    </div>
                    <div class="stimulus-section">
                        <img src="${imgPath}" class="stimulus-image" style="max-width: 400px;">
                    </div>
                    <div class="response-section">
                        <p class="instruction-text">Describe these results to your listener:</p>
                        <p class="goal-reminder" style="background: ${s.color}15; border-left: 4px solid ${s.color};">
                            <strong>Goal:</strong> ${s.goalReminder}
                        </p>
                        <div class="utterance-builder">
                            <span class="utterance-text">The treatment was</span>
                            <select id="sel-pred" class="utterance-select">
                                <option value="">Select…</option>
                                <option value="Effective">Effective</option>
                                <option value="Ineffective">Ineffective</option>
                            </select>
                            <span class="utterance-text">for</span>
                            <select id="sel-quant" class="utterance-select">
                                <option value="">Select…</option>
                                <option value="No">No</option>
                                <option value="Some">Some</option>
                                <option value="Most">Most</option>
                                <option value="All">All</option>
                            </select>
                            <span class="utterance-text">patients.</span>
                        </div>
                        <div id="val-msg" class="validation-message"></div>
                        <button id="send-btn" class="jspsych-btn submit-btn">Send Description</button>
                    </div>
                </div>`;
            },
            choices: [],
            data: { task: 'speaker', block: blockIdx, round: r + 1 },
            on_load: function() {
                const numEffective = experimentState.currentSequence[r];
                const pred = document.getElementById('sel-pred');
                const quant = document.getElementById('sel-quant');
                const msg = document.getElementById('val-msg');
                const btn = document.getElementById('send-btn');
                
                let falseAttemptCount = 0;
                const falseAttempts = [];
                
                btn.addEventListener('click', () => {
                    if (!pred.value || !quant.value) {
                        msg.textContent = 'Please complete all selections before submitting.';
                        msg.className = 'validation-message error';
                        return;
                    }
                    
                    const utterance = `The treatment was ${pred.value} for ${quant.value} patients.`;
                    const isTrue = TruthChecker.isValidUtterance(numEffective, pred.value, quant.value);
                    
                    if (isTrue) {
                        jsPsych.finishTrial({
                            task: 'speaker',
                            scenario: experimentState.currentScenario,
                            seq_idx: experimentState.currentSeqIdx,
                            round: r + 1,
                            num_effective: numEffective,
                            predicate: pred.value,
                            quantifier: quant.value,
                            utterance: utterance,
                            false_attempt_count: falseAttemptCount,
                            false_attempts: falseAttempts
                        });
                    } else {
                        falseAttemptCount++;
                        falseAttempts.push({
                            predicate: pred.value,
                            quantifier: quant.value,
                            utterance: utterance,
                            timestamp: Date.now()
                        });
                        msg.textContent = '✗ This statement is FALSE. Please choose a true description and try again.';
                        msg.className = 'validation-message error';
                    }
                });
            }
        });
        
        // Listener wait (except after last round)
        if (r < CONFIG.n_rounds - 1) {
            timeline.push({
                type: jsPsychHtmlKeyboardResponse,
                stimulus: `<div class="waiting-container">
                    <h2>Listener reading your description...</h2>
                    <div class="spinner"></div>
                </div>`,
                choices: "NO_KEYS",
                trial_duration: () => randomInt(CONFIG.listener_response_min, CONFIG.listener_response_max)
            });
        }
    }
    
    // Block completion
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            const isLast = (blockIdx === 2);
            const s = CONFIG.scenarios[experimentState.currentScenario];
            return `<div class="completion-container">
                <h2>Communication Complete!</h2>
                <p>You have finished describing all 10 trials to this listener as a <strong>${s.role}</strong>.</p>
                ${isLast ? 
                    '<p>You have completed all three communication scenarios!</p>' : 
                    '<p>Click below to be paired with a <strong>new listener</strong> for a <strong>different role</strong>.</p>'
                }
            </div>`;
        },
        choices: function() { 
            return [blockIdx === 2 ? 'Continue to Feedback' : 'Find Next Listener']; 
        }
    });
    
    return { timeline };
}

// ============================================================================
// 6. FEEDBACK & DEBRIEF
// ============================================================================

const feedback = {
    type: jsPsychSurveyText,
    preamble: `<div class="feedback-container">
        <h2>Feedback (Optional)</h2>
        <p>We would appreciate any feedback you have about this experiment.</p>
    </div>`,
    questions: [{ 
        prompt: 'Was anything confusing? Do you have any comments or concerns?', 
        name: 'feedback', 
        rows: 5, 
        required: false 
    }],
    button_label: 'Continue'
};

const debrief = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="debrief-container">
        <h2>Thank You!</h2>
        <h3>Debriefing</h3>
        <p>Thank you for participating in this study!</p>
        <p>We want to let you know that the "listeners" in this study were <strong>simulated</strong> — 
        there was no real-time matching with other participants.</p>
        <p>However, your responses are still extremely valuable for our research on how people 
        communicate information under different goals.</p>
        <p><strong>You will receive the full compensation and bonus as described.</strong></p>
        <p style="margin-top: 30px;">If you have any questions about this research, please contact the research team.</p>
    </div>`,
    choices: ['Complete Study']
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
    message: '<p>Loading experiment images...</p>'
});

// Main experiment flow
timeline.push(welcome);
timeline.push(consent);
timeline.push(instructions);

// Comprehension checks
timeline.push(comp1_procedure);
timeline.push(comp2_welcome);
timeline.push(comp2_procedure);
timeline.push(comp3_procedure);

// Speaker task
timeline.push(speakerIntro);
timeline.push(createBlock(0));
timeline.push(createBlock(1));
timeline.push(createBlock(2));

// Feedback and debrief
timeline.push(feedback);
timeline.push(debrief);

// Run the experiment
jsPsych.run(timeline);
