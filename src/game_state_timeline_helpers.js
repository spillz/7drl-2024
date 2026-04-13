//@ts-nocheck

import * as eskv from "eskv/lib/eskv.js";
import { Facing, FacingVec } from "./facing.js";
import { LayoutTiles, MetaLayers, MissionMap } from "./map.js";
import { Character, PlayerCharacter } from "./character_widget.js";
import { CharacterStateData } from "./character_state.js";
import { MissionSpatial } from "./mission_spatial.js";
import {
    AimAction,
    ArrestAction,
    BreachBombAction,
    CutterAction,
    DecoyAction,
    DoorAction,
    FiberCameraAction,
    FragGrenadeAction,
    LockpickAction,
    Rifle,
    SmokeGrenadeAction,
    StealthTakedownAction,
    SuppressAction,
} from "./action.js";
import { DoorWidget } from "./entity_widget.js";


export function startObligationLoop(game) {
        if (game.replayMode) {
            game.message = 'Obligation loop already active.';
            game.addLog(game.message);
            return;
        }
        const bypassingObjectiveGate = game.missionStatus !== 'success';
        game.rememberSeenFromCurrentMap();
        game.snapshotRandyPathFromTimeline();
        game.buildRandyReplayScriptFromTimeline();
        game.buildMariaRequestsFromTimeline();
        game.snapshotObligationObjectivesFromRequests();
        game.replayMode = true;
        game.anomalyCount = 0;
        for (const request of game.mariaRequests) {
            request.fulfilled = false;
            request.fulfilledTick = null;
        }
        game.ensureInitialPlayerPositions();
        game.setupMissionFromCurrentSeeds();
        game.setActivePlayerById('maria');
        game.applyPersistentSeenToMap();
        game.ensureReplayGhostVisible();
        game.timeline = [];
        game.timelineTick = 0;
        game.timelineTurn = 1;
        game.message = bypassingObjectiveGate
            ? `Obligation loop started (debug bypass: first run incomplete). Maria requests queued: ${game.mariaRequests.length}.`
            : `Obligation loop started. Maria requests queued: ${game.mariaRequests.length}.`;
        game.addLog(game.message);

    }

export function rewindToTick(game, tick) {
        const clamped = Math.max(0, tick);
        const intentsToApply = game.timeline
            .filter((event) => event.result === 'applied' && event.tick <= clamped)
            .map((event) => event.intent);
        game.ensureInitialPlayerPositions();
        game.setupMissionFromCurrentSeeds();
        game.missionStatus = 'active';
        game.timelineTurn = 1;
        game.timelineTick = 0;
        game.timeline = [];
        for (const intent of intentsToApply) {
            game.applyIntent(intent, true);
            game.timelineTick++;
            game.recordTimelineEvent(intent, 'rewind', `Reapplied while rewinding to tick ${clamped}`);
        }
        game.message = `Rewound to tick ${clamped}.`;

    }

export function deserializeTimeline(game, serialized) {
        /** @type {TimelineEvent[]} */
        const parsed = JSON.parse(serialized);
        game.timeline = parsed.map((event) => ({
            ...event,
            actorPos: event.actorPos ? [event.actorPos[0], event.actorPos[1]] : null,
        }));
        game.timelineTick = game.timeline.length > 0 ? game.timeline[game.timeline.length - 1].tick : 0;

    }

export function serializeTimeline(game) {
        return JSON.stringify(game.timeline);

    }

export function recordTimelineEvent(game, intent, result, message, turn = this.timelineTurn, tick = this.timelineTick, actor = this.getActivePlayer()) {
        game.timeline.push({
            turn,
            tick,
            actorId: actor?.id ?? 'none',
            actorPos: actor ? [actor.gpos[0], actor.gpos[1]] : null,
            intent,
            result,
            message,
        });

    }

export function clearSelectionState(game, message) {
        game.activePlayerAction = null;
        game.activePlayerActionData = null;
        game.pendingMariaRequestSelection = null;
        game.mariaSelectionPreviewEarliestTurn = null;
        game.mariaSelectionPreviewFeasible = null;
        game.selectorCells = [];
        game.selectorIndex = -1;
        game.message = message;

    }

export function confirmSelection(game, player) {
        if (game.pendingMariaRequestSelection) {
            const selection = game.pendingMariaRequestSelection;
            if (game.selectorIndex < 0) return { progressedTurn: false, intentApplied: false };
            /** @type {string | undefined} */
            let targetCharacterId = undefined;
            /** @type {import('eskv/lib/eskv.js').VecLike | undefined} */
            let targetPosition = undefined;
            if (selection.validTargetCharacters && selection.validTargetCharacters.length > game.selectorIndex) {
                const target = selection.validTargetCharacters[game.selectorIndex];
                targetCharacterId = target.id;
                targetPosition = [target.gpos[0], target.gpos[1]];
            } else if (selection.validTargetPositions && selection.validTargetPositions.length > game.selectorIndex) {
                const pos = selection.validTargetPositions[game.selectorIndex];
                targetPosition = [pos[0], pos[1]];
            } else {
                return { progressedTurn: false, intentApplied: false };
            }
            /** @type {GameIntent} */
            const queuedIntent = { type: 'requestActionFromKey', key: selection.key };
            if (targetCharacterId) queuedIntent.targetCharacterId = targetCharacterId;
            if (targetPosition) queuedIntent.targetPosition = [targetPosition[0], targetPosition[1]];
            const queuedApplied = game.queueMariaRequestWithImmediateProjection(
                player,
                selection.key,
                targetCharacterId ?? null,
                targetPosition ?? null,
            );
            if (!queuedApplied) return { progressedTurn: false, intentApplied: false };
            game.timelineIntentOverride = queuedIntent;
            game.clearSelectionState(game.message);
            return { progressedTurn: false, intentApplied: true };
        }
        if (!game.activePlayerAction || !game.activePlayerActionData) return { progressedTurn: false, intentApplied: false };
        if (game.selectorIndex < 0) return { progressedTurn: false, intentApplied: false };
        const completedActionKey = game.activePlayerAction.keyControl ? game.normalizeRequestKey(game.activePlayerAction.keyControl) : '';
        const responseData = game.activePlayerActionData;
        if (responseData.validTargetCharacters && responseData.validTargetCharacters.length > 0) {
            responseData.targetCharacter = responseData.validTargetCharacters[game.selectorIndex];
        } else if (responseData.validTargetPositions && responseData.validTargetPositions.length > 0) {
            responseData.targetPosition = responseData.validTargetPositions[game.selectorIndex];
        }
        const response = player.takeAction(game.activePlayerAction, game.missionMap, responseData);
        game.handleActionResponse(game.activePlayerAction, response);
        if (response.result === 'complete') {
            game.lastCompletedActionKey = completedActionKey;
        }
        return {
            progressedTurn: response.result === 'complete',
            intentApplied: response.result === 'complete',
        };

    }

export function moveSelection(game, direction) {
        if (game.selectorCells.length === 0 || game.selectorIndex < 0) return;
        const activePos = game.selectorCells[game.selectorIndex];
        let maxDist = 0;
        let minDist = Number.POSITIVE_INFINITY;
        let minDistIndex = -1;
        let maxDistIndex = game.selectorIndex;
        for (let i = 0; i < game.selectorCells.length; i++) {
            const pos = game.selectorCells[i];
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
        game.selectorIndex = minDistIndex >= 0 ? minDistIndex : maxDistIndex;
        if (game.pendingMariaRequestSelection) {
            const active = game.getActivePlayer();
            if (active?.id === 'randy') {
                game.updateMariaRequestSelectionPrompt(active);
            }
        }

    }

export function handleActionResponse(game, action, response) {
        if (response.result === 'complete' || response.result === 'notAvailable' || response.result === 'invalid') {
            game.activePlayerAction = null;
            game.activePlayerActionData = null;
            game.selectorCells = [];
            game.selectorIndex = -1;
            game.message = response.message ?? 'unknown action response';
            return;
        }
        if (response.result === 'infoNeeded') {
            game.activePlayerAction = action;
            game.activePlayerActionData = response;
            game.selectorCells = response.validTargetCharacters
                ? response.validTargetCharacters.map((target) => target.gpos)
                : (response.validTargetPositions ?? []);
            game.selectorIndex = game.selectorCells.length > 0 ? 0 : -1;
            game.message = response.message ?? 'unknown action response';
        }

    }

export function applyIntent(game, intent, suppressTimeline = false) {
        const player = game.ensureControllableActivePlayer(false);
        if (!player) return false;
        const apBeforeIntent = player.actionsThisTurn;

        let progressedTurn = false;
        let intentApplied = false;
        game.lastCompletedActionKey = '';

        if (!game.isAwaitingSelection()) {
            switch (intent.type) {
                case 'move':
                    player.move(intent.direction, game.missionMap);
                    game.message = `${player.id} moved.`;
                    progressedTurn = true;
                    intentApplied = true;
                    break;
                case 'rest':
                    player.rest(game.missionMap);
                    game.message = `${player.id} paused.`;
                    progressedTurn = true;
                    intentApplied = true;
                    break;
                case 'startActionFromKey': {
                    const requestedKey = game.normalizeRequestKey(intent.key);
                    if (game.replayMode && player.id === 'maria') {
                        const queuedRequest = game.mariaRequests.find((candidate) =>
                            !candidate.fulfilled
                            && candidate.turn === game.timelineTurn
                            && candidate.key === requestedKey,
                        );
                        if (queuedRequest) {
                            const applied = game.applyOrderedMariaAction(player, queuedRequest);
                            if (applied) {
                                intentApplied = true;
                                progressedTurn = true;
                                game.lastCompletedActionKey = requestedKey;
                                break;
                            }
                        }
                    }
                    const action = player.getActionForKey(intent.key);
                    if (!action) break;
                    const response = player.takeAction(action, game.missionMap);
                    game.handleActionResponse(action, response);
                    intentApplied = response.result !== 'notAvailable';
                    if (response.result === 'complete') {
                        progressedTurn = true;
                        game.lastCompletedActionKey = game.normalizeRequestKey(intent.key);
                    }
                    break;
                }
                case 'requestActionFromKey': {
                    const requestedKey = game.normalizeRequestKey(intent.key);
                    if (player.id !== 'randy' || game.replayMode) {
                        game.message = 'Only Randy can queue Maria requests before replay starts.';
                        break;
                    }
                    const hasOrderThisTurn = game.timeline.some((event) =>
                        event.result === 'applied'
                        && event.actorId === 'randy'
                        && event.turn === game.timelineTurn
                        && event.intent.type === 'requestActionFromKey',
                    );
                    if (hasOrderThisTurn) {
                        game.message = `Only one Maria order may be queued on turn ${game.timelineTurn}.`;
                        break;
                    }
                    if (!game.isSupportedRequestKey(requestedKey)) {
                        game.message = `No Maria request mapping for '${intent.key}'.`;
                        break;
                    }
                    if (requestedKey === 'q') {
                        intentApplied = game.queueMariaRequestWithImmediateProjection(
                            player,
                            requestedKey,
                            null,
                            null,
                        );
                        break;
                    }
                    const hasResolvedTarget = typeof intent.targetCharacterId === 'string'
                        || (Array.isArray(intent.targetPosition) && intent.targetPosition.length >= 2);
                    if (!hasResolvedTarget) {
                        game.beginMariaRequestSelection(player, requestedKey);
                        break;
                    }
                    const targetCharacterId = typeof intent.targetCharacterId === 'string' ? intent.targetCharacterId : null;
                    const targetPosition = Array.isArray(intent.targetPosition)
                        ? [intent.targetPosition[0], intent.targetPosition[1]]
                        : null;
                    intentApplied = game.queueMariaRequestWithImmediateProjection(
                        player,
                        requestedKey,
                        targetCharacterId,
                        targetPosition,
                    );
                    break;
                }
                case 'debugRevealMap':
                    for (const p of game.missionMap.metaTileMap.layer[MetaLayers.seen].iterAll()) {
                        game.missionMap.metaTileMap.setInLayer(MetaLayers.seen, p, 1);
                        game.missionMap.tileMap.clearCache();
                    }
                    intentApplied = true;
                    break;
                default:
                    break;
            }
        } else {
            switch (intent.type) {
                case 'moveSelection':
                    game.moveSelection(FacingVec[intent.direction]);
                    intentApplied = true;
                    break;
                case 'confirmSelection':
                    {
                        const selectionResult = game.confirmSelection(player);
                        progressedTurn = selectionResult.progressedTurn;
                        intentApplied = selectionResult.intentApplied;
                    }
                    break;
                case 'cancelSelection':
                    game.clearSelectionState('Action canceled.');
                    intentApplied = true;
                    break;
                default:
                    break;
            }
        }

        const actionsSpentThisIntent = Math.max(0, apBeforeIntent - player.actionsThisTurn);
        game.addPlayerTurnActionsTaken(player.id, actionsSpentThisIntent);
        if (progressedTurn) {
            game.resolveTurnProgression(player);
        }
        game.syncCharacterStateFromMap();
        game.updateTacticalStateFromMap();
        game.updateAwarenessStateFromPerception();
        game.updateEnemyBehaviorStateFromPerception();
        game.applyCharacterStateToMap();
        game.advanceTransientSignals();
        game.rememberSeenFromCurrentMap();
        if (game.replayMode) {
            game.applyPersistentSeenToMap();
        }
        game.applyVisibilityMode();
        game.ensureReplayGhostVisible();
        game.updateMissionOutcome();
        if (!suppressTimeline) {
            game.timelineTick++;
        }
        return intentApplied;

    }

export function dispatchIntent(game, intent) {
        if (intent.type === 'rewindToTick') {
            game.rewindToTick(intent.tick);
            return;
        }
        if (intent.type === 'startObligationLoop') {
            game.startObligationLoop();
            return;
        }
        const controllable = game.ensureControllableActivePlayer();
        if (!controllable) {
            game.missionStatus = 'failure';
            game.message = 'Mission failure: no SWAT operators remain combat-effective.';
            game.recordTimelineEvent(intent, 'blocked', game.message, game.timelineTurn, game.timelineTick, null);
            game.addLog(game.message);
            return;
        }
        const eventTurn = game.timelineTurn;
        const eventTick = game.timelineTick;
        const eventActor = controllable;

        if (game.missionStatus === 'success' || game.missionStatus === 'failure') {
            game.message = 'Mission already resolved. Rewind or start next loop.';
            game.recordTimelineEvent(intent, 'blocked', game.message, eventTurn, eventTick, eventActor);
            game.addLog(game.message);
            return;
        }

        game.timelineIntentOverride = null;
        const result = game.applyIntent(intent);
        const timelineIntent = game.timelineIntentOverride ?? intent;
        game.timelineIntentOverride = null;
        game.recordTimelineEvent(timelineIntent, result ? 'applied' : 'ignored', game.message, eventTurn, eventTick, eventActor);
        if (result && timelineIntent.type === 'requestActionFromKey' && !game.replayMode) {
            game.buildMariaRequestsFromTimeline();
            game.snapshotObligationObjectivesFromRequests();
        }
        if (result) {
            game.applyReplayObligationResult(timelineIntent, eventTurn, eventTick);
            game.addLog(game.message);
        }

    }

export function getSelectionKind(game) {
        if (game.pendingMariaRequestSelection) return 'order';
        if (game.activePlayerAction) return 'action';
        return 'none';

    }

export function isAwaitingSelection(game) {
        return game.activePlayerAction !== null || game.pendingMariaRequestSelection !== null;

    }

export function ensureControllableActivePlayer(game, refreshVision = true) {
        const current = game.getActivePlayer();
        if (current) return current;
        const fallback = game.missionMap.playerCharacters.find((player) => player.state !== 'dead' && player.health > 0) ?? null;
        for (const player of game.missionMap.playerCharacters) {
            player.activeCharacter = fallback === player;
        }
        game.missionMap.activeCharacter = fallback;
        if (fallback && refreshVision) {
            fallback.updateFoV(game.missionMap);
            game.missionMap.updateCharacterVisibility(true);
        }
        return fallback;

    }

export function getActivePlayer(game) {
        const active = game.missionMap.activeCharacter;
        if (!(active instanceof PlayerCharacter)) return null;
        if (active.state === 'dead' || active.health <= 0) return null;
        return active;

    }

export function applyOrderedMariaAction(game, maria, request) {
        if (maria.actionsThisTurn <= 0) {
            game.message = 'Maria has no actions remaining.';
            return false;
        }
        const action = maria.getActionForKey(request.key);
        if (!action) {
            game.message = `Maria does not have action '${request.key}'.`;
            return false;
        }
        const target = game.findEnemyById(request.targetCharacterId);
        if (request.key === 'g') {
            if (!target || target.state === 'dead') {
                game.message = 'Maria ordered arrest target unavailable.';
                return false;
            }
            game.detainEnemy(target);
            maria.actionsThisTurn--;
            game.message = `Maria ordered arrest on ${target.id}.`;
            return true;
        }
        if (request.key === 't') {
            if (!target || target.state === 'dead') {
                game.message = 'Maria ordered takedown target unavailable.';
                return false;
            }
            target.state = 'unconscious';
            maria.actionsThisTurn--;
            game.message = `Maria ordered takedown on ${target.id}.`;
            return true;
        }
        if ((request.key === 'h' || request.key === 'j' || request.key === 'k' || request.key === 'b' || request.key === 'u') && !request.targetPosition) {
            game.message = `Maria ordered ${game.describeRequestKey(request.key)} target unavailable.`;
            return false;
        }
        if (request.key === 'h') {
            const door = game.getDoorAt(request.targetPosition);
            if (!door || (door.state !== 'open' && door.state !== 'closed')) {
                game.message = 'Maria ordered door target unavailable.';
                return false;
            }
            const pseudoActor = /** @type {Character} */ (maria);
            door.interact(game.missionMap, pseudoActor);
            maria.actionsThisTurn--;
            game.message = `Maria ordered door ${door.state === 'open' ? 'open' : 'close'} at ${door.pos[0]},${door.pos[1]}.`;
            return true;
        }
        if (request.key === 'j') {
            const door = game.getDoorAt(request.targetPosition);
            if (!door || door.state !== 'closed') {
                game.message = 'Maria ordered lockpick target unavailable.';
                return false;
            }
            door.lockState = 'unlocked';
            const pseudoActor = /** @type {Character} */ (maria);
            door.interact(game.missionMap, pseudoActor);
            maria.actionsThisTurn--;
            game.message = `Maria ordered lockpick at ${door.pos[0]},${door.pos[1]}.`;
            return true;
        }
        if (request.key === 'k') {
            const door = game.getDoorAt(request.targetPosition);
            if (!door) {
                game.message = 'Maria ordered fiber camera target unavailable.';
                return false;
            }
            const observerPos = game.replayMode
                ? maria.gpos
                : request.sourcePos ?? maria.gpos;
            const camera = game.missionMap.deployFiberCamera(maria.id, observerPos, door.pos.add([0, 0]));
            if (!camera) {
                game.message = 'Maria ordered fiber camera could not be placed.';
                return false;
            }
            maria.actionsThisTurn--;
            game.message = `Maria ordered fiber camera at ${door.pos[0]},${door.pos[1]}.`;
            return true;
        }
        if (request.key === 'u') {
            const pos = eskv.v2([request.targetPosition[0], request.targetPosition[1]]);
            const layout = game.missionMap.metaTileMap.layer[MetaLayers.layout];
            const tile = layout.get(pos);
            if (tile !== LayoutTiles.window && tile !== LayoutTiles.coveredWindow) {
                game.message = 'Maria ordered cutter target invalid.';
                return false;
            }
            layout.set(pos, LayoutTiles.brokenWindow);
            game.missionMap.updateTileInfo(pos);
            maria.actionsThisTurn--;
            game.message = `Maria ordered cutter at ${pos[0]},${pos[1]}.`;
            return true;
        }
        /** @type {import('./action.js').ActionResponseData} */
        const actionRequest = { mode: 'ordered' };
        if (request.targetCharacterId) {
            const target = game.findEnemyById(request.targetCharacterId);
            if (!target || target.state === 'dead') {
                game.message = `Maria ordered ${game.describeRequestKey(request.key)} target unavailable.`;
                return false;
            }
            actionRequest.targetCharacter = target;
        }
        if (request.targetPosition) {
            actionRequest.targetPosition = eskv.v2([request.targetPosition[0], request.targetPosition[1]]);
        }
        let response = maria.takeAction(action, game.missionMap, actionRequest);
        if (response.result === 'infoNeeded') {
            if (response.validTargetCharacters && response.validTargetCharacters.length > 0) {
                actionRequest.targetCharacter = response.validTargetCharacters[0];
            } else if (response.validTargetPositions && response.validTargetPositions.length > 0) {
                actionRequest.targetPosition = response.validTargetPositions[0];
            } else {
                game.message = response.message ?? `Maria cannot perform ${game.describeRequestKey(request.key)} now.`;
                return false;
            }
            response = maria.takeAction(action, game.missionMap, actionRequest);
        }
        if (response.result !== 'complete') {
            game.message = response.message ?? `Maria failed to perform ${game.describeRequestKey(request.key)}.`;
            return false;
        }
        game.message = response.message ?? `Maria ordered ${game.describeRequestKey(request.key)}.`;
        return true;

    }

export function queueMariaRequestWithImmediateProjection(game, randy, key, targetCharacterId, targetPosition) {
        const projected = game.applyProjectedMariaOrderDuringRandyRun(randy, key, targetCharacterId, targetPosition);
        if (!projected) return false;
        const actionResultText = game.message;
        const targetText = targetCharacterId
            ? targetCharacterId
            : targetPosition
                ? `${targetPosition[0]},${targetPosition[1]}`
                : 'unknown';
        game.message = `${actionResultText} Queued Maria request for T${game.timelineTurn}: ${game.describeRequestKey(key)} -> ${targetText}.`;
        return true;

    }

export function applyProjectedMariaOrderDuringRandyRun(game, randy, key, targetCharacterId, targetPosition) {
        if (game.replayMode || randy.id !== 'randy') {
            game.message = 'Maria projected orders are only available during Randy run.';
            return false;
        }
        const maria = game.missionMap.playerCharacters.find((player) => player.id === 'maria') ?? null;
        if (!maria) {
            game.message = 'Maria unavailable for projected order.';
            return false;
        }
        /** @type {MariaRequest} */
        const request = {
            turn: game.timelineTurn,
            key,
            sourcePos: [randy.gpos[0], randy.gpos[1]],
            targetCharacterId,
            targetPosition: targetPosition ? [targetPosition[0], targetPosition[1]] : null,
            fulfilled: false,
            fulfilledTick: null,
            label: game.describeRequestKey(key),
        };
        const priorMariaActions = maria.actionsThisTurn;
        const mariaData = game.characterState.get(maria.id);
        const priorMariaDataActions = mariaData?.actionsRemaining ?? priorMariaActions;
        if (maria.actionsThisTurn <= 0) maria.actionsThisTurn = 1;
        if (mariaData && mariaData.actionsRemaining <= 0) mariaData.actionsRemaining = 1;
        const applied = game.applyOrderedMariaAction(maria, request);
        maria.actionsThisTurn = priorMariaActions;
        if (mariaData) mariaData.actionsRemaining = priorMariaDataActions;
        return applied;

    }

export function updateMariaRequestSelectionPrompt(game, randy) {
        const selection = game.pendingMariaRequestSelection;
        if (!selection || game.selectorIndex < 0) return;
        const target = game.resolveMariaSelectionTarget(selection, game.selectorIndex);
        const targetText = target.targetCharacterId
            ? target.targetCharacterId
            : target.targetPosition
                ? `${target.targetPosition[0]},${target.targetPosition[1]}`
                : 'unknown';
        const estimate = game.estimateMariaSelectionFeasibility(randy, selection, game.selectorIndex);
        if (!estimate || !Number.isFinite(estimate.earliestTurn) || estimate.earliestTurn === Number.MAX_SAFE_INTEGER) {
            game.mariaSelectionPreviewEarliestTurn = null;
            game.mariaSelectionPreviewFeasible = false;
            game.message = `Select target for Maria order: ${game.describeRequestKey(selection.key)} -> ${targetText}. No feasible execution path.`;
            return;
        }
        game.mariaSelectionPreviewEarliestTurn = estimate.earliestTurn;
        game.mariaSelectionPreviewFeasible = estimate.feasible;
        if (estimate.feasible) {
            game.message = `Select target for Maria order: ${game.describeRequestKey(selection.key)} -> ${targetText}. Feasible (earliest T${estimate.earliestTurn}).`;
        } else {
            game.message = `Select target for Maria order: ${game.describeRequestKey(selection.key)} -> ${targetText}. Infeasible for T${game.timelineTurn} (earliest T${estimate.earliestTurn}).`;
        }

    }

export function estimateMariaSelectionFeasibility(game, randy, selection, index) {
        const target = game.resolveMariaSelectionTarget(selection, index);
        if (!target.targetPosition && !target.targetCharacterId) return null;
        game.buildMariaRequestsFromTimeline();
        const planned = game.mariaRequests.map((request) => game.cloneMariaRequest(request));
        planned.push({
            turn: game.timelineTurn,
            key: selection.key,
            sourcePos: [randy.gpos[0], randy.gpos[1]],
            targetCharacterId: target.targetCharacterId,
            targetPosition: target.targetPosition
                ? [target.targetPosition[0], target.targetPosition[1]]
                : null,
            earliestTurn: 1,
            feasible: true,
            fulfilled: false,
            fulfilledTick: null,
            label: game.describeRequestKey(selection.key),
        });
        game.computeMariaRequestFeasibility(planned);
        const latest = planned[planned.length - 1];
        const earliestTurn = typeof latest.earliestTurn === 'number'
            ? latest.earliestTurn
            : Number.MAX_SAFE_INTEGER;
        return {
            earliestTurn,
            feasible: latest.feasible === true,
        };

    }

export function resolveMariaSelectionTarget(game, selection, index) {
        if (selection.validTargetCharacters && selection.validTargetCharacters.length > index) {
            const target = selection.validTargetCharacters[index];
            return {
                targetCharacterId: target.id,
                targetPosition: target.gpos.add([0, 0]),
            };
        }
        if (selection.validTargetPositions && selection.validTargetPositions.length > index) {
            const pos = selection.validTargetPositions[index];
            return {
                targetCharacterId: null,
                targetPosition: eskv.v2([pos[0], pos[1]]),
            };
        }
        return { targetCharacterId: null, targetPosition: null };

    }

export function beginMariaRequestSelection(game, randy, key) {
        const targets = game.getOrderTargetsFromRandyLOS(randy, key);
        if (!targets) {
            game.message = `No visible target for Maria order '${game.describeRequestKey(key)}'.`;
            return false;
        }
        game.activePlayerAction = null;
        game.activePlayerActionData = null;
        game.pendingMariaRequestSelection = {
            key,
            validTargetCharacters: targets.validTargetCharacters,
            validTargetPositions: targets.validTargetPositions,
        };
        game.selectorCells = targets.validTargetCharacters
            ? targets.validTargetCharacters.map((target) => target.gpos)
            : (targets.validTargetPositions ?? []);
        game.selectorIndex = game.selectorCells.length > 0 ? 0 : -1;
        game.mariaSelectionPreviewEarliestTurn = null;
        game.mariaSelectionPreviewFeasible = null;
        if (game.selectorCells.length > 0) {
            game.updateMariaRequestSelectionPrompt(randy);
        } else {
            game.message = `Select target for Maria order: ${game.describeRequestKey(key)}.`;
        }
        return game.selectorCells.length > 0;

    }

export function getOrderTargetsFromRandyLOS(game, randy, key) {
        const layout = game.missionMap.metaTileMap.layer[MetaLayers.layout];
        const seenLayer = game.missionMap.metaTileMap.layer[MetaLayers.seen];
        const isVisible = (pos) => randy._visibleLayer.get(pos) === 1;
        const isKnown = (pos) => seenLayer.get(pos) > 0;
        if (key === 'f' || key === 'g' || key === 't') {
            const visibleEnemies = game.missionMap.enemies
                .filter((enemy) => enemy.state !== 'dead' && randy.canSee(enemy, game.missionMap))
                .sort((a, b) => a.gpos.dist(randy.gpos) - b.gpos.dist(randy.gpos) || a.id.localeCompare(b.id));
            if (visibleEnemies.length === 0) return null;
            return { validTargetCharacters: visibleEnemies };
        }
        if (key === 'c') {
            /** @type {import('eskv/lib/eskv.js').Vec2[]} */
            const knownSuppressAnchors = [];
            for (const rawPos of layout.iterAll()) {
                const pos = eskv.v2(rawPos);
                const traversible = game.missionMap.metaTileMap.getFromLayer(MetaLayers.traversible, pos);
                if (typeof traversible !== 'number' || traversible <= 0) continue;
                if (isKnown(pos)) knownSuppressAnchors.push(pos.add([0, 0]));
            }
            if (knownSuppressAnchors.length === 0) return null;
            knownSuppressAnchors.sort((a, b) => a.dist(randy.gpos) - b.dist(randy.gpos));
            return { validTargetPositions: knownSuppressAnchors };
        }
        if (key === 'x') {
            /** @type {import('eskv/lib/eskv.js').Vec2[]} */
            const visibleWalkable = [];
            for (const rawPos of layout.iterAll()) {
                const pos = eskv.v2(rawPos);
                const tile = layout.get(pos);
                if (tile !== LayoutTiles.floor && tile !== LayoutTiles.hallway) continue;
                if (isKnown(pos)) visibleWalkable.push(pos.add([0, 0]));
            }
            if (visibleWalkable.length === 0) return null;
            visibleWalkable.sort((a, b) => a.dist(randy.gpos) - b.dist(randy.gpos));
            return { validTargetPositions: visibleWalkable };
        }
        if (key === 'n' || key === 'm') {
            /** @type {import('eskv/lib/eskv.js').Vec2[]} */
            const knownThrowTargets = [];
            for (const rawPos of layout.iterAll()) {
                const pos = eskv.v2(rawPos);
                const tile = layout.get(pos);
                if (tile !== LayoutTiles.floor && tile !== LayoutTiles.hallway) continue;
                if (isKnown(pos)) knownThrowTargets.push(pos.add([0, 0]));
            }
            if (knownThrowTargets.length === 0) return null;
            knownThrowTargets.sort((a, b) => a.dist(randy.gpos) - b.dist(randy.gpos));
            return { validTargetPositions: knownThrowTargets };
        }
        if (key === 'h' || key === 'j' || key === 'k') {
            const visibleDoors = game.missionMap.entities.children
                .filter((entity) => entity instanceof DoorWidget)
                .filter((door) => key !== 'j' || door.state === 'closed')
                .filter((door) => isKnown(door.pos))
                .map((door) => door.pos.add([0, 0]))
                .sort((a, b) => a.dist(randy.gpos) - b.dist(randy.gpos));
            if (visibleDoors.length === 0) return null;
            return { validTargetPositions: visibleDoors };
        }
        if (key === 'u') {
            /** @type {import('eskv/lib/eskv.js').Vec2[]} */
            const visibleWindows = [];
            for (const rawPos of layout.iterAll()) {
                const pos = eskv.v2(rawPos);
                const tile = layout.get(pos);
                if (tile !== LayoutTiles.window && tile !== LayoutTiles.coveredWindow) continue;
                if (isKnown(pos)) visibleWindows.push(pos.add([0, 0]));
            }
            if (visibleWindows.length === 0) return null;
            visibleWindows.sort((a, b) => a.dist(randy.gpos) - b.dist(randy.gpos));
            return { validTargetPositions: visibleWindows };
        }
        if (key === 'b') {
            /** @type {import('eskv/lib/eskv.js').Vec2[]} */
            const breachable = [];
            for (const rawPos of layout.iterAll()) {
                const pos = eskv.v2(rawPos);
                const tile = layout.get(pos);
                const isTileBreachable = tile === LayoutTiles.wall
                    || tile === LayoutTiles.doorway
                    || tile === LayoutTiles.window
                    || tile === LayoutTiles.coveredWindow
                    || tile === LayoutTiles.brokenWindow;
                const hasDoor = game.getDoorAt(pos) instanceof DoorWidget;
                if ((isTileBreachable || hasDoor) && isKnown(pos)) {
                    breachable.push(pos.add([0, 0]));
                }
            }
            if (breachable.length === 0) return null;
            breachable.sort((a, b) => a.dist(randy.gpos) - b.dist(randy.gpos));
            return { validTargetPositions: breachable };
        }
        if (key === 'q') {
            return { validTargetPositions: [randy.gpos.add([0, 0])] };
        }
        return null;

    }

export function applyReplayObligationResult(game, intent, turn, tick) {
        if (!game.replayMode) return;
        const player = game.getActivePlayer();
        if (!player || player.id !== 'maria') return;
        const performedKey = game.intentToPerformedKey(intent);
        if (!performedKey) return;
        const request = game.mariaRequests.find((candidate) => !candidate.fulfilled && candidate.turn === turn && candidate.key === performedKey);
        if (request) {
            request.fulfilled = true;
            request.fulfilledTick = tick;
            game.addLog(`Maria fulfilled request: ${request.label} (T${request.turn})`);
            return;
        }
        game.anomalyCount++;
        game.message = `${game.message} [Anomaly +1: unrequested Maria action '${performedKey}']`;
        game.addLog(`ANOMALY +1 (unrequested Maria action '${performedKey}' on T${turn})`);

    }

export function finalizeMariaTurnObligations(game, turn) {
        if (!game.replayMode) return;
        const missed = game.mariaRequests.filter((request) => !request.fulfilled && request.turn === turn);
        if (missed.length === 0) return;
        game.anomalyCount += missed.length;
        game.missionStatus = 'failure';
        game.message = `Mission failure: missed ${missed.length} Maria request(s) on T${turn}.`;
        game.addLog(`ANOMALY +${missed.length} (missed requests on T${turn})`);

    }

export function runRandyReplayTurn(game, turn) {
        if (!game.replayMode) return;
        const scriptedIntents = game.randyReplayScriptByTurn.get(turn) ?? [];
        if (scriptedIntents.length === 0) return;
        const randy = game.missionMap.playerCharacters.find((player) => player.id === 'randy');
        if (!randy || randy.state === 'dead' || randy.health <= 0) return;
        randy.updateFoV(game.missionMap);
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
                randy.move(intent.direction, game.missionMap);
                if (randy.actionsThisTurn === apBefore) {
                    randy.actionsThisTurn = Math.max(0, randy.actionsThisTurn - 1);
                }
                randy.updateFoV(game.missionMap);
                continue;
            }
            if (intent.type === 'rest') {
                if (randy.actionsThisTurn <= 0) continue;
                randy.rest(game.missionMap);
                randy.updateFoV(game.missionMap);
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
                const response = randy.takeAction(action, game.missionMap);
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
                randy.updateFoV(game.missionMap);
                continue;
            }
            if (intent.type === 'moveSelection') {
                replaySelectorIndex = game.advanceSelectionIndex(replaySelectorCells, replaySelectorIndex, FacingVec[intent.direction]);
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
                const response = randy.takeAction(replayAction, game.missionMap, replayActionData);
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
                randy.updateFoV(game.missionMap);
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

export function advanceSelectionIndex(game, cells, index, direction) {
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

export function ensureReplayGhostVisible(game) {
        if (!game.replayMode) return;
        const randy = game.missionMap.playerCharacters.find((player) => player.id === 'randy');
        if (!randy) return;
        randy.visibleToPlayer = true;

    }

export function addLog(game, entry) {
        const line = `T${game.timelineTurn}#${game.timelineTick} ${entry}`;
        game.eventLog.push(line);
        if (game.eventLog.length > 80) {
            game.eventLog = game.eventLog.slice(game.eventLog.length - 80);
        }

    }

export function intentToPerformedKey(game, intent) {
        if (intent.type === 'move' || intent.type === 'rest') return null;
        if (intent.type === 'startActionFromKey') return game.lastCompletedActionKey || null;
        if (intent.type === 'confirmSelection') return game.lastCompletedActionKey || null;
        return null;

    }

export function isSupportedRequestKey(game, key) {
        return game.supportedRequestKeys.has(key);

    }

export function describeRequestKey(game, key) {
        if (key === 'f') return 'fire rifle';
        if (key === 'c') return 'suppress area';
        if (key === 'q') return 'steady aim';
        if (key === 'x') return 'deploy decoy';
        if (key === 'g') return 'arrest';
        if (key === 't') return 'takedown';
        if (key === 'h') return 'open/close door';
        if (key === 'j') return 'lockpick door';
        if (key === 'k') return 'fiber camera';
        if (key === 'b') return 'breach bomb';
        if (key === 'u') return 'window cutter';
        if (key === 'n') return 'frag grenade';
        if (key === 'm') return 'smoke grenade';
        return `action ${key}`;

    }

export function estimateMariaRequestFeasibility(game, targetPosition, requestTurn) {
        if (!targetPosition) return { earliestTurn: 1, feasible: true };
        const mariaStart = game.initialPlayerPositions.get('maria')
            ?? game.missionMap.playerCharacters.find((p) => p.id === 'maria')?.gpos
            ?? [0, 0];
        const distance = game.spatial.shortestTraverseDistance(mariaStart, targetPosition);
        if (!Number.isFinite(distance)) {
            return { earliestTurn: Number.MAX_SAFE_INTEGER, feasible: false };
        }
        // Two actions per turn, reserve one action for executing the requested order.
        const earliestTurn = Math.max(1, Math.ceil((distance + 1) / 2));
        return { earliestTurn, feasible: earliestTurn <= requestTurn };

    }

export function requestMarkerLabel(game, key) {
        if (key === 'f') return 'FIRE';
        if (key === 'c') return 'SUP';
        if (key === 'q') return 'AIM';
        if (key === 'x') return 'DECOY';
        if (key === 'g') return 'ARREST';
        if (key === 't') return 'TAKE';
        if (key === 'h') return 'DOOR';
        if (key === 'j') return 'PICK';
        if (key === 'k') return 'CAM';
        if (key === 'b') return 'BOMB';
        if (key === 'u') return 'CUT';
        if (key === 'n') return 'FRAG';
        if (key === 'm') return 'SMOKE';
        return key.toUpperCase();

    }

export function normalizeRequestKey(game, key) {
        if (key === 'space') return ' ';
        if (key.length === 1) return key.toLowerCase();
        return key.toLowerCase();

    }

export function cloneMariaRequest(game, request) {
        return {
            turn: request.turn,
            key: request.key,
            sourcePos: [request.sourcePos[0], request.sourcePos[1]],
            targetCharacterId: request.targetCharacterId,
            targetPosition: request.targetPosition
                ? [request.targetPosition[0], request.targetPosition[1]]
                : null,
            earliestTurn: request.earliestTurn,
            feasible: request.feasible,
            fulfilled: request.fulfilled,
            fulfilledTick: request.fulfilledTick,
            label: request.label,
        };

    }

export function computeMariaRequestFeasibility(game, requests) {
        const mariaStartLike = game.initialPlayerPositions.get('maria')
            ?? game.missionMap.playerCharacters.find((p) => p.id === 'maria')?.gpos
            ?? [0, 0];
        let previousOrderTurn = 0;
        let previousOrderPos = eskv.v2([mariaStartLike[0], mariaStartLike[1]]);
        for (const request of requests) {
            const candidates = game.spatial.getMariaExecutionCandidatesForRequest(request, previousOrderPos);
            let bestDistance = Number.POSITIVE_INFINITY;
            let bestCandidate = /** @type {import('eskv/lib/eskv.js').Vec2|null} */ (null);
            for (const candidate of candidates) {
                const dist = game.spatial.shortestTraverseDistance(previousOrderPos, candidate, true);
                if (dist < bestDistance) {
                    bestDistance = dist;
                    bestCandidate = candidate;
                }
            }
            if (!Number.isFinite(bestDistance) || !bestCandidate) {
                request.earliestTurn = Number.MAX_SAFE_INTEGER;
                request.feasible = false;
                continue;
            }
            const earliestTurn = previousOrderTurn <= 0
                ? Math.max(1, Math.ceil((bestDistance + 1) / 2))
                : previousOrderTurn + Math.ceil(bestDistance / 2);
            request.earliestTurn = earliestTurn;
            request.feasible = earliestTurn <= request.turn;
            previousOrderTurn = Math.max(request.turn, earliestTurn);
            previousOrderPos = bestCandidate.add([0, 0]);
        }

    }

export function refreshMariaRequestFeasibility(game) {
        game.computeMariaRequestFeasibility(game.mariaRequests);

    }

export function snapshotObligationObjectivesFromRequests(game) {
        game.refreshMariaRequestFeasibility();
        game.obligationObjectives = game.mariaRequests.map((request, index) => {
            return {
                turn: request.turn,
                tick: request.fulfilledTick ?? index,
                actorId: 'maria',
                position: request.targetPosition
                    ? [request.targetPosition[0], request.targetPosition[1]]
                    : [request.sourcePos[0], request.sourcePos[1]],
                label: request.feasible
                    ? `${game.requestMarkerLabel(request.key)} T${request.turn}`
                    : `${game.requestMarkerLabel(request.key)} T${request.turn}!`,
                color: request.feasible
                    ? 'rgba(255,165,0,0.86)'
                    : 'rgba(255,95,95,0.94)',
            };
        }).sort((a, b) => a.turn - b.turn || a.tick - b.tick);

    }

export function buildMariaRequestsFromTimeline(game) {
        game.mariaRequests = game.timeline
            .filter((event) => event.result === 'applied' && event.actorId === 'randy' && event.intent.type === 'requestActionFromKey' && event.actorPos !== null)
            .map((event) => {
                const requestIntent = /** @type {{type:'requestActionFromKey', key:string, targetCharacterId?: string, targetPosition?: import('eskv/lib/eskv.js').VecLike}} */ (event.intent);
                const key = game.normalizeRequestKey(requestIntent.key);
                return {
                    turn: event.turn,
                    key,
                    sourcePos: [event.actorPos[0], event.actorPos[1]],
                    targetCharacterId: typeof requestIntent.targetCharacterId === 'string' ? requestIntent.targetCharacterId : null,
                    targetPosition: Array.isArray(requestIntent.targetPosition)
                        ? [requestIntent.targetPosition[0], requestIntent.targetPosition[1]]
                        : null,
                    earliestTurn: 1,
                    feasible: true,
                    fulfilled: false,
                    fulfilledTick: null,
                    label: game.describeRequestKey(key),
                };
            })
            .filter((request) => game.isSupportedRequestKey(request.key));

    }

export function buildRandyReplayScriptFromTimeline(game) {
        /** @type {Map<number, {tick:number, intent:GameIntent}[]>} */
        const byTurn = new Map();
        const randyEvents = game.timeline
            .filter((event) => event.result === 'applied' && event.actorId === 'randy')
            .sort((a, b) => a.turn - b.turn || a.tick - b.tick);
        for (const event of randyEvents) {
            const replayIntent = game.cloneReplayableRandyIntent(event.intent);
            if (!replayIntent) continue;
            if (!byTurn.has(event.turn)) byTurn.set(event.turn, []);
            byTurn.get(event.turn)?.push({ tick: event.tick, intent: replayIntent });
        }
        game.randyReplayScriptByTurn = new Map(
            [...byTurn.entries()].map(([turn, entries]) => [
                turn,
                entries
                    .sort((a, b) => a.tick - b.tick)
                    .map((entry) => entry.intent),
            ]),
        );

    }

export function cloneReplayableRandyIntent(game, intent) {
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

export function snapshotRandyPathFromTimeline(game) {
        const randyEvents = game.timeline
            .filter((event) => event.result === 'applied' && event.actorId === 'randy' && event.actorPos !== null);
        /** @type {Map<number, import('eskv/lib/eskv.js').VecLike>} */
        const byTurn = new Map();
        for (const event of randyEvents) {
            if (!event.actorPos) continue;
            byTurn.set(event.turn, [event.actorPos[0], event.actorPos[1]]);
        }
        game.randyPath = [...byTurn.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([turn, position]) => ({ turn, position }));

    }

export function getRandyEchoForCurrentTurn(game) {
        if (game.randyPath.length === 0) return null;
        let candidate = null;
        for (const step of game.randyPath) {
            if (step.turn <= game.timelineTurn) {
                candidate = step;
            } else {
                break;
            }
        }
        if (!candidate) candidate = game.randyPath[0];
        return candidate.position;
    }
