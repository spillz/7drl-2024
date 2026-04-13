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


export function resolveTurnHazards(game) {
        const detonations = game.missionMap.advanceTurnHazards();
        if (detonations.length === 0) return;
        const breachAction = BreachBombAction.a();
        for (const detonation of detonations) {
            if (detonation.kind !== 'breach') continue;
            const sourceCharacter = game.missionMap.characters.find((character) => character.id === detonation.source)
                ?? game.missionMap.playerCharacters[0];
            const detonated = breachAction.detonate(sourceCharacter, game.missionMap, detonation.position);
            if (detonated) {
                game.addLog(`Timed charge detonated at ${detonation.position[0]},${detonation.position[1]}.`);
            }
        }

    }

export function advanceTransientSignals(game) {
        game.missionMap.soundEvents = game.missionMap.soundEvents
            .map((event) => ({ ...event, ttl: event.ttl - 1 }))
            .filter((event) => event.ttl > 0);
        game.missionMap.decoyEvents = game.missionMap.decoyEvents
            .map((event) => ({ ...event, ttl: event.ttl - 1 }))
            .filter((event) => event.ttl > 0);
        game.missionMap.attackEvents = game.missionMap.attackEvents
            .map((event) => ({ ...event, ttl: event.ttl - 1 }))
            .filter((event) => event.ttl > 0);

    }

export function decaySuppression(game) {
        for (const data of game.characterState.values()) {
            if (data.casualtyState === 'dead' || data.casualtyState === 'detained') continue;
            const decay = data.hasCover ? 2 : 1;
            data.suppressionPoints = Math.max(0, data.suppressionPoints - decay);
            data.isSuppressed = data.suppressionPoints >= 2;
        }

    }

export function updateTacticalStateFromMap(game) {
        const coverLayer = game.missionMap.metaTileMap.layer[MetaLayers.cover];
        for (const character of game.missionMap.characters) {
            const data = game.characterState.get(character.id);
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

export function toCharacterWidgetState(game, behaviorState) {
        if (behaviorState === 'dead') return 'dead';
        if (behaviorState === 'surrendering') return 'surrendering';
        return 'patrolling';

    }

export function applyCharacterStateToMap(game) {
        for (const character of game.missionMap.characters) {
            const data = game.characterState.get(character.id);
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
                character.state = game.toCharacterWidgetState(data.behaviorState);
            }
        }

    }

export function syncCharacterStateFromMap(game) {
        for (const character of game.missionMap.characters) {
            const data = game.characterState.get(character.id);
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
                const becameSuppressed = prevSuppression < 2 && data.suppressionPoints >= 2;
                const reinforcedSuppression = prevSuppression >= 2 && data.suppressionPoints > prevSuppression + 0.6;
                if (becameSuppressed || reinforcedSuppression) {
                    data.suppressionFireLockRedTurns = Math.max(data.suppressionFireLockRedTurns, 1);
                    data.suppressionFireLockOrangeTurns = Math.max(data.suppressionFireLockOrangeTurns, 1);
                }
                const tookDamage = data.healthPoints < prevHealth;
                const tookIncomingFire = data.suppressionPoints > prevSuppression + 0.5;
                if (tookDamage || tookIncomingFire) {
                    data.recentlyAttackedTtl = 3;
                    data.alertTtl = Math.max(data.alertTtl, 120);
                    data.alertPermanent = true;
                    game.hostilityEscalated = true;
                    if (!game.hostilityReason) {
                        game.hostilityReason = tookDamage ? `${character.id} was hit` : `${character.id} took incoming fire`;
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
                data.suppressionFireLockRedTurns = 0;
                data.suppressionFireLockOrangeTurns = 0;
                if (game.isScientistId(character.id)) {
                    game.scientistPreviousPositions.delete(character.id);
                    game.scientistFleeStallTurns.delete(character.id);
                    game.scientistPassiveWaitTurns.delete(character.id);
                }
            } else if (character.state === 'surrendering') {
                data.priorBehaviorState = data.behaviorState;
                data.behaviorState = 'surrendering';
                data.casualtyState = 'detained';
                data.suppressionFireLockRedTurns = 0;
                data.suppressionFireLockOrangeTurns = 0;
                if (game.isScientistId(character.id)) {
                    game.escapedScientistIds.delete(character.id);
                    game.scientistPreviousPositions.delete(character.id);
                    game.scientistFleeStallTurns.delete(character.id);
                    game.scientistPassiveWaitTurns.delete(character.id);
                }
            } else if (character.state === 'unconscious') {
                data.priorBehaviorState = data.behaviorState;
                data.behaviorState = 'unaware';
                data.casualtyState = 'unconscious';
                data.awarenessState = 'unaware';
                data.actionsRemaining = 0;
                data.suppressionFireLockRedTurns = 0;
                data.suppressionFireLockOrangeTurns = 0;
                if (game.isScientistId(character.id)) {
                    game.scientistPreviousPositions.delete(character.id);
                    game.scientistFleeStallTurns.delete(character.id);
                    game.scientistPassiveWaitTurns.delete(character.id);
                }
            } else if (data.casualtyState === 'dead' || data.casualtyState === 'detained') {
                data.casualtyState = 'combatEffective';
            }
        }

    }

export function initializeCharacterState(game) {
        game.characterState = new Map();
        for (const character of game.missionMap.playerCharacters) {
            const data = new CharacterStateData(character, 'player');
            data.behaviorState = character.state === 'dead' ? 'dead' : 'patrol';
            data.awarenessState = 'engaging';
            game.characterState.set(character.id, data);
        }
        for (const enemy of game.missionMap.enemies) {
            const role = game.isScientistId(enemy.id) ? 'target' : 'enemy';
            const data = new CharacterStateData(enemy, role);
            if (enemy.state === 'dead') {
                data.behaviorState = 'dead';
                data.awarenessState = 'unaware';
            } else if (role === 'target') {
                data.behaviorState = 'passive';
                data.resumeBehaviorState = 'passive';
                data.awarenessState = 'unaware';
                if (!game.scientistPassiveWaitTurns.has(enemy.id)) {
                    game.scientistPassiveWaitTurns.set(enemy.id, 6 + ((enemy.id.length + game.missionSeed) % 7));
                }
            } else {
                data.behaviorState = game.getGuardIdleBehaviorState(enemy);
                data.resumeBehaviorState = data.behaviorState;
                data.awarenessState = 'unaware';
            }
            game.characterState.set(enemy.id, data);
        }
        game.applyCharacterStateToMap();

    }

export function updateEnemyBehaviorStateFromPerception(game) {
        for (const enemy of game.missionMap.enemies) {
            const data = game.characterState.get(enemy.id);
            if (!data) continue;
            if (data.behaviorState === 'dead' || data.behaviorState === 'surrendering') continue;
            const visiblePlayers = game.getEnemyPerceivablePlayers()
                .map((player) => {
                    const playerData = game.characterState.get(player.id);
                    const distance = enemy.gpos.dist(player.gpos);
                    const rawCanSee = enemy.canSee(player, game.missionMap) && game.enemyFacingAllowsSight(enemy, player, data);
                    const coverSightLimit = game.getPerceptionCoverDistance(enemy, data);
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
                if (enemy.state === 'fleeing' || game.escapedScientistIds.has(enemy.id)) {
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
                const guardIdleState = game.getGuardIdleBehaviorState(enemy);
                if (((seenPlayer && seenPlayer.distance <= 5 && !data.isSuppressed) || data.awarenessState === 'engaging')
                    && game.canEnemyEscalateToEngage(enemy, data, seenPlayer?.distance ?? Number.POSITIVE_INFINITY)) {
                    nextState = 'engage';
                } else if ((seenPlayer || data.awarenessState === 'investigating')
                    && data.lastKnownThreatPos
                    && data.lastKnownThreatTtl > 0) {
                    nextState = 'investigate';
                } else if (
                    (data.behaviorState === 'investigate' || data.behaviorState === 'engage')
                    && (data.lastKnownThreatTtl > 0 || data.awarenessCooldown > 0 || data.awarenessState === 'investigating' || data.awarenessState === 'engaging')
                ) {
                    nextState = 'investigate';
                } else if (data.behaviorState === 'investigate' || data.behaviorState === 'engage' || data.lastKnownThreatTtl === 0) {
                    nextState = guardIdleState;
                } else if (data.behaviorState !== guardIdleState && data.awarenessState === 'unaware') {
                    nextState = guardIdleState;
                }
            }
            if (nextState !== data.behaviorState) {
                data.priorBehaviorState = data.behaviorState;
                data.behaviorState = nextState;
            }
        }

    }

export function updateAwarenessStateFromPerception(game) {
        const communicatingEnemies = game.missionMap.enemies
            .filter((enemy) => {
                const data = game.characterState.get(enemy.id);
                if (!data) return false;
                return data.awarenessState === 'investigating'
                    || data.awarenessState === 'engaging'
                    || data.alertPermanent
                    || data.alertTtl >= 30;
            });
        const openDoors = game.missionMap.entities.children
            .filter((entity) => entity instanceof DoorWidget && entity.state === 'open');
        const layout = game.missionMap.metaTileMap.layer[MetaLayers.layout];
        const brokenWindowCells = [];
        for (const rawPos of layout.iterAll()) {
            const pos = eskv.v2(rawPos);
            if (layout.get(pos) === LayoutTiles.brokenWindow) brokenWindowCells.push(pos.add([0, 0]));
        }
        /** @type {{source:string, position: import('eskv/lib/eskv.js').Vec2, radius:number, severe:boolean}[]} */
        const guardAlertBroadcasts = game.missionMap.enemies
            .filter((enemy) => game.isGuardId(enemy.id))
            .map((enemy) => {
                const data = game.characterState.get(enemy.id);
                if (!data) return null;
                const active = data.alertPermanent || data.alertTtl > 0 || data.awarenessState !== 'unaware';
                if (!active) return null;
                const position = data.lastKnownThreatPos ? data.lastKnownThreatPos.add([0, 0]) : enemy.gpos.add([0, 0]);
                return {
                    source: enemy.id,
                    position,
                    radius: data.alertPermanent ? 14 : 10,
                    severe: data.alertPermanent || data.awarenessState === 'engaging',
                };
            })
            .filter((entry) => entry !== null);
        for (const enemy of game.missionMap.enemies) {
            const data = game.characterState.get(enemy.id);
            if (!data) continue;
            if (data.behaviorState === 'dead' || data.behaviorState === 'surrendering' || data.casualtyState === 'unconscious') continue;
            const isScientist = game.isScientistId(enemy.id) || data.role === 'target';
            const visiblePlayers = game.getEnemyPerceivablePlayers()
                .map((player) => {
                    const playerData = game.characterState.get(player.id);
                    const rawCanSeePlayer = enemy.canSee(player, game.missionMap) && game.enemyFacingAllowsSight(enemy, player, data);
                    const distToPlayer = enemy.gpos.dist(player.gpos);
                    const coverSightLimit = game.getPerceptionCoverDistance(enemy, data);
                    const canSeePlayer = rawCanSeePlayer && !(playerData?.hasCover && distToPlayer > coverSightLimit);
                    return { player, distToPlayer, canSeePlayer };
                })
                .filter((entry) => entry.canSeePlayer)
                .sort((a, b) => a.distToPlayer - b.distToPlayer);
            const seenPlayer = visiblePlayers.length > 0 ? visiblePlayers[0] : null;
            const heardSoundEvents = game.missionMap.soundEvents
                .filter((event) => event.source !== enemy.id && event.position.dist(enemy.gpos) <= event.radius)
                .sort((a, b) => a.position.dist(enemy.gpos) - b.position.dist(enemy.gpos));
            const heardGunfireEvents = heardSoundEvents.filter((event) => event.source.endsWith(':gunfire'));
            const heardNearbySoundEvents = heardSoundEvents.filter((event) => event.position.dist(enemy.gpos) <= 3.25);
            const heardSound = heardGunfireEvents.length > 0 || (isScientist ? heardNearbySoundEvents.length > 0 : heardSoundEvents.length > 0);
            const noticedDecoyEvents = game.missionMap.decoyEvents
                .filter((event) => event.source !== enemy.id && event.position.dist(enemy.gpos) <= event.radius)
                .sort((a, b) => a.position.dist(enemy.gpos) - b.position.dist(enemy.gpos));
            const noticedDecoy = isScientist ? false : noticedDecoyEvents.length > 0;
            const nearbyDoor = !isScientist
                ? (openDoors.find((door) => door.pos.dist(enemy.gpos) <= 3.5) ?? null)
                : null;
            const nearbyOpenDoor = nearbyDoor !== null;
            const heardGuardBroadcast = !isScientist
                ? guardAlertBroadcasts
                    .filter((broadcast) => broadcast.source !== enemy.id && broadcast.position.dist(enemy.gpos) <= broadcast.radius)
                    .sort((a, b) => a.position.dist(enemy.gpos) - b.position.dist(enemy.gpos))
                : [];
            const nearestGuardBroadcast = heardGuardBroadcast.length > 0 ? heardGuardBroadcast[0] : null;
            const visibleCasualty = game.missionMap.enemies.some((other) => {
                if (other === enemy) return false;
                if (other.state !== 'dead' && other.state !== 'unconscious' && other.state !== 'surrendering') return false;
                return enemy.canSee(other, game.missionMap) && game.enemyFacingAllowsSight(enemy, other, data);
            });
            const seenBrokenWindow = brokenWindowCells.some((pos) => {
                const dist = pos.dist(enemy.gpos);
                if (isScientist) return dist <= 2.5;
                return dist <= 5.5;
            });
            const allyCommunicated = communicatingEnemies.some((ally) => ally !== enemy && ally.gpos.dist(enemy.gpos) <= 9);
            const communicatedPermanentAlert = !isScientist && communicatingEnemies.some((ally) => {
                if (ally === enemy || ally.gpos.dist(enemy.gpos) > 12) return false;
                const allyData = game.characterState.get(ally.id);
                return Boolean(allyData?.alertPermanent);
            });
            const sharedThreat = communicatingEnemies
                .map((ally) => ({ ally, data: game.characterState.get(ally.id) }))
                .find((entry) =>
                    entry.ally !== enemy
                    && entry.ally.gpos.dist(enemy.gpos) <= 12
                    && entry.data?.lastKnownThreatPos
                    && (entry.data?.lastKnownThreatTtl ?? 0) > 0,
                );
            const severeStimulus = Boolean(seenPlayer)
                || heardGunfireEvents.length > 0
                || visibleCasualty
                || seenBrokenWindow
                || Boolean(nearestGuardBroadcast?.severe);
            const mildStimulus = heardSound || noticedDecoy || nearbyOpenDoor || allyCommunicated || communicatedPermanentAlert || nearestGuardBroadcast !== null;
            let nextAwareness = data.awarenessState;
            const engageSightDistance = isScientist ? 2.2 : 5;
            const awarenessHold = isScientist ? 12 : 30;
            const threatTtl = isScientist ? 30 : 90;
            if (severeStimulus) {
                data.alertPermanent = true;
                data.alertTtl = Math.max(data.alertTtl, isScientist ? 90 : 180);
            } else if (communicatedPermanentAlert) {
                data.alertTtl = Math.max(data.alertTtl, isScientist ? 20 : 90);
                if (!isScientist && data.alertTtl >= 80) {
                    data.alertPermanent = true;
                }
                if (!data.lastKnownThreatPos && sharedThreat?.data?.lastKnownThreatPos) {
                    data.lastKnownThreatPos = sharedThreat.data.lastKnownThreatPos.add([0, 0]);
                    data.lastKnownThreatTtl = Math.max(data.lastKnownThreatTtl, 30);
                }
                if (!data.lastKnownThreatPos && nearestGuardBroadcast) {
                    data.lastKnownThreatPos = nearestGuardBroadcast.position.add([0, 0]);
                    data.lastKnownThreatTtl = Math.max(data.lastKnownThreatTtl, nearestGuardBroadcast.severe ? 45 : 25);
                }
            } else if (mildStimulus) {
                data.alertTtl = Math.max(data.alertTtl, isScientist ? 8 : 45);
                if (!data.lastKnownThreatPos && nearestGuardBroadcast) {
                    data.lastKnownThreatPos = nearestGuardBroadcast.position.add([0, 0]);
                    data.lastKnownThreatTtl = Math.max(data.lastKnownThreatTtl, nearestGuardBroadcast.severe ? 35 : 18);
                } else if (!data.lastKnownThreatPos && nearbyDoor) {
                    data.lastKnownThreatPos = nearbyDoor.pos.add([0, 0]);
                    data.lastKnownThreatTtl = Math.max(data.lastKnownThreatTtl, 12);
                }
            }
            if (seenPlayer && seenPlayer.distToPlayer <= engageSightDistance) {
                nextAwareness = isScientist ? 'investigating' : 'engaging';
                data.awarenessCooldown = Math.max(data.awarenessCooldown, awarenessHold);
                data.lastKnownThreatPos = seenPlayer.player.gpos.add([0, 0]);
                data.lastKnownThreatTtl = threatTtl;
            } else if (seenPlayer || heardSound || visibleCasualty || seenBrokenWindow) {
                nextAwareness = game.maxAwareness(nextAwareness, 'investigating');
                data.awarenessCooldown = Math.max(data.awarenessCooldown, awarenessHold);
                if (seenPlayer) {
                    data.lastKnownThreatPos = seenPlayer.player.gpos.add([0, 0]);
                    data.lastKnownThreatTtl = threatTtl;
                } else if (heardSound) {
                    const sourceSound = heardGunfireEvents[0] ?? (isScientist ? heardNearbySoundEvents[0] : heardSoundEvents[0]);
                    if (sourceSound) {
                        data.lastKnownThreatPos = sourceSound.position.add([0, 0]);
                        data.lastKnownThreatTtl = Math.max(isScientist ? 18 : 40, sourceSound.ttl);
                    }
                } else if (seenBrokenWindow) {
                    const anchor = brokenWindowCells[0];
                    data.lastKnownThreatPos = anchor.add([0, 0]);
                    data.lastKnownThreatTtl = Math.max(data.lastKnownThreatTtl, isScientist ? 15 : 35);
                }
            } else if (noticedDecoy) {
                // Decoys should pull guard attention as an active investigation cue.
                nextAwareness = game.maxAwareness(nextAwareness, 'investigating');
                data.awarenessCooldown = Math.max(data.awarenessCooldown, awarenessHold);
                data.lastKnownThreatPos = noticedDecoyEvents[0].position.add([0, 0]);
                data.lastKnownThreatTtl = Math.max(isScientist ? 10 : 24, noticedDecoyEvents[0].ttl);
            } else if (!isScientist && (allyCommunicated || communicatedPermanentAlert || nearbyOpenDoor)) {
                nextAwareness = game.maxAwareness(nextAwareness, 'aware');
                data.awarenessCooldown = Math.max(data.awarenessCooldown, communicatedPermanentAlert ? 25 : 14);
            } else if (data.awarenessCooldown > 0) {
                data.awarenessCooldown--;
            } else if (data.alertPermanent || data.alertTtl > 0) {
                nextAwareness = game.maxAwareness(
                    data.awarenessState === 'engaging' ? 'investigating' : data.awarenessState,
                    'aware',
                );
            } else if (data.awarenessState === 'engaging') {
                nextAwareness = 'investigating';
            } else if (data.awarenessState === 'investigating') {
                nextAwareness = data.lastKnownThreatTtl > 0
                    ? 'investigating'
                    : (isScientist ? 'unaware' : 'aware');
            } else if (data.awarenessState === 'aware') {
                nextAwareness = 'unaware';
            }
            const noFreshStimulus = !seenPlayer
                && !heardSound
                && !noticedDecoy
                && !visibleCasualty
                && !seenBrokenWindow
                && !nearbyOpenDoor
                && !allyCommunicated
                && !communicatedPermanentAlert;
            if (noFreshStimulus) {
                data.lastKnownThreatTtl = Math.max(0, data.lastKnownThreatTtl - 1);
                if (data.lastKnownThreatTtl === 0) {
                    data.lastKnownThreatPos = null;
                }
                data.alertTtl = Math.max(0, data.alertTtl - 1);
            } else if (data.alertTtl > 0) {
                data.alertTtl = Math.max(data.alertPermanent ? (isScientist ? 30 : 60) : 0, data.alertTtl - 1);
            }
            if (data.alertPermanent) {
                data.alertTtl = Math.max(data.alertTtl, isScientist ? 30 : 60);
            }
            if (game.isGuardId(enemy.id) && !isScientist && (severeStimulus || mildStimulus || nextAwareness !== 'unaware')) {
                const anchor = data.lastKnownThreatPos
                    ?? (seenPlayer ? seenPlayer.player.gpos : null)
                    ?? (nearbyDoor ? nearbyDoor.pos : null)
                    ?? enemy.gpos;
                guardAlertBroadcasts.push({
                    source: enemy.id,
                    position: anchor.add([0, 0]),
                    radius: severeStimulus ? 15 : 10,
                    severe: severeStimulus || nextAwareness === 'engaging',
                });
            }
            data.awarenessState = nextAwareness;
        }

    }

export function enemyFacingAllowsSight(game, enemy, target, data) {
        if (enemy.facing === Facing.none) return true;
        const delta = target.gpos.sub(enemy.gpos);
        const dist = enemy.gpos.dist(target.gpos);
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

export function canEnemyEscalateToEngage(game, enemy, data, distanceToPlayer = Number.POSITIVE_INFINITY) {
        const profile = game.getEnemyAggressionProfile(enemy, data);
        const immediateThreat = distanceToPlayer <= 2.25;
        if (profile === 'aggressive') {
            return game.hostilityEscalated || data.recentlyAttackedTtl > 0 || data.awarenessState === 'engaging' || immediateThreat;
        }
        if (profile === 'defensive') {
            return game.hostilityEscalated || data.recentlyAttackedTtl > 0 || immediateThreat;
        }
        return game.hostilityEscalated || data.recentlyAttackedTtl > 0 || (data.awarenessState === 'engaging' && immediateThreat);

    }

export function getEnemyAggressionProfile(game, enemy, data) {
        if (data.role === 'target') return 'hesitant';
        if (enemy.id === 'guard1' || enemy.id === 'guard2') return 'aggressive';
        if (enemy.id === 'guard6') return 'hesitant';
        return 'defensive';

    }

export function getPerceptionCoverDistance(game, enemy, data) {
        if (game.isScientistId(enemy.id) || data.role === 'target') return 2.5;
        if (game.isGuardId(enemy.id)) return 5;
        return 3;

    }

export function isBlockingEnemyPathCharacter(game, character) {
        if (character.state === 'dead') return false;
        if (character instanceof PlayerCharacter) return false;
        return true;

    }

export function getEnemyPerceivablePlayers(game) {
        const alivePlayers = game.missionMap.playerCharacters.filter((player) => player.state !== 'dead' && player.health > 0);
        if (game.replayMode) return alivePlayers;
        return alivePlayers.filter((player) => player.id === 'randy');

    }

export function getGuardIdleBehaviorState(game, enemy) {
        return enemy.patrolRoute.length <= 1 ? 'post' : 'patrol';

    }

export function maxAwareness(game, current, incoming) {
        return game.awarenessRank(incoming) > game.awarenessRank(current) ? incoming : current;

    }

export function awarenessRank(game, awareness) {
        if (awareness === 'engaging') return 3;
        if (awareness === 'investigating') return 2;
        if (awareness === 'aware') return 1;
        return 0;

    }

export function escapeScientist(game, enemy, data) {
        if (game.escapedScientistIds.has(enemy.id)) {
            enemy.actionsThisTurn = 0;
            return;
        }
        game.escapedScientistIds.add(enemy.id);
        game.scientistPreviousPositions.delete(enemy.id);
        game.scientistFleeStallTurns.delete(enemy.id);
        game.scientistPassiveWaitTurns.delete(enemy.id);
        enemy.state = 'fleeing';
        enemy.actionsThisTurn = 0;
        data.behaviorState = 'fleeing';
        data.casualtyState = 'combatEffective';
        data.actionsRemaining = 0;
        game.addLog(`${enemy.id} escaped.`);

    }

export function findEnemyById(game, id) {
        if (!id) return null;
        return game.missionMap.enemies.find((enemy) => enemy.id === id) ?? null;

    }

export function detainEnemy(game, target) {
        target.state = 'surrendering';
        const data = game.characterState.get(target.id);
        if (data) {
            data.priorBehaviorState = data.behaviorState;
            data.behaviorState = 'surrendering';
            data.casualtyState = 'detained';
            data.awarenessState = 'unaware';
            data.actionsRemaining = 0;
            data.lastKnownThreatPos = null;
            data.lastKnownThreatTtl = 0;
        }
        if (game.isScientistId(target.id)) {
            game.escapedScientistIds.delete(target.id);
            game.scientistPreviousPositions.delete(target.id);
            game.scientistFleeStallTurns.delete(target.id);
            game.scientistPassiveWaitTurns.delete(target.id);
        }

    }