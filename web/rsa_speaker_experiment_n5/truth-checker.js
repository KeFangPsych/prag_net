/**
 * truth-checker.js - Validates whether utterances are true for given observations
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
     * Check utterance from string format
     * @param {number} numEffective - Number of effective patients
     * @param {string} utterance - Full utterance string like "The treatment was Effective for Some patients."
     * @returns {boolean}
     */
    checkUtteranceString(numEffective, utterance) {
        // Parse utterance: "The treatment was [Predicate] for [Quantifier] patients."
        const match = utterance.match(/The treatment was (Effective|Ineffective) for (No|Some|Most|All) patients\.?/i);
        
        if (!match) {
            console.error('Could not parse utterance:', utterance);
            return false;
        }
        
        const predicate = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        const quantifier = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
        
        return this.checkUtterance(numEffective, predicate, quantifier);
    },
    
    /**
     * Get all true utterances for a given number of effective patients
     * @param {number} numEffective - Number of effective patients (0-5)
     * @returns {Array} - Array of true utterance objects {predicate, quantifier, text}
     */
    getTrueUtterances(numEffective) {
        const trueUtterances = [];
        const quantifiers = ['No', 'Some', 'Most', 'All'];
        const predicates = ['Effective', 'Ineffective'];
        
        for (const predicate of predicates) {
            for (const quantifier of quantifiers) {
                if (this.checkUtterance(numEffective, predicate, quantifier)) {
                    trueUtterances.push({
                        predicate,
                        quantifier,
                        text: `The treatment was ${predicate} for ${quantifier} patients.`
                    });
                }
            }
        }
        
        return trueUtterances;
    },
    
    /**
     * Check if a specific combination is true (for form validation)
     * @param {number} numEffective - Number of effective patients
     * @param {string} predicate - Predicate
     * @param {string} quantifier - Quantifier
     * @returns {boolean}
     */
    isValidUtterance(numEffective, predicate, quantifier) {
        if (!predicate || !quantifier) return false;
        return this.checkUtterance(numEffective, predicate, quantifier);
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
