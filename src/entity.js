//@ts-check

import * as eskv from "../eskv/lib/eskv.js";
import {Rect, Vec2} from "../eskv/lib/eskv.js";
import {parse} from "../eskv/lib/modules/markup.js";
import {LayeredAnimationFrame, SpriteWidget} from "../eskv/lib/modules/sprites.js";
import { Character, PlayerCharacter } from "./character.js";
import { MetaLayers, MissionMap } from "./map.js";


export class Entity extends SpriteWidget {
    visible = true;
    constructor(props={}) {
        super();
        if(props) this.updateProperties(props)
    }
    get traversible() {
        return 0b1111;
    }
    get allowsSight() {
        return 0b1111;
    }
    /**
     * 
     * @param {MissionMap} map 
     * @param {Character} character 
     */
    interact(map, character) {
        return false;
    }
}

/**@typedef {'open'|'closed'|'flattened'|'destroyed'} DoorStates*/
/**@typedef {'open'|'closed'|'flattened'|'destroyed'|'closing'|'opening'|'falling'|'exploding'} DoorAnimationStates*/
/**@typedef {'locked'|'unlocked'} LockState*/

export class DoorWidget extends Entity {
    /**@type {DoorStates} */
    state = 'open';
    /**@type {DoorAnimationStates} */
    animationState = 'open';
    /**@type {LockState} */
    lockState = 'unlocked';
    timePerFrame = 100;
    visible = false;
    oneShot = true;
    /**@type {{[id:string]: LayeredAnimationFrame[]|number[]}|null} */
    animationGroup = {
        'closed':[39],
        'open':[3111],
        'closing':[3111, 7],
        'opening':[39, 7],
        'flattened':[new LayeredAnimationFrame([40, 8],[[0,-0.5],[0,-1.5]])],
        'destroyed':[new LayeredAnimationFrame([9, 41],[[0,-0.5],[0,-1.5]])],
        'falling':[10],
        'exploding':[41],
    };
    constructor(props={}) {
        super();
        this.spriteSheet = eskv.App.resources['sprites'];
        if(props) this.updateProperties(props);
    }
    placeDoor(pos, facing) {
        this.pos = pos;
        this.facing = facing;
    }
    on_state(e,o,v) {
        switch(this.state) {
            case 'closed':
                this.animationState = 'closing';
            break;
            case 'open':
                this.animationState = 'opening';
            break;
            case 'destroyed':
                this.animationState = 'exploding';
            break;
            case 'flattened':
                this.animationState = 'falling';
            break;
        }
    }
    get traversible() {
        return this.state!=='closed'?0b1111:0;
    }
    get allowsSight() {
        return this.state!=='closed'?0b1111:0;
    }
    /**@type {Entity['interact']} */
    interact(map, character) {
        if(character instanceof PlayerCharacter && this.lockState==='locked' && this.state==='closed') return false;
        if(this.state==='closed') {
            this.state = 'open';
            map.metaTileMap.layer[MetaLayers.allowsSight].set(this.pos, this.allowsSight);
            map.metaTileMap.layer[MetaLayers.traversible].set(this.pos, this.traversible);
            return true;
        }
        if(this.state==='open') {
            this.state = 'closed';
            map.metaTileMap.layer[MetaLayers.allowsSight].set(this.pos, this.allowsSight);
            map.metaTileMap.layer[MetaLayers.traversible].set(this.pos, this.traversible);
            return true;
        }
        return false;
    }
    on_animationState(e,o,v) {
        if(this.animationGroup) {
            this.frames = this.animationGroup[this.animationState];
        }
    }
    on_animationComplete(e,o,v) {
        switch(this.animationState) {            
            case 'closing':
                this.animationState = 'closed';
            break;
            case 'opening':
                this.animationState = 'open';
            break;
            case 'exploding':
                this.animationState = 'destroyed';
            break;
            case 'falling':
                this.animationState = 'flattened';
            break;            
        }
    }
    draw(app, ctx) {
        if(this.visible) super.draw(app, ctx);
    }
}


export class Ability extends SpriteWidget {
    constructor(props={}) {
        super();
        if(props) this.updateProperties(props)
    }
}

export class RifleEntity extends Entity {
    constructor(props={}) {
        super();
        if(props) this.updateProperties(props)
    }
}

export class ShotEntity extends Entity {
    constructor(props={}) {
        super();
        if(props) this.updateProperties(props)
    }
}

export class PistolEntity extends Entity {
    constructor(props={}) {
        super();
        if(props) this.updateProperties(props)
    }
}

