/**
 * stimuli.js - Stimulus generation and display utilities for Listener Experiment
 * Simplified version for N=5 patients, M=1 trial
 * Includes placeholder for unknown data display
 */

// Arrangement counts: C(5,k) for each k (for comprehension checks)
const ARRANGEMENT_COUNTS = {
    0: 1,
    1: 5,
    2: 10,
    3: 10,
    4: 5,
    5: 1
};

const Stimuli = {
    
    /**
     * Get image filename for a given number of effective patients and variant
     * Used for comprehension checks
     */
    getImagePath(numEffective, variant = 0) {
        return `stimuli_emoji_n5m1/effective_${numEffective}_v${variant}.png`;
    },
    
    /**
     * Generate HTML for displaying unknown data (5 gray circles with ?)
     * @returns {string} - HTML string
     */
    getUnknownDataHTML() {
        let html = '<div class="unknown-data-container">';
        for (let i = 0; i < 5; i++) {
            html += '<div class="unknown-patient-circle">?</div>';
        }
        html += '</div>';
        return html;
    },
    
    /**
     * Generate HTML for displaying a stimulus image (for comprehension checks)
     */
    getImageHTML(numEffective, variant = 0, caption = null) {
        const path = this.getImagePath(numEffective, variant);
        let html = `<div class="stimulus-container">
            <img src="${path}" alt="Trial outcome: ${numEffective} effective" class="stimulus-image">`;
        
        if (caption) {
            html += `<p class="stimulus-caption">${caption}</p>`;
        }
        
        html += `</div>`;
        return html;
    },
    
    /**
     * Get list of all images to preload (for comprehension checks)
     */
    getAllImagePaths() {
        const paths = [];
        for (let numEffective = 0; numEffective <= 5; numEffective++) {
            paths.push(this.getImagePath(numEffective, 0));
        }
        return paths;
    },
    
    /**
     * Convert number of effective patients to readable description
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
    }
};

// Make available globally
window.Stimuli = Stimuli;
window.ARRANGEMENT_COUNTS = ARRANGEMENT_COUNTS;
