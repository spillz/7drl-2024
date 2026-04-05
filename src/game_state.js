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
 *   intent: GameIntent,
 *   result: 'applied'|'ignored'|'blocked'|'rewind',
 *   message: string,
 * }} TimelineEvent
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
 *   enemyStatusText: string,
 *   signalStatusText: string,
 * }} GameView
 */

/**
 * @typedef {'player'|'enemy'|'target'} CharacterRole
 */

/**
 * @typedef {'patrol'|'investigate'|'engage'|'unaware'|'usingSkype'|'seekingGuards'|'surrendering'|'dead'} CharacterBehaviorState
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
    /** @type {import('eskv/lib/eskv.js').Vec2[]} */
    patrolRoute = [];
    /** @type {number} */
    patrolTarget = -1;
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
    /** @type {string} */
    missionTargetId = 'alfred';
    /** @type {import('eskv/lib/eskv.js').Vec2 | null} */
    missionTargetLastPos = null;
    /** @type {boolean} */
    missionTargetHasMoved = false;
    /** @type {import('eskv/lib/eskv.js').Vec2[]} */
    selectorCells = [];
    selectorIndex = -1;

    /** @type {TimelineEvent[]} */
    timeline = [];
    /** @type {number} */
    timelineTick = 0;
    /** @type {number} */
    timelineTurn = 1;
    /** @type {GameIntent[]} */
    obligationTimeline = [];
    /** @type {number} */
    obligationIndex = 0;
    /** @type {boolean} */
    replayMode = false;

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
        this.obligationIndex = 0;
    }

    setupMissionFromCurrentSeeds() {
        this.missionMap.setupLevel(this.missionSeed);
        this.initializeCharacterState();
        for (const playerCharacter of this.missionMap.playerCharacters) {
            if (![...playerCharacter.actions].some((action) => action instanceof Rifle)) {
                playerCharacter.addAction(new Rifle());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof ArrestAction)) {
                playerCharacter.addAction(new ArrestAction());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof StealthTakedownAction)) {
                playerCharacter.addAction(new StealthTakedownAction());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof DecoyAction)) {
                playerCharacter.addAction(new DecoyAction());
            }
        }
        const player = this.getActivePlayer();
        if (!player) return;
        player.updateFoV(this.missionMap);
        this.missionMap.updateCharacterVisibility(true);
        this.activePlayerAction = null;
        this.activePlayerActionData = null;
        this.selectorCells = [];
        this.selectorIndex = -1;
        this.initializeObjectives();
        const target = this.getMissionTarget();
        this.missionTargetLastPos = target ? target.gpos.add([0, 0]) : null;
        this.missionTargetHasMoved = false;
        this.missionStatus = 'active';
        this.message = `Mission started (run:${this.runSeed}, mission:${this.missionIndex}, seed:${this.missionSeed})`;
        this.updateMissionOutcome();
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
            const role = enemy.id === this.missionTargetId ? 'target' : 'enemy';
            const data = new CharacterStateData(enemy, role);
            if (enemy.state === 'dead') {
                data.behaviorState = 'dead';
                data.awarenessState = 'unaware';
            } else if (role === 'target') {
                data.behaviorState = 'unaware';
                data.resumeBehaviorState = 'usingSkype';
                data.awarenessState = 'unaware';
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
            data.gridPosition = character.gpos.add([0, 0]);
            data.actionsRemaining = character.actionsThisTurn;
            data.movementBlockedCount = character.movementBlockedCount;
            data.patrolRoute = character.patrolRoute.map((pos) => pos.add([0, 0]));
            data.patrolTarget = character.patrolTarget;
            data.suppressionPoints = character.suppressionLevel;
            data.isSuppressed = data.suppressionPoints >= 2;
            data.suppressibility = character.suppressibility;
            if (character.state === 'dead') {
                data.priorBehaviorState = data.behaviorState;
                data.behaviorState = 'dead';
                data.casualtyState = 'dead';
                data.awarenessState = 'unaware';
            } else if (character.state === 'surrendering') {
                data.priorBehaviorState = data.behaviorState;
                data.behaviorState = 'surrendering';
                data.casualtyState = 'detained';
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
            character.state = this.toCharacterWidgetState(data.behaviorState);
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

    updateAwarenessStateFromPerception() {
        const player = this.getActivePlayer();
        if (!player) return;
        const communicatingEnemies = this.missionMap.enemies
            .filter((enemy) => {
                const data = this.characterState.get(enemy.id);
                if (!data) return false;
                return data.awarenessState === 'investigating' || data.awarenessState === 'engaging';
            });
        for (const enemy of this.missionMap.enemies) {
            const data = this.characterState.get(enemy.id);
            if (!data) continue;
            if (data.behaviorState === 'dead' || data.behaviorState === 'surrendering') continue;
            const playerData = this.characterState.get(player.id);
            const rawCanSeePlayer = enemy.canSee(player, this.missionMap);
            const distToPlayer = enemy.gpos.dist(player.gpos);
            const canSeePlayer = rawCanSeePlayer && !(playerData?.hasCover && distToPlayer > 3);
            const heardSound = this.missionMap.soundEvents.some((event) => event.source !== enemy.id && event.position.dist(enemy.gpos) <= event.radius);
            const noticedDecoy = this.missionMap.decoyEvents.some((event) => event.source !== enemy.id && event.position.dist(enemy.gpos) <= event.radius);
            const allyCommunicated = communicatingEnemies.some((ally) => ally !== enemy && ally.gpos.dist(enemy.gpos) <= 8);
            let nextAwareness = data.awarenessState;
            if (canSeePlayer && distToPlayer <= 5) {
                nextAwareness = 'engaging';
                data.awarenessCooldown = 2;
            } else if (canSeePlayer || heardSound) {
                nextAwareness = this.maxAwareness(nextAwareness, 'investigating');
                data.awarenessCooldown = 2;
                if (!canSeePlayer && heardSound && this.missionMap.soundEvents.length > 0) {
                    data.lastKnownThreatPos = this.missionMap.soundEvents[0].position.add([0, 0]);
                }
            } else if (noticedDecoy) {
                nextAwareness = this.maxAwareness(nextAwareness, 'aware');
                data.awarenessCooldown = Math.max(data.awarenessCooldown, 1);
                if (this.missionMap.decoyEvents.length > 0) {
                    data.lastKnownThreatPos = this.missionMap.decoyEvents[0].position.add([0, 0]);
                }
            } else if (allyCommunicated) {
                nextAwareness = this.maxAwareness(nextAwareness, 'aware');
                data.awarenessCooldown = Math.max(data.awarenessCooldown, 1);
            } else if (data.awarenessCooldown > 0) {
                data.awarenessCooldown--;
            } else if (data.awarenessState === 'engaging') {
                nextAwareness = 'investigating';
            } else if (data.awarenessState === 'investigating') {
                nextAwareness = 'aware';
            } else if (data.awarenessState === 'aware') {
                nextAwareness = 'unaware';
            }
            data.awarenessState = nextAwareness;
        }
    }

    updateEnemyBehaviorStateFromPerception() {
        const player = this.getActivePlayer();
        if (!player) return;
        for (const enemy of this.missionMap.enemies) {
            const data = this.characterState.get(enemy.id);
            if (!data) continue;
            if (data.behaviorState === 'dead' || data.behaviorState === 'surrendering') continue;
            const canSeePlayer = enemy.canSee(player, this.missionMap);
            const playerDistance = enemy.gpos.dist(player.gpos);
            let nextState = data.behaviorState;
            if (canSeePlayer) {
                data.lastKnownThreatPos = player.gpos.add([0, 0]);
            }
            if (data.role === 'target') {
                if (data.behaviorState === 'unaware' && canSeePlayer) {
                    nextState = 'usingSkype';
                } else if (data.behaviorState === 'usingSkype' && canSeePlayer && playerDistance <= 6) {
                    nextState = 'seekingGuards';
                } else if (data.behaviorState === 'seekingGuards' && canSeePlayer) {
                    nextState = 'engage';
                }
                if (data.awarenessState === 'engaging' && !data.isSuppressed) {
                    nextState = 'engage';
                } else if (data.awarenessState === 'investigating' && data.behaviorState === 'unaware') {
                    nextState = 'usingSkype';
                }
            } else {
                if ((canSeePlayer && playerDistance <= 5 && !data.isSuppressed) || data.awarenessState === 'engaging') {
                    nextState = 'engage';
                } else if (canSeePlayer || data.awarenessState === 'investigating') {
                    nextState = 'investigate';
                } else if (data.behaviorState === 'investigate' || data.behaviorState === 'engage') {
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
            { id: 'locateTarget', text: `Locate target ${this.missionTargetId}`, state: 'pending' },
            { id: 'arrestTarget', text: `Arrest target ${this.missionTargetId}`, state: 'pending' },
            { id: 'preventTargetEscape', text: `Prevent ${this.missionTargetId} from escaping with armed support`, state: 'pending' },
            { id: 'keepSquadAlive', text: 'Keep every SWAT operator alive', state: 'pending' },
        ];
    }

    /** @returns {PlayerCharacter | null} */
    getActivePlayer() {
        const active = this.missionMap.activeCharacter;
        return active instanceof PlayerCharacter ? active : null;
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

        if (this.missionStatus === 'success' || this.missionStatus === 'failure') {
            this.message = 'Mission already resolved. Rewind or start next loop.';
            this.recordTimelineEvent(intent, 'blocked', this.message);
            return;
        }
        if (this.replayMode && !this.intentMatchesObligation(intent)) {
            this.missionStatus = 'failure';
            this.message = `Obligation mismatch at step ${this.obligationIndex + 1}.`;
            this.recordTimelineEvent(intent, 'blocked', this.message);
            return;
        }

        const result = this.applyIntent(intent);
        this.recordTimelineEvent(intent, result ? 'applied' : 'ignored', this.message);
        if (result && this.replayMode) {
            this.obligationIndex++;
        }
    }

    /**
     * @param {GameIntent} intent
     * @param {boolean=} suppressTimeline
     */
    applyIntent(intent, suppressTimeline = false) {
        const player = this.getActivePlayer();
        if (!player) return false;

        let progressedTurn = false;

        if (!this.activePlayerAction) {
            switch (intent.type) {
                case 'move':
                    player.move(intent.direction, this.missionMap);
                    progressedTurn = true;
                    break;
                case 'rest':
                    player.rest(this.missionMap);
                    progressedTurn = true;
                    break;
                case 'startActionFromKey': {
                    const action = player.getActionForKey(intent.key);
                    if (!action) break;
                    const response = player.takeAction(action, this.missionMap);
                    this.handleActionResponse(action, response);
                    progressedTurn = response.result === 'complete';
                    break;
                }
                case 'debugRevealMap':
                    for (const p of this.missionMap.metaTileMap.layer[MetaLayers.seen].iterAll()) {
                        this.missionMap.metaTileMap.setInLayer(MetaLayers.seen, p, 1);
                        this.missionMap.tileMap.clearCache();
                    }
                    break;
                default:
                    break;
            }
        } else {
            switch (intent.type) {
                case 'moveSelection':
                    this.moveSelection(FacingVec[intent.direction]);
                    break;
                case 'confirmSelection':
                    progressedTurn = this.confirmSelection(player);
                    break;
                case 'cancelSelection':
                    this.clearSelectionState('canceled');
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
        this.updateMissionOutcome();
        if (!suppressTimeline) {
            this.timelineTick++;
        }
        return progressedTurn;
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
        const responseData = this.activePlayerActionData;
        if (responseData.validTargetCharacters && responseData.validTargetCharacters.length > 0) {
            responseData.targetCharacter = responseData.validTargetCharacters[this.selectorIndex];
        } else if (responseData.validTargetPositions && responseData.validTargetPositions.length > 0) {
            responseData.targetPosition = responseData.validTargetPositions[this.selectorIndex];
        }
        const response = player.takeAction(this.activePlayerAction, this.missionMap, responseData);
        this.handleActionResponse(this.activePlayerAction, response);
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
        this.syncCharacterStateFromMap();
        this.updateTacticalStateFromMap();
        this.decaySuppression();
        this.updateAwarenessStateFromPerception();
        this.updateEnemyBehaviorStateFromPerception();
        this.applyCharacterStateToMap();
        for (const enemy of this.missionMap.enemies) {
            enemy.takeTurn(this.missionMap);
        }
        this.syncCharacterStateFromMap();
        this.updateTacticalStateFromMap();
        this.updateAwarenessStateFromPerception();
        this.updateEnemyBehaviorStateFromPerception();
        this.applyCharacterStateToMap();
        this.advanceTransientSignals();
        player.actionsThisTurn = 2;
        const playerData = this.characterState.get(player.id);
        if (playerData) {
            playerData.actionsRemaining = 2;
        }
        this.timelineTurn++;
        this.missionMap.updateCharacterVisibility(true);
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

    /** @returns {import('./character.js').Character | undefined} */
    getMissionTarget() {
        return this.missionMap.enemies.find((enemy) => enemy.id === this.missionTargetId);
    }

    /** @returns {CharacterStateData | undefined} */
    getMissionTargetState() {
        return this.characterState.get(this.missionTargetId);
    }

    updateMissionOutcome() {
        const target = this.getMissionTarget();
        const targetState = this.getMissionTargetState();
        const locateObjective = this.objectives.find((o) => o.id === 'locateTarget');
        const arrestObjective = this.objectives.find((o) => o.id === 'arrestTarget');
        const escapeObjective = this.objectives.find((o) => o.id === 'preventTargetEscape');
        const squadObjective = this.objectives.find((o) => o.id === 'keepSquadAlive');
        if (target && this.missionTargetLastPos && !target.gpos.equals(this.missionTargetLastPos)) {
            this.missionTargetHasMoved = true;
        }
        this.missionTargetLastPos = target ? target.gpos.add([0, 0]) : null;
        if (target && this.getActivePlayer()?.canSee(target, this.missionMap)) {
            if (locateObjective) locateObjective.state = 'complete';
        }
        const targetArrested = targetState?.behaviorState === 'surrendering';
        if (targetArrested && arrestObjective) {
            arrestObjective.state = 'complete';
        }

        const aliveGuards = this.missionMap.enemies.filter((enemy) => {
            if (enemy.id === this.missionTargetId) return false;
            const data = this.characterState.get(enemy.id);
            return data ? data.behaviorState !== 'dead' : enemy.state !== 'dead';
        });
        const targetEscaped = target
            ? this.missionTargetHasMoved && this.isAtMapBoundary(target.gpos[0], target.gpos[1]) && aliveGuards.length > 0
            : false;
        const anyPlayerDead = this.missionMap.playerCharacters.some((pc) => {
            const data = this.characterState.get(pc.id);
            return data ? data.behaviorState === 'dead' : pc.state === 'dead';
        });
        if (targetState?.behaviorState === 'dead' && !targetArrested) {
            if (arrestObjective) arrestObjective.state = 'failed';
            if (escapeObjective && escapeObjective.state !== 'failed') escapeObjective.state = 'pending';
            if (squadObjective) squadObjective.state = anyPlayerDead ? 'failed' : 'pending';
            this.missionStatus = 'failure';
            this.message = `Mission failure: ${this.missionTargetId} was killed.`;
        } else if (targetEscaped) {
            if (escapeObjective) escapeObjective.state = 'failed';
            if (squadObjective && squadObjective.state !== 'failed') squadObjective.state = 'pending';
            this.missionStatus = 'failure';
            this.message = `Mission failure: ${this.missionTargetId} escaped with armed guard support.`;
        } else if (anyPlayerDead) {
            if (squadObjective) squadObjective.state = 'failed';
            if (escapeObjective && escapeObjective.state !== 'failed') escapeObjective.state = 'pending';
            this.missionStatus = 'failure';
            this.message = 'Mission failure: a SWAT operator was killed.';
        } else if (this.objectives.every((objective) => objective.state === 'complete')) {
            if (escapeObjective && escapeObjective.state !== 'failed') escapeObjective.state = 'complete';
            if (squadObjective && squadObjective.state !== 'failed') squadObjective.state = 'complete';
            this.missionStatus = 'success';
            this.message = `Mission success: ${this.missionTargetId} arrested.`;
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
            const prefix = objective.state === 'complete' ? '[✓]' : objective.state === 'failed' ? '[✗]' : '[ ]';
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

    /**
     * @param {GameIntent} intent
     * @returns {boolean}
     */
    intentMatchesObligation(intent) {
        const expected = this.obligationTimeline[this.obligationIndex];
        if (!expected) return true;
        return JSON.stringify(expected) === JSON.stringify(intent);
    }

    /**
     * @param {GameIntent} intent
     * @param {TimelineEvent['result']} result
     * @param {string} message
     */
    recordTimelineEvent(intent, result, message) {
        const player = this.getActivePlayer();
        this.timeline.push({
            turn: this.timelineTurn,
            tick: this.timelineTick,
            actorId: player?.id ?? 'none',
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
        this.timeline = parsed;
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
        this.obligationTimeline = this.timeline
            .filter((event) => event.result === 'applied')
            .map((event) => event.intent);
        this.replayMode = true;
        this.obligationIndex = 0;
        this.missionIndex += 1;
        this.missionSeed = this.computeMissionSeed(this.runSeed, this.missionIndex);
        this.setupMissionFromCurrentSeeds();
        this.timeline = [];
        this.timelineTick = 0;
        this.timelineTurn = 1;
        this.message = `Obligation loop started. Match ${this.obligationTimeline.length} recorded intents.`;
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
            enemyStatusText: this.enemyStatusSummary(),
            signalStatusText: this.signalStatusSummary(),
        };
    }
}
