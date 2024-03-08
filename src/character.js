//@ts-check

import * as eskv from "../eskv/lib/eskv.js";
import {vec2, Vec2} from "../eskv/lib/eskv.js";
import { parse } from "../eskv/lib/modules/markup.js";
import { SpriteWidget } from "../eskv/lib/modules/sprites.js";
import { Action } from "./action.js";
import { Entity } from "./entity.js";
import { MissionMap, MetaLayers } from "./map.js";
import { Facing, FacingVec, binaryFacing } from "./facing.js"

const animations = {
    standing: []
}

export class Character extends Entity {
    /**@type {Action[]} */
    actions = [];
    /**@type {Facing} */
    facing = Facing.north;
    gpos = vec2(0,0);
    constructor(props={}) {
        super();
        this.spriteSheet = eskv.App.resources['sprites'];
        this.frames = [292];
        if(props) this.updateProperties(props);
    }
    /**
     * 
     * @param {Facing} dir 
     * @param {MissionMap} mmap
     */
    move(dir, mmap) {
        const npos = this.gpos.add(FacingVec[dir]);
        const tmap = mmap.metaTileMap;
        const traverse = tmap.getFromLayer(MetaLayers.traversible, npos)
        this.facing = dir;
        if(traverse&binaryFacing[dir]) {
            this.gpos = npos;
            const anim = new eskv.WidgetAnimation();
            anim.add({ x: this.gpos[0], y: this.gpos[1]}, 250 );
            anim.start(this);
        }
        const camera = /**@type {eskv.ScrollView}*/(eskv.App.get().findById('scroller'));
        if(camera) {
            //TODO: Put the camera a few spaces behind the player in the current facing
            const X = Math.max(this.gpos[0]+0.5-camera.w/camera.zoom/2,0)
            const Y = Math.max(this.gpos[1]+0.5-camera.h/camera.zoom/2,0)
            const anim = new eskv.WidgetAnimation();
            anim.add({ scrollX: X, scrollY: Y}, 250 );
            anim.start(camera);
        }
    }
}