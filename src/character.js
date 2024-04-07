//@ts-check

import * as eskv from "../eskv/lib/eskv.js";
import {vec2, Vec2, Grid2D} from "../eskv/lib/eskv.js";
import { ActionItem } from "./action.js";
import { Entity } from "./entity.js";
import { MissionMap, MetaLayers, LayoutTiles } from "./map.js";
import { Facing, FacingVec, binaryFacing, facingFromVec } from "./facing.js"
import { TileMap, laf, LayeredAnimationFrame } from "../eskv/lib/modules/sprites.js";

/**@typedef {'patrolling'|'sleeping'|'hunting'|'hiding'|'surrendering'|'fleeing'|'dead'|'unconscious'|'shocked'} CharacterStates */
/**@typedef {'standing'|'walking'|'dead'} AnimationStates */


const characterAnimations = {
    randy: {
        standing: [
            laf([326, 4388],  [[0,0], [0, -0.25]]),
        ],
        walking: [
            laf([323, 4387],   [[0,0], [0, -0.25]]),
            laf([324, 4387],   [[0,0], [0, -0.25]]),
            laf([4420,4388],  [[0,0], [0, -0.25]]),
            laf([4419,4389], [[0,0], [0, -0.25]]),
            laf([4420,4389], [[0,0], [0, -0.25]]),
            laf([324, 4388],   [[0,0], [0, -0.25]]),
        ],
        dead: [
            laf([321, 289/*, 321+32*/], [[0,1], [0, 0]])
        ],
    },
    maria: {
        standing: [
            laf([326+96, 4388+96],  [[0,0], [0, -0.25]]),
        ],
        walking: [
            laf([323+96,  4387+96],   [[0,0], [0, -0.25]]),
            laf([324+96,  4387+96],   [[0,0], [0, -0.25]]),
            laf([4420+96, 4388+96],  [[0,0], [0, -0.25]]),
            laf([4419+96, 4389+96], [[0,0], [0, -0.25]]),
            laf([4420+96, 4389+96],  [[0,0], [0, -0.25]]),
            laf([324+96,  4388+96],   [[0,0], [0, -0.25]]),
        ],
        dead: [
            laf([321+96, 289+96 /*, 321+96+32*/], [[0,1], [0, 0]])
        ],
    },
    greenShirt: {
        standing: [
            laf([326+288, 4388+288],  [[0,0], [0, -0.25]]),
        ],
        walking: [
            laf([323+288,  4387+288],   [[0,0], [0, -0.25]]),
            laf([324+288,  4387+288],   [[0,0], [0, -0.25]]),
            laf([4420+288, 4388+288],  [[0,0], [0, -0.25]]),
            laf([4419+288, 4389+288], [[0,0], [0, -0.25]]),
            laf([4420+288, 4389+288],  [[0,0], [0, -0.25]]),
            laf([324+288,  4388+288],   [[0,0], [0, -0.25]]),
        ],
        dead: [
            laf([321+288, 289+288, 321+288+32], [[0,1], [0, 0]])
        ],
    },
    whiteShirt: {
        standing: [
            laf([518, 484],  [[0,0], [0, -0.25]]),
        ],
        walking: [
            laf([515, 483],   [[0,0], [0, -0.25]]),
            laf([516, 483],   [[0,0], [0, -0.25]]),
            laf([4612, 484],  [[0,0], [0, -0.25]]),
            laf([4611, 4579], [[0,0], [0, -0.25]]),
            laf([4612, 4579],  [[0,0], [0, -0.25]]),
            laf([516, 484],   [[0,0], [0, -0.25]]),
        ],
        dead: [
            laf([513, 481, 513+32], [[0,1], [0, 0]])
        ],
    },

}



/**
 * Returns a BFS-style distance field on a grid-based TileMap
 * for an input costGrid where the cost in the destination
 * cell in `costGrid` applies to all orthogonally adjacent cells.
 * Note that each check of adjacent calls in the current canddiate
 * pool does not exclude already visited cells to allow for the
 * fact that high cost cells may have been visited at an earlier
 * step. This is probably slightly more efficient than maintaining
 * a priority queue in the Dijksta or A* methods.
 * @param {Grid2D} costGrid 
 * @param {Vec2} origin 
 * @returns 
 */
function costedBFS(costGrid, origin) {
    let distances = new Grid2D(costGrid.tileDim).fill(Infinity);
    distances.set(origin, 0);
    let candidates = [origin];
    while (candidates.length > 0) {
        let newCandidates = [];
        for(let pos of candidates) {
            for(let npos of costGrid.iterAdjacent(pos)) {
                let cost = costGrid.get(npos);
                if (distances.get(pos) + cost < distances.get(npos)) {
                    distances.set(npos, distances.get(pos) + cost);
                    newCandidates.push(npos);
                }
            }
        };
        candidates = newCandidates;
    }
    return distances;
}

/**
 * Returns a BFS-style distance field on a grid-based TileMap
 * for an input costGrid where the cost in the destination
 * cell in `costGrid` applies to all orthogonally adjacent cells.
 * Note that each check of adjacent calls in the current canddiate
 * pool does not exclude already visited cells to allow for the
 * fact that high cost cells may have been visited at an earlier
 * step. This is probably slightly more efficient than maintaining
 * a priority queue in the Dijksta or A* methods.
 * @param {Grid2D} costGrid 
 * @param {Vec2} origin 
 * @param {Vec2} dest 
 * @returns 
 */
function costedBFSPath(costGrid, origin, dest) {
    if(origin.equals(dest)) return [dest];
    let distances = new Grid2D(costGrid.tileDim).fill(Infinity);
    distances.set(origin, 0);
    let candidates = [origin];
    /**@type {[Vec2, number][]} */
    let deferredCandidates = [];
    let done = false;
    while (candidates.length > 0 && !done) {
        let newCandidates = [];
        for(let pos of candidates) {
            for(let npos of costGrid.iterAdjacent(pos)) {
                let cost = costGrid.get(npos);
                if (distances.get(pos) + cost < distances.get(npos)) {
                    if(npos.equals(dest)) done = true;
                    distances.set(npos, distances.get(pos) + cost);
                    if(cost>1 && !done) {
                        deferredCandidates.push([npos, cost]);
                    } else {
                        newCandidates.push(npos);
                    }
                }    
            }
        }
        /**@type {[Vec2,number][]} */
        const newDeferred = [];
        for(let posCost of deferredCandidates) {
            if(posCost[1]>1) {
                posCost[1]--;
                newDeferred.push(posCost);
            }
            else {
                newCandidates.push(posCost[0]);
            }
        }
        deferredCandidates = newDeferred;
        candidates = newCandidates;
    }
    const route = [];
    if(distances.get(dest)===Infinity) return route;
    let current = dest;
    while(!current.equals(origin)) {
        let lowest = Infinity
        let nextCurrent = null;
        for(let candidate of distances.iterAdjacent(current)) {
            const dist = distances.get(candidate);
            if(dist <lowest) {
                lowest = dist;
                nextCurrent = candidate;
            }
        }
        route.unshift(current);
        if(nextCurrent!==null) current = nextCurrent;
    }
    return route;
}


export class Character extends Entity {
    /**@type {Set<ActionItem>} */
    actions = new Set();
    /**@type {eskv.Widget|null}*/
    actionInventory = null;
    /**@type {Facing} */
    facing = Facing.north;
    constitution = 1;
    /**@type {CharacterStates} */
    priorState = 'patrolling';
    /**@type {CharacterStates} */
    state = 'patrolling';
    /**@type {CharacterStates} */
    resumeState = 'patrolling';
    /**@type {AnimationStates} */
    animationState = 'standing';
    /**@type {{[id:string]: LayeredAnimationFrame[]|number[]}|null} */
    animationGroup = null;
    /**Grid location of the character on the map */
    gpos = vec2(0,0);
    /**@type {eskv.Vec2[]} Array of waypoints that character will move along in patrol mode*/
    patrolRoute = [];
    /** Index of the current target on the patrol route*/
    patrolTarget = -1;
    /** Number of actions remaining this turn */
    actionsThisTurn = 2;
    /** true if player can see this character */
    visibleToPlayer = false;
    /** @type {[ActionItem, import("./action.js").ActionResponseData][]} */
    history = [];
    suppressed = false;
    /**Cumulative # of actions where the character's movement has been impeded */
    movementBlockedCount = 0;
    /**@type {Set<eskv.Vec2>} */
    _coverPositions = new Set();
    _visibleLayer = new Grid2D();
    activeCharacter = false;
    constructor(props={}) {
        super();
        this.spriteSheet = eskv.App.resources['sprites'];
        /**@type {number[]|LayeredAnimationFrame[]} */
        this.frames = [452]; //484
        this.w = 1;
        this.h = 1;
        if(props) this.updateProperties(props);
    }
    on_actionInventory(e, o, v) {
        if(this.actionInventory) {
            const children = [];
            for(let a of this.actions) {
                a.hints = {w:'3', h:'3'};
                this.actionInventory.addChild(a);
            }
            this.actionInventory.children = children;
        }
    }
    /**
     * 
     * @param {ActionItem} action 
     */
    addAction(action) {
        if(this.actions.has(action)) return false;
        this.actions.add(action);
        action.hints = {w:'3', h:'3'};
        if(this.actionInventory) this.actionInventory.addChild(action);
        return true;
    }
    /**
     * 
     * @param {ActionItem} action 
     */
    removeAction(action) {
        if(!this.actions.has(action)) return false;
        this.actions.delete(action);
        if(this.actionInventory) this.actionInventory.removeChild(action);
        return true;
    }
    on_animationState(e,o,v) {
        if(this.animationGroup) this.frames = this.animationGroup[this.animationState];
    }
    /**
     * Line of sight check from one character to another
     * respects both tile sight and cover properties
     * @param {Character} character 
     * @param {MissionMap} map 
     */
    canSee(character, map) {
        const sightMap = map.metaTileMap.layer[MetaLayers.allowsSight]
        const coverMap = map.metaTileMap.layer[MetaLayers.cover]
        const w = sightMap.tileDim[0];
        let cover = false;
        for(let pos of sightMap.iterInBetween(this.gpos, character.gpos)) {
            if(sightMap[pos[0]+pos[1]*w]===0 || cover) return false;
            cover = coverMap[pos[0]+pos[1]*w]>0?true:false;
        }
        return true;
    }
    /**
     * 
     * @param {MissionMap} map 
     */
    setupForLevelStart(map, rng) {
        this._coverPositions = new Set(); // set of positions that have cover from the current location
        this._visibleLayer = new Grid2D([map.w, map.h]).fill(0);
        let i = 0;
        let a = eskv.vec2(1,1);
        let b = eskv.vec2(1,1);
        while(i<1000) {
            i++;
            a = eskv.v2(rng.getRandomPos(map.w, map.h));
            if(map.metaTileMap.layer[MetaLayers.layout].get(a)===LayoutTiles.floor) break; 
        }
        i = 0;
        while(i<1000) {
            i++;
            b = eskv.v2(rng.getRandomPos(map.w, map.h));
            if(map.metaTileMap.layer[MetaLayers.layout].get(b)===LayoutTiles.floor
                &&!b.equals(a)) break; 
        }
        this.patrolRoute = [a, b];
        this.gpos = eskv.v2(b);
        [this.x, this.y] = this.gpos;
        this.animationGroup = this.id[0]==='d'?characterAnimations.greenShirt:characterAnimations.whiteShirt;
        this.animationState = 'standing';
    }
    /**
     * @param {MissionMap} mmap
     */
    rest(mmap) {
        this.actionsThisTurn--;
        if(this.activeCharacter) {
            this.updateFoV(mmap);
            this.updateCamera(mmap);
        }
    }
    /**
     * 
     * @param {Facing} dir direction to move in
     * @param {MissionMap} mmap
     */
    move(dir, mmap) {
        const npos = this.gpos.add(FacingVec[dir]);
        const tmap = mmap.metaTileMap;
        const traverse = tmap.getFromLayer(MetaLayers.traversible, npos)
        this.facing = dir;
        if((traverse&binaryFacing[dir])===0) {
            for(let e of mmap.entities.children) {
                if(e instanceof Entity && e.pos.equals(npos)) {
                    e.interact(mmap, this);
                    this.actionsThisTurn--;
                    return;
                }
            }
        } else if(mmap.characters.reduce((accum,e)=>accum||e.gpos.equals(npos)&&e.state!=='dead', false)) {
            //TODO: Make characters swap if they are stuck in a faceoff
            this.movementBlockedCount++;
        } else {
            this.pos = eskv.v2(this.gpos); //Cut the old animation and move to where the character was
            this.gpos = npos;
            const anim = new eskv.WidgetAnimation();
            anim.add({ x: this.gpos[0], y: this.gpos[1]}, 300);
            anim.start(this);
            if(this.animationGroup!==null) {
                this.animationState = 'walking';
                this.timePerFrame = 60; //TODO: put this in the layered frame definiton??
            }
            this.actionsThisTurn--;
            this.movementBlockedCount = Math.max(this.movementBlockedCount-1,0);
        }
        if(this.activeCharacter) {
            this.updateFoV(mmap);
            this.updateCamera(mmap);
        }
    }
    on_animationComplete(e, o, v) {
        if(this.animationState = 'walking') {
            this.animationState = 'standing';
        }
    }
    /**
     * @param {'piercing'|'shock'|'force'} damageType
     */
    takeDamage(damageType) {
        if(damageType==='piercing') {
            this.state = 'dead';
            this.animationState = 'dead';
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
     * Updates the field of view for the character
     * This is expensive so typically we will only run this
     * on the active player character. Non-player character
     * checks should use canSee instead on discrete points
     * @param {MissionMap} map 
     */
    updateFoV(map) {
        const mmap = map.metaTileMap;
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
                    if(this.activeCharacter) mmap.setInLayer(MetaLayers.seen, p0, 1);
                    if(altSight) {
                        this._visibleLayer[p1[0]+p1[1]*mmap.w] = 1;
                        if(this.activeCharacter) mmap.setInLayer(MetaLayers.seen, p1, 1);    
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
        for(let ent of map.entities.children) {
            if(ent instanceof Entity) {
                ent.visible = this._visibleLayer.get(ent.pos)>0;
            }
        }
        map.tileMap.clearCache();
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
            let X = Math.min(Math.max(target[0]+0.5-camera.w/camera.zoom/2, 0), mmap.w);
            let Y = Math.min(Math.max(target[1]+0.5-camera.h/camera.zoom/2, 0), mmap.h);
            const ts = eskv.App.get().tileSize;
            X = Math.floor(X*ts)/ts
            Y = Math.floor(Y*ts)/ts
            const anim = new eskv.WidgetAnimation();
            anim.add({ scrollX: X, scrollY: Y}, 250*dist/2 );
            anim.start(camera);    
        // if(eskv.v2([camera.scrollX, camera.scrollY]).dist([X,Y])>0.5) {
        //     }
        }
    }
    /**
     * 
     * @param {ActionItem} actionItem
     * @param {MissionMap} mmap 
     * @param {import("./action.js").ActionResponseData} request
     * @returns {import("./action.js").ActionResponseData}
     */
    takeAction(actionItem, mmap, request={}) {
        if(this.actions.has(actionItem)) {
            const response = actionItem.request(this, mmap, request);
            if(response.result==='complete') {
                this.history.push([actionItem, request]);
                this.actionsThisTurn--;
            }
            return response;
        }
        return {result:'notAvailable'};
    }
    /**
     * 
     * @param {MissionMap} mmap 
     * @returns 
     */
    takeTurn(mmap) {
        mmap.updateCharacterVisibility(true);
        while(this.actionsThisTurn>0) {
            if(this.state==='patrolling') {
                if(this.patrolTarget<0) this.patrolTarget=0;
                if(this.patrolRoute.length===0) break;
                if(this.gpos.equals(this.patrolRoute[this.patrolTarget])) this.patrolTarget = (this.patrolTarget+1)%this.patrolRoute.length;
                const src = this.gpos; 
                const dest = this.patrolRoute[this.patrolTarget];
                const moveCostGrid = new Grid2D([mmap.w, mmap.h]);
                mmap.metaTileMap.layer[MetaLayers.layout].forEach((v,i)=>{
                    moveCostGrid[i] = v===LayoutTiles.wall?Infinity:1;
                });
                for(let e of mmap.characters) {
                    if(e!==this) moveCostGrid.set(e.gpos, moveCostGrid.get(e.gpos)+(e.movementBlockedCount<=this.movementBlockedCount?4+this.movementBlockedCount*2:4));
                }
                const route = costedBFSPath(moveCostGrid, src, dest);
                if(route.length>0) {
                    //First action spent moving
                    this.move(facingFromVec(route[0].sub(this.gpos)), mmap);
                    this.history.push([new ActionItem(),{}]);    
                }
                this.actionsThisTurn--; //Spend second action doing nothing
                mmap.updateCharacterVisibility(true);
            } else if (this.state==='dead') {
                this.actionsThisTurn--;
            }
        }
        this.actionsThisTurn = 2;
    }
    /**@type {eskv.sprites.SpriteWidget['draw']} */
    draw(app, ctx) {
        if(this.activeCharacter || this.visibleToPlayer) {
            super.draw(app, ctx);
        }
    }

}

export class PlayerCharacter extends Character {
    constructor(props={}) {
        super();
        this.spriteSheet = eskv.App.resources['sprites'];
        this.frames = [259]; //292
        if(props) this.updateProperties(props);
    }
    /**
     * 
     * @param {MissionMap} map 
     */
    setupForLevelStart(map) {
        this._coverPositions = new Set(); // set of positions that have cover from the current location
        this.animationGroup = characterAnimations[this.id];
        this.animationState = 'standing';
        if(this.activeCharacter) {
            this._visibleLayer = map.metaTileMap._layerData[MetaLayers.visible];
            this._visibleLayer.fill(0);
        } else {
            this._visibleLayer = new Grid2D([map.w, map.h]).fill(0);
        }
    }
    /**
     * Line of sight check from one character to another
     * Uses the player's field of view, which respects both 
     * tile sight and cover properties
     * @param {Character} character 
     * @param {MissionMap} map 
     */
     canSee(character, map) {
        const vmap = this._visibleLayer;
        const [x,y] = character.gpos;
        return vmap[x+y*vmap.tileDim[0]]>0;
    }
    /**
     * 
     * @param {string} key 
     */
    getActionForKey(key) {
        return [...this.actions].find((a)=>{
            return a.keyControl===key
        })
    }
}