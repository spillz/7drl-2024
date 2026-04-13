//@ts-check

import * as eskv from "eskv/lib/eskv.js";
import { SpriteWidget } from "eskv/lib/modules/sprites.js";
import { Character, PlayerCharacter } from "./character.js";
import { DoorWidget } from "./entity.js";
import { LayoutTiles, MetaLayers, MissionMap } from "./map.js";

/**
 * Describes the data interchanged between the action and the AI/GUI handler
 * @typedef {{
 *      result?: 'complete'|'invalid'|'infoNeeded'|'notAvailable',
 *      message?: string,
 *      validTargetPositions?: eskv.Vec2[],
 *      validTargetCharacters?: Character[],
 *      validModes?: string[],
 *      targetPosition?: eskv.Vec2,
 *      targetCharacter?: Character,
 *      mode?: string,
 *   }} ActionResponseData
 */

/**
 * ActionItem represents an inventory item of a character.
 */
export class ActionItem extends eskv.BoxLayout {
    /** @type {'vertical'|'horizontal'} */
    orientation = 'vertical';
    keyControl = '';
    constructor(props={}) {
        super();
        this.hints = {h:'5'};
        this.sprite = SpriteWidget.a({spriteSheet:eskv.App.resources['sprites']});
        this.label = eskv.Label.a({hints:{h:'1'}});
        this.children = [
            this.sprite,
            this.label,
        ];
        if(props) this.updateProperties(props);
    }
    /**
     * @param {Character} actor
     * @param {MissionMap} map
     * @param {ActionResponseData} response
     * @return {ActionResponseData}
     */
    request(actor, map, response) {
        return {result: 'notAvailable'};
    }
    get name() {
        return this.label.text;
    }
    set name(value) {
        this.label.text = value;
    }
}

/**
 * @param {Character} actor
 * @returns {Rifle|null}
 */
function getActorRifle(actor) {
    for (const action of actor.actions) {
        if (action instanceof Rifle) return action;
    }
    return null;
}

/**
 * @param {MissionMap} map
 * @param {eskv.VecLike} pos
 * @returns {DoorWidget|null}
 */
function findDoorAt(map, pos) {
    for (const entity of map.entities.children) {
        if (entity instanceof DoorWidget && entity.pos.equals(pos)) return entity;
    }
    return null;
}

/**
 * 8-way adjacency (orthogonal + diagonal), excluding same cell.
 * @param {eskv.VecLike} a
 * @param {eskv.VecLike} b
 * @returns {boolean}
 */
function isAdjacent8(a, b) {
    const dx = Math.abs(Math.floor(a[0]) - Math.floor(b[0]));
    const dy = Math.abs(Math.floor(a[1]) - Math.floor(b[1]));
    return dx <= 1 && dy <= 1 && (dx !== 0 || dy !== 0);
}

/**
 * Active player gunfire should use only direct (body) LoS, not camera-augmented visibility.
 * @param {Character} actor
 * @param {Character} target
 * @param {MissionMap} map
 * @returns {boolean}
 */
function hasDirectGunLoS(actor, target, map) {
    if (actor instanceof PlayerCharacter && actor.activeCharacter) {
        return map.canActivePlayerDirectlySee(target.gpos);
    }
    return actor.canSee(target, map);
}

/**
 * @param {MissionMap} map
 * @param {eskv.VecLike} from
 * @param {eskv.VecLike} to
 * @returns {boolean}
 */
function hasLineClear(map, from, to) {
    const fromPos = eskv.v2([Math.floor(from[0]), Math.floor(from[1])]);
    const toPos = eskv.v2([Math.floor(to[0]), Math.floor(to[1])]);
    if (fromPos.equals(toPos)) return true;
    const sightMap = map.metaTileMap.layer[MetaLayers.allowsSight];
    for (const rawPos of sightMap.iterInBetween(fromPos, toPos)) {
        const pos = eskv.v2(rawPos);
        if (!pos.equals(fromPos) && map.isSmokeAt(pos)) return false;
        if (sightMap.get(pos) === 0) return false;
    }
    return true;
}

/**
 * @param {Character} actor
 * @param {MissionMap} map
 * @param {eskv.VecLike} pos
 * @returns {boolean}
 */
function canSelectSuppressionAnchor(actor, map, pos) {
    if (actor instanceof PlayerCharacter && actor.activeCharacter) {
        return map.canActivePlayerDirectlySee(pos);
    }
    return hasLineClear(map, actor.gpos, pos);
}

export class Rifle extends ActionItem {
    keyControl = 'f';
    constructor() {
        super();
        this.label.text = 'Fire';
        this.sprite.frames = [736];
        this.ammo = 200;
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        if(response.targetCharacter instanceof Character && response.targetCharacter!==actor) {
            if (!hasDirectGunLoS(actor, response.targetCharacter, map)) {
                return { result: 'invalid', message: 'No direct line of fire to target' };
            }
            if(this.fire(actor, map, response.targetCharacter)) {
                return {result:'complete', message:'Target neutralized'};
            }
            return {result:'complete', message:'Target missed'};
        }
        if(this.ammo>0) {
            const charsInRange = [];
            for(let c of map.characters) {
                if(c!==actor && hasDirectGunLoS(actor, c, map)) charsInRange.push(c);
            }
            if(charsInRange.length>0) {
                return {message:'Select target', result:'infoNeeded', validTargetCharacters:charsInRange};
            }
            return {message:'No visible target', result:'notAvailable'};
        }
        return {message:'Out of ammo', result:'notAvailable'};
    }
    /**
     * @param {Character} actor
     * @param {Character} target
     * @param {MissionMap} map
     * @returns {boolean}
     */
    isGuaranteedKillShot(actor, target, map) {
        const dist = actor.gpos.dist(target.gpos);
        const coverAtTarget = map.metaTileMap.layer[MetaLayers.cover].get(target.gpos) > 0;
        return dist <= 7 && !coverAtTarget && hasDirectGunLoS(actor, target, map);
    }
    /**
     * @param {Character} actor
     * @param {Character} target
     * @param {MissionMap} map
     * @returns {number}
     */
    sampleDeterministicRoll(actor, target, map) {
        const text = `${map.runtimeRandomSeed}|${actor.id}|${target.id}|${actor.gpos[0]},${actor.gpos[1]}|${target.gpos[0]},${target.gpos[1]}|${target.health}`;
        let hash = 2166136261 >>> 0;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619) >>> 0;
        }
        return (hash % 10000) / 10000;
    }
    /**
     * @param {number} chance
     * @returns {number}
     */
    clampChance(chance) {
        return Math.max(0.05, Math.min(1, chance));
    }
    /**
     * @param {Character} actor
     * @returns {number}
     */
    getAimMultiplier(actor) {
        return typeof actor.aimMultiplier === 'number' && actor.aimMultiplier > 0 ? actor.aimMultiplier : 1;
    }
    /**
     * @param {Character} actor
     * @param {Character} target
     * @param {MissionMap} map
     * @returns {number}
     */
    getBaseHitChance(actor, target, map) {
        const dist = actor.gpos.dist(target.gpos);
        const coverAtTarget = map.metaTileMap.layer[MetaLayers.cover].get(target.gpos) > 0;
        const distancePenalty = Math.max(0, dist - 10) * 0.04;
        const closeBonus = dist <= 5 ? 0.08 : 0;
        const coverPenalty = coverAtTarget ? 0.28 : 0;
        const suppressionPenalty = actor.suppressed ? 0.18 : 0;
        const armorEvasionPenalty = target.armorRating >= 0.7 ? 0.07 : 0;
        const trainedEvasionPenalty = target.trainingLevel >= 1 ? 0.05 : 0;
        const untrainedBonus = target.trainingLevel <= 0 ? 0.03 : 0;
        return 0.8 + closeBonus + untrainedBonus
            - distancePenalty - coverPenalty - suppressionPenalty - armorEvasionPenalty - trainedEvasionPenalty;
    }
    /**
     * @param {Character} actor
     * @param {Character} target
     * @param {MissionMap} map
     * @returns {number}
     */
    getHitChance(actor, target, map) {
        if (this.isGuaranteedKillShot(actor, target, map)) return 1;
        const base = this.getBaseHitChance(actor, target, map);
        return this.clampChance(base * this.getAimMultiplier(actor));
    }
    /**
     * @param {Character} actor
     * @param {Character} target
     * @param {MissionMap} map
     * @returns {number}
     */
    getUiHitChance(actor, target, map) {
        return this.getHitChance(actor, target, map);
    }
    /**
     * @param {Character} actor
     * @param {MissionMap} map
     * @param {Character} target
     * @returns {boolean}
     */
    fire(actor, map, target) {
        if (this.ammo <= 0) return false;
        this.ammo -= 1;
        target.applySuppression(1.2);
        map.emitGunfire(actor.gpos, actor.id, false, 1);
        const hitChance = this.getHitChance(actor, target, map);
        const guaranteedKill = this.isGuaranteedKillShot(actor, target, map);
        const hit = guaranteedKill || this.sampleDeterministicRoll(actor, target, map) < hitChance;
        if(hit) {
            const dist = actor.gpos.dist(target.gpos);
            let damage = dist <= 8 ? 4 : 3;
            if (guaranteedKill) damage = 20;
            target.takeDamage('piercing', damage);
        }
        map.emitAttack(actor.gpos, target.gpos, hit, actor.id, target.id, 2);
        return hit;
    }
    /**
     * @param {Character} actor
     * @param {MissionMap} map
     * @param {eskv.Vec2} targetPosition
     * @returns {number}
     */
    suppressArea(actor, map, targetPosition) {
        if (this.ammo < 6) return -1;
        this.ammo -= 6;
        map.emitGunfire(actor.gpos, actor.id, false, 1);
        const anchor = eskv.v2([targetPosition[0], targetPosition[1]]);
        const aim = anchor.sub(actor.gpos);
        const aimDist = aim.dist([0, 0]);
        if (aimDist <= 0.001) return 0;
        const dir = aim.scale(1 / aimDist);
        const maxRange = Math.max(6, Math.min(14, aimDist + 3));
        let suppressedCount = 0;
        for (const candidate of map.characters) {
            if (candidate === actor || candidate.state === 'dead') continue;
            const rel = candidate.gpos.sub(actor.gpos);
            const forward = rel[0] * dir[0] + rel[1] * dir[1];
            if (forward < 0.5 || forward > maxRange) continue;
            const lateral = Math.abs(rel[0] * dir[1] - rel[1] * dir[0]);
            const width = 1.05 + forward * 0.18;
            if (lateral > width) continue;
            if (!hasLineClear(map, actor.gpos, candidate.gpos)) continue;
            const pressure = Math.max(1.2, 2.9 - forward * 0.18 - lateral * 0.35);
            candidate.applySuppression(pressure);
            suppressedCount++;
        }
        return suppressedCount;
    }
}

export class SuppressAction extends ActionItem {
    keyControl = 'c';
    constructor() {
        super();
        this.label.text = 'Suppress';
        this.sprite.frames = [736];
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        const rifle = getActorRifle(actor);
        if (!(rifle instanceof Rifle)) {
            return { result: 'notAvailable', message: 'Suppress requires a rifle' };
        }
        if (rifle.ammo < 6) {
            return { result: 'notAvailable', message: 'Not enough ammo for suppressive fire' };
        }
        const ordered = response.mode === 'ordered';
        if (response.targetCharacter instanceof Character && response.targetCharacter !== actor) {
            response.targetPosition = response.targetCharacter.gpos.add([0, 0]);
        }
        if (response.targetPosition) {
            if (!ordered && !canSelectSuppressionAnchor(actor, map, response.targetPosition)) {
                return { result: 'invalid', message: 'No direct line of fire to suppression point' };
            }
            const count = rifle.suppressArea(actor, map, response.targetPosition);
            if (count < 0) {
                return { result: 'notAvailable', message: 'Not enough ammo for suppressive fire' };
            }
            return { result: 'complete', message: `Suppressive fire affected ${count} target(s)` };
        }
        /** @type {eskv.Vec2[]} */
        const validTargetPositions = [];
        const layout = map.metaTileMap.layer[MetaLayers.layout];
        for (const rawPos of layout.iterAll()) {
            const pos = eskv.v2(rawPos);
            const traversible = map.metaTileMap.getFromLayer(MetaLayers.traversible, pos);
            if (typeof traversible !== 'number' || traversible <= 0) continue;
            if (actor.gpos.dist(pos) > 11.5) continue;
            if (!canSelectSuppressionAnchor(actor, map, pos)) continue;
            validTargetPositions.push(pos.add([0, 0]));
        }
        if (validTargetPositions.length === 0) {
            return { result: 'notAvailable', message: 'No visible suppression anchor' };
        }
        validTargetPositions.sort((a, b) => a.dist(actor.gpos) - b.dist(actor.gpos));
        return { result: 'infoNeeded', message: 'Select suppression anchor', validTargetPositions };
    }
}

export class AimAction extends ActionItem {
    keyControl = 'q';
    constructor() {
        super();
        this.label.text = 'Aim';
        this.sprite.frames = [736];
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        actor.aimMultiplier = 2;
        return { result: 'complete', message: 'Aim steadied: hit chance doubled until you move.' };
    }
}

export class DoorAction extends ActionItem {
    keyControl = 'h';
    constructor() {
        super();
        this.label.text = 'Door';
        this.sprite.frames = [39];
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        if (response.targetPosition) {
            const door = findDoorAt(map, response.targetPosition);
            if (!(door instanceof DoorWidget)) return { result: 'invalid', message: 'No door at selected position' };
            if (!isAdjacent8(actor.gpos, door.pos)) return { result: 'invalid', message: 'Door action requires adjacent door' };
            if (door.state !== 'open' && door.state !== 'closed') return { result: 'invalid', message: 'Door cannot be toggled now' };
            const toggled = door.interact(map, actor);
            if (!toggled) return { result: 'invalid', message: 'Door action unavailable' };
            return { result: 'complete', message: door.state === 'open' ? 'Door opened' : 'Door closed' };
        }
        const validTargetPositions = [];
        for (const entity of map.entities.children) {
            if (!(entity instanceof DoorWidget)) continue;
            if (entity.state !== 'open' && entity.state !== 'closed') continue;
            if (isAdjacent8(actor.gpos, entity.pos)) {
                validTargetPositions.push(entity.pos.add([0, 0]));
            }
        }
        if (validTargetPositions.length === 0) {
            return { result: 'notAvailable', message: 'No adjacent door to toggle' };
        }
        return { result: 'infoNeeded', message: 'Select adjacent door', validTargetPositions };
    }
}

export class LockpickAction extends ActionItem {
    keyControl = 'j';
    constructor() {
        super();
        this.label.text = 'Lockpick';
        this.sprite.frames = [39];
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        if (response.targetPosition) {
            const door = findDoorAt(map, response.targetPosition);
            if (!(door instanceof DoorWidget)) return { result: 'invalid', message: 'No door at selected position' };
            if (!isAdjacent8(actor.gpos, door.pos)) return { result: 'invalid', message: 'Lockpick requires adjacent door' };
            if (door.state !== 'closed') return { result: 'invalid', message: 'Lockpick requires a closed door' };
            door.lockState = 'unlocked';
            door.interact(map, actor);
            return { result: 'complete', message: 'Door lockpicked and opened' };
        }
        const validTargetPositions = [];
        for (const entity of map.entities.children) {
            if (!(entity instanceof DoorWidget)) continue;
            if (entity.state !== 'closed') continue;
            if (isAdjacent8(actor.gpos, entity.pos)) {
                validTargetPositions.push(entity.pos.add([0, 0]));
            }
        }
        if (validTargetPositions.length === 0) {
            return { result: 'notAvailable', message: 'No adjacent closed door to lockpick' };
        }
        return { result: 'infoNeeded', message: 'Select adjacent door to lockpick', validTargetPositions };
    }
}

export class FiberCameraAction extends ActionItem {
    keyControl = 'k';
    constructor() {
        super();
        this.label.text = 'Fiber Cam';
        this.sprite.frames = [736];
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        if (response.targetPosition) {
            const door = findDoorAt(map, response.targetPosition);
            if (!(door instanceof DoorWidget)) return { result: 'invalid', message: 'No door at selected position' };
            if (!isAdjacent8(actor.gpos, door.pos)) return { result: 'invalid', message: 'Fiber cam requires adjacent door' };
            const camera = map.deployFiberCamera(actor.id, actor.gpos, door.pos.add([0, 0]));
            if (!camera) return { result: 'invalid', message: 'Could not place camera from this side' };
            return { result: 'complete', message: `Fiber cam active at ${camera.doorPos[0]},${camera.doorPos[1]}` };
        }
        const validTargetPositions = [];
        for (const entity of map.entities.children) {
            if (!(entity instanceof DoorWidget)) continue;
            if (isAdjacent8(actor.gpos, entity.pos)) {
                validTargetPositions.push(entity.pos.add([0, 0]));
            }
        }
        if (validTargetPositions.length === 0) {
            return { result: 'notAvailable', message: 'No adjacent door for fiber camera' };
        }
        return { result: 'infoNeeded', message: 'Select adjacent door for fiber camera', validTargetPositions };
    }
}

export class BreachBombAction extends ActionItem {
    keyControl = 'b';
    constructor() {
        super();
        this.label.text = 'Bomb';
        this.sprite.frames = [736];
    }
    /**
     * @param {number} tile
     * @returns {boolean}
     */
    isBreachableTile(tile) {
        return tile === LayoutTiles.wall
            || tile === LayoutTiles.doorway
            || tile === LayoutTiles.window
            || tile === LayoutTiles.coveredWindow
            || tile === LayoutTiles.brokenWindow;
    }
    /**
     * @param {Character} actor
     * @param {MissionMap} map
     * @param {eskv.Vec2} position
     * @returns {boolean}
     */
    detonate(actor, map, position) {
        let modified = false;
        const door = findDoorAt(map, position);
        if (door && door.state !== 'destroyed') {
            door.state = 'destroyed';
            map.updateTileInfo(door.pos);
            modified = true;
        }
        const layoutLayer = map.metaTileMap.layer[MetaLayers.layout];
        const tile = layoutLayer.get(position);
        if (this.isBreachableTile(tile)) {
            layoutLayer.set(position, LayoutTiles.floor);
            map.updateTileInfo(position);
            modified = true;
        }
        if (!modified) return false;
        map.emitSound(position, Math.max(map.w, map.h), `${actor.id}:breach`, 3);
        for (const candidate of map.characters) {
            if (candidate.state === 'dead') continue;
            const dist = candidate.gpos.dist(position);
            if (dist <= 2.2) candidate.applySuppression(2.8);
            if (candidate !== actor && dist <= 1.6) {
                candidate.takeDamage('piercing', 2);
            }
        }
        return true;
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        const ordered = response.mode === 'ordered';
        if (response.targetPosition) {
            const pos = eskv.v2([response.targetPosition[0], response.targetPosition[1]]);
            if (!ordered && actor.gpos.dist(pos) > 4.1) {
                return { result: 'invalid', message: 'Bomb target out of range' };
            }
            const layoutLayer = map.metaTileMap.layer[MetaLayers.layout];
            const tile = layoutLayer.get(pos);
            if (tile === LayoutTiles.wall) {
                const armed = map.armTimedBreachCharge(pos, actor.id, 2);
                if (!armed) return { result: 'invalid', message: 'Unable to arm timed charge' };
                return { result: 'complete', message: 'Timed wall charge armed (detonates in 2 turns)' };
            }
            const ok = this.detonate(actor, map, pos);
            if (!ok) return { result: 'invalid', message: 'Bomb requires wall/door/window target' };
            return { result: 'complete', message: 'Breach bomb detonated' };
        }
        const validTargetPositions = [];
        const layoutLayer = map.metaTileMap.layer[MetaLayers.layout];
        for (const rawPos of layoutLayer.iterAll()) {
            const pos = eskv.v2(rawPos);
            if (actor.gpos.dist(pos) > 4.1) continue;
            const tile = layoutLayer.get(pos);
            if (this.isBreachableTile(tile) || findDoorAt(map, pos)) {
                validTargetPositions.push(pos.add([0, 0]));
            }
        }
        if (validTargetPositions.length === 0) {
            return { result: 'notAvailable', message: 'No valid bomb target in range' };
        }
        return { result: 'infoNeeded', message: 'Select breach target', validTargetPositions };
    }
}

export class FragGrenadeAction extends ActionItem {
    keyControl = 'n';
    ammo = 3;
    constructor() {
        super();
        this.label.text = 'Frag';
        this.sprite.frames = [736];
    }
    /**
     * @param {eskv.VecLike} pos
     * @param {MissionMap} map
     * @returns {boolean}
     */
    isThrowableFloor(pos, map) {
        const tile = map.metaTileMap.layer[MetaLayers.layout].get(pos);
        return tile === LayoutTiles.floor || tile === LayoutTiles.hallway;
    }
    /**
     * @param {Character} actor
     * @param {MissionMap} map
     * @param {eskv.Vec2} targetPosition
     * @returns {{affected:number, casualties:number}}
     */
    detonate(actor, map, targetPosition) {
        map.emitSound(targetPosition, Math.max(map.w, map.h), `${actor.id}:frag`, 2);
        let affected = 0;
        let casualties = 0;
        for (const candidate of map.characters) {
            if (candidate.state === 'dead') continue;
            const dist = candidate.gpos.dist(targetPosition);
            if (dist > 3.05) continue;
            if (!hasLineClear(map, targetPosition, candidate.gpos)) continue;
            affected++;
            const preCasualty = candidate.state === 'unconscious' || candidate.state === 'surrendering';
            const damage = dist <= 1.2 ? 4 : dist <= 2.1 ? 3 : 2;
            candidate.applySuppression(Math.max(1.2, 3.1 - dist * 0.55));
            candidate.takeDamage('piercing', damage);
            map.emitAttack(targetPosition, candidate.gpos, true, `${actor.id}:frag`, candidate.id, 1);
            const postCasualty = candidate.state === 'unconscious' || candidate.state === 'surrendering';
            if (!preCasualty && postCasualty) casualties++;
        }
        return { affected, casualties };
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        if (this.ammo <= 0) return { result: 'notAvailable', message: 'No frag grenades remaining' };
        const ordered = response.mode === 'ordered';
        if (response.targetPosition) {
            const pos = eskv.v2([response.targetPosition[0], response.targetPosition[1]]);
            if (!this.isThrowableFloor(pos, map)) return { result: 'invalid', message: 'Frag requires floor target' };
            if (!ordered && actor.gpos.dist(pos) > 8.1) return { result: 'invalid', message: 'Frag target out of range' };
            if (!ordered && !canSelectSuppressionAnchor(actor, map, pos)) return { result: 'invalid', message: 'No line of sight to frag target' };
            this.ammo--;
            const outcome = this.detonate(actor, map, pos);
            return {
                result: 'complete',
                message: `Frag detonated: ${outcome.affected} affected, ${outcome.casualties} casualties.`,
            };
        }
        /** @type {eskv.Vec2[]} */
        const validTargetPositions = [];
        const layout = map.metaTileMap.layer[MetaLayers.layout];
        for (const rawPos of layout.iterAll()) {
            const pos = eskv.v2(rawPos);
            if (!this.isThrowableFloor(pos, map)) continue;
            if (actor.gpos.dist(pos) > 8.1) continue;
            if (!canSelectSuppressionAnchor(actor, map, pos)) continue;
            validTargetPositions.push(pos.add([0, 0]));
        }
        if (validTargetPositions.length === 0) {
            return { result: 'notAvailable', message: 'No visible floor target for frag grenade' };
        }
        validTargetPositions.sort((a, b) => a.dist(actor.gpos) - b.dist(actor.gpos));
        return { result: 'infoNeeded', message: 'Select frag target', validTargetPositions };
    }
}

export class SmokeGrenadeAction extends ActionItem {
    keyControl = 'm';
    ammo = 3;
    constructor() {
        super();
        this.label.text = 'Smoke';
        this.sprite.frames = [736];
    }
    /**
     * @param {eskv.VecLike} pos
     * @param {MissionMap} map
     * @returns {boolean}
     */
    isThrowableFloor(pos, map) {
        const tile = map.metaTileMap.layer[MetaLayers.layout].get(pos);
        return tile === LayoutTiles.floor || tile === LayoutTiles.hallway;
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        if (this.ammo <= 0) return { result: 'notAvailable', message: 'No smoke grenades remaining' };
        const ordered = response.mode === 'ordered';
        if (response.targetPosition) {
            const pos = eskv.v2([response.targetPosition[0], response.targetPosition[1]]);
            if (!this.isThrowableFloor(pos, map)) return { result: 'invalid', message: 'Smoke requires floor target' };
            if (!ordered && actor.gpos.dist(pos) > 8.1) return { result: 'invalid', message: 'Smoke target out of range' };
            if (!ordered && !canSelectSuppressionAnchor(actor, map, pos)) return { result: 'invalid', message: 'No line of sight to smoke target' };
            this.ammo--;
            map.emitSmoke(pos, 5, actor.id, 4);
            map.emitSound(pos, 9, `${actor.id}:smoke`, 1);
            return { result: 'complete', message: 'Smoke grenade deployed (5m cloud, spreading)' };
        }
        /** @type {eskv.Vec2[]} */
        const validTargetPositions = [];
        const layout = map.metaTileMap.layer[MetaLayers.layout];
        for (const rawPos of layout.iterAll()) {
            const pos = eskv.v2(rawPos);
            if (!this.isThrowableFloor(pos, map)) continue;
            if (actor.gpos.dist(pos) > 8.1) continue;
            if (!canSelectSuppressionAnchor(actor, map, pos)) continue;
            validTargetPositions.push(pos.add([0, 0]));
        }
        if (validTargetPositions.length === 0) {
            return { result: 'notAvailable', message: 'No visible floor target for smoke grenade' };
        }
        validTargetPositions.sort((a, b) => a.dist(actor.gpos) - b.dist(actor.gpos));
        return { result: 'infoNeeded', message: 'Select smoke target', validTargetPositions };
    }
}

export class CutterAction extends ActionItem {
    keyControl = 'u';
    constructor() {
        super();
        this.label.text = 'Cutter';
        this.sprite.frames = [736];
    }
    /**
     * @param {number} tile
     * @returns {boolean}
     */
    isCuttableWindow(tile) {
        return tile === LayoutTiles.window || tile === LayoutTiles.coveredWindow;
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        const layoutLayer = map.metaTileMap.layer[MetaLayers.layout];
        if (response.targetPosition) {
            if (!isAdjacent8(actor.gpos, response.targetPosition)) {
                return { result: 'invalid', message: 'Cutter requires adjacent window' };
            }
            const tile = layoutLayer.get(response.targetPosition);
            if (!this.isCuttableWindow(tile)) {
                return { result: 'invalid', message: 'Selected target is not a cuttable window' };
            }
            layoutLayer.set(response.targetPosition, LayoutTiles.brokenWindow);
            map.updateTileInfo(response.targetPosition);
            return { result: 'complete', message: 'Window silently cut open (visible tampering)' };
        }
        const validTargetPositions = [];
        for (const rawPos of layoutLayer.iterAll()) {
            const pos = eskv.v2(rawPos);
            if (!isAdjacent8(actor.gpos, pos)) continue;
            if (this.isCuttableWindow(layoutLayer.get(pos))) {
                validTargetPositions.push(pos.add([0, 0]));
            }
        }
        if (validTargetPositions.length === 0) {
            return { result: 'notAvailable', message: 'No adjacent window to cut' };
        }
        return { result: 'infoNeeded', message: 'Select adjacent window to cut', validTargetPositions };
    }
}

export class ArrestAction extends ActionItem {
    keyControl = 'g';
    constructor() {
        super();
        this.label.text = 'Arrest';
        this.sprite.frames = [867];
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        if (response.targetCharacter instanceof Character && response.targetCharacter !== actor) {
            if (!isAdjacent8(actor.gpos, response.targetCharacter.gpos)) {
                return { result: 'invalid', message: 'Arrest requires adjacent target' };
            }
            response.targetCharacter.state = 'surrendering';
            return { result: 'complete', message: `${response.targetCharacter.id} arrested` };
        }
        const adjacentTargets = [];
        for (const candidate of map.enemies) {
            if (candidate.state === 'dead') continue;
            if (isAdjacent8(candidate.gpos, actor.gpos)) {
                adjacentTargets.push(candidate);
            }
        }
        if (adjacentTargets.length === 0) {
            return { result: 'notAvailable', message: 'Move adjacent to arrest target' };
        }
        return { result: 'infoNeeded', message: 'Select arrest target', validTargetCharacters: adjacentTargets };
    }
}

export class Strafe extends ActionItem {

}

export class StealthTakedownAction extends ActionItem {
    keyControl = 't';
    constructor() {
        super();
        this.label.text = 'Takedown';
        this.sprite.frames = [867];
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        if (response.targetCharacter instanceof Character && response.targetCharacter !== actor) {
            if (!isAdjacent8(response.targetCharacter.gpos, actor.gpos)) {
                return { result: 'invalid', message: 'Takedown requires adjacent target' };
            }
            const spotted = map.enemies.some((enemy) => {
                if (enemy === response.targetCharacter || enemy.state === 'dead') return false;
                return enemy.canSee(actor, map);
            });
            if (spotted) {
                return { result: 'invalid', message: 'Too exposed for a stealth takedown' };
            }
            response.targetCharacter.state = 'unconscious';
            return { result: 'complete', message: `${response.targetCharacter.id} taken down (arrest still required)` };
        }
        const adjacentTargets = [];
        for (const candidate of map.enemies) {
            if (candidate.state === 'dead') continue;
            if (isAdjacent8(candidate.gpos, actor.gpos)) {
                adjacentTargets.push(candidate);
            }
        }
        if (adjacentTargets.length === 0) {
            return { result: 'notAvailable', message: 'Move adjacent to attempt stealth takedown' };
        }
        return { result: 'infoNeeded', message: 'Select takedown target', validTargetCharacters: adjacentTargets };
    }
}

export class DecoyAction extends ActionItem {
    keyControl = 'x';
    constructor() {
        super();
        this.label.text = 'Decoy';
        this.sprite.frames = [736];
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        if (response.targetPosition) {
            map.emitDecoy(response.targetPosition, 9, actor.id, 3);
            return { result: 'complete', message: `Decoy deployed at ${response.targetPosition}` };
        }
        /** @type {eskv.Vec2[]} */
        const validTargetPositions = [];
        const layout = map.metaTileMap.layer[MetaLayers.layout];
        for (const rawPos of layout.iterAll()) {
            const pos = eskv.v2(rawPos);
            const tile = layout.get(pos);
            if (tile !== LayoutTiles.floor && tile !== LayoutTiles.hallway) continue;
            if (pos.dist(actor.gpos) <= 6) {
                validTargetPositions.push(pos.add([0, 0]));
            }
        }
        if (validTargetPositions.length === 0) {
            return { result: 'notAvailable', message: 'No valid decoy position in range' };
        }
        return { result: 'infoNeeded', message: 'Select decoy position', validTargetPositions };
    }
}

export class Crawl extends ActionItem {

}

export class Pistol extends ActionItem {

}

export class Grenade extends ActionItem {

}

export class Halligan extends ActionItem {
    // Could just be a bump action
}

export class Explosive extends ActionItem {

}

export class BreachPromise extends ActionItem {

}
