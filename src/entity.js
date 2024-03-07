//@ts-check

import * as eskv from "../eskv/lib/eskv.js";
import { parse } from "../eskv/lib/modules/markup.js";
import { SpriteWidget } from "../eskv/lib/modules/sprites.js";


export class Entity extends SpriteWidget {
    constructor(props={}) {
        super();
        if(props) this.updateProperties(props)
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

