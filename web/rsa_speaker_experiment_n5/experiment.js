/**
 * experiment.js - Main experiment logic for N=5 patients, M=1 session
 * Updated version with all requested changes
 */

// ============================================================================
// SUBJECT ID AND PROLIFIC INTEGRATION
// ============================================================================

// Get URL parameters (for Prolific integration)
const urlParams = new URLSearchParams(window.location.search);
const prolificPID = urlParams.get('PROLIFIC_PID') || null;
const studyID = urlParams.get('STUDY_ID') || null;
const sessionID = urlParams.get('SESSION_ID') || null;

// Generate subject ID: use Prolific ID if available, otherwise generate random
function generateSubjectId() {
    if (prolificPID) {
        return prolificPID;
    }
    // Generate random ID for testing
    return 'test_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
}

const subjectId = generateSubjectId();

// Initialize jsPsych
const jsPsych = initJsPsych({
    show_progress_bar: true,
    auto_update_progress_bar: false,
    on_finish: function() {
        // Redirect to Prolific completion page if running on Prolific
        if (prolificPID) {
            // Replace with your actual Prolific completion URL
            window.location.href = "https://app.prolific.com/submissions/complete?cc=YOUR_COMPLETION_CODE";
        }
    }
});

// Add subject info to all trials
jsPsych.data.addProperties({
    subject_id: subjectId,
    prolific_pid: prolificPID,
    study_id: studyID,
    session_id: sessionID,
    experiment_version: '1.0.0',
    start_time: new Date().toISOString()
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
    roleCompOptions: []
};

// Calculate total trials for progress bar
// Added role comprehension checks (3 checks + 3 feedbacks)
const TOTAL_PROGRESS_STEPS = 65;

function updateProgress() {
    experimentState.completedTrials++;
    const progress = Math.min(experimentState.completedTrials / TOTAL_PROGRESS_STEPS, 1);
    jsPsych.setProgressBar(progress);
}

// ============================================================================
// INSTRUCTION PAGES
// ============================================================================

const instructionPages = [
    // Page 1: Cover story and data representation
    `<div class="instructions-container">
        <h2>Understanding Clinical Trial Data</h2>
        <h3>The Scenario</h3>
        <p>In this study, you will see results from clinical trials testing a new medical treatment.</p>
        <p>The treatment has some underlying probability of being effective, which we call its <strong>effectiveness</strong>. 
        Each trial involves <strong>5 patients who receive one treatment session</strong>.</p>
        <p>For each patient, the treatment session can be either:</p>
        <ul>
            <li><strong>Effective</strong> (😃) — the treatment worked for this patient</li>
            <li><strong>Ineffective</strong> (🤒) — the treatment did not work for this patient</li>
        </ul>
        <h3>Reading the Display</h3>
        <p>Trial results are shown as a row of 5 face icons, one for each patient:</p>
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
    
    // Page 3: Truth conditions (shortened reminders)
    `<div class="instructions-container">
        <h2>True vs. False Descriptions</h2>
        <h3>Important Rules</h3>
        <div class="definition-box">
            <strong>"Some"</strong> means <em>at least one</em> — it could even mean all!
        </div>
        <div class="definition-box">
            <strong>"Most"</strong> means <em>strictly more than half</em> — it could include all!
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
            <p class="subtitle">In this study, you will play roles with different goals that describe clinical trial results to audiences.</p>
            <p>This study takes approximately <strong>15-20 minutes</strong> to complete.</p>
            <p class="press-space">Press <strong>SPACE</strong> to continue</p>
        </div>
    `,
    choices: [' '],
    on_finish: updateProgress
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
    choices: ['I Consent'],
    button_html: '<button class="jspsych-btn" style="background: #4CAF50; color: white;">%choice%</button>',
    on_finish: updateProgress
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
    allow_backward: true,
    on_load: function() {
        // Change button text on last page
        const checkLastPage = setInterval(() => {
            const currentPage = document.querySelector('.jspsych-instructions-pagenum');
            if (currentPage && currentPage.textContent.includes('3/3')) {
                const nextBtn = document.querySelector('button[id="jspsych-instructions-next"]');
                if (nextBtn && nextBtn.textContent === 'Continue') {
                    nextBtn.textContent = 'I understood everything!';
                    clearInterval(checkLastPage);
                }
            }
        }, 100);
    },
    on_finish: updateProgress
};

// ============================================================================
// 4. COMPREHENSION TESTS
// ============================================================================

// --- Module 1: Quantifier Definitions (with immediate feedback, no retry) ---

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
        updateProgress();
    }
};

const comp1_some_feedback = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const data = jsPsych.data.get().filter({task: 'comp1_some'}).last(1).values()[0];
        if (data.comp1_some_correct) {
            return `<div class="comprehension-container">
                <h2 style="color: #4CAF50;">✓ Correct!</h2>
                <p>"Some" means <strong>at least one and could be all</strong>.</p>
            </div>`;
        } else {
            return `<div class="comprehension-container">
                <h2 style="color: #f44336;">✗ Incorrect</h2>
                <p>You answered: "${jsPsych.data.get().filter({task: 'comp1_some'}).last(1).values()[0].response.some_def}"</p>
                <p>But "Some" actually means: <strong>At least one and could be all.</strong></p>
                <p>For example, "The treatment was Effective for Some patients" is true if 1, 2, 3, 4, or even all 5 patients had effective treatment.</p>
            </div>`;
        }
    },
    choices: ['Continue'],
    on_finish: updateProgress
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
        updateProgress();
    }
};

const comp1_most_feedback = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const data = jsPsych.data.get().filter({task: 'comp1_most'}).last(1).values()[0];
        if (data.comp1_most_correct) {
            return `<div class="comprehension-container">
                <h2 style="color: #4CAF50;">✓ Correct!</h2>
                <p>"Most" means <strong>more than half and could be all</strong>.</p>
            </div>`;
        } else {
            return `<div class="comprehension-container">
                <h2 style="color: #f44336;">✗ Incorrect</h2>
                <p>You answered: "${jsPsych.data.get().filter({task: 'comp1_most'}).last(1).values()[0].response.most_def}"</p>
                <p>But "Most" actually means: <strong>More than half and could be all.</strong></p>
                <p>For 5 patients, "Most patients" means 3, 4, or 5 patients (more than 2.5).</p>
            </div>`;
        }
    },
    choices: ['Continue'],
    on_finish: updateProgress
};

// --- Module 2: True/False Judgments (with explanatory feedback, no retry) ---

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
        updateProgress();
    }
};

const comp2_trial_1 = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const item = experimentState.comp2_items[0];
        const imgPath = Stimuli.getImagePath(item.numEffective);
        return `<div class="comprehension-container">
            <p class="progress-indicator">Question 1 of ${CONFIG.comprehension.module2.length}</p>
            <h3>Is this statement TRUE or FALSE?</h3>
            <div class="stimulus-container">
                <img src="${imgPath}" class="stimulus-image" style="max-width: 400px;">
            </div>
            <p style="text-align: center; color: #666; font-size: 0.9em;">(${item.numEffective} effective, ${5 - item.numEffective} ineffective)</p>
            <div class="definition-box" style="text-align: center; font-size: 1.2em;">"${item.statement}"</div>
            <div style="margin-top: 30px; text-align: center;">
                <button class="jspsych-btn tf-btn true-btn" id="btn-true">TRUE</button>
                <button class="jspsych-btn tf-btn false-btn" id="btn-false">FALSE</button>
            </div>
        </div>`;
    },
    choices: [],
    data: { task: 'comp2', item_index: 0 },
    on_load: function() {
        const item = experimentState.comp2_items[0];
        
        document.getElementById('btn-true').addEventListener('click', () => {
            jsPsych.finishTrial({
                task: 'comp2',
                item_index: 0,
                item: item,
                response: true,
                comp2_correct: (item.correct === true)
            });
        });
        
        document.getElementById('btn-false').addEventListener('click', () => {
            jsPsych.finishTrial({
                task: 'comp2',
                item_index: 0,
                item: item,
                response: false,
                comp2_correct: (item.correct === false)
            });
        });
    },
    on_finish: updateProgress
};

const comp2_feedback_1 = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const data = jsPsych.data.get().filter({task: 'comp2', item_index: 0}).last(1).values()[0];
        const item = data.item;
        const numIneffective = 5 - item.numEffective;
        
        let explanation = '';
        if (item.statement.includes('Ineffective for Some')) {
            explanation = `"Some" means at least 1. There ${numIneffective === 1 ? 'is' : 'are'} ${numIneffective} ineffective patient${numIneffective === 1 ? '' : 's'}, so this is ${numIneffective >= 1 ? 'TRUE' : 'FALSE'}.`;
        } else if (item.statement.includes('Ineffective for All')) {
            explanation = `"All" means all 5 patients. There ${numIneffective === 1 ? 'is' : 'are'} only ${numIneffective} ineffective patient${numIneffective === 1 ? '' : 's'}, not all 5, so this is ${numIneffective === 5 ? 'TRUE' : 'FALSE'}.`;
        }
        
        if (data.comp2_correct) {
            return `<div class="comprehension-container">
                <h2 style="color: #4CAF50;">✓ Correct!</h2>
                <p>The statement "${item.statement}" is <strong>${item.correct ? 'TRUE' : 'FALSE'}</strong>.</p>
                <p>${explanation}</p>
            </div>`;
        } else {
            return `<div class="comprehension-container">
                <h2 style="color: #f44336;">✗ Incorrect</h2>
                <p>The statement "${item.statement}" is actually <strong>${item.correct ? 'TRUE' : 'FALSE'}</strong>.</p>
                <p>${explanation}</p>
                <div style="margin-top: 20px;">
                    <button class="jspsych-btn" id="review-btn" style="background: #ff9800; color: white;">Review Definitions (Optional)</button>
                </div>
            </div>`;
        }
    },
    choices: ['Continue'],
    on_load: function() {
        const reviewBtn = document.getElementById('review-btn');
        if (reviewBtn) {
            reviewBtn.addEventListener('click', () => {
                alert("Quick Review:\n\n• No = 0 patients\n• Some = at least 1 (could be all)\n• Most = more than half (3, 4, or 5)\n• All = all 5 patients");
            });
        }
    },
    on_finish: updateProgress
};

const comp2_trial_2 = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const item = experimentState.comp2_items[1];
        const imgPath = Stimuli.getImagePath(item.numEffective);
        return `<div class="comprehension-container">
            <p class="progress-indicator">Question 2 of ${CONFIG.comprehension.module2.length}</p>
            <h3>Is this statement TRUE or FALSE?</h3>
            <div class="stimulus-container">
                <img src="${imgPath}" class="stimulus-image" style="max-width: 400px;">
            </div>
            <p style="text-align: center; color: #666; font-size: 0.9em;">(${item.numEffective} effective, ${5 - item.numEffective} ineffective)</p>
            <div class="definition-box" style="text-align: center; font-size: 1.2em;">"${item.statement}"</div>
            <div style="margin-top: 30px; text-align: center;">
                <button class="jspsych-btn tf-btn true-btn" id="btn-true">TRUE</button>
                <button class="jspsych-btn tf-btn false-btn" id="btn-false">FALSE</button>
            </div>
        </div>`;
    },
    choices: [],
    data: { task: 'comp2', item_index: 1 },
    on_load: function() {
        const item = experimentState.comp2_items[1];
        
        document.getElementById('btn-true').addEventListener('click', () => {
            jsPsych.finishTrial({
                task: 'comp2',
                item_index: 1,
                item: item,
                response: true,
                comp2_correct: (item.correct === true)
            });
        });
        
        document.getElementById('btn-false').addEventListener('click', () => {
            jsPsych.finishTrial({
                task: 'comp2',
                item_index: 1,
                item: item,
                response: false,
                comp2_correct: (item.correct === false)
            });
        });
    },
    on_finish: updateProgress
};

const comp2_feedback_2 = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const data = jsPsych.data.get().filter({task: 'comp2', item_index: 1}).last(1).values()[0];
        const item = data.item;
        const numIneffective = 5 - item.numEffective;
        
        let explanation = '';
        if (item.statement.includes('Ineffective for Some')) {
            explanation = `"Some" means at least 1. There ${numIneffective === 1 ? 'is' : 'are'} ${numIneffective} ineffective patient${numIneffective === 1 ? '' : 's'}, so this is ${numIneffective >= 1 ? 'TRUE' : 'FALSE'}.`;
        } else if (item.statement.includes('Ineffective for All')) {
            explanation = `"All" means all 5 patients. There ${numIneffective === 1 ? 'is' : 'are'} only ${numIneffective} ineffective patient${numIneffective === 1 ? '' : 's'}, not all 5, so this is ${numIneffective === 5 ? 'TRUE' : 'FALSE'}.`;
        }
        
        if (data.comp2_correct) {
            return `<div class="comprehension-container">
                <h2 style="color: #4CAF50;">✓ Correct!</h2>
                <p>The statement "${item.statement}" is <strong>${item.correct ? 'TRUE' : 'FALSE'}</strong>.</p>
                <p>${explanation}</p>
            </div>`;
        } else {
            return `<div class="comprehension-container">
                <h2 style="color: #f44336;">✗ Incorrect</h2>
                <p>The statement "${item.statement}" is actually <strong>${item.correct ? 'TRUE' : 'FALSE'}</strong>.</p>
                <p>${explanation}</p>
                <div style="margin-top: 20px;">
                    <button class="jspsych-btn" id="review-btn" style="background: #ff9800; color: white;">Review Definitions (Optional)</button>
                </div>
            </div>`;
        }
    },
    choices: ['Continue'],
    on_load: function() {
        const reviewBtn = document.getElementById('review-btn');
        if (reviewBtn) {
            reviewBtn.addEventListener('click', () => {
                alert("Quick Review:\n\n• No = 0 patients\n• Some = at least 1 (could be all)\n• Most = more than half (3, 4, or 5)\n• All = all 5 patients");
            });
        }
    },
    on_finish: updateProgress
};

// --- Module 3: Multiple Choice (with explanatory feedback, no retry) ---

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
            <p style="text-align: center; color: #666; margin-top: 20px;"><strong>Note:</strong> There may be <strong>one or more</strong> correct answers. Select ALL that apply:</p>
            <div class="checkbox-options">`;
        
        shuffledOptions.forEach((opt, i) => {
            const imgPath = Stimuli.getImagePath(opt.numEffective);
            html += `<div class="checkbox-option" data-idx="${i}" id="opt-${i}">
                <img src="${imgPath}" style="max-width: 180px;">
                <div class="checkbox-label">
                    <span class="checkbox-marker"></span>
                    <span>Option ${String.fromCharCode(65 + i)}</span>
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
            const selectedOptions = experimentState.comp3_options.filter((_, i) => selectedIndices.has(i));
            const correctOptions = experimentState.comp3_options.filter(opt => opt.correct);
            
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
    },
    on_finish: updateProgress
};

const comp3_feedback = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const data = jsPsych.data.get().filter({task: 'comp3'}).last(1).values()[0];
        const item = CONFIG.comprehension.module3;
        
        let html = `<div class="comprehension-container">`;
        
        if (data.comp3_correct) {
            html += `<h2 style="color: #4CAF50;">✓ Correct!</h2>`;
        } else {
            html += `<h2 style="color: #f44336;">✗ Incorrect</h2>`;
        }
        
        html += `<h3>The question was:</h3>
            <div class="definition-box" style="text-align: center; font-size: 1.1em;">"${item.statement}"</div>
            <p style="text-align: center; margin: 15px 0;">"Ineffective for Most patients" means more than half (3, 4, or 5) patients had <em>ineffective</em> treatment.</p>
            
            <div class="checkbox-options" style="pointer-events: none;">`;
        
        experimentState.comp3_options.forEach((opt, i) => {
            const imgPath = Stimuli.getImagePath(opt.numEffective);
            const numIneffective = 5 - opt.numEffective;
            const isCorrect = opt.correct;
            const borderColor = isCorrect ? '#4CAF50' : '#f44336';
            const bgColor = isCorrect ? '#e8f5e9' : '#ffebee';
            
            html += `<div class="checkbox-option" style="border-color: ${borderColor}; background: ${bgColor};">
                <img src="${imgPath}" style="max-width: 160px;">
                <div class="checkbox-label">
                    <span style="color: ${borderColor}; font-weight: bold;">${isCorrect ? '✓' : '✗'}</span>
                    <span>Option ${String.fromCharCode(65 + i)}</span>
                </div>
                <p style="font-size: 0.85em; margin: 5px 0 0 0; color: #666;">
                    ${numIneffective} ineffective ${numIneffective > 2.5 ? '> 2.5 ✓' : '≤ 2.5 ✗'}
                </p>
            </div>`;
        });
        
        html += `</div>
            <div style="margin-top: 20px;">
                <button class="jspsych-btn" id="review-btn" style="background: #ff9800; color: white;">Review All Definitions (Optional)</button>
            </div>
        </div>`;
        
        return html;
    },
    choices: ['Continue'],
    on_load: function() {
        document.getElementById('review-btn').addEventListener('click', () => {
            alert("Quick Review:\n\n• No = 0 patients\n• Some = at least 1 (could be all)\n• Most = more than half (3, 4, or 5)\n• All = all 5 patients\n\nFor 'Ineffective for Most patients' to be TRUE, more than half (at least 3) patients must have had ineffective treatment.");
        });
    },
    on_finish: updateProgress
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
        
        <div class="definition-box" style="margin: 20px 0;">
            <strong>💰 Bonus Structure:</strong> After each description, the listener will respond based on what you told them. 
            Your bonus (up to <strong>${PAYMENT.block_bonus_max} per block</strong>) depends on whether the listener's response matches your communication goal!
        </div>
        
        <p><strong>Important:</strong> You can only send descriptions that are <strong>TRUE</strong>!</p>
    </div>`,
    choices: ['Begin Speaker Task'],
    on_finish: function() {
        experimentState.blockOrder = shuffleArray(['informative', 'pers_plus', 'pers_minus']);
        experimentState.blockNum = 0;
        experimentState.attentionFailures = 0;
        updateProgress();
    }
};

function createBlock(blockIdx) {
    const timeline = [];
    
    // Randomly choose after which round (5-9) to insert attention check
    const attentionCheckAfterRound = Math.floor(Math.random() * 5) + 5; // 5, 6, 7, 8, or 9
    
    // Initialize block
    timeline.push({
        type: jsPsychCallFunction,
        func: function() {
            const key = experimentState.blockOrder[blockIdx];
            experimentState.currentScenario = key;
            const seqs = CONFIG.trial_sequences[key];
            experimentState.currentSeqIdx = Math.floor(Math.random() * seqs.length);
            experimentState.currentSequence = seqs[experimentState.currentSeqIdx];
            experimentState.attentionCheckAfterRound = attentionCheckAfterRound;
            // Counterbalance: randomly choose whether to show descriptions in original or reverse order
            experimentState.reverseDescriptionOrder = Math.random() < 0.5;
        }
    });
    
    // Scenario introduction with listener mockup (BEFORE pairing)
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            const s = CONFIG.scenarios[experimentState.currentScenario];
            const isInformative = (experimentState.currentScenario === 'informative');
            const isPositive = (experimentState.currentScenario === 'pers_plus');
            
            // Generate listener mockup based on scenario type
            let listenerMockup = '';
            if (isInformative) {
                listenerMockup = `
                    <div class="listener-mockup">
                        <p style="font-weight: bold; margin-bottom: 10px;">How your bonus works:</p>
                        <div class="mockup-box">
                            <p style="margin: 0 0 15px 0; color: #666; font-size: 0.95em;"><strong>1. You see the trial outcome:</strong></p>
                            <div style="text-align: center; margin-bottom: 15px;">
                                <span style="font-size: 1.5em;">😃😃😃🤒🤒</span>
                                <p style="margin: 5px 0 0 0; font-size: 0.85em; color: #888;">(3 effective, 2 ineffective)</p>
                            </div>
                            <p style="margin: 0 0 10px 0; color: #666; font-size: 0.95em;"><strong>2. You send a description:</strong></p>
                            <p style="margin: 0 0 15px 0; text-align: center;"><em>"The treatment was Effective for Most patients."</em></p>
                            <p style="margin: 0 0 10px 0; color: #666; font-size: 0.95em;"><strong>3. The listener tries to identify what you saw:</strong></p>
                            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                                <div class="mockup-option" style="border: 2px solid #4CAF50; background: #e8f5e9;">😃😃😃🤒🤒 ✓</div>
                                <div class="mockup-option">😃😃🤒🤒🤒</div>
                                <div class="mockup-option">😃😃😃😃🤒</div>
                            </div>
                            <p style="margin: 15px 0 0 0; text-align: center; color: #4CAF50; font-weight: bold;">
                                If the listener picks correctly → You earn bonus!
                            </p>
                        </div>
                    </div>`;
            } else {
                const bonusDirection = isPositive ? 'Your bonus increases with higher ratings' : 'Your bonus increases with lower ratings';
                listenerMockup = `
                    <div class="listener-mockup">
                        <p style="font-weight: bold; margin-bottom: 10px;">What the listener will see <span style="font-weight: normal; color: #666;">(${bonusDirection})</span>:</p>
                        <div class="mockup-box">
                            <p style="margin: 0 0 10px 0;">The speaker said: <em>"The treatment was Effective for Some patients."</em></p>
                            <p style="margin: 0 0 10px 0;">How effective do you think this treatment is?</p>
                            <div class="mockup-slider">
                                <span>0%</span>
                                <div class="slider-track">
                                    <div class="slider-fill" style="width: 60%;"></div>
                                    <div class="slider-thumb" style="left: 60%;"></div>
                                </div>
                                <span>100%</span>
                            </div>
                        </div>
                    </div>`;
            }
            
            return `<div class="scenario-container">
                <h2>Your Next Role</h2>
                <p style="font-size: 1.1em; margin: 20px 0;"><strong>YOUR ROLE:</strong></p>
                <div class="role-badge" style="background:${s.color};">${s.role}</div>
                <div class="scenario-description">${s.description}</div>
                
                <div class="bonus-info" style="background: ${s.color}15; border: 1px solid ${s.color}; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <strong>💰 Your Bonus:</strong> ${s.bonusExplanation}
                </div>
                
                ${listenerMockup}
                
                <p style="margin-top: 20px;">You will describe <strong>10 trial results</strong> to this listener.</p>
                <p><strong>Remember:</strong> Only TRUE statements can be sent!</p>
            </div>`;
        },
        choices: ['Continue'],
        on_finish: updateProgress
    });
    
    // Role comprehension check
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            const scenario = experimentState.currentScenario;
            const s = CONFIG.scenarios[scenario];
            
            let question = '';
            let options = [];
            let correctIndex = 0;
            
            if (scenario === 'informative') {
                question = 'How do you maximize your bonus in this role?';
                options = [
                    'Help the listener correctly identify which trial outcome I observed',
                    'Make the listener think the treatment is highly effective',
                    'Make the listener think the treatment is ineffective'
                ];
                correctIndex = 0;
            } else if (scenario === 'pers_plus') {
                question = 'How do you maximize your bonus in this role?';
                options = [
                    'Help the listener correctly identify which trial outcome I observed',
                    'Make the listener rate the treatment as highly effective',
                    'Make the listener rate the treatment as ineffective'
                ];
                correctIndex = 1;
            } else { // pers_minus
                question = 'How do you maximize your bonus in this role?';
                options = [
                    'Help the listener correctly identify which trial outcome I observed',
                    'Make the listener rate the treatment as highly effective',
                    'Make the listener rate the treatment as ineffective'
                ];
                correctIndex = 2;
            }
            
            // Shuffle options but track correct answer
            const shuffledOptions = options.map((opt, idx) => ({ text: opt, isCorrect: idx === correctIndex }));
            const shuffled = shuffleArray(shuffledOptions);
            experimentState.roleCompOptions = shuffled;
            
            let optionsHtml = '<div class="utterance-options">';
            shuffled.forEach((opt, i) => {
                optionsHtml += `<label class="utterance-option" data-idx="${i}">
                    <input type="radio" name="role-comp" value="${i}">
                    ${opt.text}
                </label>`;
            });
            optionsHtml += '</div>';
            
            return `<div class="comprehension-container">
                <h2>Quick Check</h2>
                <p style="margin-bottom: 5px;">You are about to play as:</p>
                <div class="role-badge" style="background:${s.color}; margin: 10px 0;">${s.role}</div>
                <p style="margin-top: 20px; font-weight: bold;">${question}</p>
                ${optionsHtml}
                <div style="text-align: center; margin-top: 20px;">
                    <button id="role-comp-btn" class="jspsych-btn" disabled>Submit</button>
                </div>
            </div>`;
        },
        choices: [],
        data: { task: 'role_comprehension', block: blockIdx },
        on_load: function() {
            const options = document.querySelectorAll('.utterance-option');
            const btn = document.getElementById('role-comp-btn');
            let selectedIdx = -1;
            
            options.forEach((opt, i) => {
                opt.addEventListener('click', () => {
                    options.forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    opt.querySelector('input').checked = true;
                    selectedIdx = i;
                    btn.disabled = false;
                });
            });
            
            btn.addEventListener('click', () => {
                const isCorrect = experimentState.roleCompOptions[selectedIdx].isCorrect;
                jsPsych.finishTrial({
                    task: 'role_comprehension',
                    block: blockIdx,
                    scenario: experimentState.currentScenario,
                    selected_option: experimentState.roleCompOptions[selectedIdx].text,
                    role_comp_correct: isCorrect
                });
            });
        },
        on_finish: updateProgress
    });
    
    // Feedback for role comprehension
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            const data = jsPsych.data.get().filter({task: 'role_comprehension', block: blockIdx}).last(1).values()[0];
            const s = CONFIG.scenarios[experimentState.currentScenario];
            
            let correctAnswer = '';
            if (experimentState.currentScenario === 'informative') {
                correctAnswer = 'Help the listener correctly identify which trial outcome you observed';
            } else if (experimentState.currentScenario === 'pers_plus') {
                correctAnswer = 'Make the listener rate the treatment as highly effective';
            } else {
                correctAnswer = 'Make the listener rate the treatment as ineffective';
            }
            
            if (data.role_comp_correct) {
                return `<div class="comprehension-container">
                    <h2 style="color: #4CAF50;">✓ Correct!</h2>
                    <p>As a <strong>${s.role}</strong>, your goal is to:</p>
                    <p style="font-weight: bold; color: ${s.color};">${correctAnswer}</p>
                </div>`;
            } else {
                return `<div class="comprehension-container">
                    <h2 style="color: #f44336;">✗ Not quite</h2>
                    <p>As a <strong>${s.role}</strong>, your goal is to:</p>
                    <p style="font-weight: bold; color: ${s.color};">${correctAnswer}</p>
                    <p style="margin-top: 15px; color: #666;">Remember this goal as you describe the trial results!</p>
                </div>`;
            }
        },
        choices: ['Find a Listener'],
        on_finish: updateProgress
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
        trial_duration: () => randomInt(CONFIG.pairing_wait_min, CONFIG.pairing_wait_max),
        on_finish: updateProgress
    });
    
    // Listener matched confirmation
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            const s = CONFIG.scenarios[experimentState.currentScenario];
            return `<div class="scenario-container">
                <h2 style="color: #4CAF50;">✓ Listener Matched!</h2>
                <p>You are now connected with a listener.</p>
                <div class="role-badge" style="background:${s.color};">${s.role}</div>
                <p style="margin-top: 20px;"><strong>Goal:</strong> ${s.goalReminder}</p>
            </div>`;
        },
        choices: ['Start Communication'],
        on_finish: updateProgress
    });
    
    // 10 regular trials with 1 attention check inserted after a random round (5-9)
    for (let r = 0; r < CONFIG.n_rounds; r++) {
        // Regular trial
        timeline.push({
            type: jsPsychHtmlButtonResponse,
            stimulus: function() {
                const numEffective = experimentState.currentSequence[r];
                const s = CONFIG.scenarios[experimentState.currentScenario];
                const imgPath = Stimuli.getImagePath(numEffective);
                
                // Get all true utterances for this observation
                let trueUtterances = TruthChecker.getTrueUtterances(numEffective);
                
                // Counterbalance: reverse order if flag is set
                if (experimentState.reverseDescriptionOrder) {
                    trueUtterances = [...trueUtterances].reverse();
                }
                
                let optionsHtml = '<div class="utterance-options">';
                trueUtterances.forEach((u, i) => {
                    optionsHtml += `<label class="utterance-option" data-idx="${i}">
                        <input type="radio" name="utterance" value="${i}">
                        ${u.text}
                    </label>`;
                });
                optionsHtml += '</div>';
                
                return `<div class="trial-container">
                    <div class="trial-header">
                        <span class="round-indicator" style="background:${s.color};">Round ${r+1} of ${CONFIG.n_rounds} | ${s.role}</span>
                    </div>
                    <div class="stimulus-section">
                        <img src="${imgPath}" class="stimulus-image" style="max-width: 400px;">
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
            data: { task: 'speaker', block: blockIdx, round: r + 1 },
            on_load: function() {
                const numEffective = experimentState.currentSequence[r];
                let trueUtterances = TruthChecker.getTrueUtterances(numEffective);
                if (experimentState.reverseDescriptionOrder) {
                    trueUtterances = [...trueUtterances].reverse();
                }
                const options = document.querySelectorAll('.utterance-option');
                const btn = document.getElementById('send-btn');
                let selectedIdx = -1;
                
                options.forEach((opt, i) => {
                    opt.addEventListener('click', () => {
                        options.forEach(o => o.classList.remove('selected'));
                        opt.classList.add('selected');
                        opt.querySelector('input').checked = true;
                        selectedIdx = i;
                        btn.disabled = false;
                    });
                });
                
                btn.addEventListener('click', () => {
                    if (selectedIdx >= 0) {
                        const selected = trueUtterances[selectedIdx];
                        jsPsych.finishTrial({
                            task: 'speaker',
                            scenario: experimentState.currentScenario,
                            seq_idx: experimentState.currentSeqIdx,
                            round: r + 1,
                            num_effective: numEffective,
                            predicate: selected.predicate,
                            quantifier: selected.quantifier,
                            utterance: selected.text,
                            reverse_order: experimentState.reverseDescriptionOrder
                        });
                    }
                });
            },
            on_finish: updateProgress
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
                trial_duration: () => randomInt(CONFIG.listener_response_min, CONFIG.listener_response_max)
            });
        }
        
        // Insert attention check after the specified round (no listener wait after attention check)
        if (r + 1 === attentionCheckAfterRound) {
            // Attention check trial
            timeline.push(createAttentionCheck(blockIdx, r + 1));
            
            // Conditional warning after first failure
            timeline.push({
                timeline: [attentionWarning],
                conditional_function: function() {
                    const lastAttnCheck = jsPsych.data.get().filter({task: 'attention_check'}).last(1).values()[0];
                    // Show warning only if they just failed AND it's their first failure
                    return lastAttnCheck && !lastAttnCheck.attention_passed && experimentState.attentionFailures === 1;
                }
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
        },
        on_finish: updateProgress
    });
    
    return { timeline };
}

function createAttentionCheck(blockIdx, afterRound) {
    // Random image for attention check
    const randomNumEffective = Math.floor(Math.random() * 6);
    
    // Get all true utterances for this image and pick one randomly
    const trueUtterances = TruthChecker.getTrueUtterances(randomNumEffective);
    const requiredUtterance = trueUtterances[Math.floor(Math.random() * trueUtterances.length)];
    const requiredDescription = requiredUtterance.text;
    
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            const s = CONFIG.scenarios[experimentState.currentScenario];
            const imgPath = Stimuli.getImagePath(randomNumEffective);
            
            // Get utterances and apply counterbalancing
            let displayUtterances = [...trueUtterances];
            if (experimentState.reverseDescriptionOrder) {
                displayUtterances = displayUtterances.reverse();
            }
            
            let optionsHtml = '<div class="utterance-options">';
            displayUtterances.forEach((u, i) => {
                optionsHtml += `<label class="utterance-option" data-idx="${i}" data-text="${u.text}">
                    <input type="radio" name="utterance" value="${i}">
                    ${u.text}
                </label>`;
            });
            optionsHtml += '</div>';
            
            return `<div class="trial-container">
                <div class="trial-header">
                    <span class="round-indicator" style="background:${s.color};">Round ${afterRound} of ${CONFIG.n_rounds} | ${s.role}</span>
                </div>
                <div class="stimulus-section">
                    <img src="${imgPath}" class="stimulus-image" style="max-width: 400px;">
                </div>
                <div class="response-section" style="min-width: 500px; max-width: 600px;">
                    <p class="instruction-text">Describe these results to your listener:</p>
                    <p class="goal-reminder" style="background: ${s.color}15; border-left: 4px solid ${s.color};">
                        <strong>⚠️ Attention Check:</strong> Please select exactly this description: <strong>"${requiredDescription}"</strong>
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
            task: 'attention_check', 
            block: blockIdx, 
            round: afterRound,
            num_effective: randomNumEffective,
            required_description: requiredDescription 
        },
        on_load: function() {
            const options = document.querySelectorAll('.utterance-option');
            const btn = document.getElementById('send-btn');
            let selectedText = '';
            
            options.forEach((opt, i) => {
                opt.addEventListener('click', () => {
                    options.forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    opt.querySelector('input').checked = true;
                    selectedText = opt.dataset.text;
                    btn.disabled = false;
                });
            });
            
            btn.addEventListener('click', () => {
                const passed = (selectedText === requiredDescription);
                if (!passed) {
                    experimentState.attentionFailures++;
                }
                jsPsych.finishTrial({
                    task: 'attention_check',
                    block: blockIdx,
                    round: afterRound,
                    num_effective: randomNumEffective,
                    required_description: requiredDescription,
                    selected_description: selectedText,
                    attention_passed: passed,
                    total_failures: experimentState.attentionFailures,
                    reverse_order: experimentState.reverseDescriptionOrder
                });
            });
        },
        on_finish: function(data) {
            updateProgress();
            // Check if we need to terminate (2 out of 3 failures)
            if (experimentState.attentionFailures >= 2) {
                jsPsych.endExperiment(`
                    <div class="debrief-container">
                        <h2>Study Ended</h2>
                        <p>Unfortunately, the study has ended because attention checks were not passed.</p>
                        <p>Thank you for your time.</p>
                    </div>
                `);
            }
        }
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
    choices: ['I understand, continue'],
    data: { task: 'attention_warning' }
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
    questions: [{ 
        prompt: 'Was anything confusing? Do you have any comments or concerns?', 
        name: 'feedback', 
        rows: 5, 
        required: false 
    }],
    button_label: 'Continue',
    on_finish: updateProgress
};

const debrief = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
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
            ${isProlific ? 
                '<p style="margin-top: 30px; color: #4CAF50; font-weight: bold;">Click below to complete the study and return to Prolific.</p>' : 
                '<p style="margin-top: 30px;">If you have any questions about this research, please contact the research team.</p>'
            }
        </div>`;
    },
    choices: function() {
        return [prolificPID ? 'Complete & Return to Prolific' : 'Complete Study'];
    },
    on_finish: updateProgress
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

// Save data to DataPipe (before debrief)
if (DATAPIPE_CONFIG.enabled) {
    timeline.push({
        type: jsPsychPipe,
        action: "save",
        experiment_id: DATAPIPE_CONFIG.experiment_id,
        filename: `${subjectId}.csv`,
        data_string: () => jsPsych.data.get().csv()
    });
}

// Debrief (final screen)
timeline.push(debrief);

// Run the experiment
jsPsych.run(timeline);
