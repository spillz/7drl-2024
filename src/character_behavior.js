//@ts-check

/**
 * @typedef {{
 *   timelineTurn: number,
 *   timelineTick: number,
 *   replayMode: boolean,
 * }} BehaviorContext
 */

/**
 * Base behavior policy contract for character decision-making.
 * Concrete policies can be swapped per role/capability without changing orchestration.
 */
export class CharacterBehavior {
    /** @type {string} */
    id = 'base';

    /**
     * @param {import('./character_state.js').CharacterStateData} state
     * @param {BehaviorContext} context
     * @returns {string}
     */
    chooseIntent(state, context) {
        return 'idle';
    }
}

