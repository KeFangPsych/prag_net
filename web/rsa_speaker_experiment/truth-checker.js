/**
 * truth-checker.js - Validates whether utterances are true for given observations
 * 
 * Implements the semantics for:
 * - Quantifiers: No, Some, Most, All
 * - Predicates: Effective (success), Ineffective (failure)
 * - Structure: "[Q1] sessions are [Predicate] for [Q2] patients"
 */

const TruthChecker = {
    
    /**
     * Semantic functions for quantifiers
     * Each takes (count, total) and returns true/false
     */
    quantifierFunctions: {
        'No': (count, total) => count === 0,
        'Some': (count, total) => count >= 1,
        'Most': (count, total) => count > total / 2,
        'All': (count, total) => count === total
    },
    
    /**
     * Convert observation tuple to patient success counts
     * obs = [n0, n1, n2, n3, n4] where n_j = number of patients with j successes
     * Returns array of success counts for each patient (sorted descending)
     */
    obsToPatientSuccesses(obs, m = 4) {
        const successes = [];
        for (let j = 0; j <= m; j++) {
            for (let i = 0; i < obs[j]; i++) {
                successes.push(j);
            }
        }
        return successes.sort((a, b) => b - a);
    },
    
    /**
     * Check if an utterance is true for a given observation
     * 
     * @param {Array} obs - Observation tuple [n0, n1, n2, n3, n4]
     * @param {string} q1 - First quantifier (for sessions): No, Some, Most, All
     * @param {string} predicate - Effective or Ineffective
     * @param {string} q2 - Second quantifier (for patients): No, Some, Most, All
     * @param {number} n - Number of patients (default 5)
     * @param {number} m - Number of trials per patient (default 4)
     * @returns {boolean} - Whether the utterance is true
     */
    checkUtterance(obs, q1, predicate, q2, n = 5, m = 4) {
        const patientSuccesses = this.obsToPatientSuccesses(obs, m);
        
        // For each patient, check if predicate applies based on q1
        // Then count how many patients satisfy this
        
        const q1Func = this.quantifierFunctions[q1];
        const q2Func = this.quantifierFunctions[q2];
        
        if (!q1Func || !q2Func) {
            console.error('Invalid quantifier:', q1, q2);
            return false;
        }
        
        // Count patients for whom "[q1] sessions are [predicate]"
        let patientsSatisfying = 0;
        
        for (const successes of patientSuccesses) {
            let relevantCount;
            
            if (predicate === 'Effective') {
                // Count effective sessions (successes)
                relevantCount = successes;
            } else {
                // Count ineffective sessions (failures)
                relevantCount = m - successes;
            }
            
            // Check if q1 is satisfied for this patient
            if (q1Func(relevantCount, m)) {
                patientsSatisfying++;
            }
        }
        
        // Now check if q2 is satisfied across patients
        return q2Func(patientsSatisfying, n);
    },
    
    /**
     * Check utterance from string format
     * @param {Array} obs - Observation tuple
     * @param {string} utterance - Full utterance string like "Some sessions are Effective for All patients"
     * @returns {boolean}
     */
    checkUtteranceString(obs, utterance) {
        // Parse utterance: "[Q1] sessions are [Predicate] for [Q2] patients"
        const match = utterance.match(/^(No|Some|Most|All) sessions are (Effective|Ineffective) for (No|Some|Most|All) patients\.?$/i);
        
        if (!match) {
            console.error('Could not parse utterance:', utterance);
            return false;
        }
        
        const q1 = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        const predicate = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
        const q2 = match[3].charAt(0).toUpperCase() + match[3].slice(1).toLowerCase();
        
        return this.checkUtterance(obs, q1, predicate, q2);
    },
    
    /**
     * Get all true utterances for an observation
     * @param {Array} obs - Observation tuple
     * @returns {Array} - Array of true utterance objects {q1, predicate, q2, text}
     */
    getTrueUtterances(obs, n = 5, m = 4) {
        const trueUtterances = [];
        const quantifiers = ['No', 'Some', 'Most', 'All'];
        const predicates = ['Effective', 'Ineffective'];
        
        for (const q1 of quantifiers) {
            for (const predicate of predicates) {
                for (const q2 of quantifiers) {
                    if (this.checkUtterance(obs, q1, predicate, q2, n, m)) {
                        trueUtterances.push({
                            q1,
                            predicate,
                            q2,
                            text: `${q1} sessions are ${predicate} for ${q2} patients.`
                        });
                    }
                }
            }
        }
        
        return trueUtterances;
    },
    
    /**
     * Check if a specific combination is true (for form validation)
     * @param {Array} obs - Observation tuple
     * @param {string} q1 - First quantifier
     * @param {string} predicate - Predicate
     * @param {string} q2 - Second quantifier
     * @returns {boolean}
     */
    isValidUtterance(obs, q1, predicate, q2) {
        if (!q1 || !predicate || !q2) return false;
        return this.checkUtterance(obs, q1, predicate, q2);
    }
};

// Make available globally
window.TruthChecker = TruthChecker;
