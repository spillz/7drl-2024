//@ts-check

import * as eskv from "../eskv/lib/eskv.js";
import {Rect, Vec2} from "../eskv/lib/eskv.js";
import {parse} from "../eskv/lib/modules/markup.js";
import { SpriteWidget } from "../eskv/lib/modules/sprites.js";
import { Character } from "./character.js";
import { MissionMap } from "./map.js";

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
        this.sprite = new SpriteWidget({spriteSheet:eskv.App.resources['sprites']});
        this.label = new eskv.Label({hints:{h:'1'}});
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
        //TODO: Run a line of sight from the target, then iterate through
        // misses on closer characters or obstacles may hit targets further back
        const char = target;
            const hit = this.mode==='single'?true:map.rng.random()>0.5;
            if(hit) {
                char.takeDamage('piercing');
                return true;
            }
            return false;
    }
}

export class Strafe extends ActionItem {

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