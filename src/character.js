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
        this.w = 1;
        this.h = 1;
        if(props) this.updateProperties(props);
    }
    /**
     * 
     * @param {Facing} dir d
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
            const target = this.gpos.add(FacingVec[dir].scale(5));
            const dist = target.dist(this.gpos);
            //TODO: Put the camera a few spaces behind the player in the current facing
            const X = target[0]+0.5-camera.w/camera.zoom/2;
            const Y = target[1]+0.5-camera.h/camera.zoom/2;
            const anim = new eskv.WidgetAnimation();
            anim.add({ scrollX: X, scrollY: Y}, 250*dist/2 );
            anim.start(camera);
        }
    }
    /**@type {eskv.sprites.SpriteWidget['draw']} */
    draw(app, ctx) {
        super.draw(app, ctx);
    }
}