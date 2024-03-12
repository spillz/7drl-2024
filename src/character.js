//@ts-check

import * as eskv from "../eskv/lib/eskv.js";
import {vec2, Vec2, Grid2D} from "../eskv/lib/eskv.js";
import { Action, ActionData } from "./action.js";
import { Entity } from "./entity.js";
import { MissionMap, MetaLayers } from "./map.js";
import { Facing, FacingVec, binaryFacing, facingFromVec } from "./facing.js"
import { TileMap } from "../eskv/lib/modules/sprites.js";

const animations = {
    standing: []
}

/**
 * Returns a BFS distance field on a grid-based TileMap
 * for an input costGrid where the cost in the destination
 * cell in `costGrid` applies to all orthogonally adjacent cells.
 * @param {Grid2D} costGrid 
 * @param {Vec2} origin 
 * @returns 
 */
function costedBFS(costGrid, origin) {
    let distances = new TileMap({tileDim:costGrid.tileDim});
    distances.set(origin, 0);
    let candidates = [origin];
    while (candidates.length > 0) {
        let newCandidates = [];
        candidates.forEach((pos) => {
            for(let npos of costGrid.iterAdjacent(pos)) {
                let cost = costGrid.get(npos);
                if (distances.get(npos) + cost < distances.get(npos)) {
                    distances.set(npos, distances.get(pos) + cost);
                    newCandidates.push(npos);
                }
            }
        });
        candidates = newCandidates;
    }
    return distances;
}

/**@typedef {'Patrolling'|'Sleeping'|'Hunting'|'Hiding'|'Fleeing'} CharacterStates */

export class Character extends Entity {
    /**@type {Set<Action>} */
    actions = new Set();
    /**@type {Facing} */
    facing = Facing.north;
    /**@type {CharacterStates} */
    state = 'Patrolling';
    /**Grid location of the character on the map */
    gpos = vec2(0,0);
    /** @type {Action[]} */
    history = [];
    suppressed = false;
    /**@type {Set<eskv.Vec2>} */
    _coverPositions = new Set();
    _visibleLayer = new Grid2D();
    activeCharacter = true;
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
        if(this.activeCharacter) {
            this.updateLoS(mmap);
            this.updateCamera(mmap);
        }
    }
    /**
     * 
     * @param {string} actionId 
     * @param {string} mode 
     * @param {Vec2} position 
     */
    useAction(actionId, position, mode) {

    }
    /**
     * 
     * @param {MissionMap} map 
     */
    updateLoS(map) {
        const mmap = map.metaTileMap
        this._coverPositions.clear();
        this._visibleLayer.fill(0);
        mmap.activeLayer = MetaLayers.allowsSight;
        const cpos = this.gpos;//.add([0.5,0.5]);
        for(let pBounds of mmap.data.iterRectBoundary(new eskv.Rect([...this.gpos, 20, 20]).translate([-10,-10]).translate(FacingVec[this.facing].scale(9)))) {
            const dest = eskv.v2(pBounds);//.add([0.5, 0.5]);
            let prevPos = eskv.v2(this.gpos);
            let coversNext = false;
            for(let p of mmap.data.iterBetween(cpos, dest)) {
                let p0 = eskv.v2([Math.round(p[0]),Math.round(p[1])]);
                let p1 = eskv.v2(p0);
                const addx = p[0]-p0[0];
                if(addx>0) p1[0]+=1;
                else if(addx<0) p1[0]-=1;
                const addy = p[1]-p0[1];
                if(addy>0) p1[1]+=1;
                else if(addy<0) p1[1]-=1;
                let dir0 = FacingVec[facingFromVec(eskv.v2(p0).sub(prevPos))];
                let dir1 = FacingVec[facingFromVec(eskv.v2(p1).sub(prevPos))];
                const sight0 = mmap.get(p0);
                const sight1 = mmap.get(p1);
                let altSight = cpos.dist(p0)>cpos.dist(p1);
                let canContinue = false;
                if(cpos.dist(p0)===0) canContinue = true;
                else if(dir0[1]<0 && sight0&0b0001) canContinue = true; //N
                else if(dir0[0]>0 && sight0&0b0010) canContinue = true; //E
                else if(dir0[1]>0 && sight0&0b0100) canContinue = true; //S
                else if(dir0[0]<0 && sight0&0b1000) canContinue = true; //W
                if(!coversNext) {
                    this._visibleLayer[p0[0]+p0[1]*mmap.w] = 1;
                    mmap.setInLayer(MetaLayers.seen, p0, 1);
                    if(altSight) {
                        this._visibleLayer[p1[0]+p1[1]*mmap.w] = 1;
                        mmap.setInLayer(MetaLayers.seen, p1, 1);    
                    }
                } else {
                    this._coverPositions.add(p0);
                    if(altSight) this._coverPositions.add(p0);;
                }
                if(!canContinue) break
                coversNext = false;
                if(dir0[1]<0 && sight0&0b00010000) coversNext = true; //N
                else if(dir0[0]>0 && sight0&0b00100000) coversNext = true; //E
                else if(dir0[1]>0 && sight0&0b01000000) coversNext = true; //S
                else if(dir0[0]<0 && sight0&0b10000000) coversNext = true; //W
                else if(altSight && dir1[1]<0&& sight1&0b00010000) coversNext = true; //N
                else if(altSight && dir1[0]>0&& sight1&0b00100000) coversNext = true; //E
                else if(altSight && dir1[1]>0&& sight1&0b01000000) coversNext = true; //S
                else if(altSight && dir1[0]<0&& sight1&0b10000000) coversNext = true; //W
                prevPos = eskv.v2(p0)
            }
        }
    }
    /**
     * 
     * @param {MissionMap} mmap 
     */
    updateCamera(mmap) {
        const camera = /**@type {eskv.ScrollView}*/(eskv.App.get().findById('scroller'));
        if(camera) {
            const target = this.gpos.add(FacingVec[this.facing].scale(5));
            const dist = target.dist(this.gpos);
            //TODO: Put the camera a few spaces behind the player in the current facing
            const X = Math.min(Math.max(target[0]+0.5-camera.w/camera.zoom/2, 0), mmap.w);
            const Y = Math.min(Math.max(target[1]+0.5-camera.h/camera.zoom/2, 0), mmap.h);
            const anim = new eskv.WidgetAnimation();
            anim.add({ scrollX: X, scrollY: Y}, 250*dist/2 );
            anim.start(camera);
        }
    }
    /**
     * 
     * @param {MissionMap} map 
     */
    setupForLevelStart(map) {
        this._coverPositions = new Set(); // set of positions that have cover from the current location
        this._visibleLayer = new Grid2D([map.w, map.h]).fill(0);
    }
    /**
     * 
     * @param {Action} action 
     * @param {MissionMap} mmap 
     */
    takeAction(action, mmap) {
        this.history.push(action);
    }
    /**@type {eskv.sprites.SpriteWidget['draw']} */
    draw(app, ctx) {
        super.draw(app, ctx);
    }

}




export class PlayerCharacter extends Character {
    constructor(props={}) {
        super();
        this.spriteSheet = eskv.App.resources['sprites'];
        this.frames = [292];
        if(props) this.updateProperties(props);
    }
    /**
     * 
     * @param {MissionMap} map 
     */
    setupForLevelStart(map) {
        this._coverPositions = new Set(); // set of positions that have cover from the current location
        if(this.activeCharacter) {
            this._visibleLayer = map.metaTileMap._layerData[MetaLayers.visible];
            this._visibleLayer.fill(0);
        } else {
            this._visibleLayer = new Grid2D([map.w, map.h]).fill(0);
        }
    }
    /**
     * 
     * @param {Action} action 
     * @param {MissionMap} mmap 
     */
    takeAction(action, mmap) {
        this.history.push(action);
    }
}