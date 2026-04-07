//@ts-check

import { Facing, FacingVec } from "./facing.js";
import { MetaLayers, MissionMap } from "./map.js";
import { Character, PlayerCharacter } from "./character.js";
import { ArrestAction, DecoyAction, Rifle, StealthTakedownAction } from "./action.js";

/**
 * @typedef {'notStarted'|'active'|'success'|'failure'} MissionStatus
 */

/**
 * @typedef {'pending'|'complete'|'failed'} ObjectiveState
 */

/**
 * @typedef {{
 *   id: string,
 *   text: string,
 *   state: ObjectiveState,
 * }} MissionObjective
 */

/**
 * @typedef {{
 *   type: 'move',
 *   direction: Facing,
 * } | {
 *   type: 'rest',
 * } | {
 *   type: 'startActionFromKey',
 *   key: string,
 * } | {
 *   type: 'requestActionFromKey',
 *   key: string,
 * } | {
 *   type: 'moveSelection',
 *   direction: Facing,
 * } | {
 *   type: 'confirmSelection',
 * } | {
 *   type: 'cancelSelection',
 * } | {
 *   type: 'debugRevealMap',
 * } | {
 *   type: 'rewindToTick',
 *   tick: number,
 * } | {
 *   type: 'startObligationLoop',
 * }} GameIntent
 */

/**
 * @typedef {{
 *   turn: number,
 *   tick: number,
 *   actorId: string,
 *   actorPos: import('eskv/lib/eskv.js').VecLike | null,
 *   intent: GameIntent,
 *   result: 'applied'|'ignored'|'blocked'|'rewind',
 *   message: string,
 * }} TimelineEvent
 */

/**
 * @typedef {{
 *   turn: number,
 *   tick: number,
 *   actorId: string,
 *   position: import('eskv/lib/eskv.js').VecLike,
 *   label: string,
 * }} ObligationObjective
 */

/**
 * @typedef {{
 *   id: string,
 *   position: import('eskv/lib/eskv.js').VecLike,
 *   kind: 'attack'|'advance'|'search'|'patrol'|'passive'|'flee'|'comply'|'arrested'|'down'|'dead',
 *   label: string,
 *   color: string,
 * }} EnemyIntentGlyph
 */

/**
 * @typedef {{
 *   message: string,
 *   awaitingSelection: boolean,
 *   selectorCells: import('eskv/lib/eskv.js').Vec2[],
 *   selectorIndex: number,
 *   objectiveText: string,
 *   missionStatus: MissionStatus,
 *   runSeed: number,
 *   missionSeed: number,
 *   missionIndex: number,
 *   timelineTick: number,
 *   timelineTurn: number,
 *   replayMode: boolean,
 *   squadStatusText: string,
 *   playerStatusText: string,
 *   inventoryStatusText: string,
 *   enemyStatusText: string,
 *   signalStatusText: string,
 *   shortcutsText: string,
 *   logText: string,
 *   activeCharacterId: string,
 *   randyEchoPos: import('eskv/lib/eskv.js').VecLike | null,
 *   obligationObjectives: ObligationObjective[],
 *   obligationTurns: number[],
 *   randyPath: {turn:number, position: import('eskv/lib/eskv.js').VecLike}[],
 *   anomalyCount: number,
 *   requestSummaryText: string,
 *   enemyIntents: EnemyIntentGlyph[],
 * }} GameView
 */

/**
 * @typedef {{
 *   turn: number,
 *   key: string,
 *   sourcePos: import('eskv/lib/eskv.js').VecLike,
 *   fulfilled: boolean,
 *   fulfilledTick: number | null,
 *   label: string,
 * }} MariaRequest
 */

/**
 * @typedef {'player'|'enemy'|'target'} CharacterRole
 */

/**
 * @typedef {'patrol'|'passive'|'investigate'|'engage'|'unaware'|'usingSkype'|'seekingGuards'|'fleeing'|'comply'|'surrendering'|'dead'} CharacterBehaviorState
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
 * Authoritative character state for deterministic simulation.
 * UI widgets should only mirror this data, not own it.
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
    /**
     * Suppression points are deterministic pressure from incoming fire.
     * 0-1 = pressured, 2+ = suppressed (reduced initiative/options).
     * @type {number}
     */
    suppressionPoints = 0;
    /** @type {boolean} */
    isSuppressed = false;
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
     * @param {Character} character
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

export class GameState {
    /** @type {MissionMap} */
    missionMap;
    /** @type {Map<string, CharacterStateData>} */
    characterState = new Map();
    /** @type {import('./action.js').ActionItem | null} */
    activePlayerAction = null;
    /** @type {import('./action.js').ActionResponseData | null} */
    activePlayerActionData = null;
    /** @type {string} */
    message = 'Welcome to the mansion';
    /** @type {MissionStatus} */
    missionStatus = 'notStarted';
    /** @type {number} */
    runSeed = 20260405;
    /** @type {number} */
    missionIndex = 0;
    /** @type {number} */
    missionSeed = 0;
    /** @type {MissionObjective[]} */
    objectives = [];
    /** @type {string[]} */
    guardIds = ['guard1', 'guard2', 'guard3', 'guard4', 'guard5', 'guard6'];
    /** @type {string[]} */
    scientistIds = ['scientist1', 'scientist2', 'scientist3', 'scientist4'];
    /** @type {Set<string>} */
    escapedScientistIds = new Set();
    /** @type {Map<string, import('eskv/lib/eskv.js').Vec2>} */
    scientistPreviousPositions = new Map();
    /** @type {Map<string, number>} */
    scientistFleeStallTurns = new Map();
    /** @type {Map<string, number>} */
    scientistPassiveWaitTurns = new Map();
    /** @type {import('eskv/lib/eskv.js').Vec2[]} */
    selectorCells = [];
    selectorIndex = -1;

    /** @type {TimelineEvent[]} */
    timeline = [];
    /** @type {number} */
    timelineTick = 0;
    /** @type {number} */
    timelineTurn = 1;
    /** @type {boolean} */
    replayMode = false;
    /** @type {boolean} */
    hostilityEscalated = false;
    /** @type {string} */
    hostilityReason = '';
    /** @type {ObligationObjective[]} */
    obligationObjectives = [];
    /** @type {MariaRequest[]} */
    mariaRequests = [];
    /** @type {{turn:number, position: import('eskv/lib/eskv.js').VecLike}[]} */
    randyPath = [];
    /** @type {Map<number, GameIntent[]>} */
    randyReplayScriptByTurn = new Map();
    /** @type {number} */
    anomalyCount = 0;
    /** @type {string[]} */
    eventLog = [];
    /** @type {string} */
    lastCompletedActionKey = '';
    /** @type {Set<string>} */
    persistentSeenCells = new Set();
    /** @type {boolean} */
    debugFullVision = false;

    /** @param {MissionMap} missionMap */
    constructor(missionMap) {
        this.missionMap = missionMap;
    }

    setupLevel() {
        this.missionSeed = this.computeMissionSeed(this.runSeed, this.missionIndex);
        this.setupMissionFromCurrentSeeds();
        this.timeline = [];
        this.timelineTick = 0;
        this.timelineTurn = 1;
        this.replayMode = false;
        this.mariaRequests = [];
        this.randyPath = [];
        this.randyReplayScriptByTurn = new Map();
        this.obligationObjectives = [];
        this.anomalyCount = 0;
        this.eventLog = [];
        this.escapedScientistIds.clear();
        this.scientistPreviousPositions.clear();
        this.scientistFleeStallTurns.clear();
        this.scientistPassiveWaitTurns.clear();
    }

    setupMissionFromCurrentSeeds() {
        this.missionMap.setupLevel(this.missionSeed);
        this.initializeCharacterState();
        this.setActivePlayerById('randy', false);
        this.hostilityEscalated = false;
        this.hostilityReason = '';
        for (const playerCharacter of this.missionMap.playerCharacters) {
            if (![...playerCharacter.actions].some((action) => action instanceof Rifle)) {
                playerCharacter.addAction(Rifle.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof ArrestAction)) {
                playerCharacter.addAction(ArrestAction.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof StealthTakedownAction)) {
                playerCharacter.addAction(StealthTakedownAction.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof DecoyAction)) {
                playerCharacter.addAction(DecoyAction.a());
            }
        }
        const player = this.getActivePlayer();
        if (!player) return;
        player.updateFoV(this.missionMap);
        this.applyPersistentSeenToMap();
        this.rememberSeenFromCurrentMap();
        this.missionMap.updateCharacterVisibility(true);
        this.activePlayerAction = null;
        this.activePlayerActionData = null;
        this.selectorCells = [];
        this.selectorIndex = -1;
        this.initializeObjectives();
        this.missionStatus = 'active';
        this.message = `Mission started (run:${this.runSeed}, mission:${this.missionIndex}, seed:${this.missionSeed})`;
        this.updateMissionOutcome();
        this.applyVisibilityMode();
        this.ensureReplayGhostVisible();
    }

    initializeCharacterState() {
        this.characterState = new Map();
        for (const character of this.missionMap.playerCharacters) {
            const data = new CharacterStateData(character, 'player');
            data.behaviorState = character.state === 'dead' ? 'dead' : 'patrol';
            data.awarenessState = 'engaging';
            this.characterState.set(character.id, data);
        }
        for (const enemy of this.missionMap.enemies) {
            const role = this.isScientistId(enemy.id) ? 'target' : 'enemy';
            const data = new CharacterStateData(enemy, role);
            if (enemy.state === 'dead') {
                data.behaviorState = 'dead';
                data.awarenessState = 'unaware';
            } else if (role === 'target') {
                data.behaviorState = 'passive';
                data.resumeBehaviorState = 'passive';
                data.awarenessState = 'unaware';
                this.scientistPassiveWaitTurns.set(enemy.id, 2 + ((enemy.id.length + this.missionSeed) % 4));
            } else {
                data.behaviorState = 'patrol';
                data.awarenessState = 'unaware';
            }
            this.characterState.set(enemy.id, data);
        }
        this.applyCharacterStateToMap();
    }

    syncCharacterStateFromMap() {
        for (const character of this.missionMap.characters) {
            const data = this.characterState.get(character.id);
            if (!data) continue;
            const prevHealth = data.healthPoints;
            const prevSuppression = data.suppressionPoints;
            data.gridPosition = character.gpos.add([0, 0]);
            data.actionsRemaining = character.actionsThisTurn;
            data.movementBlockedCount = character.movementBlockedCount;
            data.patrolRoute = character.patrolRoute.map((pos) => pos.add([0, 0]));
            data.patrolTarget = character.patrolTarget;
            data.suppressionPoints = character.suppressionLevel;
            data.isSuppressed = data.suppressionPoints >= 2;
            data.suppressibility = character.suppressibility;
            data.healthPoints = character.health;
            if (data.role !== 'player') {
                const tookDamage = data.healthPoints < prevHealth;
                const tookIncomingFire = data.suppressionPoints > prevSuppression + 0.5;
                if (tookDamage || tookIncomingFire) {
                    data.recentlyAttackedTtl = 3;
                    this.hostilityEscalated = true;
                    if (!this.hostilityReason) {
                        this.hostilityReason = tookDamage ? `${character.id} was hit` : `${character.id} took incoming fire`;
                    }
                } else if (data.recentlyAttackedTtl > 0) {
                    data.recentlyAttackedTtl--;
                }
            }
            if (character.state === 'dead') {
                data.priorBehaviorState = data.behaviorState;
                data.behaviorState = 'dead';
                data.casualtyState = 'dead';
                data.awarenessState = 'unaware';
                if (this.isScientistId(character.id)) {
                    this.scientistPreviousPositions.delete(character.id);
                    this.scientistFleeStallTurns.delete(character.id);
                    this.scientistPassiveWaitTurns.delete(character.id);
                }
            } else if (character.state === 'surrendering') {
                data.priorBehaviorState = data.behaviorState;
                data.behaviorState = 'surrendering';
                data.casualtyState = 'detained';
                if (this.isScientistId(character.id)) {
                    this.escapedScientistIds.delete(character.id);
                    this.scientistPreviousPositions.delete(character.id);
                    this.scientistFleeStallTurns.delete(character.id);
                    this.scientistPassiveWaitTurns.delete(character.id);
                }
            } else if (character.state === 'unconscious') {
                data.priorBehaviorState = data.behaviorState;
                data.behaviorState = 'unaware';
                data.casualtyState = 'unconscious';
                data.awarenessState = 'unaware';
                data.actionsRemaining = 0;
                if (this.isScientistId(character.id)) {
                    this.scientistPreviousPositions.delete(character.id);
                    this.scientistFleeStallTurns.delete(character.id);
                    this.scientistPassiveWaitTurns.delete(character.id);
                }
            } else if (data.casualtyState === 'dead' || data.casualtyState === 'detained') {
                data.casualtyState = 'combatEffective';
            }
        }
    }

    applyCharacterStateToMap() {
        for (const character of this.missionMap.characters) {
            const data = this.characterState.get(character.id);
            if (!data) continue;
            character.actionsThisTurn = data.actionsRemaining;
            character.movementBlockedCount = data.movementBlockedCount;
            character.suppressed = data.isSuppressed;
            character.suppressionLevel = data.suppressionPoints;
            character.suppressibility = data.suppressibility;
            character.patrolRoute = data.patrolRoute.map((pos) => pos.add([0, 0]));
            character.patrolTarget = data.patrolTarget;
            if (data.casualtyState === 'unconscious') {
                character.state = 'unconscious';
            } else {
                character.state = this.toCharacterWidgetState(data.behaviorState);
            }
        }
    }

    /**
     * @param {CharacterBehaviorState} behaviorState
     * @returns {import('./character.js').CharacterStates}
     */
    toCharacterWidgetState(behaviorState) {
        if (behaviorState === 'dead') return 'dead';
        if (behaviorState === 'surrendering') return 'surrendering';
        return 'patrolling';
    }

    updateTacticalStateFromMap() {
        const coverLayer = this.missionMap.metaTileMap.layer[MetaLayers.cover];
        for (const character of this.missionMap.characters) {
            const data = this.characterState.get(character.id);
            if (!data) continue;
            data.hasCover = coverLayer.get(character.gpos) > 0;
            data.isSuppressed = data.suppressionPoints >= 2;
            if (data.casualtyState === 'dead' || data.casualtyState === 'detained') {
                data.actionsRemaining = 0;
            } else if (data.posture === 'prone' || data.isSuppressed) {
                data.actionsRemaining = Math.min(data.actionsRemaining, 1);
            }
        }
    }

    decaySuppression() {
        for (const data of this.characterState.values()) {
            if (data.casualtyState === 'dead' || data.casualtyState === 'detained') continue;
            const decay = data.hasCover ? 2 : 1;
            data.suppressionPoints = Math.max(0, data.suppressionPoints - decay);
            data.isSuppressed = data.suppressionPoints >= 2;
        }
    }

    advanceTransientSignals() {
        this.missionMap.soundEvents = this.missionMap.soundEvents
            .map((event) => ({ ...event, ttl: event.ttl - 1 }))
            .filter((event) => event.ttl > 0);
        this.missionMap.decoyEvents = this.missionMap.decoyEvents
            .map((event) => ({ ...event, ttl: event.ttl - 1 }))
            .filter((event) => event.ttl > 0);
        this.missionMap.attackEvents = this.missionMap.attackEvents
            .map((event) => ({ ...event, ttl: event.ttl - 1 }))
            .filter((event) => event.ttl > 0);
    }

    /**
     * @param {CharacterAwarenessState} awareness
     * @returns {number}
     */
    awarenessRank(awareness) {
        if (awareness === 'engaging') return 3;
        if (awareness === 'investigating') return 2;
        if (awareness === 'aware') return 1;
        return 0;
    }

    /**
     * @param {CharacterAwarenessState} current
     * @param {CharacterAwarenessState} incoming
     * @returns {CharacterAwarenessState}
     */
    maxAwareness(current, incoming) {
        return this.awarenessRank(incoming) > this.awarenessRank(current) ? incoming : current;
    }

    /**
     * @param {string} id
     * @returns {boolean}
     */
    isScientistId(id) {
        return this.scientistIds.includes(id) || id.startsWith('scientist');
    }

    /**
     * @param {string} id
     * @returns {boolean}
     */
    isGuardId(id) {
        return this.guardIds.includes(id) || id.startsWith('guard');
    }

    /**
     * @param {Character} enemy
     * @param {CharacterStateData} data
     * @returns {number}
     */
    getPerceptionCoverDistance(enemy, data) {
        if (this.isScientistId(enemy.id) || data.role === 'target') return 2.5;
        if (this.isGuardId(enemy.id)) return 5;
        return 3;
    }

    /**
     * @param {Character} enemy
     * @param {CharacterStateData} data
     * @returns {'aggressive'|'defensive'|'hesitant'}
     */
    getEnemyAggressionProfile(enemy, data) {
        if (data.role === 'target') return 'hesitant';
        if (enemy.id === 'guard1' || enemy.id === 'guard2') return 'aggressive';
        if (enemy.id === 'guard6') return 'hesitant';
        return 'defensive';
    }

    /**
     * @param {Character} enemy
     * @param {CharacterStateData} data
     * @param {number} distanceToPlayer
     * @returns {boolean}
     */
    canEnemyEscalateToEngage(enemy, data, distanceToPlayer = Number.POSITIVE_INFINITY) {
        const profile = this.getEnemyAggressionProfile(enemy, data);
        const immediateThreat = distanceToPlayer <= 2.25;
        if (profile === 'aggressive') {
            return this.hostilityEscalated || data.recentlyAttackedTtl > 0 || data.awarenessState === 'engaging' || immediateThreat;
        }
        if (profile === 'defensive') {
            return this.hostilityEscalated || data.recentlyAttackedTtl > 0 || immediateThreat;
        }
        return this.hostilityEscalated || data.recentlyAttackedTtl > 0 || (data.awarenessState === 'engaging' && immediateThreat);
    }

    /**
     * Enemy sight must respect facing so targets in the rear arc are not instantly seen.
     * @param {Character} enemy
     * @param {Character} target
     * @param {CharacterStateData} data
     * @returns {boolean}
     */
    enemyFacingAllowsSight(enemy, target, data) {
        if (enemy.facing === Facing.none) return true;
        const delta = target.gpos.sub(enemy.gpos);
        const dist = delta.mag();
        if (dist <= 0.001) return true;
        const fvec = FacingVec[enemy.facing];
        const forward = (delta[0] * fvec[0] + delta[1] * fvec[1]) / dist;
        if (data.behaviorState === 'engage') {
            return forward >= -0.25;
        }
        if (data.behaviorState === 'investigate' || data.awarenessState === 'investigating' || data.awarenessState === 'engaging') {
            return forward >= 0;
        }
        return forward >= 0.2;
    }

    updateAwarenessStateFromPerception() {
        const communicatingEnemies = this.missionMap.enemies
            .filter((enemy) => {
                const data = this.characterState.get(enemy.id);
                if (!data) return false;
                return data.awarenessState === 'investigating' || data.awarenessState === 'engaging';
            });
        for (const enemy of this.missionMap.enemies) {
            const data = this.characterState.get(enemy.id);
            if (!data) continue;
            if (data.behaviorState === 'dead' || data.behaviorState === 'surrendering' || data.casualtyState === 'unconscious') continue;
            const isScientist = this.isScientistId(enemy.id) || data.role === 'target';
            const visiblePlayers = this.missionMap.playerCharacters
                .filter((player) => player.state !== 'dead')
                .map((player) => {
                    const playerData = this.characterState.get(player.id);
                    const rawCanSeePlayer = enemy.canSee(player, this.missionMap) && this.enemyFacingAllowsSight(enemy, player, data);
                    const distToPlayer = enemy.gpos.dist(player.gpos);
                    const coverSightLimit = this.getPerceptionCoverDistance(enemy, data);
                    const canSeePlayer = rawCanSeePlayer && !(playerData?.hasCover && distToPlayer > coverSightLimit);
                    return { player, distToPlayer, canSeePlayer };
                })
                .filter((entry) => entry.canSeePlayer)
                .sort((a, b) => a.distToPlayer - b.distToPlayer);
            const seenPlayer = visiblePlayers.length > 0 ? visiblePlayers[0] : null;
            const heardSoundEvents = this.missionMap.soundEvents
                .filter((event) => event.source !== enemy.id && event.position.dist(enemy.gpos) <= event.radius)
                .sort((a, b) => a.position.dist(enemy.gpos) - b.position.dist(enemy.gpos));
            const heardGunfireEvents = heardSoundEvents.filter((event) => event.source.endsWith(':gunfire'));
            const heardNearbySoundEvents = heardSoundEvents.filter((event) => event.position.dist(enemy.gpos) <= 3.25);
            const heardSound = heardGunfireEvents.length > 0 || (isScientist ? heardNearbySoundEvents.length > 0 : heardSoundEvents.length > 0);
            const noticedDecoyEvents = this.missionMap.decoyEvents
                .filter((event) => event.source !== enemy.id && event.position.dist(enemy.gpos) <= event.radius)
                .sort((a, b) => a.position.dist(enemy.gpos) - b.position.dist(enemy.gpos));
            const noticedDecoy = isScientist ? false : noticedDecoyEvents.length > 0;
            const allyCommunicated = communicatingEnemies.some((ally) => ally !== enemy && ally.gpos.dist(enemy.gpos) <= 8);
            let nextAwareness = data.awarenessState;
            const engageSightDistance = isScientist ? 2.2 : 5;
            if (seenPlayer && seenPlayer.distToPlayer <= engageSightDistance) {
                nextAwareness = isScientist ? 'investigating' : 'engaging';
                data.awarenessCooldown = 2;
                data.lastKnownThreatPos = seenPlayer.player.gpos.add([0, 0]);
                data.lastKnownThreatTtl = 4;
            } else if (seenPlayer || heardSound) {
                nextAwareness = this.maxAwareness(nextAwareness, 'investigating');
                data.awarenessCooldown = 2;
                if (seenPlayer) {
                    data.lastKnownThreatPos = seenPlayer.player.gpos.add([0, 0]);
                    data.lastKnownThreatTtl = 4;
                } else if (heardSound) {
                    const sourceSound = heardGunfireEvents[0] ?? (isScientist ? heardNearbySoundEvents[0] : heardSoundEvents[0]);
                    if (sourceSound) {
                        data.lastKnownThreatPos = sourceSound.position.add([0, 0]);
                        data.lastKnownThreatTtl = Math.max(2, sourceSound.ttl);
                    }
                }
            } else if (noticedDecoy) {
                nextAwareness = this.maxAwareness(nextAwareness, 'aware');
                data.awarenessCooldown = Math.max(data.awarenessCooldown, 1);
                data.lastKnownThreatPos = noticedDecoyEvents[0].position.add([0, 0]);
                data.lastKnownThreatTtl = Math.max(2, noticedDecoyEvents[0].ttl);
            } else if (!isScientist && allyCommunicated) {
                nextAwareness = this.maxAwareness(nextAwareness, 'aware');
                data.awarenessCooldown = Math.max(data.awarenessCooldown, 1);
            } else if (data.awarenessCooldown > 0) {
                data.awarenessCooldown--;
            } else if (data.awarenessState === 'engaging') {
                nextAwareness = 'investigating';
            } else if (data.awarenessState === 'investigating') {
                nextAwareness = isScientist ? 'unaware' : 'aware';
            } else if (data.awarenessState === 'aware') {
                nextAwareness = 'unaware';
            }
            if (!seenPlayer && !heardSound && !noticedDecoy) {
                data.lastKnownThreatTtl = Math.max(0, data.lastKnownThreatTtl - 1);
                if (data.lastKnownThreatTtl === 0) {
                    data.lastKnownThreatPos = null;
                }
            }
            data.awarenessState = nextAwareness;
        }
    }

    updateEnemyBehaviorStateFromPerception() {
        for (const enemy of this.missionMap.enemies) {
            const data = this.characterState.get(enemy.id);
            if (!data) continue;
            if (data.behaviorState === 'dead' || data.behaviorState === 'surrendering') continue;
            const visiblePlayers = this.missionMap.playerCharacters
                .filter((player) => player.state !== 'dead')
                .map((player) => {
                    const playerData = this.characterState.get(player.id);
                    const distance = enemy.gpos.dist(player.gpos);
                    const rawCanSee = enemy.canSee(player, this.missionMap) && this.enemyFacingAllowsSight(enemy, player, data);
                    const coverSightLimit = this.getPerceptionCoverDistance(enemy, data);
                    const canSeePlayer = rawCanSee && !(playerData?.hasCover && distance > coverSightLimit);
                    return { player, canSeePlayer, distance };
                })
                .filter((entry) => entry.canSeePlayer)
                .sort((a, b) => a.distance - b.distance);
            const seenPlayer = visiblePlayers.length > 0 ? visiblePlayers[0] : null;
            let nextState = data.behaviorState;
            if (seenPlayer) {
                data.lastKnownThreatPos = seenPlayer.player.gpos.add([0, 0]);
                data.lastKnownThreatTtl = 4;
            }
            if (data.role === 'target') {
                if (enemy.state === 'fleeing' || this.escapedScientistIds.has(enemy.id)) {
                    nextState = 'fleeing';
                } else if (data.recentlyAttackedTtl > 0 || data.suppressionPoints >= 1.2) {
                    nextState = 'fleeing';
                } else if (seenPlayer && seenPlayer.distance <= 1.75) {
                    nextState = 'comply';
                } else if ((seenPlayer || data.awarenessState === 'investigating' || data.awarenessState === 'engaging')
                    && data.lastKnownThreatPos
                    && data.lastKnownThreatTtl > 0) {
                    nextState = 'investigate';
                } else if (data.behaviorState === 'comply') {
                    nextState = seenPlayer && seenPlayer.distance <= 3 ? 'comply' : 'passive';
                } else if (data.behaviorState === 'fleeing') {
                    nextState = data.awarenessState === 'unaware' ? 'passive' : 'investigate';
                } else {
                    nextState = 'passive';
                }
            } else {
                if (((seenPlayer && seenPlayer.distance <= 5 && !data.isSuppressed) || data.awarenessState === 'engaging')
                    && this.canEnemyEscalateToEngage(enemy, data, seenPlayer?.distance ?? Number.POSITIVE_INFINITY)) {
                    nextState = 'engage';
                } else if ((seenPlayer || data.awarenessState === 'investigating')
                    && data.lastKnownThreatPos
                    && data.lastKnownThreatTtl > 0) {
                    nextState = 'investigate';
                } else if (data.behaviorState === 'investigate' || data.behaviorState === 'engage' || data.lastKnownThreatTtl === 0) {
                    nextState = 'patrol';
                }
            }
            if (nextState !== data.behaviorState) {
                data.priorBehaviorState = data.behaviorState;
                data.behaviorState = nextState;
            }
        }
    }

    initializeObjectives() {
        this.objectives = [
            { id: 'arrestScientists', text: 'Arrest all 4 scientists', state: 'pending' },
            { id: 'protectScientists', text: 'No scientist may be killed by gunfire', state: 'pending' },
            { id: 'preventScientistEscape', text: 'Do not let all 4 scientists escape', state: 'pending' },
        ];
    }

    /**
     * @param {string} id
     * @param {boolean=} refreshVision
     * @returns {PlayerCharacter|null}
     */
    setActivePlayerById(id, refreshVision = true) {
        const visibleLayer = this.missionMap.metaTileMap.layer[MetaLayers.visible];
        let selected = null;
        for (const player of this.missionMap.playerCharacters) {
            const isActive = player.id === id && player.state !== 'dead' && player.health > 0;
            player.activeCharacter = isActive;
            if (isActive) selected = player;
        }
        if (!selected) {
            selected = this.missionMap.playerCharacters.find((player) => player.state !== 'dead' && player.health > 0) ?? null;
            if (selected) selected.activeCharacter = true;
        }
        this.missionMap.activeCharacter = selected;
        if (selected) {
            selected._visibleLayer = visibleLayer;
            if (refreshVision) {
                selected.updateFoV(this.missionMap);
                this.missionMap.updateCharacterVisibility(true);
            }
        }
        if (this.debugFullVision) {
            this.applyVisibilityMode();
        }
        return selected;
    }

    applyVisibilityMode() {
        const seenLayer = this.missionMap.metaTileMap.layer[MetaLayers.seen];
        const visibleLayer = this.missionMap.metaTileMap.layer[MetaLayers.visible];
        if (!seenLayer || !visibleLayer) return;
        if (this.debugFullVision) {
            seenLayer.fill(1);
            visibleLayer.fill(1);
            const active = this.getActivePlayer();
            if (active) {
                active._visibleLayer = visibleLayer;
            }
            this.missionMap.updateCharacterVisibility(true);
            this.missionMap.tileMap.clearCache();
            return;
        }
        seenLayer.fill(0);
        visibleLayer.fill(0);
        const active = this.getActivePlayer();
        if (active) {
            active._visibleLayer = visibleLayer;
            active.updateFoV(this.missionMap);
        }
        this.applyPersistentSeenToMap();
        this.missionMap.updateCharacterVisibility(true);
        this.missionMap.tileMap.clearCache();
    }

    toggleFullVision() {
        this.debugFullVision = !this.debugFullVision;
        this.applyVisibilityMode();
        this.message = this.debugFullVision
            ? 'Full-map vision enabled.'
            : 'Full-map vision disabled.';
        this.addLog(this.message);
    }

    rememberSeenFromCurrentMap() {
        if (this.debugFullVision) return;
        const seenLayer = this.missionMap.metaTileMap.layer[MetaLayers.seen];
        if (!seenLayer) return;
        for (const pos of seenLayer.iterAll()) {
            if (seenLayer.get(pos) > 0) {
                this.persistentSeenCells.add(`${pos[0]},${pos[1]}`);
            }
        }
    }

    applyPersistentSeenToMap() {
        if (this.persistentSeenCells.size === 0) return;
        const seenLayer = this.missionMap.metaTileMap.layer[MetaLayers.seen];
        if (!seenLayer) return;
        for (const key of this.persistentSeenCells) {
            const [sx, sy] = key.split(',').map((value) => Number.parseInt(value, 10));
            if (Number.isNaN(sx) || Number.isNaN(sy)) continue;
            if (sx < 0 || sy < 0 || sx >= this.missionMap.w || sy >= this.missionMap.h) continue;
            this.missionMap.metaTileMap.setInLayer(MetaLayers.seen, [sx, sy], 1);
        }
        this.missionMap.tileMap.clearCache();
    }

    snapshotRandyPathFromTimeline() {
        const randyEvents = this.timeline
            .filter((event) => event.result === 'applied' && event.actorId === 'randy' && event.actorPos !== null);
        /** @type {Map<number, import('eskv/lib/eskv.js').VecLike>} */
        const byTurn = new Map();
        for (const event of randyEvents) {
            if (!event.actorPos) continue;
            byTurn.set(event.turn, [event.actorPos[0], event.actorPos[1]]);
        }
        this.randyPath = [...byTurn.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([turn, position]) => ({ turn, position }));
    }

    /**
     * @param {GameIntent} intent
     * @returns {GameIntent|null}
     */
    cloneReplayableRandyIntent(intent) {
        if (intent.type === 'move') {
            return { type: 'move', direction: intent.direction };
        }
        if (intent.type === 'rest') {
            return { type: 'rest' };
        }
        if (intent.type === 'startActionFromKey') {
            return { type: 'startActionFromKey', key: intent.key };
        }
        if (intent.type === 'moveSelection') {
            return { type: 'moveSelection', direction: intent.direction };
        }
        if (intent.type === 'confirmSelection') {
            return { type: 'confirmSelection' };
        }
        if (intent.type === 'cancelSelection') {
            return { type: 'cancelSelection' };
        }
        return null;
    }

    buildRandyReplayScriptFromTimeline() {
        /** @type {Map<number, {tick:number, intent:GameIntent}[]>} */
        const byTurn = new Map();
        const randyEvents = this.timeline
            .filter((event) => event.result === 'applied' && event.actorId === 'randy')
            .sort((a, b) => a.turn - b.turn || a.tick - b.tick);
        for (const event of randyEvents) {
            const replayIntent = this.cloneReplayableRandyIntent(event.intent);
            if (!replayIntent) continue;
            if (!byTurn.has(event.turn)) byTurn.set(event.turn, []);
            byTurn.get(event.turn)?.push({ tick: event.tick, intent: replayIntent });
        }
        this.randyReplayScriptByTurn = new Map(
            [...byTurn.entries()].map(([turn, entries]) => [
                turn,
                entries
                    .sort((a, b) => a.tick - b.tick)
                    .map((entry) => entry.intent),
            ]),
        );
    }

    buildMariaRequestsFromTimeline() {
        this.mariaRequests = this.timeline
            .filter((event) => event.result === 'applied' && event.actorId === 'randy' && event.intent.type === 'requestActionFromKey' && event.actorPos !== null)
            .map((event) => {
                const requestIntent = /** @type {{type:'requestActionFromKey', key:string}} */ (event.intent);
                const key = this.normalizeRequestKey(requestIntent.key);
                return {
                    turn: event.turn,
                    key,
                    sourcePos: [event.actorPos[0], event.actorPos[1]],
                    fulfilled: false,
                    fulfilledTick: null,
                    label: this.describeRequestKey(key),
                };
            })
            .filter((request) => this.isSupportedRequestKey(request.key));
    }

    snapshotObligationObjectivesFromRequests() {
        this.obligationObjectives = this.mariaRequests.map((request, index) => ({
            turn: request.turn,
            tick: request.fulfilledTick ?? index,
            actorId: 'maria',
            position: [request.sourcePos[0], request.sourcePos[1]],
            label: `${this.requestMarkerLabel(request.key)} T${request.turn}`,
        })).sort((a, b) => a.turn - b.turn || a.tick - b.tick);
    }

    /**
     * @returns {import('eskv/lib/eskv.js').VecLike | null}
     */
    getRandyEchoForCurrentTurn() {
        if (this.randyPath.length === 0) return null;
        let candidate = null;
        for (const step of this.randyPath) {
            if (step.turn <= this.timelineTurn) {
                candidate = step;
            } else {
                break;
            }
        }
        if (!candidate) candidate = this.randyPath[0];
        return candidate.position;
    }

    /**
     * @param {string} key
     * @returns {string}
     */
    normalizeRequestKey(key) {
        if (key === 'space') return ' ';
        if (key.length === 1) return key.toLowerCase();
        return key.toLowerCase();
    }

    /**
     * @param {string} key
     * @returns {string}
     */
    requestMarkerLabel(key) {
        if (key === 'f') return 'FIRE';
        if (key === 'g') return 'ARREST';
        if (key === 't') return 'TAKE';
        if (key === 'c') return 'DECOY';
        return key.toUpperCase();
    }

    /**
     * @param {string} key
     * @returns {string}
     */
    describeRequestKey(key) {
        if (key === 'f') return 'fire rifle';
        if (key === 'g') return 'arrest';
        if (key === 't') return 'stealth takedown';
        if (key === 'c') return 'deploy decoy';
        return `action ${key}`;
    }

    /**
     * @param {string} key
     * @returns {boolean}
     */
    isSupportedRequestKey(key) {
        return key === 'f' || key === 'g' || key === 't' || key === 'c';
    }

    /**
     * @param {GameIntent} intent
     * @returns {string|null}
     */
    intentToPerformedKey(intent) {
        if (intent.type === 'move' || intent.type === 'rest') return null;
        if (intent.type === 'startActionFromKey') return this.lastCompletedActionKey || null;
        if (intent.type === 'confirmSelection') return this.lastCompletedActionKey || null;
        return null;
    }

    /**
     * @param {string} entry
     */
    addLog(entry) {
        const line = `T${this.timelineTurn}#${this.timelineTick} ${entry}`;
        this.eventLog.push(line);
        if (this.eventLog.length > 80) {
            this.eventLog = this.eventLog.slice(this.eventLog.length - 80);
        }
    }

    ensureReplayGhostVisible() {
        if (!this.replayMode) return;
        const randy = this.missionMap.playerCharacters.find((player) => player.id === 'randy');
        if (!randy) return;
        randy.visibleToPlayer = true;
    }

    /**
     * @param {import('eskv/lib/eskv.js').Vec2[]} cells
     * @param {number} index
     * @param {import('eskv/lib/eskv.js').Vec2} direction
     * @returns {number}
     */
    advanceSelectionIndex(cells, index, direction) {
        if (cells.length === 0 || index < 0) return -1;
        const activePos = cells[index];
        let maxDist = 0;
        let minDist = Number.POSITIVE_INFINITY;
        let minDistIndex = -1;
        let maxDistIndex = index;
        for (let i = 0; i < cells.length; i++) {
            const pos = cells[i];
            const delta = pos.sub(activePos);
            const dist = delta.mul(direction).sum() + direction.abs().scale(-1).add([1, 1]).mul(delta).sum();
            if (dist > 0 && dist < minDist) {
                minDist = dist;
                minDistIndex = i;
            }
            if (dist < 0 && dist < maxDist) {
                maxDist = dist;
                maxDistIndex = i;
            }
        }
        return minDistIndex >= 0 ? minDistIndex : maxDistIndex;
    }

    /**
     * @param {number} turn
     */
    runRandyReplayTurn(turn) {
        if (!this.replayMode) return;
        const scriptedIntents = this.randyReplayScriptByTurn.get(turn) ?? [];
        if (scriptedIntents.length === 0) return;
        const randy = this.missionMap.playerCharacters.find((player) => player.id === 'randy');
        if (!randy || randy.state === 'dead' || randy.health <= 0) return;
        randy.updateFoV(this.missionMap);
        /** @type {import('./action.js').ActionItem|null} */
        let replayAction = null;
        /** @type {import('./action.js').ActionResponseData|null} */
        let replayActionData = null;
        /** @type {import('eskv/lib/eskv.js').Vec2[]} */
        let replaySelectorCells = [];
        let replaySelectorIndex = -1;

        for (const intent of scriptedIntents) {
            if (intent.type === 'move') {
                if (randy.actionsThisTurn <= 0) continue;
                const apBefore = randy.actionsThisTurn;
                randy.move(intent.direction, this.missionMap);
                if (randy.actionsThisTurn === apBefore) {
                    randy.actionsThisTurn = Math.max(0, randy.actionsThisTurn - 1);
                }
                randy.updateFoV(this.missionMap);
                continue;
            }
            if (intent.type === 'rest') {
                if (randy.actionsThisTurn <= 0) continue;
                randy.rest(this.missionMap);
                randy.updateFoV(this.missionMap);
                continue;
            }
            if (intent.type === 'startActionFromKey') {
                if (randy.actionsThisTurn <= 0) continue;
                const action = randy.getActionForKey(intent.key);
                if (!action) {
                    replayAction = null;
                    replayActionData = null;
                    replaySelectorCells = [];
                    replaySelectorIndex = -1;
                    continue;
                }
                const response = randy.takeAction(action, this.missionMap);
                if (response.result === 'infoNeeded') {
                    replayAction = action;
                    replayActionData = response;
                    replaySelectorCells = response.validTargetCharacters
                        ? response.validTargetCharacters.map((target) => target.gpos)
                        : (response.validTargetPositions ?? []);
                    replaySelectorIndex = replaySelectorCells.length > 0 ? 0 : -1;
                } else {
                    replayAction = null;
                    replayActionData = null;
                    replaySelectorCells = [];
                    replaySelectorIndex = -1;
                }
                randy.updateFoV(this.missionMap);
                continue;
            }
            if (intent.type === 'moveSelection') {
                replaySelectorIndex = this.advanceSelectionIndex(replaySelectorCells, replaySelectorIndex, FacingVec[intent.direction]);
                continue;
            }
            if (intent.type === 'confirmSelection') {
                if (randy.actionsThisTurn <= 0) continue;
                if (!replayAction || !replayActionData || replaySelectorIndex < 0) {
                    replayAction = null;
                    replayActionData = null;
                    replaySelectorCells = [];
                    replaySelectorIndex = -1;
                    continue;
                }
                if (replayActionData.validTargetCharacters && replayActionData.validTargetCharacters.length > 0) {
                    replayActionData.targetCharacter = replayActionData.validTargetCharacters[replaySelectorIndex];
                } else if (replayActionData.validTargetPositions && replayActionData.validTargetPositions.length > 0) {
                    replayActionData.targetPosition = replayActionData.validTargetPositions[replaySelectorIndex];
                }
                const response = randy.takeAction(replayAction, this.missionMap, replayActionData);
                if (response.result === 'infoNeeded') {
                    replayActionData = response;
                    replaySelectorCells = response.validTargetCharacters
                        ? response.validTargetCharacters.map((target) => target.gpos)
                        : (response.validTargetPositions ?? []);
                    replaySelectorIndex = replaySelectorCells.length > 0 ? 0 : -1;
                } else {
                    replayAction = null;
                    replayActionData = null;
                    replaySelectorCells = [];
                    replaySelectorIndex = -1;
                }
                randy.updateFoV(this.missionMap);
                continue;
            }
            if (intent.type === 'cancelSelection') {
                replayAction = null;
                replayActionData = null;
                replaySelectorCells = [];
                replaySelectorIndex = -1;
            }
        }
        randy.actionsThisTurn = 0;
    }

    /**
     * @param {number} turn
     */
    finalizeMariaTurnObligations(turn) {
        if (!this.replayMode) return;
        const missed = this.mariaRequests.filter((request) => !request.fulfilled && request.turn === turn);
        if (missed.length === 0) return;
        this.anomalyCount += missed.length;
        this.missionStatus = 'failure';
        this.message = `Mission failure: missed ${missed.length} Maria request(s) on T${turn}.`;
        this.addLog(`ANOMALY +${missed.length} (missed requests on T${turn})`);
    }

    /**
     * @param {GameIntent} intent
     * @param {number} turn
     * @param {number} tick
     */
    applyReplayObligationResult(intent, turn, tick) {
        if (!this.replayMode) return;
        const player = this.getActivePlayer();
        if (!player || player.id !== 'maria') return;
        const performedKey = this.intentToPerformedKey(intent);
        if (!performedKey) return;
        const request = this.mariaRequests.find((candidate) => !candidate.fulfilled && candidate.turn === turn && candidate.key === performedKey);
        if (request) {
            request.fulfilled = true;
            request.fulfilledTick = tick;
            this.addLog(`Maria fulfilled request: ${request.label} (T${request.turn})`);
            return;
        }
        this.anomalyCount++;
        this.message = `${this.message} [Anomaly +1: unrequested Maria action '${performedKey}']`;
        this.addLog(`ANOMALY +1 (unrequested Maria action '${performedKey}' on T${turn})`);
    }

    /** @returns {PlayerCharacter | null} */
    getActivePlayer() {
        const active = this.missionMap.activeCharacter;
        if (!(active instanceof PlayerCharacter)) return null;
        if (active.state === 'dead' || active.health <= 0) return null;
        return active;
    }

    /**
     * @param {boolean=} refreshVision
     * @returns {PlayerCharacter | null}
     */
    ensureControllableActivePlayer(refreshVision = true) {
        const current = this.getActivePlayer();
        if (current) return current;
        const fallback = this.missionMap.playerCharacters.find((player) => player.state !== 'dead' && player.health > 0) ?? null;
        for (const player of this.missionMap.playerCharacters) {
            player.activeCharacter = fallback === player;
        }
        this.missionMap.activeCharacter = fallback;
        if (fallback && refreshVision) {
            fallback.updateFoV(this.missionMap);
            this.missionMap.updateCharacterVisibility(true);
        }
        return fallback;
    }

    /** @returns {boolean} */
    isAwaitingSelection() {
        return this.activePlayerAction !== null;
    }

    /** @param {GameIntent} intent */
    dispatchIntent(intent) {
        if (intent.type === 'rewindToTick') {
            this.rewindToTick(intent.tick);
            return;
        }
        if (intent.type === 'startObligationLoop') {
            this.startObligationLoop();
            return;
        }
        const controllable = this.ensureControllableActivePlayer();
        if (!controllable) {
            this.missionStatus = 'failure';
            this.message = 'Mission failure: no SWAT operators remain combat-effective.';
            this.recordTimelineEvent(intent, 'blocked', this.message, this.timelineTurn, this.timelineTick, null);
            this.addLog(this.message);
            return;
        }
        const eventTurn = this.timelineTurn;
        const eventTick = this.timelineTick;
        const eventActor = controllable;

        if (this.missionStatus === 'success' || this.missionStatus === 'failure') {
            this.message = 'Mission already resolved. Rewind or start next loop.';
            this.recordTimelineEvent(intent, 'blocked', this.message, eventTurn, eventTick, eventActor);
            this.addLog(this.message);
            return;
        }

        const result = this.applyIntent(intent);
        this.recordTimelineEvent(intent, result ? 'applied' : 'ignored', this.message, eventTurn, eventTick, eventActor);
        if (result) {
            this.applyReplayObligationResult(intent, eventTurn, eventTick);
            this.addLog(this.message);
        }
    }

    /**
     * @param {GameIntent} intent
     * @param {boolean=} suppressTimeline
     */
    applyIntent(intent, suppressTimeline = false) {
        const player = this.ensureControllableActivePlayer(false);
        if (!player) return false;

        let progressedTurn = false;
        let intentApplied = false;
        this.lastCompletedActionKey = '';

        if (!this.activePlayerAction) {
            switch (intent.type) {
                case 'move':
                    player.move(intent.direction, this.missionMap);
                    this.message = `${player.id} moved.`;
                    progressedTurn = true;
                    intentApplied = true;
                    break;
                case 'rest':
                    player.rest(this.missionMap);
                    this.message = `${player.id} paused.`;
                    progressedTurn = true;
                    intentApplied = true;
                    break;
                case 'startActionFromKey': {
                    const action = player.getActionForKey(intent.key);
                    if (!action) break;
                    const response = player.takeAction(action, this.missionMap);
                    this.handleActionResponse(action, response);
                    intentApplied = response.result !== 'notAvailable';
                    if (response.result === 'complete') {
                        progressedTurn = true;
                        this.lastCompletedActionKey = this.normalizeRequestKey(intent.key);
                    }
                    break;
                }
                case 'requestActionFromKey': {
                    const requestedKey = this.normalizeRequestKey(intent.key);
                    if (player.id !== 'randy' || this.replayMode) {
                        this.message = 'Only Randy can queue Maria requests before replay starts.';
                        break;
                    }
                    if (!this.isSupportedRequestKey(requestedKey)) {
                        this.message = `No Maria request mapping for '${intent.key}'.`;
                        break;
                    }
                    this.message = `Queued Maria request for T${this.timelineTurn}: ${this.describeRequestKey(requestedKey)}.`;
                    intentApplied = true;
                    break;
                }
                case 'debugRevealMap':
                    for (const p of this.missionMap.metaTileMap.layer[MetaLayers.seen].iterAll()) {
                        this.missionMap.metaTileMap.setInLayer(MetaLayers.seen, p, 1);
                        this.missionMap.tileMap.clearCache();
                    }
                    intentApplied = true;
                    break;
                default:
                    break;
            }
        } else {
            switch (intent.type) {
                case 'moveSelection':
                    this.moveSelection(FacingVec[intent.direction]);
                    intentApplied = true;
                    break;
                case 'confirmSelection':
                    progressedTurn = this.confirmSelection(player);
                    intentApplied = progressedTurn;
                    break;
                case 'cancelSelection':
                    this.clearSelectionState('Action canceled.');
                    intentApplied = true;
                    break;
                default:
                    break;
            }
        }

        if (progressedTurn) {
            this.resolveTurnProgression(player);
        }
        this.syncCharacterStateFromMap();
        this.updateTacticalStateFromMap();
        this.updateAwarenessStateFromPerception();
        this.updateEnemyBehaviorStateFromPerception();
        this.applyCharacterStateToMap();
        this.advanceTransientSignals();
        this.rememberSeenFromCurrentMap();
        if (this.replayMode) {
            this.applyPersistentSeenToMap();
        }
        this.applyVisibilityMode();
        this.ensureReplayGhostVisible();
        this.updateMissionOutcome();
        if (!suppressTimeline) {
            this.timelineTick++;
        }
        return intentApplied;
    }

    /**
     * @param {import('./action.js').ActionItem} action
     * @param {import('./action.js').ActionResponseData} response
     */
    handleActionResponse(action, response) {
        if (response.result === 'complete' || response.result === 'notAvailable' || response.result === 'invalid') {
            this.activePlayerAction = null;
            this.activePlayerActionData = null;
            this.selectorCells = [];
            this.selectorIndex = -1;
            this.message = response.message ?? 'unknown action response';
            return;
        }
        if (response.result === 'infoNeeded') {
            this.activePlayerAction = action;
            this.activePlayerActionData = response;
            this.selectorCells = response.validTargetCharacters
                ? response.validTargetCharacters.map((target) => target.gpos)
                : (response.validTargetPositions ?? []);
            this.selectorIndex = this.selectorCells.length > 0 ? 0 : -1;
            this.message = response.message ?? 'unknown action response';
        }
    }

    /**
     * @param {import('eskv/lib/eskv.js').Vec2} direction
     */
    moveSelection(direction) {
        if (this.selectorCells.length === 0 || this.selectorIndex < 0) return;
        const activePos = this.selectorCells[this.selectorIndex];
        let maxDist = 0;
        let minDist = Number.POSITIVE_INFINITY;
        let minDistIndex = -1;
        let maxDistIndex = this.selectorIndex;
        for (let i = 0; i < this.selectorCells.length; i++) {
            const pos = this.selectorCells[i];
            const delta = pos.sub(activePos);
            const dist = delta.mul(direction).sum() + direction.abs().scale(-1).add([1, 1]).mul(delta).sum();
            if (dist > 0 && dist < minDist) {
                minDist = dist;
                minDistIndex = i;
            }
            if (dist < 0 && dist < maxDist) {
                maxDist = dist;
                maxDistIndex = i;
            }
        }
        this.selectorIndex = minDistIndex >= 0 ? minDistIndex : maxDistIndex;
    }

    /** @param {PlayerCharacter} player */
    confirmSelection(player) {
        if (!this.activePlayerAction || !this.activePlayerActionData) return false;
        if (this.selectorIndex < 0) return false;
        const completedActionKey = this.activePlayerAction.keyControl ? this.normalizeRequestKey(this.activePlayerAction.keyControl) : '';
        const responseData = this.activePlayerActionData;
        if (responseData.validTargetCharacters && responseData.validTargetCharacters.length > 0) {
            responseData.targetCharacter = responseData.validTargetCharacters[this.selectorIndex];
        } else if (responseData.validTargetPositions && responseData.validTargetPositions.length > 0) {
            responseData.targetPosition = responseData.validTargetPositions[this.selectorIndex];
        }
        const response = player.takeAction(this.activePlayerAction, this.missionMap, responseData);
        this.handleActionResponse(this.activePlayerAction, response);
        if (response.result === 'complete') {
            this.lastCompletedActionKey = completedActionKey;
        }
        return response.result === 'complete';
    }

    /** @param {string} message */
    clearSelectionState(message) {
        this.activePlayerAction = null;
        this.activePlayerActionData = null;
        this.selectorCells = [];
        this.selectorIndex = -1;
        this.message = message;
    }

    /** @param {PlayerCharacter} player */
    resolveTurnProgression(player) {
        this.missionMap.updateCharacterVisibility();
        if (player.actionsThisTurn !== 0) return;
        const completedTurn = this.timelineTurn;
        this.syncCharacterStateFromMap();
        this.updateTacticalStateFromMap();
        this.decaySuppression();
        this.updateAwarenessStateFromPerception();
        this.updateEnemyBehaviorStateFromPerception();
        this.applyCharacterStateToMap();
        this.ensureReplayGhostVisible();

        if (this.replayMode && player.id === 'maria') {
            this.runRandyReplayTurn(completedTurn);
            this.syncCharacterStateFromMap();
            this.updateTacticalStateFromMap();
            this.updateAwarenessStateFromPerception();
            this.updateEnemyBehaviorStateFromPerception();
            this.applyCharacterStateToMap();
            this.ensureReplayGhostVisible();
        }

        for (const enemy of this.missionMap.enemies) {
            this.takeEnemyBehaviorTurn(enemy);
        }
        this.syncCharacterStateFromMap();
        this.updateTacticalStateFromMap();
        this.updateAwarenessStateFromPerception();
        this.updateEnemyBehaviorStateFromPerception();
        this.applyCharacterStateToMap();
        this.ensureReplayGhostVisible();
        this.advanceTransientSignals();
        player.actionsThisTurn = 2;
        const playerData = this.characterState.get(player.id);
        if (playerData) {
            playerData.actionsRemaining = 2;
        }
        if (this.replayMode && player.id === 'maria') {
            const randy = this.missionMap.playerCharacters.find((candidate) => candidate.id === 'randy');
            if (randy && randy.state !== 'dead' && randy.health > 0) {
                randy.actionsThisTurn = 2;
                const randyData = this.characterState.get(randy.id);
                if (randyData) randyData.actionsRemaining = 2;
            }
        }
        this.timelineTurn++;
        this.missionMap.updateCharacterVisibility(true);
        this.ensureReplayGhostVisible();
        if (player.id === 'maria') {
            this.finalizeMariaTurnObligations(completedTurn);
        }
    }

    /**
     * @param {Character} enemy
     */
    takeEnemyBehaviorTurn(enemy) {
        if (enemy.state === 'dead' || enemy.state === 'surrendering' || enemy.state === 'unconscious' || enemy.state === 'fleeing') return;
        const data = this.characterState.get(enemy.id);
        if (!data) {
            enemy.takeTurn(this.missionMap);
            return;
        }
        if (this.isScientistId(enemy.id) || data.role === 'target') {
            this.takeScientistTurn(enemy, data);
            return;
        }
        while (enemy.actionsThisTurn > 0) {
            const attackTarget = this.selectEnemyAttackTarget(enemy, data);
            if (attackTarget && this.tryEnemyAttack(enemy, attackTarget, data)) {
                continue;
            }
            const target = this.selectEnemyBehaviorTarget(enemy, data);
            if (!target) {
                enemy.rest(this.missionMap);
                continue;
            }
            if (!this.moveEnemyToward(enemy, target)) {
                enemy.rest(this.missionMap);
            }
        }
        enemy.actionsThisTurn = 2;
    }

    /**
     * @param {import('eskv/lib/eskv.js').Vec2} pos
     * @returns {number}
     */
    boundaryDistance(pos) {
        return Math.min(pos[0], pos[1], this.missionMap.w - 1 - pos[0], this.missionMap.h - 1 - pos[1]);
    }

    /**
     * @param {Character} enemy
     */
    takeScientistPassiveTurn(enemy) {
        let waitTurns = this.scientistPassiveWaitTurns.get(enemy.id) ?? 0;
        while (enemy.actionsThisTurn > 0) {
            if (waitTurns > 0) {
                waitTurns--;
                enemy.rest(this.missionMap);
                continue;
            }
            if (enemy.patrolRoute.length === 0) {
                enemy.rest(this.missionMap);
                continue;
            }
            if (enemy.patrolTarget < 0) enemy.patrolTarget = 0;
            const target = enemy.patrolRoute[enemy.patrolTarget];
            if (enemy.gpos.equals(target)) {
                enemy.patrolTarget = (enemy.patrolTarget + 1) % enemy.patrolRoute.length;
                waitTurns = 3 + ((this.timelineTurn + enemy.patrolTarget + enemy.id.length) % 4);
                enemy.rest(this.missionMap);
                continue;
            }
            const from = enemy.gpos.add([0, 0]);
            const moved = this.moveEnemyToward(enemy, target);
            if (!moved) {
                enemy.rest(this.missionMap);
            } else {
                this.scientistPreviousPositions.set(enemy.id, from);
                enemy.rest(this.missionMap);
            }
        }
        this.scientistPassiveWaitTurns.set(enemy.id, waitTurns);
        enemy.actionsThisTurn = 2;
    }

    /**
     * @param {Character} enemy
     * @param {CharacterStateData} data
     */
    takeScientistTurn(enemy, data) {
        if (data.behaviorState === 'comply') {
            while (enemy.actionsThisTurn > 0) {
                enemy.rest(this.missionMap);
            }
            enemy.actionsThisTurn = 2;
            return;
        }
        if (data.behaviorState === 'passive') {
            this.scientistFleeStallTurns.delete(enemy.id);
            this.takeScientistPassiveTurn(enemy);
            return;
        }
        if (data.behaviorState !== 'fleeing' && data.behaviorState !== 'investigate') {
            this.takeScientistPassiveTurn(enemy);
            return;
        }
        this.scientistPassiveWaitTurns.set(enemy.id, 0);
        let movedThisTurn = false;
        while (enemy.actionsThisTurn > 0) {
            const isFleeing = data.behaviorState === 'fleeing';
            if (isFleeing && this.boundaryDistance(enemy.gpos) <= 0) {
                this.escapeScientist(enemy, data);
                break;
            }
            if (movedThisTurn) {
                enemy.rest(this.missionMap);
                continue;
            }
            const avoidImmediateBacktrack = this.scientistPreviousPositions.get(enemy.id) ?? null;
            const currentBoundary = this.boundaryDistance(enemy.gpos);
            const currentNearestPlayerDist = this.missionMap.playerCharacters
                .filter((player) => player.state !== 'dead')
                .reduce((minDist, player) => Math.min(minDist, enemy.gpos.dist(player.gpos)), Number.POSITIVE_INFINITY);
            const directions = [Facing.north, Facing.east, Facing.south, Facing.west];
            const candidates = directions
                .map((direction) => {
                    const npos = enemy.gpos.add(FacingVec[direction]);
                    const traversible = this.missionMap.metaTileMap.getFromLayer(MetaLayers.traversible, npos);
                    const occupied = this.missionMap.characters.some((character) => character !== enemy && character.state !== 'dead' && character.gpos.equals(npos));
                    const traversibleInDirection = (traversible & (1 << direction)) !== 0;
                    const nearestPlayerDist = this.missionMap.playerCharacters
                        .filter((player) => player.state !== 'dead')
                        .reduce((minDist, player) => Math.min(minDist, npos.dist(player.gpos)), Number.POSITIVE_INFINITY);
                    const boundaryDist = this.boundaryDistance(npos);
                    const score = isFleeing
                        ? boundaryDist * 3.1 - nearestPlayerDist * 1.1
                        : boundaryDist * 0.2 - nearestPlayerDist * 1.4;
                    return { direction, npos, traversibleInDirection, occupied, score, boundaryDist, nearestPlayerDist };
                })
                .filter((candidate) => candidate.traversibleInDirection && !candidate.occupied)
                .filter((candidate) => {
                    if (isFleeing) {
                        return candidate.boundaryDist < currentBoundary
                            || candidate.nearestPlayerDist >= currentNearestPlayerDist + 1.5;
                    }
                    return candidate.nearestPlayerDist > currentNearestPlayerDist + 0.15;
                })
                .sort((a, b) => a.score - b.score);
            if (candidates.length === 0) {
                if (isFleeing) {
                    const stall = (this.scientistFleeStallTurns.get(enemy.id) ?? 0) + 1;
                    this.scientistFleeStallTurns.set(enemy.id, stall);
                    if (stall >= 2) {
                        data.behaviorState = 'comply';
                        this.addLog(`${enemy.id} yields under pressure.`);
                    }
                }
                enemy.rest(this.missionMap);
                continue;
            }
            const usableCandidates = avoidImmediateBacktrack
                ? candidates.filter((candidate) => !candidate.npos.equals(avoidImmediateBacktrack))
                : candidates;
            const selected = usableCandidates.length > 0 ? usableCandidates[0] : candidates[0];
            const from = enemy.gpos.add([0, 0]);
            enemy.move(selected.direction, this.missionMap);
            if (!enemy.gpos.equals(from)) {
                this.scientistPreviousPositions.set(enemy.id, from);
                this.scientistFleeStallTurns.set(enemy.id, 0);
            }
            movedThisTurn = true;
        }
        enemy.actionsThisTurn = 2;
    }

    /**
     * @param {Character} enemy
     * @param {CharacterStateData} data
     */
    escapeScientist(enemy, data) {
        if (this.escapedScientistIds.has(enemy.id)) {
            enemy.actionsThisTurn = 0;
            return;
        }
        this.escapedScientistIds.add(enemy.id);
        this.scientistPreviousPositions.delete(enemy.id);
        this.scientistFleeStallTurns.delete(enemy.id);
        this.scientistPassiveWaitTurns.delete(enemy.id);
        enemy.state = 'fleeing';
        enemy.actionsThisTurn = 0;
        data.behaviorState = 'fleeing';
        data.casualtyState = 'combatEffective';
        data.actionsRemaining = 0;
        this.addLog(`${enemy.id} escaped.`);
    }

    /**
     * Small deterministic jitter to avoid synchronized enemy choices.
     * @param {string} id
     * @returns {number}
     */
    enemyIdJitter(id) {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
        }
        return ((hash % 11) - 5) * 0.05;
    }

    /**
     * @param {Character} enemy
     * @param {CharacterStateData} data
     * @returns {PlayerCharacter|null}
     */
    selectEnemyAttackTarget(enemy, data) {
        if (this.isScientistId(enemy.id) || data.role === 'target') return null;
        const visiblePlayers = this.missionMap.playerCharacters
            .filter((player) => player.state !== 'dead')
            .map((player) => {
                const playerData = this.characterState.get(player.id);
                const distance = enemy.gpos.dist(player.gpos);
                const coverSightLimit = this.getPerceptionCoverDistance(enemy, data);
                const canSeePlayer = enemy.canSee(player, this.missionMap)
                    && this.enemyFacingAllowsSight(enemy, player, data)
                    && !(playerData?.hasCover && distance > coverSightLimit);
                return {
                    player,
                    playerData,
                    distance,
                    canSeePlayer,
                    isActive: player === this.missionMap.activeCharacter,
                };
            })
            .filter((entry) => entry.canSeePlayer);
        if (visiblePlayers.length === 0) return null;
        const scored = visiblePlayers
            .map((entry) => {
                const alliesAlreadyPressuring = this.missionMap.enemies.filter((ally) => {
                    if (ally === enemy || ally.state === 'dead') return false;
                    const allyData = this.characterState.get(ally.id);
                    if (!allyData) return false;
                    const isPressuring = allyData.behaviorState === 'engage' || allyData.awarenessState === 'engaging';
                    return isPressuring && ally.gpos.dist(entry.player.gpos) <= 6;
                }).length;
                const healthRatio = entry.player.maxHealth > 0 ? entry.player.health / entry.player.maxHealth : 1;
                const coverPenalty = entry.playerData?.hasCover ? 1.25 : 0;
                const activePenalty = entry.isActive ? 0.5 : 0;
                const spreadPenalty = alliesAlreadyPressuring * 0.75;
                const score = entry.distance + coverPenalty + healthRatio + activePenalty + spreadPenalty + this.enemyIdJitter(`${enemy.id}:${entry.player.id}`);
                return { player: entry.player, score };
            })
            .sort((a, b) => a.score - b.score);
        return scored[0]?.player ?? null;
    }

    /**
     * @param {Character} enemy
     * @param {PlayerCharacter} target
     * @param {CharacterStateData} data
     * @returns {boolean}
     */
    tryEnemyAttack(enemy, target, data) {
        if (this.isScientistId(enemy.id) || data.role === 'target') return false;
        const dist = enemy.gpos.dist(target.gpos);
        if (dist > 7 || !enemy.canSee(target, this.missionMap) || !this.enemyFacingAllowsSight(enemy, target, data)) return false;
        if (!this.canEnemyEscalateToEngage(enemy, data, dist)) return false;
        if (data.behaviorState !== 'engage' && dist > 4) return false;
        enemy.actionsThisTurn--;
        const targetData = this.characterState.get(target.id);
        const coverPenalty = targetData?.hasCover ? 0.22 : 0;
        const suppressionPenalty = data.isSuppressed ? 0.2 : 0;
        const distancePenalty = Math.max(0, dist - 8) * 0.04;
        const baseHit = dist <= 2 ? 0.9 : 0.78;
        const armorEvasion = target.armorRating >= 0.7 ? 0.08 : 0;
        const trainedEvasion = target.trainingLevel >= 1 ? 0.04 : 0;
        const hitChance = Math.max(0.16, Math.min(0.95, baseHit - coverPenalty - suppressionPenalty - distancePenalty - armorEvasion - trainedEvasion));
        target.applySuppression(dist <= 2.2 ? 1.9 : 1.3);
        const didHit = this.missionMap.sampleRuntimeRandom(`enemy:${enemy.id}:attack`) < hitChance;
        if (didHit) {
            const damage = dist <= 3 ? 3 : 2;
            target.takeDamage('piercing', damage);
        }
        this.missionMap.emitGunfire(enemy.gpos, enemy.id, false, 1);
        this.missionMap.emitAttack(enemy.gpos, target.gpos, didHit, enemy.id, target.id, 2);
        this.addLog(`${enemy.id} fired on ${target.id} (${didHit ? 'hit' : 'miss'})`);
        data.lastKnownThreatPos = target.gpos.add([0, 0]);
        data.lastKnownThreatTtl = 4;
        data.awarenessState = 'engaging';
        return true;
    }

    /**
     * @param {Character} enemy
     * @param {import('eskv/lib/eskv.js').Vec2} point
     * @returns {boolean}
     */
    canEnemyOccupy(enemy, point) {
        if (point[0] < 0 || point[1] < 0 || point[0] >= this.missionMap.w || point[1] >= this.missionMap.h) return false;
        const traversible = this.missionMap.metaTileMap.getFromLayer(MetaLayers.traversible, point);
        if (typeof traversible !== 'number' || traversible === 0) return false;
        const occupied = this.missionMap.characters.some((character) => character !== enemy && character.state !== 'dead' && character.gpos.equals(point));
        return !occupied;
    }

    /**
     * @param {Character} enemy
     * @param {import('eskv/lib/eskv.js').Vec2} target
     * @returns {import('eskv/lib/eskv.js').Vec2}
     */
    pickEngageApproachCell(enemy, target) {
        const offsets = [FacingVec[Facing.north], FacingVec[Facing.east], FacingVec[Facing.south], FacingVec[Facing.west]];
        const coverLayer = this.missionMap.metaTileMap.layer[MetaLayers.cover];
        const candidates = offsets
            .map((offset) => target.add(offset))
            .filter((point) => this.canEnemyOccupy(enemy, point))
            .map((point) => {
                const coverBonus = coverLayer.get(point) > 0 ? -0.35 : 0;
                const score = point.dist(enemy.gpos) + coverBonus + this.enemyIdJitter(`${enemy.id}:${point[0]},${point[1]}`);
                return { point, score };
            })
            .sort((a, b) => a.score - b.score);
        return candidates[0]?.point ?? target;
    }

    /**
     * @param {Character} enemy
     * @param {import('eskv/lib/eskv.js').Vec2} anchor
     * @returns {import('eskv/lib/eskv.js').Vec2|null}
     */
    pickInvestigateSweepCell(enemy, anchor) {
        const offsets = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1],[2,0],[0,2],[-2,0],[0,-2]];
        const idOffset = enemy.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const start = (this.timelineTick + idOffset) % offsets.length;
        for (let i = 0; i < offsets.length; i++) {
            const offset = offsets[(start + i) % offsets.length];
            const candidate = anchor.add(offset);
            if (this.canEnemyOccupy(enemy, candidate)) return candidate;
        }
        return null;
    }

    /**
     * @param {Character} enemy
     * @param {CharacterStateData} data
     * @returns {import('eskv/lib/eskv.js').Vec2 | null}
     */
    selectEnemyBehaviorTarget(enemy, data) {
        if (data.behaviorState === 'patrol') {
            if (enemy.patrolTarget < 0) enemy.patrolTarget = 0;
            if (enemy.patrolRoute.length === 0) return null;
            if (enemy.gpos.equals(enemy.patrolRoute[enemy.patrolTarget])) {
                enemy.patrolTarget = (enemy.patrolTarget + 1) % enemy.patrolRoute.length;
            }
            return enemy.patrolRoute[enemy.patrolTarget];
        }
        if (data.behaviorState === 'engage') {
            const visibleTarget = this.selectEnemyAttackTarget(enemy, data);
            if (visibleTarget) {
                data.lastKnownThreatPos = visibleTarget.gpos.add([0, 0]);
                data.lastKnownThreatTtl = 4;
                return this.pickEngageApproachCell(enemy, visibleTarget.gpos);
            }
        }
        if ((data.behaviorState === 'investigate' || data.behaviorState === 'engage') && data.lastKnownThreatPos) {
            if (enemy.gpos.equals(data.lastKnownThreatPos)) {
                return this.pickInvestigateSweepCell(enemy, data.lastKnownThreatPos);
            }
            return data.lastKnownThreatPos;
        }
        return null;
    }

    /**
     * @param {Character} enemy
     * @param {import('eskv/lib/eskv.js').Vec2} target
     * @returns {boolean}
     */
    moveEnemyToward(enemy, target) {
        const directions = [Facing.north, Facing.east, Facing.south, Facing.west];
        const candidates = directions
            .map((direction) => {
                const npos = enemy.gpos.add(FacingVec[direction]);
                const traversible = this.missionMap.metaTileMap.getFromLayer(MetaLayers.traversible, npos);
                const occupied = this.missionMap.characters.some((character) => character !== enemy && character.state !== 'dead' && character.gpos.equals(npos));
                const traversibleInDirection = (traversible & (1 << direction)) !== 0;
                return { direction, npos, traversibleInDirection, occupied, distance: npos.dist(target) };
            })
            .filter((candidate) => candidate.traversibleInDirection && !candidate.occupied)
            .sort((a, b) => a.distance - b.distance || a.direction - b.direction);
        if (candidates.length === 0) return false;
        const from = enemy.gpos.add([0, 0]);
        enemy.move(candidates[0].direction, this.missionMap);
        return !enemy.gpos.equals(from);
    }

    /**
     * @param {Character} enemy
     * @param {CharacterStateData} data
     * @returns {EnemyIntentGlyph['kind']}
     */
    predictEnemyIntentKind(enemy, data) {
        const hasActiveThreat = data.lastKnownThreatPos !== null && data.lastKnownThreatTtl > 0;
        if (enemy.state === 'dead' || data.behaviorState === 'dead' || data.casualtyState === 'dead') return 'dead';
        if (enemy.state === 'surrendering' || data.behaviorState === 'surrendering' || data.casualtyState === 'detained') return 'arrested';
        if (enemy.state === 'unconscious' || data.casualtyState === 'unconscious') return 'down';
        if (enemy.state === 'fleeing' || this.escapedScientistIds.has(enemy.id) || data.behaviorState === 'fleeing') return 'flee';
        if (data.behaviorState === 'comply') return 'comply';
        if (this.isScientistId(enemy.id) || data.role === 'target') {
            if (data.behaviorState === 'investigate') return hasActiveThreat ? 'search' : 'passive';
            if (data.behaviorState === 'passive') return 'passive';
            return 'patrol';
        }
        if (data.behaviorState === 'engage') {
            const target = this.selectEnemyAttackTarget(enemy, data);
            if (target) {
                const dist = enemy.gpos.dist(target.gpos);
                const canAttack = dist <= 7
                    && enemy.canSee(target, this.missionMap)
                    && this.enemyFacingAllowsSight(enemy, target, data)
                    && this.canEnemyEscalateToEngage(enemy, data, dist)
                    && !(data.behaviorState !== 'engage' && dist > 4);
                if (canAttack) return 'attack';
            }
            return 'advance';
        }
        if (data.behaviorState === 'investigate') return hasActiveThreat ? 'search' : 'patrol';
        if (data.behaviorState === 'patrol') return 'patrol';
        return 'patrol';
    }

    /** @returns {EnemyIntentGlyph[]} */
    getEnemyIntentGlyphs() {
        return this.missionMap.enemies
            .filter((enemy) => enemy.visibleToPlayer && enemy.state !== 'fleeing' && !this.escapedScientistIds.has(enemy.id))
            .map((enemy) => {
                const data = this.characterState.get(enemy.id);
                const kind = data ? this.predictEnemyIntentKind(enemy, data) : 'patrol';
                const label = kind === 'attack' ? 'ATTACK'
                    : kind === 'advance' ? 'ADV'
                    : kind === 'search' ? 'SEARCH'
                    : kind === 'passive' ? 'WORK'
                    : kind === 'flee' ? 'FLEE'
                    : kind === 'comply' ? 'YIELD'
                    : kind === 'arrested' ? 'ARREST'
                    : kind === 'down' ? 'DOWN'
                    : kind === 'dead' ? 'DEAD'
                    : 'PATROL';
                const color = kind === 'attack' ? 'rgba(255,72,72,0.98)'
                    : kind === 'advance' ? 'rgba(255,165,66,0.96)'
                    : kind === 'search' ? 'rgba(255,228,130,0.94)'
                    : kind === 'passive' ? 'rgba(170,230,210,0.9)'
                    : kind === 'flee' ? 'rgba(120,215,255,0.96)'
                    : kind === 'comply' ? 'rgba(165,255,180,0.96)'
                    : kind === 'arrested' ? 'rgba(110,250,170,0.95)'
                    : kind === 'down' ? 'rgba(150,205,255,0.94)'
                    : kind === 'dead' ? 'rgba(245,245,245,0.88)'
                    : 'rgba(205,205,220,0.9)';
                return {
                    id: enemy.id,
                    position: [enemy.gpos[0], enemy.gpos[1]],
                    kind,
                    label,
                    color,
                };
            });
    }

    /**
     * @param {number} runSeed
     * @param {number} missionIndex
     * @returns {number}
     */
    computeMissionSeed(runSeed, missionIndex) {
        const run = runSeed >>> 0;
        const index = missionIndex >>> 0;
        let mixed = (run ^ (index + 0x9e3779b9)) >>> 0;
        mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b) >>> 0;
        mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35) >>> 0;
        mixed = (mixed ^ (mixed >>> 16)) >>> 0;
        return mixed;
    }

    updateMissionOutcome() {
        const scientistEnemies = this.missionMap.enemies.filter((enemy) => this.isScientistId(enemy.id));
        const arrestedCount = scientistEnemies.filter((enemy) => enemy.state === 'surrendering').length;
        const killedCount = scientistEnemies.filter((enemy) => enemy.state === 'dead').length;
        const escapedCount = scientistEnemies.filter((enemy) => this.escapedScientistIds.has(enemy.id)).length;
        const scientistTotal = Math.max(1, scientistEnemies.length);

        const arrestObjective = this.objectives.find((o) => o.id === 'arrestScientists');
        const protectObjective = this.objectives.find((o) => o.id === 'protectScientists');
        const escapeObjective = this.objectives.find((o) => o.id === 'preventScientistEscape');

        if (arrestObjective) arrestObjective.state = arrestedCount >= scientistTotal ? 'complete' : 'pending';
        if (protectObjective) protectObjective.state = killedCount > 0 ? 'failed' : (arrestedCount >= scientistTotal ? 'complete' : 'pending');
        if (escapeObjective) escapeObjective.state = escapedCount >= scientistTotal ? 'failed' : (arrestedCount >= scientistTotal ? 'complete' : 'pending');

        if (killedCount > 0) {
            this.missionStatus = 'failure';
            this.message = `Mission failure: ${killedCount} scientist(s) were killed by gunfire.`;
        } else if (escapedCount >= scientistTotal) {
            this.missionStatus = 'failure';
            this.message = 'Mission failure: all scientists escaped.';
        } else if (arrestedCount >= scientistTotal) {
            this.missionStatus = 'success';
            this.message = `Mission success: all ${scientistTotal} scientists arrested.`;
        } else if (this.missionStatus === 'notStarted') {
            this.missionStatus = 'active';
        }
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isAtMapBoundary(x, y) {
        const maxX = this.missionMap.w - 1;
        const maxY = this.missionMap.h - 1;
        return x <= 0 || y <= 0 || x >= maxX || y >= maxY;
    }

    objectiveSummary() {
        return this.objectives.map((objective) => {
            const prefix = objective.state === 'complete' ? '[OK]' : objective.state === 'failed' ? '[X]' : '[ ]';
            return `${prefix} ${objective.text}`;
        }).join(' | ');
    }

    squadStatusSummary() {
        return this.missionMap.playerCharacters.map((character) => {
            const data = this.characterState.get(character.id);
            const hp = `${character.health}/${character.maxHealth}`;
            const sup = data ? data.suppressionPoints.toFixed(1) : character.suppressionLevel.toFixed(1);
            const awareness = data ? data.awarenessState : 'engaging';
            return `${character.id}:HP ${hp} SUP ${sup} AWR ${awareness}`;
        }).join(' | ');
    }

    playerStatusSummary() {
        return this.missionMap.playerCharacters.map((character) => {
            const hp = `${character.health}/${character.maxHealth}`;
            const pos = `${character.gpos[0]},${character.gpos[1]}`;
            const act = character.actionsThisTurn;
            return `${character.id.toUpperCase()} HP:${hp} AP:${act} POS:${pos}`;
        }).join(' | ');
    }

    inventoryStatusSummary() {
        return this.missionMap.playerCharacters.map((character) => {
            const actionSummary = [...character.actions].map((action) => {
                const ammo = /** @type {{ammo?: number}} */(action).ammo;
                const suffix = typeof ammo === 'number' ? `(${ammo})` : '';
                return `${action.keyControl}:${action.name}${suffix}`;
            }).join(', ');
            return `${character.id}: ${actionSummary}`;
        }).join('\n');
    }

    enemyStatusSummary() {
        const visibleEnemies = this.missionMap.enemies.filter((enemy) => enemy.visibleToPlayer && enemy.state !== 'dead');
        if (visibleEnemies.length === 0) return 'No visible enemies';
        return visibleEnemies.map((enemy) => {
            const data = this.characterState.get(enemy.id);
            const hp = `${enemy.health}/${enemy.maxHealth}`;
            const sup = data ? data.suppressionPoints.toFixed(1) : enemy.suppressionLevel.toFixed(1);
            const awareness = data ? data.awarenessState : 'unaware';
            return `${enemy.id}:HP ${hp} SUP ${sup} AWR ${awareness}`;
        }).join(' | ');
    }

    signalStatusSummary() {
        return `sound:${this.missionMap.soundEvents.length} decoy:${this.missionMap.decoyEvents.length}`;
    }

    requestStatusSummary() {
        const queuedFromTimeline = this.timeline.filter((event) => event.result === 'applied' && event.actorId === 'randy' && event.intent.type === 'requestActionFromKey').length;
        const total = this.replayMode ? this.mariaRequests.length : queuedFromTimeline;
        const fulfilled = this.mariaRequests.filter((request) => request.fulfilled).length;
        const pending = total - fulfilled;
        const pendingThisTurn = this.mariaRequests.filter((request) => !request.fulfilled && request.turn === this.timelineTurn).length;
        if (!this.replayMode) {
            return `Requests queued: ${total} | pending replay: ${pending} | anomalies: ${this.anomalyCount}`;
        }
        return `Requests fulfilled: ${fulfilled}/${total} | pending now: ${pendingThisTurn} | anomalies: ${this.anomalyCount}`;
    }

    shortcutsSummary() {
        return 'Randy actions: W/A/S/D move, SPACE wait, F/G/T/C action | Randy requests (free): CTRL+SHIFT+F/G/T/C | Maria actions: W/A/S/D, SPACE, F/G/T/C | O: start Maria replay loop';
    }

    eventLogSummary() {
        if (this.eventLog.length === 0) return 'No events yet.';
        return this.eventLog.slice(Math.max(0, this.eventLog.length - 24)).join('\n');
    }

    /**
     * @param {GameIntent} intent
     * @param {TimelineEvent['result']} result
     * @param {string} message
     * @param {number=} turn
     * @param {number=} tick
     * @param {PlayerCharacter|null=} actor
     */
    recordTimelineEvent(intent, result, message, turn = this.timelineTurn, tick = this.timelineTick, actor = this.getActivePlayer()) {
        this.timeline.push({
            turn,
            tick,
            actorId: actor?.id ?? 'none',
            actorPos: actor ? [actor.gpos[0], actor.gpos[1]] : null,
            intent,
            result,
            message,
        });
    }

    serializeTimeline() {
        return JSON.stringify(this.timeline);
    }

    /** @param {string} serialized */
    deserializeTimeline(serialized) {
        /** @type {TimelineEvent[]} */
        const parsed = JSON.parse(serialized);
        this.timeline = parsed.map((event) => ({
            ...event,
            actorPos: event.actorPos ? [event.actorPos[0], event.actorPos[1]] : null,
        }));
        this.timelineTick = this.timeline.length > 0 ? this.timeline[this.timeline.length - 1].tick : 0;
    }

    /** @param {number} tick */
    rewindToTick(tick) {
        const clamped = Math.max(0, tick);
        const intentsToApply = this.timeline
            .filter((event) => event.result === 'applied' && event.tick <= clamped)
            .map((event) => event.intent);
        this.setupMissionFromCurrentSeeds();
        this.missionStatus = 'active';
        this.timelineTurn = 1;
        this.timelineTick = 0;
        this.timeline = [];
        for (const intent of intentsToApply) {
            this.applyIntent(intent, true);
            this.timelineTick++;
            this.recordTimelineEvent(intent, 'rewind', `Reapplied while rewinding to tick ${clamped}`);
        }
        this.message = `Rewound to tick ${clamped}.`;
    }

    startObligationLoop() {
        if (this.replayMode) {
            this.message = 'Obligation loop already active.';
            this.addLog(this.message);
            return;
        }
        if (this.missionStatus !== 'success') {
            this.missionStatus = 'failure';
            this.message = 'Mission failure: first run must complete all objectives before rewind.';
            this.addLog(this.message);
            return;
        }
        this.rememberSeenFromCurrentMap();
        this.snapshotRandyPathFromTimeline();
        this.buildRandyReplayScriptFromTimeline();
        this.buildMariaRequestsFromTimeline();
        this.snapshotObligationObjectivesFromRequests();
        this.replayMode = true;
        this.anomalyCount = 0;
        for (const request of this.mariaRequests) {
            request.fulfilled = false;
            request.fulfilledTick = null;
        }
        this.setupMissionFromCurrentSeeds();
        this.setActivePlayerById('maria');
        this.applyPersistentSeenToMap();
        this.ensureReplayGhostVisible();
        this.timeline = [];
        this.timelineTick = 0;
        this.timelineTurn = 1;
        this.message = `Obligation loop started. Maria requests queued: ${this.mariaRequests.length}.`;
        this.addLog(this.message);
    }

    /** @returns {GameView} */
    getView() {
        return {
            message: this.message,
            awaitingSelection: this.activePlayerAction !== null,
            selectorCells: this.selectorCells,
            selectorIndex: this.selectorIndex,
            objectiveText: this.objectiveSummary(),
            missionStatus: this.missionStatus,
            runSeed: this.runSeed,
            missionSeed: this.missionSeed,
            missionIndex: this.missionIndex,
            timelineTick: this.timelineTick,
            timelineTurn: this.timelineTurn,
            replayMode: this.replayMode,
            squadStatusText: this.squadStatusSummary(),
            playerStatusText: this.playerStatusSummary(),
            inventoryStatusText: this.inventoryStatusSummary(),
            enemyStatusText: this.enemyStatusSummary(),
            signalStatusText: this.signalStatusSummary(),
            shortcutsText: this.shortcutsSummary(),
            logText: this.eventLogSummary(),
            activeCharacterId: this.getActivePlayer()?.id ?? 'none',
            randyEchoPos: this.getRandyEchoForCurrentTurn(),
            obligationObjectives: this.obligationObjectives.map((objective) => ({
                ...objective,
                position: [objective.position[0], objective.position[1]],
            })),
            obligationTurns: [...new Set(this.obligationObjectives.map((objective) => objective.turn))].sort((a, b) => a - b),
            randyPath: this.randyPath.map((step) => ({
                turn: step.turn,
                position: [step.position[0], step.position[1]],
            })),
            anomalyCount: this.anomalyCount,
            requestSummaryText: this.requestStatusSummary(),
            enemyIntents: this.getEnemyIntentGlyphs().map((intent) => ({
                ...intent,
                position: [intent.position[0], intent.position[1]],
            })),
        };
    }
}
