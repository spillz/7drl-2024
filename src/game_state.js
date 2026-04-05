//@ts-check

import { Facing, FacingVec } from "./facing.js";
import { MetaLayers, MissionMap } from "./map.js";
import { PlayerCharacter } from "./character.js";
import { Rifle } from "./action.js";

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
 * }} GameIntent
 */

/**
 * @typedef {{
 *   message: string,
 *   awaitingSelection: boolean,
 *   selectorCells: import('eskv/lib/eskv.js').Vec2[],
 *   selectorIndex: number,
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
    /** @type {import('eskv/lib/eskv.js').Vec2[]} */
    selectorCells = [];
    selectorIndex = -1;

    /** @param {MissionMap} missionMap */
    constructor(missionMap) {
        this.missionMap = missionMap;
    }

    setupLevel() {
        this.missionMap.setupLevel();
        const player = this.getActivePlayer();
        if (!player) return;
        if (![...player.actions].some((action) => action instanceof Rifle)) {
            player.addAction(new Rifle());
        }
        player.updateFoV(this.missionMap);
        this.missionMap.updateCharacterVisibility(true);
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
        const player = this.getActivePlayer();
        if (!player) return;

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
        this.missionMap.updateCharacterVisibility(true);
    }

    /** @returns {GameView} */
    getView() {
        return {
            message: this.message,
            awaitingSelection: this.activePlayerAction !== null,
            selectorCells: this.selectorCells,
            selectorIndex: this.selectorIndex,
        };
    }
}
