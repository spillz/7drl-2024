//@ts-check

import * as eskv from "../eskv/lib/eskv.js";
import {Rect, Vec2} from "../eskv/lib/eskv.js";
import {parse} from "../eskv/lib/modules/markup.js";
import { SpriteWidget } from "../eskv/lib/modules/sprites.js";

export class Action extends SpriteWidget {
    constructor(props={}) {
        super();
        if(props) this.updateProperties(props);
    }
}

export class ActionData {
    name = '';
    target = eskv.vec2(0,0);
    time = -1;
    owner = '';
}

export class Run extends Action {

}

export class Walk extends Action {

}

export class Crawl extends Action {

}

export class RifleSkill extends Action {

}

export class PistolSkill extends Action {

}

export class GrenadeSkill extends Action {
    
}
