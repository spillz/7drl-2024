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


export function getEnemyIntentGlyphs(game) {
        return game.missionMap.enemies
            .filter((enemy) => {
                if (enemy.state === 'fleeing' || game.escapedScientistIds.has(enemy.id)) return false;
                const data = game.characterState.get(enemy.id);
                const forcedKnownState = enemy.state === 'surrendering'
                    || enemy.state === 'unconscious'
                    || enemy.state === 'dead'
                    || data?.casualtyState === 'detained'
                    || data?.casualtyState === 'unconscious'
                    || data?.casualtyState === 'dead';
                return enemy.visibleToPlayer || forcedKnownState;
            })
            .map((enemy) => {
                const data = game.characterState.get(enemy.id);
                const kind = data ? game.predictEnemyIntentKind(enemy, data) : 'patrol';
                const baseLabel = kind === 'attack' ? 'ATTACK'
                    : kind === 'advance' ? 'ADV'
                    : kind === 'search' ? 'SEARCH'
                    : kind === 'post' ? 'POST'
                    : kind === 'passive' ? 'WORK'
                    : kind === 'flee' ? 'FLEE'
                    : kind === 'comply' ? 'YIELD'
                    : kind === 'arrested' ? 'ARREST'
                    : kind === 'down' ? 'DOWN'
                    : kind === 'dead' ? 'DEAD'
                    : 'PATROL';
                const baseColor = kind === 'attack' ? 'rgba(255,72,72,0.98)'
                    : kind === 'advance' ? 'rgba(255,165,66,0.96)'
                    : kind === 'search' ? 'rgba(255,228,130,0.94)'
                    : kind === 'post' ? 'rgba(185,215,245,0.92)'
                    : kind === 'passive' ? 'rgba(170,230,210,0.9)'
                    : kind === 'flee' ? 'rgba(120,215,255,0.96)'
                    : kind === 'comply' ? 'rgba(165,255,180,0.96)'
                    : kind === 'arrested' ? 'rgba(110,250,170,0.95)'
                    : kind === 'down' ? 'rgba(150,205,255,0.94)'
                    : kind === 'dead' ? 'rgba(245,245,245,0.88)'
                    : 'rgba(205,205,220,0.9)';
                const redLock = (data?.suppressionFireLockRedTurns ?? 0) > 0;
                const orangeLock = !redLock && (data?.suppressionFireLockOrangeTurns ?? 0) > 0;
                const label = redLock
                    ? `LOCK ${baseLabel}`
                    : orangeLock
                        ? `LOCK ${baseLabel}`
                        : baseLabel;
                const color = redLock
                    ? 'rgba(255,72,72,0.98)'
                    : orangeLock
                        ? 'rgba(255,170,72,0.98)'
                        : baseColor;
                return {
                    id: enemy.id,
                    position: [enemy.gpos[0], enemy.gpos[1]],
                    kind,
                    label,
                    color,
                };
            });

    }

export function predictEnemyIntentKind(game, enemy, data) {
        const hasActiveThreat = data.lastKnownThreatPos !== null && data.lastKnownThreatTtl > 0;
        if (enemy.state === 'dead' || data.behaviorState === 'dead' || data.casualtyState === 'dead') return 'dead';
        if (enemy.state === 'surrendering' || data.behaviorState === 'surrendering' || data.casualtyState === 'detained') return 'arrested';
        if (enemy.state === 'unconscious' || data.casualtyState === 'unconscious') return 'down';
        if (enemy.state === 'fleeing' || game.escapedScientistIds.has(enemy.id) || data.behaviorState === 'fleeing') return 'flee';
        if (data.behaviorState === 'comply') return 'comply';
        if (game.isScientistId(enemy.id) || data.role === 'target') {
            if (data.behaviorState === 'investigate') return hasActiveThreat ? 'search' : 'passive';
            if (data.behaviorState === 'passive') return 'passive';
            return 'patrol';
        }
        if (data.behaviorState === 'engage') {
            const target = game.selectEnemyAttackTarget(enemy, data);
            if (target) {
                const dist = enemy.gpos.dist(target.gpos);
                const canAttack = dist <= 7
                    && enemy.canSee(target, game.missionMap)
                    && game.enemyFacingAllowsSight(enemy, target, data)
                    && game.canEnemyEscalateToEngage(enemy, data, dist)
                    && !(data.behaviorState !== 'engage' && dist > 4);
                if (canAttack) return 'attack';
            }
            return 'advance';
        }
        if (data.behaviorState === 'investigate') return hasActiveThreat ? 'search' : 'patrol';
        if (data.behaviorState === 'post') return 'post';
        if (data.behaviorState === 'patrol') return 'patrol';
        return 'patrol';

    }

export function moveEnemyToward(game, enemy, target) {
        if (enemy.gpos.equals(target)) return false;
        const path = game.spatial.shortestTraversePath(enemy.gpos, target, true);
        if (path.length > 0) {
            const next = path[0];
            const delta = next.sub(enemy.gpos);
            let direction = null;
            if (delta[0] > 0 && delta[1] === 0) direction = Facing.east;
            else if (delta[0] < 0 && delta[1] === 0) direction = Facing.west;
            else if (delta[1] > 0 && delta[0] === 0) direction = Facing.south;
            else if (delta[1] < 0 && delta[0] === 0) direction = Facing.north;
            if (direction !== null) {
                const from = enemy.gpos.add([0, 0]);
                const beforeActions = enemy.actionsThisTurn;
                enemy.move(direction, game.missionMap);
                const moved = !enemy.gpos.equals(from);
                if (moved) {
                    game.tryCloseDoorBehindGuard(enemy, from);
                    return true;
                }
                if (game.trySwapWithBlockingCharacter(enemy, direction)) {
                    game.tryCloseDoorBehindGuard(enemy, from);
                    return true;
                }
                return enemy.actionsThisTurn < beforeActions;
            }
        }
        const directions = [Facing.north, Facing.east, Facing.south, Facing.west];
        const candidates = directions
            .map((direction) => {
                const npos = enemy.gpos.add(FacingVec[direction]);
                const traversible = game.missionMap.metaTileMap.getFromLayer(MetaLayers.traversible, npos);
                const blocker = game.getBlockingCharacterAt(npos, enemy);
                const occupied = blocker ? game.isBlockingEnemyPathCharacter(blocker) : false;
                const traversibleInDirection = (traversible & (1 << direction)) !== 0;
                const canOperateDoor = game.spatial.isDoorwayTile(npos) && !traversibleInDirection;
                const stepPossible = traversibleInDirection || canOperateDoor;
                return {
                    direction,
                    npos,
                    stepPossible,
                    occupied,
                    blocker,
                    directDistance: npos.dist(target),
                    canOperateDoor,
                };
            })
            .filter((candidate) => candidate.stepPossible)
            .sort((a, b) => {
                const ad = a.canOperateDoor ? 0.35 : 0;
                const bd = b.canOperateDoor ? 0.35 : 0;
                const occA = a.occupied ? 0.25 : 0;
                const occB = b.occupied ? 0.25 : 0;
                const as = a.directDistance + ad + occA;
                const bs = b.directDistance + bd + occB;
                if (as !== bs) return as - bs;
                if (a.directDistance !== b.directDistance) return a.directDistance - b.directDistance;
                return a.direction - b.direction;
            });
        if (candidates.length === 0) return false;
        const from = enemy.gpos.add([0, 0]);
        const beforeActions = enemy.actionsThisTurn;
        enemy.move(candidates[0].direction, game.missionMap);
        const moved = !enemy.gpos.equals(from);
        if (moved) {
            game.tryCloseDoorBehindGuard(enemy, from);
            return true;
        }
        if (game.trySwapWithBlockingCharacter(enemy, candidates[0].direction)) {
            game.tryCloseDoorBehindGuard(enemy, from);
            return true;
        }
        return enemy.actionsThisTurn < beforeActions;

    }

export function selectEnemyBehaviorTarget(game, enemy, data) {
        if (data.behaviorState === 'post') {
            return null;
        }
        if (data.behaviorState === 'patrol') {
            if (enemy.patrolTarget < 0) enemy.patrolTarget = 0;
            if (enemy.patrolRoute.length === 0) return null;
            if (enemy.gpos.equals(enemy.patrolRoute[enemy.patrolTarget])) {
                enemy.patrolTarget = (enemy.patrolTarget + 1) % enemy.patrolRoute.length;
            }
            return enemy.patrolRoute[enemy.patrolTarget];
        }
        if (data.behaviorState === 'engage') {
            const visibleTarget = game.selectEnemyAttackTarget(enemy, data);
            if (visibleTarget) {
                data.lastKnownThreatPos = visibleTarget.gpos.add([0, 0]);
                data.lastKnownThreatTtl = 4;
                return game.pickEngageApproachCell(enemy, visibleTarget.gpos);
            }
        }
        if ((data.behaviorState === 'investigate' || data.behaviorState === 'engage') && data.lastKnownThreatPos) {
            const anchorReachedByAny = game.missionMap.enemies.some((ally) => {
                if (ally.state === 'dead' || ally === enemy) return false;
                const allyData = game.characterState.get(ally.id);
                if (!allyData) return false;
                const investigating = allyData.behaviorState === 'investigate' || allyData.behaviorState === 'engage';
                return investigating && ally.gpos.equals(data.lastKnownThreatPos);
            });
            if (enemy.gpos.equals(data.lastKnownThreatPos) || anchorReachedByAny) {
                return game.pickInvestigateSweepCell(enemy, data.lastKnownThreatPos);
            }
            return data.lastKnownThreatPos;
        }
        return null;

    }

export function tryCloseDoorBehindGuard(game, enemy, fromPos) {
        if (!game.isGuardId(enemy.id)) return;
        const door = game.getDoorAt(fromPos);
        if (!door || door.state !== 'open') return;
        const occupied = game.missionMap.characters.some((character) => game.isBlockingEnemyPathCharacter(character) && character.gpos.equals(fromPos));
        if (occupied) return;
        door.interact(game.missionMap, enemy);

    }

export function trySwapWithBlockingCharacter(game, mover, direction) {
        if (mover.actionsThisTurn <= 0) return false;
        const from = mover.gpos.add([0, 0]);
        const to = mover.gpos.add(FacingVec[direction]);
        const blocker = game.getBlockingCharacterAt(to, mover);
        if (!blocker) return false;
        if (blocker instanceof PlayerCharacter) return false;
        const blockerFrom = blocker.gpos.add([0, 0]);
        blocker.gpos = from.add([0, 0]);
        blocker.x = blocker.gpos[0];
        blocker.y = blocker.gpos[1];
        mover.gpos = blockerFrom.add([0, 0]);
        mover.x = mover.gpos[0];
        mover.y = mover.gpos[1];
        mover.actionsThisTurn = Math.max(0, mover.actionsThisTurn - 1);
        mover.movementBlockedCount = Math.max(0, mover.movementBlockedCount - 1);
        blocker.movementBlockedCount = Math.max(0, blocker.movementBlockedCount - 1);
        return true;

    }

export function getBlockingCharacterAt(game, pos, mover) {
        for (const character of game.missionMap.characters) {
            if (character === mover) continue;
            if (character.state === 'dead') continue;
            if (!character.gpos.equals(pos)) continue;
            return character;
        }
        return null;

    }

export function getDoorAt(game, pos) {
        for (const entity of game.missionMap.entities.children) {
            if (entity instanceof DoorWidget && entity.pos.equals(pos)) return entity;
        }
        return null;

    }

export function pickInvestigateSweepCell(game, enemy, anchor) {
        const offsets = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1],[2,0],[0,2],[-2,0],[0,-2]];
        const idOffset = enemy.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const start = (game.timelineTick + idOffset) % offsets.length;
        for (let i = 0; i < offsets.length; i++) {
            const offset = offsets[(start + i) % offsets.length];
            const candidate = anchor.add(offset);
            if (game.canEnemyOccupy(enemy, candidate)) return candidate;
        }
        return null;

    }

export function pickEngageApproachCell(game, enemy, target) {
        const offsets = [FacingVec[Facing.north], FacingVec[Facing.east], FacingVec[Facing.south], FacingVec[Facing.west]];
        const coverLayer = game.missionMap.metaTileMap.layer[MetaLayers.cover];
        const candidates = offsets
            .map((offset) => target.add(offset))
            .filter((point) => game.canEnemyOccupy(enemy, point))
            .map((point) => {
                const coverBonus = coverLayer.get(point) > 0 ? -0.35 : 0;
                const score = point.dist(enemy.gpos) + coverBonus + game.enemyIdJitter(`${enemy.id}:${point[0]},${point[1]}`);
                return { point, score };
            })
            .sort((a, b) => a.score - b.score);
        return candidates[0]?.point ?? target;

    }

export function canEnemyOccupy(game, enemy, point) {
        if (point[0] < 0 || point[1] < 0 || point[0] >= game.missionMap.w || point[1] >= game.missionMap.h) return false;
        const traversible = game.missionMap.metaTileMap.getFromLayer(MetaLayers.traversible, point);
        if (typeof traversible !== 'number' || traversible === 0) return false;
        const occupied = game.missionMap.characters.some((character) => character !== enemy && game.isBlockingEnemyPathCharacter(character) && character.gpos.equals(point));
        return !occupied;

    }

export function tryEnemyAttack(game, enemy, target, data, orangeFireLockPenalty = false) {
        if (game.isScientistId(enemy.id) || data.role === 'target') return false;
        const dist = enemy.gpos.dist(target.gpos);
        if (dist > 7 || !enemy.canSee(target, game.missionMap) || !game.enemyFacingAllowsSight(enemy, target, data)) return false;
        if (!game.canEnemyEscalateToEngage(enemy, data, dist)) return false;
        if (data.behaviorState !== 'engage' && dist > 4) return false;
        enemy.actionsThisTurn--;
        const targetData = game.characterState.get(target.id);
        const coverPenalty = targetData?.hasCover ? 0.22 : 0;
        const suppressionPenalty = data.isSuppressed ? 0.2 : 0;
        const lockPenalty = orangeFireLockPenalty ? 0.22 : 0;
        const distancePenalty = Math.max(0, dist - 8) * 0.04;
        const baseHit = dist <= 2 ? 0.9 : 0.78;
        const armorEvasion = target.armorRating >= 0.7 ? 0.08 : 0;
        const trainedEvasion = target.trainingLevel >= 1 ? 0.04 : 0;
        const hitChance = Math.max(0.16, Math.min(0.95, baseHit - coverPenalty - suppressionPenalty - lockPenalty - distancePenalty - armorEvasion - trainedEvasion));
        target.applySuppression(dist <= 2.2 ? 1.9 : 1.3);
        const didHit = game.missionMap.sampleRuntimeRandom(`enemy:${enemy.id}:attack`) < hitChance;
        if (didHit) {
            const damage = dist <= 3 ? 3 : 2;
            target.takeDamage('piercing', damage);
        }
        game.missionMap.emitGunfire(enemy.gpos, enemy.id, false, 1);
        game.missionMap.emitAttack(enemy.gpos, target.gpos, didHit, enemy.id, target.id, 2);
        game.addLog(`${enemy.id} fired on ${target.id} (${didHit ? 'hit' : 'miss'})`);
        data.lastKnownThreatPos = target.gpos.add([0, 0]);
        data.lastKnownThreatTtl = 4;
        data.awarenessState = 'engaging';
        return true;

    }

export function selectEnemyAttackTarget(game, enemy, data) {
        if (game.isScientistId(enemy.id) || data.role === 'target') return null;
        const visiblePlayers = game.getEnemyPerceivablePlayers()
            .map((player) => {
                const playerData = game.characterState.get(player.id);
                const distance = enemy.gpos.dist(player.gpos);
                const coverSightLimit = game.getPerceptionCoverDistance(enemy, data);
                const canSeePlayer = enemy.canSee(player, game.missionMap)
                    && game.enemyFacingAllowsSight(enemy, player, data)
                    && !(playerData?.hasCover && distance > coverSightLimit);
                return {
                    player,
                    playerData,
                    distance,
                    canSeePlayer,
                    isActive: player === game.missionMap.activeCharacter,
                };
            })
            .filter((entry) => entry.canSeePlayer);
        if (visiblePlayers.length === 0) return null;
        const scored = visiblePlayers
            .map((entry) => {
                const alliesAlreadyPressuring = game.missionMap.enemies.filter((ally) => {
                    if (ally === enemy || ally.state === 'dead') return false;
                    const allyData = game.characterState.get(ally.id);
                    if (!allyData) return false;
                    const isPressuring = allyData.behaviorState === 'engage' || allyData.awarenessState === 'engaging';
                    return isPressuring && ally.gpos.dist(entry.player.gpos) <= 6;
                }).length;
                const healthRatio = entry.player.maxHealth > 0 ? entry.player.health / entry.player.maxHealth : 1;
                const coverPenalty = entry.playerData?.hasCover ? 1.25 : 0;
                const activePenalty = entry.isActive ? 0.5 : 0;
                const spreadPenalty = alliesAlreadyPressuring * 0.75;
                const score = entry.distance + coverPenalty + healthRatio + activePenalty + spreadPenalty + game.enemyIdJitter(`${enemy.id}:${entry.player.id}`);
                return { player: entry.player, score };
            })
            .sort((a, b) => a.score - b.score);
        return scored[0]?.player ?? null;

    }

export function enemyIdJitter(game, id) {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
        }
        return ((hash % 11) - 5) * 0.05;

    }

export function takeScientistTurn(game, enemy, data) {
        if (data.behaviorState === 'comply') {
            while (enemy.actionsThisTurn > 0) {
                enemy.rest(game.missionMap);
            }
            enemy.actionsThisTurn = 2;
            return;
        }
        if (data.behaviorState === 'passive') {
            game.scientistFleeStallTurns.delete(enemy.id);
            game.takeScientistPassiveTurn(enemy);
            return;
        }
        if (data.behaviorState !== 'fleeing' && data.behaviorState !== 'investigate') {
            game.takeScientistPassiveTurn(enemy);
            return;
        }
        game.scientistPassiveWaitTurns.set(enemy.id, 0);
        let movedThisTurn = false;
        while (enemy.actionsThisTurn > 0) {
            const isFleeing = data.behaviorState === 'fleeing';
            if (isFleeing && game.boundaryDistance(enemy.gpos) <= 0) {
                game.escapeScientist(enemy, data);
                break;
            }
            if (movedThisTurn) {
                enemy.rest(game.missionMap);
                continue;
            }
            const avoidImmediateBacktrack = game.scientistPreviousPositions.get(enemy.id) ?? null;
            const currentBoundary = game.boundaryDistance(enemy.gpos);
            const currentNearestPlayerDist = game.getEnemyPerceivablePlayers()
                .reduce((minDist, player) => Math.min(minDist, enemy.gpos.dist(player.gpos)), Number.POSITIVE_INFINITY);
            const directions = [Facing.north, Facing.east, Facing.south, Facing.west];
            const candidates = directions
                .map((direction) => {
                    const npos = enemy.gpos.add(FacingVec[direction]);
                    const traversible = game.missionMap.metaTileMap.getFromLayer(MetaLayers.traversible, npos);
                    const blocker = game.getBlockingCharacterAt(npos, enemy);
                    const occupied = blocker ? game.isBlockingEnemyPathCharacter(blocker) : false;
                    const traversibleInDirection = (traversible & (1 << direction)) !== 0;
                    const nearestPlayerDist = game.getEnemyPerceivablePlayers()
                        .reduce((minDist, player) => Math.min(minDist, npos.dist(player.gpos)), Number.POSITIVE_INFINITY);
                    const boundaryDist = game.boundaryDistance(npos);
                    const score = isFleeing
                        ? boundaryDist * 3.1 - nearestPlayerDist * 1.1
                        : boundaryDist * 0.2 - nearestPlayerDist * 1.4;
                    return { direction, npos, traversibleInDirection, occupied, blocker, score, boundaryDist, nearestPlayerDist };
                })
                .filter((candidate) => candidate.traversibleInDirection)
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
                    const stall = (game.scientistFleeStallTurns.get(enemy.id) ?? 0) + 1;
                    game.scientistFleeStallTurns.set(enemy.id, stall);
                    if (stall >= 2) {
                        data.behaviorState = 'comply';
                        game.addLog(`${enemy.id} yields under pressure.`);
                    }
                }
                enemy.rest(game.missionMap);
                continue;
            }
            const usableCandidates = avoidImmediateBacktrack
                ? candidates.filter((candidate) => !candidate.npos.equals(avoidImmediateBacktrack))
                : candidates;
            const selected = usableCandidates.length > 0 ? usableCandidates[0] : candidates[0];
            const from = enemy.gpos.add([0, 0]);
            enemy.move(selected.direction, game.missionMap);
            let movedOrSwapped = !enemy.gpos.equals(from);
            if (!enemy.gpos.equals(from)) {
                game.scientistPreviousPositions.set(enemy.id, from);
                game.scientistFleeStallTurns.set(enemy.id, 0);
            } else if (game.trySwapWithBlockingCharacter(enemy, selected.direction)) {
                game.scientistPreviousPositions.set(enemy.id, from);
                game.scientistFleeStallTurns.set(enemy.id, 0);
                movedOrSwapped = true;
            }
            movedThisTurn = movedOrSwapped;
        }
        enemy.actionsThisTurn = 2;

    }

export function takeScientistPassiveTurn(game, enemy) {
        let waitTurns = game.scientistPassiveWaitTurns.get(enemy.id) ?? 0;
        while (enemy.actionsThisTurn > 0) {
            if (waitTurns > 0) {
                waitTurns--;
                enemy.rest(game.missionMap);
                continue;
            }
            if (enemy.patrolRoute.length === 0) {
                enemy.rest(game.missionMap);
                continue;
            }
            if (enemy.patrolTarget < 0) enemy.patrolTarget = 0;
            const target = enemy.patrolRoute[enemy.patrolTarget];
            if (enemy.gpos.equals(target)) {
                enemy.patrolTarget = (enemy.patrolTarget + 1) % enemy.patrolRoute.length;
                waitTurns = 6 + ((game.timelineTurn + enemy.patrolTarget + enemy.id.length) % 7);
                enemy.rest(game.missionMap);
                continue;
            }
            const from = enemy.gpos.add([0, 0]);
            const moved = game.moveEnemyToward(enemy, target);
            if (!moved) {
                enemy.rest(game.missionMap);
            } else {
                game.scientistPreviousPositions.set(enemy.id, from);
                enemy.rest(game.missionMap);
            }
        }
        game.scientistPassiveWaitTurns.set(enemy.id, waitTurns);
        enemy.actionsThisTurn = 2;

    }

export function boundaryDistance(game, pos) {
        return Math.min(pos[0], pos[1], game.missionMap.w - 1 - pos[0], game.missionMap.h - 1 - pos[1]);

    }

export function takeEnemyBehaviorTurn(game, enemy) {
        if (enemy.state === 'dead' || enemy.state === 'surrendering' || enemy.state === 'unconscious' || enemy.state === 'fleeing') return;
        const data = game.characterState.get(enemy.id);
        if (!data) {
            enemy.takeTurn(game.missionMap);
            return;
        }
        const hardFireLockThisTurn = data.suppressionFireLockRedTurns > 0;
        const softFireLockThisTurn = !hardFireLockThisTurn && data.suppressionFireLockOrangeTurns > 0;
        if (hardFireLockThisTurn) {
            data.suppressionFireLockRedTurns = Math.max(0, data.suppressionFireLockRedTurns - 1);
        }
        if (game.isScientistId(enemy.id) || data.role === 'target') {
            game.takeScientistTurn(enemy, data);
            if (softFireLockThisTurn) {
                data.suppressionFireLockOrangeTurns = Math.max(0, data.suppressionFireLockOrangeTurns - 1);
            }
            return;
        }
        while (enemy.actionsThisTurn > 0) {
            const attackTarget = game.selectEnemyAttackTarget(enemy, data);
            if (!hardFireLockThisTurn && attackTarget && game.tryEnemyAttack(enemy, attackTarget, data, softFireLockThisTurn)) {
                continue;
            }
            if (data.isSuppressed) {
                enemy.rest(game.missionMap);
                continue;
            }
            const target = game.selectEnemyBehaviorTarget(enemy, data);
            if (!target) {
                enemy.rest(game.missionMap);
                continue;
            }
            if (!game.moveEnemyToward(enemy, target)) {
                enemy.rest(game.missionMap);
            }
        }
        if (softFireLockThisTurn) {
            data.suppressionFireLockOrangeTurns = Math.max(0, data.suppressionFireLockOrangeTurns - 1);
        }
        enemy.actionsThisTurn = 2;

    }

export function resolveTurnProgression(game, player) {
        game.missionMap.updateCharacterVisibility();
        if (player.actionsThisTurn !== 0) return;
        const completedTurn = game.timelineTurn;
        game.syncCharacterStateFromMap();
        game.updateTacticalStateFromMap();
        game.decaySuppression();
        game.updateAwarenessStateFromPerception();
        game.updateEnemyBehaviorStateFromPerception();
        game.applyCharacterStateToMap();
        game.ensureReplayGhostVisible();

        if (game.replayMode && player.id === 'maria') {
            game.runRandyReplayTurn(completedTurn);
            game.syncCharacterStateFromMap();
            game.updateTacticalStateFromMap();
            game.updateAwarenessStateFromPerception();
            game.updateEnemyBehaviorStateFromPerception();
            game.applyCharacterStateToMap();
            game.ensureReplayGhostVisible();
        }

        game.resolveTurnHazards();
        game.syncCharacterStateFromMap();
        game.updateTacticalStateFromMap();
        game.updateAwarenessStateFromPerception();
        game.updateEnemyBehaviorStateFromPerception();
        game.applyCharacterStateToMap();
        game.ensureReplayGhostVisible();

        for (const enemy of game.missionMap.enemies) {
            game.takeEnemyBehaviorTurn(enemy);
        }
        game.syncCharacterStateFromMap();
        game.updateTacticalStateFromMap();
        game.updateAwarenessStateFromPerception();
        game.updateEnemyBehaviorStateFromPerception();
        game.applyCharacterStateToMap();
        game.ensureReplayGhostVisible();
        game.advanceTransientSignals();
        player.actionsThisTurn = 2;
        const playerData = game.characterState.get(player.id);
        if (playerData) {
            playerData.actionsRemaining = 2;
        }
        if (game.replayMode && player.id === 'maria') {
            const randy = game.missionMap.playerCharacters.find((candidate) => candidate.id === 'randy');
            if (randy && randy.state !== 'dead' && randy.health > 0) {
                randy.actionsThisTurn = 2;
                const randyData = game.characterState.get(randy.id);
                if (randyData) randyData.actionsRemaining = 2;
            }
        }
        game.resetPlayerTurnActionCounters();
        game.timelineTurn++;
        game.missionMap.updateCharacterVisibility(true);
        game.ensureReplayGhostVisible();
        if (player.id === 'maria') {
            game.finalizeMariaTurnObligations(completedTurn);
        }

    }

export function updateMissionOutcome(game) {
        const scientistEnemies = game.missionMap.enemies.filter((enemy) => game.isScientistId(enemy.id));
        const arrestedCount = scientistEnemies.filter((enemy) => {
            const data = game.characterState.get(enemy.id);
            return enemy.state === 'surrendering' || data?.casualtyState === 'detained';
        }).length;
        const killedCount = scientistEnemies.filter((enemy) => {
            const data = game.characterState.get(enemy.id);
            return enemy.state === 'dead' || data?.casualtyState === 'dead';
        }).length;
        const escapedCount = scientistEnemies.filter((enemy) => game.escapedScientistIds.has(enemy.id)).length;
        const scientistTotal = Math.max(1, scientistEnemies.length);

        const arrestObjective = game.objectives.find((o) => o.id === 'arrestScientists');
        const protectObjective = game.objectives.find((o) => o.id === 'protectScientists');
        const escapeObjective = game.objectives.find((o) => o.id === 'preventScientistEscape');

        if (arrestObjective) arrestObjective.state = arrestedCount >= scientistTotal ? 'complete' : 'pending';
        if (protectObjective) protectObjective.state = killedCount > 0 ? 'failed' : (arrestedCount >= scientistTotal ? 'complete' : 'pending');
        if (escapeObjective) escapeObjective.state = escapedCount >= scientistTotal ? 'failed' : (arrestedCount >= scientistTotal ? 'complete' : 'pending');

        if (killedCount > 0) {
            game.missionStatus = 'failure';
            game.message = `Mission failure: ${killedCount} scientist(s) were killed by gunfire.`;
        } else if (escapedCount >= scientistTotal) {
            game.missionStatus = 'failure';
            game.message = 'Mission failure: all scientists escaped.';
        } else if (arrestedCount >= scientistTotal) {
            game.missionStatus = 'success';
            game.message = `Mission success: all ${scientistTotal} scientists arrested.`;
        } else if (game.missionStatus === 'notStarted') {
            game.missionStatus = 'active';
        }

    }

export function isAtMapBoundary(game, x, y) {
        const maxX = game.missionMap.w - 1;
        const maxY = game.missionMap.h - 1;
        return x <= 0 || y <= 0 || x >= maxX || y >= maxY;

    }

export function getPatrolRouteGlyphs(game) {
        return game.missionMap.enemies.map((enemy) => {
            const points = enemy.patrolRoute.length > 0 ? enemy.patrolRoute : [enemy.gpos];
            return {
                id: enemy.id,
                role: game.isScientistId(enemy.id) ? 'scientist' : 'guard',
                points: points.map((pos) => [pos[0], pos[1]]),
            };
        });
    }
