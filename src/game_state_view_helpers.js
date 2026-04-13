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


export function getView(game) {
        const active = game.getActivePlayer();
        const activeCharacterId = active?.id ?? "none";
        const activeTurnActionsTaken = game.playerTurnActionsTaken.get(activeCharacterId) ?? 0;
        const activeTurnActionLimit = 2;
        return {
            message: game.message,
            awaitingSelection: game.isAwaitingSelection(),
            selectionKind: game.getSelectionKind(),
            selectorCells: game.selectorCells,
            selectorCellLabels: game.getSelectorCellLabels(),
            selectorIndex: game.selectorIndex,
            objectiveText: game.objectiveSummary(),
            missionStatus: game.missionStatus,
            runSeed: game.runSeed,
            missionSeed: game.missionSeed,
            missionIndex: game.missionIndex,
            timelineTick: game.timelineTick,
            timelineTurn: game.timelineTurn,
            replayMode: game.replayMode,
            activeTurnActionsTaken,
            activeTurnActionLimit,
            squadStatusText: game.squadStatusSummary(),
            playerStatusText: game.playerStatusSummary(),
            inventoryStatusText: game.inventoryStatusSummary(),
            enemyStatusText: game.enemyStatusSummary(),
            signalStatusText: game.signalStatusSummary(),
            shortcutsText: game.shortcutsSummary(),
            logText: game.eventLogSummary(),
            activeCharacterId,
            randyEchoPos: game.getRandyEchoForCurrentTurn(),
            obligationObjectives: game.obligationObjectives.map((objective) => ({
                ...objective,
                position: [objective.position[0], objective.position[1]],
                color: objective.color,
            })),
            obligationTurns: [...new Set(game.obligationObjectives.map((objective) => objective.turn))].sort((a, b) => a - b),
            randyPath: game.randyPath.map((step) => ({
                turn: step.turn,
                position: [step.position[0], step.position[1]],
            })),
            anomalyCount: game.anomalyCount,
            requestSummaryText: game.requestStatusSummary(),
            enemyIntents: game.getEnemyIntentGlyphs().map((intent) => ({
                ...intent,
                position: [intent.position[0], intent.position[1]],
            })),
            showPatrolRoutes: game.showPatrolRoutes,
            patrolRoutes: game.getPatrolRouteGlyphs(),
        };

    }

export function getSelectorCellLabels(game) {
        const labels = game.selectorCells.map(() => '');
        if (game.pendingMariaRequestSelection && game.selectorIndex >= 0 && game.selectorIndex < labels.length) {
            if (game.mariaSelectionPreviewEarliestTurn !== null && Number.isFinite(game.mariaSelectionPreviewEarliestTurn)) {
                labels[game.selectorIndex] = game.mariaSelectionPreviewFeasible
                    ? `T${game.mariaSelectionPreviewEarliestTurn}`
                    : `T${game.mariaSelectionPreviewEarliestTurn}!`;
            } else if (game.mariaSelectionPreviewFeasible === false) {
                labels[game.selectorIndex] = 'X';
            }
            return labels;
        }
        if (!(game.activePlayerAction instanceof Rifle)) return labels;
        const actionData = game.activePlayerActionData;
        const actor = game.getActivePlayer();
        if (!actor || !actionData?.validTargetCharacters || actionData.validTargetCharacters.length === 0) {
            return labels;
        }
        /** @type {Map<string, string>} */
        const labelByPos = new Map();
        for (const target of actionData.validTargetCharacters) {
            const chance = game.activePlayerAction.getUiHitChance(actor, target, game.missionMap);
            const pct = Math.max(0, Math.min(100, Math.round(chance * 100)));
            labelByPos.set(game.spatial.posKey(target.gpos), `${pct}%`);
        }
        for (let i = 0; i < game.selectorCells.length; i++) {
            labels[i] = labelByPos.get(game.spatial.posKey(game.selectorCells[i])) ?? '';
        }
        return labels;

    }

export function eventLogSummary(game) {
        if (game.eventLog.length === 0) return 'No events yet.';
        return game.eventLog.slice(Math.max(0, game.eventLog.length - 24)).join('\n');

    }

export function shortcutsSummary(game) {
        return 'Randy actions: W/A/S/D move, SPACE wait, F fire, C suppress, Q aim, X decoy, G arrest, T takedown, H/J/K/B/U tools, N frag, M smoke | Randy requests: SHIFT+action key | Maria replay: O | Patrol routes: P';

    }

export function requestStatusSummary(game) {
        const queuedFromTimeline = game.timeline.filter((event) => event.result === 'applied' && event.actorId === 'randy' && event.intent.type === 'requestActionFromKey').length;
        const total = game.replayMode ? game.mariaRequests.length : queuedFromTimeline;
        const fulfilled = game.mariaRequests.filter((request) => request.fulfilled).length;
        const pending = total - fulfilled;
        const pendingThisTurn = game.mariaRequests.filter((request) => !request.fulfilled && request.turn === game.timelineTurn).length;
        if (!game.replayMode) {
            return `Requests queued: ${total} | pending replay: ${pending} | anomalies: ${game.anomalyCount}`;
        }
        return `Requests fulfilled: ${fulfilled}/${total} | pending now: ${pendingThisTurn} | anomalies: ${game.anomalyCount}`;

    }

export function signalStatusSummary(game) {
        return `sound:${game.missionMap.soundEvents.length} decoy:${game.missionMap.decoyEvents.length} smoke:${game.missionMap.smokeClouds.length} charge:${game.missionMap.timedCharges.length} cam:${game.missionMap.fiberCameras.length}`;

    }

export function enemyStatusSummary(game) {
        const visibleEnemies = game.missionMap.enemies.filter((enemy) => enemy.visibleToPlayer && enemy.state !== 'dead');
        if (visibleEnemies.length === 0) return 'No visible enemies';
        return visibleEnemies.map((enemy) => {
            const data = game.characterState.get(enemy.id);
            const hp = `${enemy.health}/${enemy.maxHealth}`;
            const sup = data ? data.suppressionPoints.toFixed(1) : enemy.suppressionLevel.toFixed(1);
            const awareness = data ? data.awarenessState : 'unaware';
            const lock = data
                ? data.suppressionFireLockRedTurns > 0
                    ? ' LOCK:red'
                    : data.suppressionFireLockOrangeTurns > 0
                        ? ' LOCK:orange'
                        : ''
                : '';
            return `${enemy.id}:HP ${hp} SUP ${sup} AWR ${awareness}${lock}`;
        }).join(' | ');

    }

export function inventoryStatusSummary(game) {
        return game.missionMap.playerCharacters.map((character) => {
            const actionSummary = [...character.actions].map((action) => {
                const ammo = /** @type {{ammo?: number}} */(action).ammo;
                const suffix = typeof ammo === 'number' ? `(${ammo})` : '';
                return `${action.keyControl}:${action.name}${suffix}`;
            }).join(', ');
            return `${character.id}: ${actionSummary}`;
        }).join('\n');

    }

export function playerStatusSummary(game) {
        return game.missionMap.playerCharacters.map((character) => {
            const hp = `${character.health}/${character.maxHealth}`;
            const pos = `${character.gpos[0]},${character.gpos[1]}`;
            const act = character.actionsThisTurn;
            return `${character.id.toUpperCase()} HP:${hp} AP:${act} POS:${pos}`;
        }).join(' | ');

    }

export function squadStatusSummary(game) {
        return game.missionMap.playerCharacters.map((character) => {
            const data = game.characterState.get(character.id);
            const hp = `${character.health}/${character.maxHealth}`;
            const sup = data ? data.suppressionPoints.toFixed(1) : character.suppressionLevel.toFixed(1);
            const awareness = data ? data.awarenessState : 'engaging';
            return `${character.id}:HP ${hp} SUP ${sup} AWR ${awareness}`;
        }).join(' | ');

    }

export function objectiveSummary(game) {
        return game.objectives.map((objective) => {
            const prefix = objective.state === 'complete' ? '[OK]' : objective.state === 'failed' ? '[X]' : '[ ]';
            return `${prefix} ${objective.text}`;
        }).join(' | ');

    }

export function applyPersistentSeenToMap(game) {
        if (game.persistentSeenCells.size === 0) return;
        const seenLayer = game.missionMap.metaTileMap.layer[MetaLayers.seen];
        if (!seenLayer) return;
        for (const key of game.persistentSeenCells) {
            const [sx, sy] = key.split(',').map((value) => Number.parseInt(value, 10));
            if (Number.isNaN(sx) || Number.isNaN(sy)) continue;
            if (sx < 0 || sy < 0 || sx >= game.missionMap.w || sy >= game.missionMap.h) continue;
            game.missionMap.metaTileMap.setInLayer(MetaLayers.seen, [sx, sy], 1);
        }
        game.missionMap.tileMap.clearCache();

    }

export function rememberSeenFromCurrentMap(game) {
        if (game.debugFullVision) return;
        const seenLayer = game.missionMap.metaTileMap.layer[MetaLayers.seen];
        if (!seenLayer) return;
        for (const pos of seenLayer.iterAll()) {
            if (seenLayer.get(pos) > 0) {
                game.persistentSeenCells.add(`${pos[0]},${pos[1]}`);
            }
        }

    }

export function togglePatrolRoutes(game) {
        game.showPatrolRoutes = !game.showPatrolRoutes;
        game.message = game.showPatrolRoutes
            ? 'Patrol routes overlay enabled.'
            : 'Patrol routes overlay disabled.';
        game.addLog(game.message);

    }

export function toggleFullVision(game) {
        game.debugFullVision = !game.debugFullVision;
        game.applyVisibilityMode();
        game.message = game.debugFullVision
            ? 'Full-map vision enabled.'
            : 'Full-map vision disabled.';
        game.addLog(game.message);

    }

export function applyFiberCameraVisibility(game) {
        const cameras = game.missionMap.fiberCameras;
        if (cameras.length === 0) return;
        const seenLayer = game.missionMap.metaTileMap.layer[MetaLayers.seen];
        const visibleLayer = game.missionMap.metaTileMap.layer[MetaLayers.visible];
        const layout = game.missionMap.metaTileMap.layer[MetaLayers.layout];
        if (!seenLayer || !visibleLayer || !layout) return;
        for (const camera of cameras) {
            const sensorPos = eskv.v2([camera.sensorPos[0], camera.sensorPos[1]]);
            for (const rawPos of layout.iterAll()) {
                const pos = eskv.v2(rawPos);
                if (sensorPos.dist(pos) > camera.radius) continue;
                if (!game.spatial.hasLineOfSightBetween(sensorPos, pos)) continue;
                visibleLayer.set(pos, 1);
                seenLayer.set(pos, 1);
            }
        }

    }

export function applyVisibilityMode(game) {
        const seenLayer = game.missionMap.metaTileMap.layer[MetaLayers.seen];
        const visibleLayer = game.missionMap.metaTileMap.layer[MetaLayers.visible];
        if (!seenLayer || !visibleLayer) return;
        if (game.debugFullVision) {
            seenLayer.fill(1);
            visibleLayer.fill(1);
            game.missionMap.captureActiveDirectVisibility();
            const active = game.getActivePlayer();
            if (active) {
                active._visibleLayer = visibleLayer;
            }
            game.missionMap.updateCharacterVisibility(true);
            game.missionMap.tileMap.clearCache();
            return;
        }
        seenLayer.fill(0);
        visibleLayer.fill(0);
        const active = game.getActivePlayer();
        if (active) {
            active._visibleLayer = visibleLayer;
            active.updateFoV(game.missionMap);
        }
        game.missionMap.captureActiveDirectVisibility();
        game.applyFiberCameraVisibility();
        game.applyPersistentSeenToMap();
        game.missionMap.updateCharacterVisibility(true);
        game.missionMap.tileMap.clearCache();
    }
