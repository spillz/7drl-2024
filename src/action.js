//@ts-check

import * as eskv from "eskv/lib/eskv.js";
import {Rect, Vec2} from "eskv/lib/eskv.js";
import {parse} from "eskv/lib/modules/markup.js";
import { SpriteWidget } from "eskv/lib/modules/sprites.js";
import { Character } from "./character.js";
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
 * ActionItem represents an inventory item of a character
 * The request method provies the interface to use the item. It will
 * respond to the caller with an ActionResponseData object, which may
 * include a request for more info, which the caller will fill out
 * and call request again.
 * The widget data relates to the inventory slot occupied by the action.
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
     * To perform an action as the player, first it must be requested to provide
     * the UI with information that maybe needed (e.g., what the target of the action
     * will be)
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

export class Rifle extends ActionItem {
    keyControl = 'f';
    constructor() {
        super();
        this.label.text = 'Rifle';
        this.sprite.frames = [736];
        this.ammo = 200;
        /**@type {'single'|'burst'|'suppress'} */
        this.mode = 'single'; //could prompt for mode after selecting target
    }
    /**@type {ActionItem['request']} */
    request(actor, map, response) {
        if (this.mode === 'suppress') {
            if (response.targetPosition) {
                const count = this.suppressArea(actor, map, response.targetPosition);
                return { result: 'complete', message: `Suppressive fire affected ${count} targets` };
            }
            /** @type {eskv.Vec2[]} */
            const validTargetPositions = [];
            for (const c of map.characters) {
                if (c !== actor && actor.canSee(c, map)) {
                    validTargetPositions.push(c.gpos);
                }
            }
            if (validTargetPositions.length === 0) {
                return { result: 'notAvailable', message: 'No visible area for suppressive fire' };
            }
            return { result: 'infoNeeded', message: 'Select suppressive fire area', validTargetPositions };
        }
        if(response.targetCharacter instanceof Character && response.targetCharacter!==actor) {
            if(this.fire(actor, map, response.targetCharacter)) {
                return {result:'complete', message:'Target hit'};
            }
            return {result:'complete', message:'Target missed'};
        }
        if(this.ammo>0) {
            const charsInRange = [];
            for(let c of map.characters) {
                if(c!==actor && actor.canSee(c, map)) charsInRange.push(c);
            }
            if(charsInRange.length>0) {
                return {message:"Select target", result:"infoNeeded", validTargetCharacters:charsInRange};
            } else {
                return {message:"No visible target", result:"notAvailable"};
            }
        } else {
            return {message:"Out of ammo", result:"notAvailable"};
        }
    }
    /**
     * 
     * @param {Character} actor 
     * @param {MissionMap} map
     * @param {Character} target 
     */
    fire(actor, map, target) {
        this.ammo -= this.mode==='single'?1:5;
        target.applySuppression(this.mode === 'burst' ? 1.5 : 1);
        map.emitGunfire(actor.gpos, actor.id, false, 1);
        const hitChance = this.getHitChance(actor, target, map);
        const hit = map.sampleRuntimeRandom(`player:${actor.id}:rifle:${this.mode}`) < hitChance;
        if(hit) {
            const dist = actor.gpos.dist(target.gpos);
            const unarmored = target.armorRating <= 0.01;
            let damage = this.mode === 'burst'
                ? (dist <= 6 ? 3 : 2)
                : (dist <= 10 ? 3 : 2);
            if (unarmored && dist <= 8) {
                damage += 1;
            }
            target.takeDamage('piercing', damage);
            return true;
        }
        return false;
    }
    /**
     * @param {Character} actor
     * @param {Character} target
     * @param {MissionMap} map
     */
    getHitChance(actor, target, map) {
        const dist = actor.gpos.dist(target.gpos);
        const coverAtTarget = map.metaTileMap.layer[MetaLayers.cover].get(target.gpos) > 0;
        const precisionMode = this.mode === 'single';
        const base = this.mode === 'burst' ? 0.9 : 0.96;
        const effectiveRange = precisionMode ? 22 : 10;
        const distancePenalty = Math.max(0, dist - effectiveRange) * (precisionMode ? 0.03 : 0.06);
        const closeBonus = dist <= 7 ? 0.03 : 0;
        const coverPenalty = coverAtTarget ? 0.34 : 0;
        const suppressionPenalty = actor.suppressed ? 0.16 : 0;
        const armorEvasionPenalty = target.armorRating >= 0.7 ? 0.08 : 0;
        const trainedEvasionPenalty = target.trainingLevel >= 1 ? 0.04 : 0;
        const untrainedBonus = target.trainingLevel <= 0 ? 0.04 : 0;
        const chance = base + closeBonus + untrainedBonus
            - distancePenalty - coverPenalty - suppressionPenalty - armorEvasionPenalty - trainedEvasionPenalty;
        return Math.max(0.08, Math.min(0.99, chance));
    }
    /**
     * @param {Character} actor
     * @param {MissionMap} map
     * @param {eskv.Vec2} targetPosition
     */
    suppressArea(actor, map, targetPosition) {
        this.ammo -= 8;
        map.emitGunfire(actor.gpos, actor.id, false, 1);
        let suppressedCount = 0;
        for (const candidate of map.characters) {
            if (candidate === actor || candidate.state === 'dead') continue;
            if (candidate.gpos.dist(targetPosition) <= 4) {
                candidate.applySuppression(2.5);
                suppressedCount++;
            }
        }
        return suppressedCount;
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
            response.targetCharacter.state = 'surrendering';
            return { result: 'complete', message: `${response.targetCharacter.id} arrested` };
        }
        const adjacentTargets = [];
        for (const candidate of map.enemies) {
            if (candidate.state === 'dead') continue;
            if (candidate.gpos.dist(actor.gpos) <= 1.1) {
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
        this.label.text = 'Stealth Takedown';
        this.sprite.frames = [867];
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        if (response.targetCharacter instanceof Character && response.targetCharacter !== actor) {
            if (response.targetCharacter.gpos.dist(actor.gpos) > 1.1) {
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
            if (candidate.gpos.dist(actor.gpos) <= 1.1) {
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
    keyControl = 'c';
    constructor() {
        super();
        this.label.text = 'Decoy';
        this.sprite.frames = [736];
    }
    /** @type {ActionItem['request']} */
    request(actor, map, response) {
        if (response.targetPosition) {
            map.emitDecoy(response.targetPosition, 8, actor.id, 2);
            return { result: 'complete', message: `Decoy deployed at ${response.targetPosition}` };
        }
        /** @type {eskv.Vec2[]} */
        const validTargetPositions = [];
        const layout = map.metaTileMap.layer[MetaLayers.layout];
        for (const pos of layout.iterAll()) {
            const tile = layout.get(pos);
            if (tile !== LayoutTiles.floor && tile !== LayoutTiles.hallway) continue;
            if (pos.dist(actor.gpos) <= 6) {
                validTargetPositions.push(pos);
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
    //Could just be a bump action
}

export class Explosive extends ActionItem {

}

export class BreachPromise extends ActionItem {

}
