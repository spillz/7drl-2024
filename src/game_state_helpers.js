//@ts-check

import * as setup from "./game_state_setup_helpers.js";
import * as character from "./game_state_character_helpers.js";
import * as behavior from "./game_state_behavior_helpers.js";
import * as timeline from "./game_state_timeline_helpers.js";
import * as view from "./game_state_view_helpers.js";

const HELPER_GROUPS = {
    setup,
    character,
    behavior,
    timeline,
    view,
};

/**
 * @param {import("./game_state.js").GameState} game
 */
function createHelperContext(game) {
    /** @type {Record<string, (...args: any[]) => any>} */
    const rawHelpers = {};
    for (const group of Object.values(HELPER_GROUPS)) {
        for (const [name, fn] of Object.entries(group)) {
            if (typeof fn === "function") rawHelpers[name] = fn;
        }
    }

    /** @type {Record<string, (...args: any[]) => any>} */
    const boundHelpers = {};

    const context = new Proxy(game, {
        get(target, prop, receiver) {
            if (typeof prop === "string" && boundHelpers[prop]) return boundHelpers[prop];
            return Reflect.get(target, prop, receiver);
        },
        set(target, prop, value, receiver) {
            return Reflect.set(target, prop, value, receiver);
        },
    });

    for (const [name, fn] of Object.entries(rawHelpers)) {
        boundHelpers[name] = (...args) => fn(context, ...args);
    }

    return boundHelpers;
}

/**
 * @param {import("./game_state.js").GameState} game
 */
export function createGameStateComposition(game) {
    const boundHelpers = createHelperContext(game);
    /** @type {Record<string, Record<string, (...args: any[]) => any>>} */
    const groups = {};
    for (const [groupName, group] of Object.entries(HELPER_GROUPS)) {
        groups[groupName] = {};
        for (const [name, fn] of Object.entries(group)) {
            if (typeof fn !== "function") continue;
            groups[groupName][name] = boundHelpers[name];
        }
    }
    return groups;
}

