/**
 * stimuli.js - Stimulus generation and display utilities
 * Simplified version for N=5 patients, M=1 trial
 */

const Stimuli = {
    
    /**
     * Get image filename for a given number of effective patients
     * @param {number} numEffective - Number of effective patients (0-5)
     * @returns {string} - Filename like "stimuli_emoji_n5m1/effective_2.png"
     */
    getImagePath(numEffective) {
        return `stimuli_emoji_n5m1/effective_${numEffective}.png`;
    },
    
    /**
     * Generate HTML for displaying a stimulus image
     * @param {number} numEffective - Number of effective patients
     * @param {string} caption - Optional caption below image
     * @returns {string} - HTML string
     */
    getImageHTML(numEffective, caption = null) {
        const path = this.getImagePath(numEffective);
        let html = `<div class="stimulus-container">
            <img src="${path}" alt="Trial outcome: ${numEffective} effective" class="stimulus-image">`;
        
        if (caption) {
            html += `<p class="stimulus-caption">${caption}</p>`;
        }
        
        html += `</div>`;
        return html;
    },
    
    /**
     * Get list of all images to preload
     * @returns {Array} - Array of image paths
     */
    getAllImagePaths() {
        const paths = [];
        for (let i = 0; i <= 5; i++) {
            paths.push(this.getImagePath(i));
        }
        return paths;
    },
    
    /**
     * Convert number of effective patients to readable description
     * @param {number} numEffective - Number of effective patients
     * @returns {string} - Human-readable description
     */
    describeObservation(numEffective) {
        const numIneffective = 5 - numEffective;
        
        if (numEffective === 0) {
            return "No patients had an effective treatment";
        } else if (numEffective === 5) {
            return "All 5 patients had an effective treatment";
        } else {
            const effWord = numEffective === 1 ? 'patient' : 'patients';
            const ineffWord = numIneffective === 1 ? 'patient' : 'patients';
            return `${numEffective} ${effWord} had effective treatment, ${numIneffective} ${ineffWord} had ineffective treatment`;
        }
    },
    
    /**
     * Get emoji representation of the observation
     * @param {number} numEffective - Number of effective patients
     * @returns {string} - Emoji string like "😃😃🤒🤒🤒"
     */
    getEmojiRepresentation(numEffective) {
        const effective = '😃';
        const ineffective = '🤒';
        return effective.repeat(numEffective) + ineffective.repeat(5 - numEffective);
    }
};

// Make available globally
window.Stimuli = Stimuli;
