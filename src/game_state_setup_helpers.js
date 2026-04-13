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


export function computeMissionSeed(game, runSeed, missionIndex) {
        const run = runSeed >>> 0;
        const index = missionIndex >>> 0;
        let mixed = (run ^ (index + 0x9e3779b9)) >>> 0;
        mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b) >>> 0;
        mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35) >>> 0;
        mixed = (mixed ^ (mixed >>> 16)) >>> 0;
        return mixed;

    }

export function stableHash(game, text) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h >>> 0;

    }

export function captureInitialPlayerPositions(game) {
        game.initialPlayerPositions = new Map(
            game.missionMap.playerCharacters.map((player) => [player.id, [player.gpos[0], player.gpos[1]]]),
        );

    }

export function ensureInitialPlayerPositions(game) {
        if (game.initialPlayerPositions.size > 0) return;
        if (game.spatial.seedInitialPlayerPositionsFromMap(
            game.initialPlayerPositions,
            game.missionSeed,
            (text) => game.stableHash(text),
        )) return;
        /** @type {Map<string, import('eskv/lib/eskv.js').VecLike>} */
        const inferred = new Map();
        const appliedEvents = game.timeline
            .filter((event) => event.result === 'applied' && event.actorPos !== null)
            .sort((a, b) => a.turn - b.turn || a.tick - b.tick);
        for (const event of appliedEvents) {
            if (!event.actorPos) continue;
            if (!inferred.has(event.actorId)) {
                inferred.set(event.actorId, [event.actorPos[0], event.actorPos[1]]);
            }
        }
        for (const player of game.missionMap.playerCharacters) {
            const inferredPos = inferred.get(player.id)
                ?? inferred.get('randy')
                ?? [player.gpos[0], player.gpos[1]];
            game.initialPlayerPositions.set(player.id, [inferredPos[0], inferredPos[1]]);
        }

    }

export function applyInitialPlayerPositions(game) {
        if (game.initialPlayerPositions.size === 0) return;
        for (const player of game.missionMap.playerCharacters) {
            const start = game.initialPlayerPositions.get(player.id);
            if (!start) continue;
            player.gpos[0] = start[0];
            player.gpos[1] = start[1];
            player.x = start[0];
            player.y = start[1];
        }

    }

export function configureScientistWorkRoutes(game) {
        const scientists = game.missionMap.enemies
            .filter((enemy) => game.isScientistId(enemy.id))
            .sort((a, b) => a.id.localeCompare(b.id));
        if (scientists.length === 0) return;
        const roomCells = game.spatial.collectRoomWorkCells();
        for (let i = 0; i < scientists.length; i++) {
            const scientist = scientists[i];
            const start = eskv.v2([scientist.gpos[0], scientist.gpos[1]]);
            const shouldPatrol = i % 2 === 0;
            const linearCandidates = roomCells
                .filter((cell) => !cell.equals(start))
                .map((cell) => ({ cell, linearDist: cell.dist(start) }))
                .filter((entry) => entry.linearDist >= 3.5 && entry.linearDist <= 18)
                .sort((a, b) =>
                    b.linearDist - a.linearDist
                    || game.enemyIdJitter(`${scientist.id}:${b.cell[0]},${b.cell[1]}`)
                    - game.enemyIdJitter(`${scientist.id}:${a.cell[0]},${a.cell[1]}`),
                );
            /** @type {import('eskv/lib/eskv.js').Vec2|null} */
            let endpoint = null;
            const maxChecks = Math.min(24, linearCandidates.length);
            for (let j = 0; j < maxChecks; j++) {
                const candidate = linearCandidates[j].cell;
                const pathDist = game.spatial.shortestTraverseDistance(start, candidate, true);
                if (!Number.isFinite(pathDist)) continue;
                if (pathDist < 4 || pathDist > 14) continue;
                endpoint = candidate.add([0, 0]);
                break;
            }
            if (shouldPatrol) {
                if (!endpoint) {
                    scientist.patrolRoute = [start.add([0, 0])];
                    scientist.patrolTarget = 0;
                    game.scientistPassiveWaitTurns.set(scientist.id, 8 + ((game.stableHash(`${scientist.id}:idle`) + game.missionSeed) % 9));
                    continue;
                }
                scientist.patrolRoute = [start.add([0, 0]), endpoint];
                scientist.patrolTarget = 1;
                game.scientistPassiveWaitTurns.set(scientist.id, 6 + ((game.stableHash(`${scientist.id}:start`) + game.missionSeed) % 7));
            } else {
                // Stationary "working" scientist in-room.
                scientist.patrolRoute = [start.add([0, 0])];
                scientist.patrolTarget = 0;
                game.scientistPassiveWaitTurns.set(scientist.id, 8 + ((game.stableHash(`${scientist.id}:idle`) + game.missionSeed) % 9));
            }
        }

    }

export function configureGuardDeployment(game) {
        const guards = game.missionMap.enemies
            .filter((enemy) => game.isGuardId(enemy.id))
            .sort((a, b) => a.id.localeCompare(b.id));
        if (guards.length === 0) return;
        const scientists = game.missionMap.enemies
            .filter((enemy) => game.isScientistId(enemy.id))
            .sort((a, b) => a.id.localeCompare(b.id));
        const hallwayCells = game.spatial.collectWalkablePatrolCells(true);
        const walkableCells = hallwayCells.length > 0 ? hallwayCells : game.spatial.collectWalkablePatrolCells(false);
        if (walkableCells.length === 0) return;
        const occupied = new Set(
            [
                ...game.missionMap.playerCharacters.map((p) => game.spatial.posKey(p.gpos)),
                ...scientists.map((s) => game.spatial.posKey(s.gpos)),
            ],
        );
        /** @type {import('eskv/lib/eskv.js').Vec2[]} */
        const postCells = [];
        const postCount = Math.min(2, guards.length);
        for (const scientist of scientists) {
            if (postCells.length >= postCount) break;
            const near = game.spatial.pickNearestAvailableCell(
                walkableCells,
                scientist.gpos,
                occupied,
                (text) => game.stableHash(text),
                postCells,
            );
            if (!near) continue;
            postCells.push(near);
            occupied.add(game.spatial.posKey(near));
        }
        while (postCells.length < postCount) {
            const fallback = game.spatial.pickNearestAvailableCell(
                walkableCells,
                [game.missionMap.w * 0.5, game.missionMap.h * 0.5],
                occupied,
                (text) => game.stableHash(text),
                postCells,
            );
            if (!fallback) break;
            postCells.push(fallback);
            occupied.add(game.spatial.posKey(fallback));
        }

        for (let i = 0; i < guards.length; i++) {
            const guard = guards[i];
            let start = postCells[i] ?? null;
            if (!start) {
                const seedAnchor = walkableCells[game.stableHash(`${game.missionSeed}:${guard.id}:start`) % walkableCells.length];
                start = game.spatial.pickNearestAvailableCell(
                    walkableCells,
                    seedAnchor,
                    occupied,
                    (text) => game.stableHash(text),
                ) ?? seedAnchor.add([0, 0]);
            }
            const startKey = game.spatial.posKey(start);
            occupied.add(startKey);
            const anchors = i < postCells.length
                ? [start.add([0, 0])]
                : game.buildGuardPatrolRoute(start, walkableCells, guard.id);
            const route = anchors.length > 1
                ? game.spatial.buildPatrolLoopFromAnchors(anchors, true)
                : anchors;
            guard.patrolRoute = route.map((pos) => pos.add([0, 0]));
            guard.patrolTarget = route.length > 1 ? 1 : 0;
            guard.gpos = start.add([0, 0]);
            guard.x = guard.gpos[0];
            guard.y = guard.gpos[1];
            if (route.length > 1) {
                const delta = route[1].sub(route[0]);
                if (delta[0] > 0) guard.facing = Facing.east;
                else if (delta[0] < 0) guard.facing = Facing.west;
                else if (delta[1] > 0) guard.facing = Facing.south;
                else if (delta[1] < 0) guard.facing = Facing.north;
            }
        }

    }

export function buildGuardPatrolRoute(game, start, candidates, guardId) {
        const route = [start.add([0, 0])];
        while (route.length < 4) {
            let best = null;
            let bestScore = Number.NEGATIVE_INFINITY;
            for (const candidate of candidates) {
                if (route.some((p) => p.equals(candidate))) continue;
                const pathDist = game.spatial.shortestTraverseDistance(route[route.length - 1], candidate, true);
                if (!Number.isFinite(pathDist)) continue;
                const minDistToRoute = Math.min(...route.map((p) => p.dist(candidate)));
                if (minDistToRoute < 5.5) continue;
                const score = minDistToRoute * 1.25
                    + pathDist * 0.4
                    + start.dist(candidate) * 0.25
                    + game.enemyIdJitter(`${guardId}:${candidate[0]},${candidate[1]}`);
                if (score > bestScore) {
                    bestScore = score;
                    best = candidate;
                }
            }
            if (!best) break;
            route.push(best.add([0, 0]));
        }
        if (route.length < 2) {
            const fallback = candidates
                .filter((candidate) => !candidate.equals(route[0]))
                .filter((candidate) => Number.isFinite(game.spatial.shortestTraverseDistance(route[0], candidate, true)))
                .sort((a, b) => b.dist(route[0]) - a.dist(route[0]))[0];
            if (fallback) route.push(fallback.add([0, 0]));
        }
        return route;

    }

export function setupMissionFromCurrentSeeds(game) {
        game.escapedScientistIds.clear();
        game.scientistPreviousPositions.clear();
        game.scientistFleeStallTurns.clear();
        game.scientistPassiveWaitTurns.clear();
        game.missionMap.setupLevel(game.missionSeed);
        game.ensureInitialPlayerPositions();
        game.applyInitialPlayerPositions();
        game.configureGuardDeployment();
        game.configureScientistWorkRoutes();
        game.initializeCharacterState();
        game.resetPlayerTurnActionCounters();
        game.setActivePlayerById('randy', false);
        game.hostilityEscalated = false;
        game.hostilityReason = '';
        for (const playerCharacter of game.missionMap.playerCharacters) {
            if (![...playerCharacter.actions].some((action) => action instanceof Rifle)) {
                playerCharacter.addAction(Rifle.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof SuppressAction)) {
                playerCharacter.addAction(SuppressAction.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof AimAction)) {
                playerCharacter.addAction(AimAction.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof ArrestAction)) {
                playerCharacter.addAction(ArrestAction.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof StealthTakedownAction)) {
                playerCharacter.addAction(StealthTakedownAction.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof DoorAction)) {
                playerCharacter.addAction(DoorAction.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof LockpickAction)) {
                playerCharacter.addAction(LockpickAction.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof FiberCameraAction)) {
                playerCharacter.addAction(FiberCameraAction.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof BreachBombAction)) {
                playerCharacter.addAction(BreachBombAction.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof FragGrenadeAction)) {
                playerCharacter.addAction(FragGrenadeAction.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof SmokeGrenadeAction)) {
                playerCharacter.addAction(SmokeGrenadeAction.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof CutterAction)) {
                playerCharacter.addAction(CutterAction.a());
            }
            if (![...playerCharacter.actions].some((action) => action instanceof DecoyAction)) {
                playerCharacter.addAction(DecoyAction.a());
            }
        }
        const player = game.getActivePlayer();
        if (!player) return;
        player.updateFoV(game.missionMap);
        game.applyPersistentSeenToMap();
        game.rememberSeenFromCurrentMap();
        game.missionMap.updateCharacterVisibility(true);
        game.activePlayerAction = null;
        game.activePlayerActionData = null;
        game.pendingMariaRequestSelection = null;
        game.selectorCells = [];
        game.selectorIndex = -1;
        game.initializeObjectives();
        game.missionStatus = 'active';
        game.message = `Mission started (run:${game.runSeed}, mission:${game.missionIndex}, seed:${game.missionSeed})`;
        game.updateMissionOutcome();
        game.applyVisibilityMode();
        game.ensureReplayGhostVisible();

    }

export function setupLevel(game) {
        game.missionSeed = game.computeMissionSeed(game.runSeed, game.missionIndex);
        game.escapedScientistIds.clear();
        game.scientistPreviousPositions.clear();
        game.scientistFleeStallTurns.clear();
        game.scientistPassiveWaitTurns.clear();
        game.initialPlayerPositions = new Map();
        game.setupMissionFromCurrentSeeds();
        game.captureInitialPlayerPositions();
        game.timeline = [];
        game.timelineTick = 0;
        game.timelineTurn = 1;
        game.replayMode = false;
        game.mariaRequests = [];
        game.randyPath = [];
        game.randyReplayScriptByTurn = new Map();
        game.obligationObjectives = [];
        game.anomalyCount = 0;
        game.eventLog = [];
        game.resetPlayerTurnActionCounters();

    }

export function addPlayerTurnActionsTaken(game, playerId, amount) {
        if (amount <= 0) return;
        const prior = game.playerTurnActionsTaken.get(playerId) ?? 0;
        game.playerTurnActionsTaken.set(playerId, prior + amount);

    }

export function resetPlayerTurnActionCounters(game) {
        game.playerTurnActionsTaken = new Map(
            game.missionMap.playerCharacters.map((player) => [player.id, 0]),
        );
    }


export function setActivePlayerById(game, id, refreshVision = true) {
        const visibleLayer = game.missionMap.metaTileMap.layer[MetaLayers.visible];
        let selected = null;
        for (const player of game.missionMap.playerCharacters) {
            const isActive = player.id === id && player.state !== 'dead' && player.health > 0;
            player.activeCharacter = isActive;
            if (isActive) selected = player;
        }
        if (!selected) {
            selected = game.missionMap.playerCharacters.find((player) => player.state !== 'dead' && player.health > 0) ?? null;
            if (selected) selected.activeCharacter = true;
        }
        game.missionMap.activeCharacter = selected;
        if (selected) {
            selected._visibleLayer = visibleLayer;
            if (refreshVision) {
                selected.updateFoV(game.missionMap);
                game.missionMap.captureActiveDirectVisibility();
                game.missionMap.updateCharacterVisibility(true);
            }
        }
        if (game.debugFullVision) {
            game.applyVisibilityMode();
        }
        return selected;

    }

export function initializeObjectives(game) {
        game.objectives = [
            { id: 'arrestScientists', text: 'Arrest all 4 scientists', state: 'pending' },
            { id: 'protectScientists', text: 'No scientist may be killed by gunfire', state: 'pending' },
            { id: 'preventScientistEscape', text: 'Do not let all 4 scientists escape', state: 'pending' },
        ];

    }

export function isGuardId(game, id) {
        return game.guardIds.includes(id) || id.startsWith('guard');

    }

export function isScientistId(game, id) {
        return game.scientistIds.includes(id) || id.startsWith('scientist');
    }
