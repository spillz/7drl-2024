//@ts-check

/**
 * @typedef {'player'|'enemy'|'target'} CharacterRole
 */

/**
 * @typedef {'patrol'|'post'|'passive'|'investigate'|'engage'|'unaware'|'usingSkype'|'seekingGuards'|'fleeing'|'comply'|'surrendering'|'dead'} CharacterBehaviorState
 */

/**
 * @typedef {'standing'|'prone'} CharacterPosture
 */

/**
 * @typedef {'combatEffective'|'wounded'|'critical'|'unconscious'|'detained'|'dead'} CharacterCasualtyState
 */

/**
 * @typedef {'unaware'|'aware'|'investigating'|'engaging'} CharacterAwarenessState
 */

/**
 * Authoritative character simulation state.
 * Widgets mirror this state but do not own it.
 */
export class CharacterStateData {
    /** @type {string} */
    id = '';
    /** @type {CharacterRole} */
    role = 'enemy';
    /** @type {CharacterBehaviorState} */
    behaviorState = 'patrol';
    /** @type {CharacterBehaviorState} */
    priorBehaviorState = 'patrol';
    /** @type {CharacterBehaviorState} */
    resumeBehaviorState = 'patrol';
    /** @type {number} */
    actionsRemaining = 2;
    /** @type {number} */
    movementBlockedCount = 0;
    /** @type {CharacterPosture} */
    posture = 'standing';
    /** @type {CharacterCasualtyState} */
    casualtyState = 'combatEffective';
    /** @type {CharacterAwarenessState} */
    awarenessState = 'unaware';
    /** @type {number} */
    awarenessCooldown = 0;
    /** @type {number} */
    alertTtl = 0;
    /** @type {boolean} */
    alertPermanent = false;
    /**
     * Suppression points are deterministic pressure from incoming fire.
     * 0-1 = pressured, 2+ = suppressed (reduced initiative/options).
     * @type {number}
     */
    suppressionPoints = 0;
    /** @type {boolean} */
    isSuppressed = false;
    /** @type {number} */
    suppressionFireLockRedTurns = 0;
    /** @type {number} */
    suppressionFireLockOrangeTurns = 0;
    /** @type {number} */
    suppressibility = 1;
    /** @type {boolean} */
    hasCover = false;
    /** @type {import('eskv/lib/eskv.js').Vec2 | null} */
    lastKnownThreatPos = null;
    /** @type {number} */
    lastKnownThreatTtl = 0;
    /** @type {import('eskv/lib/eskv.js').Vec2[]} */
    patrolRoute = [];
    /** @type {number} */
    patrolTarget = -1;
    /** @type {number} */
    healthPoints = 0;
    /** @type {number} */
    recentlyAttackedTtl = 0;
    /** @type {import('eskv/lib/eskv.js').Vec2} */
    gridPosition;

    /**
     * @param {import('./character_widget.js').Character} character
     * @param {CharacterRole} role
     */
    constructor(character, role) {
        this.id = character.id;
        this.role = role;
        this.gridPosition = character.gpos.add([0, 0]);
        this.actionsRemaining = character.actionsThisTurn;
        this.movementBlockedCount = character.movementBlockedCount;
        this.suppressionPoints = character.suppressionLevel;
        this.isSuppressed = this.suppressionPoints >= 2;
        this.suppressibility = character.suppressibility;
        this.healthPoints = character.health;
        this.patrolRoute = character.patrolRoute.map((pos) => pos.add([0, 0]));
        this.patrolTarget = character.patrolTarget;
    }
}
