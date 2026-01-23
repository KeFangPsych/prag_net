/**
 * truth-checker.js - Validates whether utterances are true for given observations
 * Used for comprehension checks
 * 
 * Simplified version for N=5 patients, M=1 trial
 * Utterance structure: "The treatment was [Predicate] for [Quantifier] patients."
 */

const TruthChecker = {
    
    /**
     * Semantic functions for quantifiers
     * Each takes (count, total) and returns true/false
     * total is always 5 (number of patients)
     */
    quantifierFunctions: {
        'No': (count, total) => count === 0,
        'Some': (count, total) => count >= 1,
        'Most': (count, total) => count > total / 2,  // > 2.5, so 3, 4, or 5
        'All': (count, total) => count === total
    },
    
    /**
     * Check if an utterance is true for a given number of effective patients
     * 
     * @param {number} numEffective - Number of patients for whom treatment was effective (0-5)
     * @param {string} predicate - "Effective" or "Ineffective"
     * @param {string} quantifier - "No", "Some", "Most", or "All"
     * @returns {boolean} - Whether the utterance is true
     */
    checkUtterance(numEffective, predicate, quantifier) {
        const n = CONFIG.n_patients;  // 5
        
        const quantFunc = this.quantifierFunctions[quantifier];
        if (!quantFunc) {
            console.error('Invalid quantifier:', quantifier);
            return false;
        }
        
        // Determine the relevant count based on predicate
        let relevantCount;
        if (predicate === 'Effective') {
            relevantCount = numEffective;
        } else {  // Ineffective
            relevantCount = n - numEffective;
        }
        
        return quantFunc(relevantCount, n);
    },
    
    /**
     * Get all true utterances for a given number of effective patients
     * @param {number} numEffective - Number of effective patients (0-5)
     * @returns {Array} - Array of true utterance objects {predicate, quantifier, text, displayText}
     */
    getTrueUtterances(numEffective) {
        const trueUtterances = [];
        const quantifiers = ['No', 'Some', 'Most', 'All'];
        const predicates = ['Effective', 'Ineffective'];
        
        for (const predicate of predicates) {
            for (const quantifier of quantifiers) {
                if (this.checkUtterance(numEffective, predicate, quantifier)) {
                    const predicateLower = predicate.toLowerCase();
                    const quantifierLower = quantifier.toLowerCase();
                    trueUtterances.push({
                        predicate,
                        quantifier,
                        text: `The treatment was ${predicateLower} for ${quantifierLower} patients.`,
                        displayText: `The treatment was <b><u>${predicateLower}</u></b> for <b><u>${quantifierLower}</u></b> patients.`
                    });
                }
            }
        }
        
        return trueUtterances;
    },
    
    /**
     * Generate truth table for all observations and utterances
     * Useful for debugging and verification
     * @returns {Object} - Truth table mapping observations to true utterances
     */
    generateTruthTable() {
        const table = {};
        for (let i = 0; i <= 5; i++) {
            table[i] = this.getTrueUtterances(i);
        }
        return table;
    }
};

// Make available globally
window.TruthChecker = TruthChecker;
