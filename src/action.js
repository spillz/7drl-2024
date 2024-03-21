//@ts-check

import * as eskv from "../eskv/lib/eskv.js";
import {Rect, Vec2} from "../eskv/lib/eskv.js";
import {parse} from "../eskv/lib/modules/markup.js";
import { SpriteWidget } from "../eskv/lib/modules/sprites.js";
import { Character } from "./character.js";
import { MissionMap } from "./map.js";

export class ActionItem extends eskv.BoxLayout {
    /** @type {'vertical'|'horizontal'} */
    orientation = 'vertical';
    constructor(props={}) {
        super();
        this.hints = {h:'5'};
        this.sprite = new SpriteWidget({hints:{h:'4'}});
        this.label = new eskv.Label({hints:{h:'1'}});
        this.children = [
            this.sprite,
            this.label
        ]
        if(props) this.updateProperties(props);
    }
}

export class ActionData {
    name = '';
    target = eskv.vec2(0,0);
    time = -1;
    owner = '';
}

export class Rifle extends ActionItem {
    constructor() {
        super();
        this.label.text = 'Rifle';
        this.sprite.frames = [736];
        this.ammo = 2000;
        /**@type {'single'|'burst'|'suppress'} */
        this.mode = 'single'; //could prompt for mode after selecting target
        this.inputTrigger = 'F'; //This could be a named inputTriger action to allow for different control schemes/bindings
    }
    /**
     * Returns the keybindings/gamepad/mouse controls associated with an action
     * (The ActionItem itself is a SpriteWidget that can listen for clicks/touches)
     */
    registerControls() {

    }
    /**
     * To perform an action as the player, first it must be requested to provide
     * the UI with information that maybe needed (e.g., what the target of the action
     * will be)
     * @param {Character} actor 
     * @param {MissionMap} map 
     */
    request(actor, map) {
        if(this.ammo>0) {
            //TODO: the UI handling probably shouldn't be taking place in the action class
            return {message:"Select target", result:"needsTarget"};
        } else {
            return {message:"Out of ammo", result:"failure"};
        }
    }
    /**
     * 
     * @param {Character} actor 
     * @param {MissionMap} map
     */
    requestBestAction(actor, map) {

    }
    /**
     * 
     * @param {Character} actor 
     * @param {MissionMap} map
     * @param {Vec2} target 
     */
    act(actor, map, target) {
        this.ammo -= this.mode==='single'?1:5;
        //TODO: Run a line of sight from the target, then iterate through
        // misses on closer characters or obstacles may hit targets further back
        const char = map.getCharacterAt(target);
        if(char instanceof Character && actor.canSee(char, map)) {
            const hit = this.mode==='single'?true:map.rng.random()>0.5;
            char.takeDamage('piercing');
            //Send a signal (or add a particle) to render the shooting on the map
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