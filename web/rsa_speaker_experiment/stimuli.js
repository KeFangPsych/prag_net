/**
 * stimuli.js - Stimulus generation and display utilities
 */

const Stimuli = {
    
    /**
     * Get image filename for an observation
     * @param {Array} obs - Observation tuple like [0, 0, 3, 1, 1]
     * @returns {string} - Filename like "stimuli_emoji/obs_0_0_3_1_1.png"
     */
    getImagePath(obs) {
        return `stimuli_emoji/obs_${obs.join('_')}.png`;
    },
    
    /**
     * Generate HTML for displaying a stimulus image
     * @param {Array} obs - Observation tuple
     * @param {string} caption - Optional caption below image
     * @returns {string} - HTML string
     */
    getImageHTML(obs, caption = null) {
        const path = this.getImagePath(obs);
        let html = `<div class="stimulus-container">
            <img src="${path}" alt="Trial outcome ${obs.join(',')}" class="stimulus-image">`;
        
        if (caption) {
            html += `<p class="stimulus-caption">${caption}</p>`;
        }
        
        html += `</div>`;
        return html;
    },
    
    /**
     * Generate HTML for a stimulus with description form
     * @param {Array} obs - Observation tuple
     * @param {number} roundNum - Current round number
     * @param {number} totalRounds - Total rounds
     * @returns {string} - HTML string with dropdowns
     */
    getTrialHTML(obs, roundNum, totalRounds) {
        const path = this.getImagePath(obs);
        
        return `
        <div class="trial-container">
            <div class="trial-header">
                <span class="round-indicator">Round ${roundNum} of ${totalRounds}</span>
            </div>
            
            <div class="stimulus-section">
                <img src="${path}" alt="Trial outcome" class="stimulus-image">
            </div>
            
            <div class="response-section">
                <p class="instruction-text">Describe these trial results to your listener:</p>
                
                <div class="utterance-builder">
                    <select id="select-q1" class="utterance-select" required>
                        <option value="">Select…</option>
                        <option value="No">No</option>
                        <option value="Some">Some</option>
                        <option value="Most">Most</option>
                        <option value="All">All</option>
                    </select>
                    <span class="utterance-text">sessions are</span>
                    <select id="select-predicate" class="utterance-select" required>
                        <option value="">Select…</option>
                        <option value="Effective">Effective</option>
                        <option value="Ineffective">Ineffective</option>
                    </select>
                    <span class="utterance-text">for</span>
                    <select id="select-q2" class="utterance-select" required>
                        <option value="">Select…</option>
                        <option value="No">No</option>
                        <option value="Some">Some</option>
                        <option value="Most">Most</option>
                        <option value="All">All</option>
                    </select>
                    <span class="utterance-text">patients.</span>
                </div>
                
                <div id="validation-message" class="validation-message"></div>
                
                <button id="submit-utterance" class="jspsych-btn submit-btn" disabled>
                    Send Description
                </button>
            </div>
        </div>`;
    },
    
    /**
     * Get list of all images to preload
     * @returns {Array} - Array of image paths
     */
    getAllImagePaths() {
        const paths = [];
        
        // Generate all possible observations for n=5, m=4
        // Using stars and bars: C(n+m, m) = C(9, 4) = 126 outcomes
        const generateOutcomes = (n, m) => {
            const outcomes = [];
            
            const generate = (remaining, maxVal, current) => {
                if (current.length === m) {
                    current.push(remaining);
                    outcomes.push([...current]);
                    current.pop();
                    return;
                }
                
                for (let i = 0; i <= remaining; i++) {
                    current.push(i);
                    generate(remaining - i, maxVal, current);
                    current.pop();
                }
            };
            
            generate(n, m, []);
            return outcomes;
        };
        
        const outcomes = generateOutcomes(5, 4);
        
        for (const obs of outcomes) {
            paths.push(this.getImagePath(obs));
        }
        
        return paths;
    },
    
    /**
     * Convert patient success counts to readable description
     * @param {Array} obs - Observation tuple
     * @returns {string} - Human-readable description
     */
    describeObservation(obs, m = 4) {
        const descriptions = [];
        
        for (let j = 0; j <= m; j++) {
            if (obs[j] > 0) {
                const patientWord = obs[j] === 1 ? 'patient' : 'patients';
                const sessionWord = j === 1 ? 'session' : 'sessions';
                descriptions.push(`${obs[j]} ${patientWord} with ${j} effective ${sessionWord}`);
            }
        }
        
        return descriptions.join(', ');
    }
};

// Make available globally
window.Stimuli = Stimuli;
