//@ts-check

import { Facing, FacingVec } from "./facing.js";
import { MetaLayers, MissionMap } from "./map.js";
import { PlayerCharacter } from "./character.js";
import { ArrestAction, Rifle } from "./action.js";

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
 * }} GameView
 */

export class GameState {
    /** @type {MissionMap} */
    missionMap;
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
        const player = this.getActivePlayer();
        if (!player) return;
        if (![...player.actions].some((action) => action instanceof Rifle)) {
            player.addAction(new Rifle());
        }
        if (![...player.actions].some((action) => action instanceof ArrestAction)) {
            player.addAction(new ArrestAction());
        }
        player.updateFoV(this.missionMap);
        this.missionMap.updateCharacterVisibility(true);
        this.activePlayerAction = null;
        this.activePlayerActionData = null;
        this.selectorCells = [];
        this.selectorIndex = -1;
        this.initializeObjectives();
        this.missionStatus = 'active';
        this.message = `Mission started (run:${this.runSeed}, mission:${this.missionIndex}, seed:${this.missionSeed})`;
        this.updateMissionOutcome();
    }

    initializeObjectives() {
        this.objectives = [
            { id: 'locateTarget', text: `Locate target ${this.missionTargetId}`, state: 'pending' },
            { id: 'arrestTarget', text: `Arrest target ${this.missionTargetId}`, state: 'pending' },
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
        for (const enemy of this.missionMap.enemies) {
            enemy.takeTurn(this.missionMap);
        }
        player.actionsThisTurn = 2;
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

    updateMissionOutcome() {
        const target = this.getMissionTarget();
        const locateObjective = this.objectives.find((o) => o.id === 'locateTarget');
        const arrestObjective = this.objectives.find((o) => o.id === 'arrestTarget');
        if (target && this.getActivePlayer()?.canSee(target, this.missionMap)) {
            if (locateObjective) locateObjective.state = 'complete';
        }
        const targetArrested = target?.state === 'surrendering';
        if (targetArrested && arrestObjective) {
            arrestObjective.state = 'complete';
        }

        const allPlayersDead = this.missionMap.playerCharacters.every((pc) => pc.state === 'dead');
        if (target?.state === 'dead' && !targetArrested) {
            if (arrestObjective) arrestObjective.state = 'failed';
            this.missionStatus = 'failure';
            this.message = `Mission failure: ${this.missionTargetId} was killed.`;
        } else if (allPlayersDead) {
            this.missionStatus = 'failure';
            this.message = 'Mission failure: all operators down.';
        } else if (this.objectives.every((objective) => objective.state === 'complete')) {
            this.missionStatus = 'success';
            this.message = `Mission success: ${this.missionTargetId} arrested.`;
        } else if (this.missionStatus === 'notStarted') {
            this.missionStatus = 'active';
        }
    }

    objectiveSummary() {
        return this.objectives.map((objective) => {
            const prefix = objective.state === 'complete' ? '[✓]' : objective.state === 'failed' ? '[✗]' : '[ ]';
            return `${prefix} ${objective.text}`;
        }).join(' | ');
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
        };
    }
}
