/**
 * stimuli.js - Stimulus generation and display utilities
 * Simplified version for N=5 patients, M=1 trial
 * UPDATED: Supports randomized arrangements (32 total images)
 */

// Arrangement counts: C(5,k) for each k
const ARRANGEMENT_COUNTS = {
    0: 1,   // C(5,0) = 1
    1: 5,   // C(5,1) = 5
    2: 10,  // C(5,2) = 10
    3: 10,  // C(5,3) = 10
    4: 5,   // C(5,4) = 5
    5: 1    // C(5,5) = 1
};

// Detailed arrangement mappings (positions of effective patients)
const ARRANGEMENTS = {
    0: [[]],
    1: [[0], [1], [2], [3], [4]],
    2: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]],
    3: [[0, 1, 2], [0, 1, 3], [0, 1, 4], [0, 2, 3], [0, 2, 4], [0, 3, 4], [1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4]],
    4: [[0, 1, 2, 3], [0, 1, 2, 4], [0, 1, 3, 4], [0, 2, 3, 4], [1, 2, 3, 4]],
    5: [[0, 1, 2, 3, 4]]
};

const Stimuli = {
    
    /**
     * Get a random variant index for a given number of effective patients
     * @param {number} numEffective - Number of effective patients (0-5)
     * @returns {number} - Random variant index (0 to ARRANGEMENT_COUNTS[numEffective]-1)
     */
    getRandomVariant(numEffective) {
        const count = ARRANGEMENT_COUNTS[numEffective];
        return Math.floor(Math.random() * count);
    },
    
    /**
     * Get image filename for a given number of effective patients and variant
     * @param {number} numEffective - Number of effective patients (0-5)
     * @param {number} variant - Variant index (optional, random if not provided)
     * @returns {string} - Filename like "stimuli_emoji_n5m1/effective_2_v3.png"
     */
    getImagePath(numEffective, variant = null) {
        if (variant === null) {
            variant = this.getRandomVariant(numEffective);
        }
        return `stimuli_emoji_n5m1/effective_${numEffective}_v${variant}.png`;
    },
    
    /**
     * Get image path and the variant used (for data recording)
     * @param {number} numEffective - Number of effective patients (0-5)
     * @returns {object} - {path: string, variant: number, positions: array}
     */
    getRandomImage(numEffective) {
        const variant = this.getRandomVariant(numEffective);
        return {
            path: `stimuli_emoji_n5m1/effective_${numEffective}_v${variant}.png`,
            variant: variant,
            positions: ARRANGEMENTS[numEffective][variant]
        };
    },
    
    /**
     * Generate HTML for displaying a stimulus image
     * @param {number} numEffective - Number of effective patients
     * @param {number} variant - Variant index (optional)
     * @param {string} caption - Optional caption below image
     * @returns {string} - HTML string
     */
    getImageHTML(numEffective, variant = null, caption = null) {
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
     * Get list of all images to preload (all 32 arrangements)
     * @returns {Array} - Array of image paths
     */
    getAllImagePaths() {
        const paths = [];
        for (let numEffective = 0; numEffective <= 5; numEffective++) {
            const count = ARRANGEMENT_COUNTS[numEffective];
            for (let variant = 0; variant < count; variant++) {
                paths.push(this.getImagePath(numEffective, variant));
            }
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
     * Get emoji representation of a specific arrangement
     * @param {number} numEffective - Number of effective patients
     * @param {number} variant - Variant index
     * @returns {string} - Emoji string like "😃🤒😃🤒🤒"
     */
    getEmojiRepresentation(numEffective, variant = 0) {
        const effective = '😃';
        const ineffective = '🤒';
        const positions = ARRANGEMENTS[numEffective][variant];
        const posSet = new Set(positions);
        
        let result = '';
        for (let i = 0; i < 5; i++) {
            result += posSet.has(i) ? effective : ineffective;
        }
        return result;
    },
    
    /**
     * Get HTML for displaying 5 unknown/masked patient outcomes
     * Shows smaller circles with light yellow fill to look like masked emoji faces
     * @returns {string} - HTML string with 5 masked patient icons
     */
    getUnknownDataHTML() {
        const unknownPatients = [];
        for (let i = 0; i < 5; i++) {
            unknownPatients.push(`<span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #FFF9C4; border: 2px solid #888; border-radius: 50%; font-size: 14px; color: #888; margin: 0 3px;">?</span>`);
        }
        return `<div style="display: flex; justify-content: center; gap: 5px; margin: 10px 0;">${unknownPatients.join('')}</div>`;
    }
};

// Make available globally
window.Stimuli = Stimuli;
window.ARRANGEMENT_COUNTS = ARRANGEMENT_COUNTS;
window.ARRANGEMENTS = ARRANGEMENTS;
