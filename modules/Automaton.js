"use strict"

const assert = require("assert");

/**
 * Utility functions
 * 
 * @param {Array} array1
 * @param {Array} array2
 * 
 * @returns {Boolean} true if both arrays are equal
 */
function arrayEquals(array1, array2) {
    return Array.isArray(array1)
        && Array.isArray(array2) && array1.length === array2.length
        && array1.every(value => array2.includes(value));
}

/**
 * Compute pairs of elements of a given array
 * @param {Array} array 
 * @returns {Array} Array of pairs
 */
function makePairs(array) {
    let pairs = [];
    array.forEach(element => {
        array.filter(element_ => element !== element_)
            .forEach(element__ => {
                if(!pairs.some(pair => arrayEquals(pair, [element, element__])))
                    pairs.push([element, element__]);
            });
    });

    return pairs;
}

/**
 * @typedef {Automaton} Automaton
 */

/**
 * Automaton class
 * 
 * Generic object able to represent any type of basic automaton
 */
class Automaton {
    /** 
     * @param {Array<String>} alphabet 
     * @param {Number} numberOfStates 
     * @param {Number} initialState 
     * @param {Array<Number>} finalStates 
     * @param {Array<Array<Number>>} transitions Transitions matrix
    */
    constructor(alphabet = [], numberOfStates = 0, initialState = -1, finalStates = [], transitions = []) {
        this.alphabet = alphabet; // Alphabet

        // Number of states is a positive integer
        assert(numberOfStates > -1 && Number.isInteger(numberOfStates), "Invalid number of states");

        // Compute different states
        this.states = new Array(numberOfStates);
        for (let index = 0; index < this.states.length; index++) {
            this.states[index] = index;
        }

        // Initial states is an integer included states indexes
        assert(this.states[initialState] !== undefined || (numberOfStates === 0 && initialState === -1), "Invalid initial state");
        this.initialState = initialState;

        // Final states
        finalStates.forEach(finalState => {
            assert(this.states[finalState] !== undefined, "Invalid final states");
        });
        this.finalStates = finalStates;

        // Transitions
        transitions.forEach(transition => {
            const verifyTransiton = this.states.includes(transition.from) && this.states.includes(transition.to) && (this.alphabet.includes(transition.symbol) || transition.symbol == null);
            assert(verifyTransiton, `Invalid transtion { ${transition.from}, ${transition.symbol} => ${transition.to} }`);
        });
        this.transitions = transitions;
    };

    /**
     * Execute automaton on word
     * 
     * @param {String} word 
     * @returns {Object} status and march of the process
     */
    apply(word) {
        assert(typeof (word) === "string", "Invalid word");
        let states = [[this.states[this.initialState]]];
        try {
            for (let charPosition = 0; charPosition < word.length; charPosition++) {
                let image = [];
                states[charPosition].forEach(state => {
                    let transition = this.transition(state, word.charAt(charPosition));
                    // console.log({ transition, state }, word.charAt(charPosition))
                    if (transition == null)
                        return {
                            status: false,
                            march: states
                        };
                    if (!Array.isArray(transition))
                        transition = [transition];
                    image.push(...transition);
                })

                const epsilonClosure = this.epsilonClosure(image);
                // console.log({ image, epsilonClosure })
                if (!epsilonClosure.length)
                    return {
                        status: false,
                        march: states
                    };
                states.push(epsilonClosure);
                // console.log({ charPosition, states })
            }
        } catch (error) {
            // console.log(error)
            return {
                status: false,
                march: states
            };
        }

        return {
            status: true,
            march: states
        };
    }

    /**
     * Normalizes automaton
     * 
     * @mutators
     * @returns {Automaton} this
     */
    _normalize() {
        // We can start by sorting state per order, but this can become complex

        // Map each state to the index that is going to replace
        this.states = this.states.map((state, index) => (index));
        this.initialState = this.states.findIndex(state => arrayEquals(this.initialState, state));
        this.finalStates = this.finalStates.map(finalState => (this.states.findIndex(state => arrayEquals(state, finalState))));
        this.transitions = this.transitions.map(transition => ({
            from: this.states.findIndex(state => arrayEquals(state, transition.from)),
            to: this.states.findIndex(state => arrayEquals(state, transition.to)),
            symbol: transition.symbol
        }));

        return this;
    }

    /**
     * Transition
     * 
     * @param {Number} state 
     * @param {String} symbol 
     */
    transition(state, symbol = null) {
        // console.log({ state, symbol })
        assert(this.states[state] !== undefined, "Invalid state");
        assert(this.alphabet.includes(symbol) || symbol === null, "Invalid symbol");

        // Transitions going from state
        let image = this.transitions
            .filter(transition => transition.from == state && transition.symbol === symbol)
            .sort((a, b) => a - b);

        if (image.length == 1)
            return image[0].to;

        if (image.length > 1)
            return image.map(transition => (transition.to));

        return null;
    }

    /**
     * 
     * @returns {Automaton} Complement of this automaton
     */
    complement() {
        return new Automaton(
            this.alphabet,
            this.states.length,
            this.initialState,
            this.states.filter(state => !this.finalStates.includes(state)),  // Non-final states beccome final
            this.transitions
        )
    };

    /**
     * 
     * @param {Automaton} automaton An automaton to unite
     */
    union(automaton) {
        // States = this.states X automaton.state
        let states = new Array();
        this.states.map(state => {
            automaton.states.forEach(state_ => {
                states.push([state, state_])
            });
        });

        // Initial state = [this.initialState, automaton.initialState]
        let initialState = [this.initialState, automaton.initialState];

        // Final states contains either a final state from this or automaton
        let finalStates = states.filter(state => {
            return this.finalStates.includes(state[0]) || automaton.finalStates.includes(state[1]);
        });

        // Transitions
        let transitions = new Array();
        // For each state, verify if state has an image we add it to transitions

        states.forEach(state => {
            this.alphabet.forEach(symbol => {
                let firstTransition = this.transition(state[0], symbol);
                let secondTransition = automaton.transition(state[1], symbol);

                if (firstTransition && secondTransition) {
                    transitions.push({
                        from: state,
                        to: [firstTransition, secondTransition],
                        symbol: symbol
                    })
                }
            })
        });

        // Init result
        let result = new Automaton();
        result.alphabet = this.alphabet;
        result.states = states;
        result.initialState = initialState;
        result.finalStates = finalStates;
        result.transitions = transitions;

        return result;
    };

    /**
     * 
     * @param {Automaton} automaton An automaton to intersect
     */
    intersection(automaton) {
        // Same as for union, the difference is with final states computing
        // So
        let result = this.union(automaton);

        // A computation must succeed in both automatas
        result.finalStates = result.states.filter(state => {
            return this.finalStates.includes(state[0]) && automaton.finalStates.includes(state[1]);
        });

        return result;
    };

    /**
     * Mirror this automaton
     * 
     * @return {Automaton} automaton 
     */
    mirror() {
        // Invert transitions
        let transitions = this.transitions.map(transition => ({
            from: transition.to,
            to: transition.from,
            symbol: transition.symbol
        }));

        return new Automaton(
            this.alphabet,
            this.states.length,
            this.finalStates[0],
            [this.initialState],
            transitions
        );
    };

    /**
     * Concatenates this automaton with another one
     * 
     * @param {Automaton} automaton 
     * @returns {Automaton} Result of concatenation
     */
    concat(automaton) {
        assert(this.finalStates.length == 1, "We always suppose the left automaton has one final state");

        // Concatenation makes us loose the entry state of parameter automaton
        let result = new Automaton(this.alphabet,
            this.states.length + automaton.states.length - 1,
            // Same initial state, but final states become automaton's final states
            this.initialState,
            automaton.finalStates.map(finalState => (finalState + this.states.length - 1))
        );

        // Copy all transitions of automaton by extending the current automaton object
        let transitions = automaton.transitions.map(transition => ({
            from: (transition.from == automaton.initialState) ? this.finalStates[0] : transition.from + this.states.length - 1,
            to: (transition.to == automaton.initialState) ? this.finalStates[0] : transition.to + this.states.length - 1,
            symbol: transition.symbol
        }));
        // Then add this automaton's transitions
        transitions = [...this.transitions, ...transitions];
        result.transitions = transitions;

        return result;
    };

    /**
     * Computes the iteration of this automaton
     * 
     * @returns {Automaton} Result automaton
     */
    iteration() {
        // SImple: add an epsilon-transition from final states to initial state
        let result = new Automaton(
            this.alphabet,
            this.states.length,
            this.initialState,
            this.finalStates,
            this.transitions
        );
        result.finalStates.forEach(finalState => {
            result.transitions.push({ from: finalState, to: result.initialState, symbol: null })
        });

        return result;
    };

    /**
     * Checks if automaton is deterministic
     */
    isDeterministic() {
        for (let index = 0; index < this.states.length; index++) {
            const state = this.states[index];
            for (const symbol of this.alphabet) {
                if (Array.isArray(this.transition(state, symbol)))
                    return false;
            }
        }

        return true;
    };

    /**
     * Checks if automaton is deterministic and complete
     */
    isDeterministicComplete() {
        let isDeterministic = this.isDeterministic();
        if (!isDeterministic) return false;

        // Each pair (state, symbol) must have an image by transition function
        for (let index = 0; index < this.states.length; index++) {
            const state = this.states[index];
            for (const symbol of this.alphabet) {
                if (this.transition(state, symbol) == null)
                    return false;
            }
        }

        return true;
    };

    /**
     * Complete a deterministic automaton
     * 
     * @returns {Automaton} A complete deterministic automaton equivalent to this
     */
    completion() {
        assert(!this.isDeterministicComplete(), "This automaton is already deterministic and complete");
        assert(this.isDeterministic(), "This automaton is not deterministic");

        // Iterate over transitions and when a transition misses for a given symbol,
        // point it to the "dig state"
        let transitions = [...this.transitions];
        this.states.forEach(state => {
            this.alphabet.forEach(symbol => {
                if (!this.transition(state, symbol))
                    transitions.push({
                        from: state,
                        symbol: symbol,
                        to: this.states.length
                    });
            })
        });

        return new Automaton(
            this.alphabet,
            this.states.length + 1, // Append a new dig state
            this.initialState,
            this.finalStates,
            transitions
        );
    }

    /**
     * Epsilon closure of a state of this automaton
     * 
     * @param {Array} states
     * @returns {Array} array of states belonging to the closure
     */
    epsilonClosure(states) {
        if (states === null)
            return [];

        if (!Array.isArray(states))
            states = [states];

        if (!states.length)
            return [];

        let stack = [...states];
        let result = [...states];

        while (stack.length) {
            let state = stack.pop();
            assert(this.states[state] !== undefined, "Invalid state");
            this.transitions
                .filter(transition => transition.symbol === null && transition.from == state)
                .map(element => (element.to))
                .forEach(subState => {
                    if (!result.includes(subState))
                        result.push(subState);
                });
        }

        return result;
    }

    /**
     * Automaton deterministation
     */
    determine() {
        // Automaton must be non-deterministic
        assert(!this.isDeterministic(), "Automaton is already deterministic");

        // Init configurations
        let stack = [[this.initialState]];
        let states = [...stack];
        let initialState = states[0];
        let finalStates = this.finalStates.includes(this.initialState) ? initialState : [];
        let transitions = []
        // console.log({ stack, states, initialState, finalStates, transitions }); return;

        // Algorithm
        while (stack.length) {
            let state = stack.pop();
            // stack.push(state);

            // Compute image by each symbol
            this.alphabet.forEach(symbol => {
                let image = [];
                // image = this.epsilonClosure(this.transition(state));
                state.forEach(subState => {
                    let transition = this.transition(subState, symbol);
                    let subStateImage = this.epsilonClosure(transition);
                    image.push(...subStateImage);
                    // if (subStateImage) {
                    //     // Remove duplicates
                    //     if (Array.isArray(subStateImage)) {
                    //         subStateImage = subStateImage.filter(element => !image.includes(element));
                    //         image.push(...subStateImage);
                    //     }
                    //     else
                    //         if (!image.includes(subStateImage))
                    //             image.push(subStateImage);
                    // }
                });

                // If image has been found, add image to stack and create transition
                if (image.length) {
                    // If image contains one of the final states it becomes a final state too
                    for (const subState of image) {
                        if (this.finalStates.includes(subState)) {
                            // Avoid duplicates
                            if (finalStates.findIndex(finalState => arrayEquals(finalState, image)) === -1)
                                finalStates.push(image);
                            break;
                        }
                    }

                    transitions.push({
                        from: state,
                        symbol: symbol,
                        to: image
                    });

                    // Verify if new image is an existing state
                    const check = states.findIndex(state => arrayEquals(state, image)) === -1;
                    if (check) {
                        stack.push(image);
                        states.push(image);
                    }
                }
            })
        }
        // Empty stack

        let result = new Automaton(this.alphabet);
        result.states = states;
        result.initialState = initialState;
        result.finalStates = finalStates;
        result.transitions = transitions;

        return result;
    };

    /**
     * Minimize a deterministic automaton
     * 
     * @returns {Automaton} Minimal automaton
     */
    minimize() {
        // Initialize equivalence classes in finals and non-finals
        let classes = [this.states.filter(state => !this.finalStates.includes(state)), [...this.finalStates]];

        // Iteration
        // While a pair of states s1 and s2 exist in the same class so that, for a same symbol s:
        // transition(s1, s) and transition(s2, s) are not in the same class, create a new class with that pair
        let found = true;
        while (found) {
            found = false;
            let newClasses = [];
            classes.filter((element) => element.length > 2).forEach(($class) => {
                // Compute pair of states
                const pairOfStates = makePairs($class);
                pairOfStates.forEach(pair => {
                    this.alphabet.forEach(symbol => {
                        const transitions = [this.transition(pair[0], symbol), this.transition(pair[1], symbol)];
                        // console.log({ $class, pair, transitions })
                        if (transitions.every(transition => !$class.includes(transition))) {
                            console.log('found here')
                            found = true;
                            newClasses.push(pair);
                        }
                    });
                });
            });

            newClasses.forEach(newClass => {
                classes = classes.map($class => ($class.filter(element => !newClass.includes(element))))
            });
            classes.push(...newClasses);

            // console.log({ newClasses, classes });
        }

        // We then have equivalence classes, now we must compute the minimal automaton
        let transitions = [];
        let initialState = []
        let finalStates = [];
        classes.forEach($class => {
            // Check if initial state
            if ($class.some(state => state === this.initialState))
                initialState = $class;

            // Check if final state
            if ($class.some(state => this.finalStates.includes(state)))
                finalStates.push($class);
            
            // Then look for possible transitions
            classes.forEach($class_ => {
                this.alphabet.forEach(symbol => {
                    if ($class.some(state => $class_.includes(this.transition(state, symbol))))
                        transitions.push({
                            from: $class,
                            to: $class_,
                            symbol: symbol
                        });
                });
            });
        });

        let result = new Automaton(this.alphabet);
        result.states = classes;
        result.initialState = initialState;
        result.finalStates = finalStates;
        result.transitions = transitions;

        return result;
    }
};

module.exports = Automaton;