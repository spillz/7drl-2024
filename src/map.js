//@ts-check

import * as eskv from "../eskv/lib/eskv.js";
import {Rect, Vec2} from "../eskv/lib/eskv.js";
import { LayeredTileMap, SpriteSheet, SpriteWidget, TileMap } from "../eskv/lib/modules/sprites.js";
import { Rifle } from "./action.js";
import { Character, PlayerCharacter } from "./character.js";

export const MetaLayers = {
    layout: 0, //Basic type of location
    seen: 1, //whether the characters have seen that part of the map
    visible: 2, //whether the characters can currently see that part of the map
    traversible: 3, //direction of traversibility
    allowsSight: 4, //direction of sight
    allowsSound: 5,
    cover: 6, //direction that cover is provided from
    moveCost: 7,
}

/**
 * @readonly
 * @enum {number}
 */
export const LayoutTiles = {
    outside:0,
    floor:1,
    water:2,
    wall:3,
    doorway:4,
    window:5,
}

export const DecorationTiles = {
    tree:163,

}

export const MansionTileIndexes = {
    0: 103, //outside
    1: 74, //floor
}

const wallSet1 = {
    0b0001: 1056,
    0b0010: 32,
    0b0100: 1056,
    0b1000: 32,
    0b0101: 1056,
    0b1010: 32,
    0b0011: 33,
    0b0110: 1057,
    0b1100: 2081,
    0b1001: 3105,
    0b0111: 1058,
    0b1011: 34,
    0b1101: 3106,
    0b1110: 2082,
    0b1111: 35,
}

const wallSet2 = {
    0b0001: 1056+32,
    0b0010: 32+32,
    0b0100: 1056+32,
    0b1000: 32+32,
    0b0101: 1056+32,
    0b1010: 32+32,
    0b0011: 33+32,
    0b0110: 1057+32,
    0b1100: 2081+32,
    0b1001: 3105+32,
    0b0111: 1058+32,
    0b1011: 34+32,
    0b1101: 3106+32,
    0b1110: 2082+32,
    0b1111: 35+32,
}

const wallSet3 = {
    0b0001: 1056+64,
    0b0010: 32+64,
    0b0100: 1056+64,
    0b1000: 32+64,
    0b0101: 1056+64,
    0b1010: 32+64,
    0b0011: 33+64,
    0b0110: 1057+64,
    0b1100: 2081+64,
    0b1001: 3105+64,
    0b0111: 1058+64,
    0b1011: 34+64,
    0b1101: 3106+64,
    0b1110: 2082+64,
    0b1111: 35+64,
}


const MansionAutotiles = {
    wall: new eskv.sprites.AutoTiler('mansionWalls', 
        [LayoutTiles.wall], 
        [LayoutTiles.wall, LayoutTiles.doorway, LayoutTiles.window],
        wallSet3,
    ),
    doorway:new eskv.sprites.AutoTiler('mansionDoorway',
        [LayoutTiles.doorway], 
        [LayoutTiles.wall, LayoutTiles.doorway, LayoutTiles.window],
        {
            0b0001: 0,
            0b0010: 0,
            0b0100: 0,
            0b1000: 0,
            0b0101: 0,
            0b1010: 0,
    }),
    window:new eskv.sprites.AutoTiler('mansionWindow',
        [LayoutTiles.window], 
        [LayoutTiles.wall, LayoutTiles.doorway, LayoutTiles.window],
        {
            0b0001: 0,
            0b0010: 0,
            0b0100: 0,
            0b1000: 0,
            0b0101: 0,
            0b1010: 0,
    }),
}


export const EntityTiles = {
    door:0,
    window:1,
    key:2,
    intel:3,
    explosive:4,   
    gun:5,
    downedNPC: 6, //Occupies two tiles
    deadNPC: 7, //Occupies two tiles
    desk: 8, //autotiles based on adjacencies
    bed: 9,
    chair: 10,
}

export const npcTypes = {
    boss:0,
    neutral:1,
    friendly:2,
    enemy:3,
    traiter:4,
    hostage:5,
}


/**
 * 
 * @param {TileMap} map 
 * @param {Vec2} p1 
 * @param {Vec2} p2 
 * @returns 
 */
function placeWallBetween(map, p1, p2) {
    const maxDist = Math.max(...p2.sub(p1).abs());
    const dir = p2.sub(p1).scale(1/maxDist);
    const grad = Math.abs(dir[0])>=Math.abs(dir[1]);
    let p = p1;
    let dist = 0;
    let oldfp = p1;
    map.set(p1, LayoutTiles.wall);
    while(dist<=maxDist) {
        p = p.add(dir);
        const fp = new Vec2([Math.floor(p[0]), Math.floor(p[1])]);
        const c = map.set(fp, LayoutTiles.wall);
        const diff=fp.sub(oldfp);
        if(diff.abs().sum()===2) {
            const deltaP = diff.abs()[0]>=diff.abs()[1]? new Vec2([diff[0],0]) :
                new Vec2([0,diff[1]]);
            const adjP = fp.add(deltaP);
            map.set(adjP, LayoutTiles.wall);
        }
        oldfp = fp;
        dist++;
    }
    return true;
}

/**
 * 
 * @param {TileMap} map 
 * @param {Vec2} pos 
 * @param {LayoutTiles} fillType 
 * @param {LayoutTiles} blocker 
 */
function floodFill(map, pos, fillType, blocker=LayoutTiles.wall) {
    for(let d of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const posD = pos.add(d)
        if( posD[0]>=0 && posD[0]<map.tileDim[0] &&
            posD[1]>=0 && posD[1]<map.tileDim[1]) {
            if(map.get(posD)!==blocker) {
                map.set(posD, fillType);
                floodFill(map, posD, fillType, blocker);
            }
        }
    }
}

/**
 * 
 * @param {TileMap} map 
 * @param {Rect} rect 
 * @returns 
 */
function placeWalledRect(map, rect) {
    const w = rect.w-1;
    const h = rect.h-1;
    const p = rect.pos;
    for(let pos of map.data.iterBetween(p, p.add([w,0]))) map.set(pos, LayoutTiles.wall);
    for(let pos of map.data.iterBetween(p, p.add([0,h]))) map.set(pos, LayoutTiles.wall);
    for(let pos of map.data.iterBetween(p.add([0,h]), p.add([w,h]))) map.set(pos, LayoutTiles.wall);
    for(let pos of map.data.iterBetween(p.add([w,0]), p.add([w,h]))) map.set(pos, LayoutTiles.wall);
}

/**
 * 
 * @param {TileMap} map 
 * @param {Rect} rect 
 * @param {eskv.rand.PRNG} rng 
 */
function placeRoom(map, rect, rng) {
    for(let p of map.data.iterRect(rect.grow(-1))) {
        map.set(p, LayoutTiles.floor);
    }
    placeWalledRect(map, rect);
    const doorPosX1 = rect[0]+1+rng.getRandomInt(rect[2]-2);
    const doorPosX2 = rect[0]+1+rng.getRandomInt(rect[2]-2);
    const doorPosY1 = rect[1]+1+rng.getRandomInt(rect[3]-2);
    const doorPosY2 = rect[1]+1+rng.getRandomInt(rect[3]-2);
    map.set(new Vec2([doorPosX1, rect[1]]), LayoutTiles.doorway);
    map.set(new Vec2([doorPosX2, rect[1]+rect[3]-1]), LayoutTiles.doorway);
    map.set(new Vec2([rect[0], doorPosY1]), LayoutTiles.doorway);
    map.set(new Vec2([rect[0]+rect[2]-1, doorPosY2]), LayoutTiles.doorway);
}

/**
 * 
 * @param {MissionMap} map 
 * @param {eskv.rand.PRNG} rng
 */
function generateMansionMap(map, rng) {
    map.w = 80;
    map.h = 40;
    const [w,h] = [map.w, map.h];
    const tdim = new Vec2([map.w, map.h]);
    const tmap = map.tileMap;
    tmap.useCache = true;
    tmap.numLayers = 3;
    tmap.tileDim = tdim;
    tmap.activeLayer = 0;

    const mmap = map.metaTileMap;
    mmap.defaultValue = 0;
    mmap.numLayers = 8;
    mmap.tileDim = tdim;
    mmap.activeLayer = 0; //Ground/flooring/wall layout layer
    for (const p of mmap.data.iterAll()) {
        mmap.set(p, LayoutTiles.outside);
    }

    const perim = 10;
    const houseRect = new Rect([0,0,tdim[0], tdim[1]]).grow(-perim);
    const [hx, hy, hw, hh] = houseRect;
    /**@type {Rect[]} */
    const rooms = []
    const w2 = Math.floor(hw)/2;
    const w4 = Math.floor(hw)/4;
    const h2 = Math.floor(hh)/2;
    const h4 = Math.floor(hh)/4;
    const lSplit = rng.getRandomInt(w4, w2);
    const rSplit = w2 + rng.getRandomInt(w4, w2);
    const uSplit = rng.getRandomInt(h4, h2);
    const dSplit = rng.getRandomInt(uSplit+4,Math.min(uSplit+7, hh-1));
    const cuSplit = Math.max(rng.getRandomInt(uSplit-3, uSplit), 0);
    const cdSplit = Math.min(rng.getRandomInt(dSplit+3, dSplit), hh-1);
    const lSetback = -rng.getRandomInt(0, 5);
    const rSetback = -rng.getRandomInt(0, 5);
    const missing = rng.getRandomInt(0, 4); //0 = none, 1 = top, 2 = center, 3 = bottom

    //Prefab rooms
    //Center top
    placeRoom(mmap, new Rect([hx+lSplit, hy, rSplit-lSplit+1, cuSplit+1]), rng);
    //Center middle
    placeRoom(mmap, new Rect([hx+lSplit, hy+cuSplit, rSplit-lSplit+1, cdSplit-cuSplit+1]), rng);
    //Center bottom
    placeRoom(mmap, new Rect([hx+lSplit, hy+cdSplit, rSplit-lSplit+1, hh-cdSplit+1]), rng);
    //Left upper
    placeRoom(mmap, new Rect([hx, hy+lSetback, lSplit+1, uSplit+1]), rng);
    //Left hall
    placeRoom(mmap, new Rect([hx, hy+lSetback+uSplit, lSplit+1, dSplit-uSplit+1]), rng);
    //Left lower
    placeRoom(mmap, new Rect([hx, hy+lSetback+dSplit, lSplit+1, hh-dSplit+1]), rng);
    //Right upper
    placeRoom(mmap, new Rect([hx+rSplit, hy+rSetback, hw-rSplit+1, uSplit+1]), rng);
    //Right hall
    placeRoom(mmap, new Rect([hx+rSplit, hy+rSetback+uSplit, hw-rSplit+1, dSplit-uSplit+1]), rng);
    //Right lower
    placeRoom(mmap, new Rect([hx+rSplit, hy+rSetback+dSplit, hw-rSplit+1, hh-dSplit+1]), rng);

    /**@type {[number, number][]} */
    const trees = [];
    let i=0;

    for(let pos of mmap.data.iterAll()) {
        const index = mmap.get(pos);
        if(index === LayoutTiles.outside) {
            if(rng.random()>0.95) {
                trees.push(pos);
            }
        }
        if(index in MansionTileIndexes) {
            tmap.set(pos, MansionTileIndexes[index]);
        } else {
            const vpos = new Vec2(pos);
            MansionAutotiles.wall.autoTile(vpos, mmap, tmap);
            MansionAutotiles.doorway.autoTile(vpos, mmap, tmap);
            MansionAutotiles.window.autoTile(vpos, mmap, tmap);
        }
        const traversible = index===LayoutTiles.wall?0:0b1111;
        mmap.setInLayer(MetaLayers.traversible, pos, traversible);
        i++;
    }
    tmap.activeLayer = 1;
    const sightData = mmap._layerData[MetaLayers.allowsSight];
    mmap.activeLayer = MetaLayers.layout;
    for(let p of mmap.data.iterAll()) {
        mmap.setInLayer(MetaLayers.seen, p, (mmap.data.numInRange(p,[LayoutTiles.outside],1.5)>0)?1:0);
        const layout = mmap.getFromLayer(MetaLayers.layout, p);
        const ind = p[0]+p[1]*w;
        sightData[ind] |= (layout===LayoutTiles.wall?0:0b1111); //see through if not a wall
    }
    for(let p of trees) {
        tmap.set(p, DecorationTiles.tree);
        const ind = p[0]+p[1]*w;
        sightData[ind] |= 0b11110000; //provides cover
    }
    tmap._vLayer = mmap._layerData[MetaLayers.seen];
    tmap._aLayer = mmap._layerData[MetaLayers.visible];
    tmap.clearCache();
}

/**
 * 
 * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx
 * @param {eskv.sprites.SpriteSheet} spriteSheet
 * @param {TileMap} mmap 
 * @param {TileMap} tmap 
 */
function drawFloorUnderWall(ctx, spriteSheet, mmap, tmap) {
    let i = 0;
    for(let pos of mmap.data.iterAll()) {
        const mtile = mmap.get(pos)
        if(mtile>=LayoutTiles.wall) {
            for(let adj of [[0,1],[1,0],[0,-1],[-1,0]]) {
                /**@type {[number, number]} */
                const ppos = [pos[0]+adj[0], pos[1]+adj[1]];
                const pmtile = mmap.get(ppos);
                if(pmtile<LayoutTiles.wall) {
                    const drawTile = tmap.get(ppos);
                    // spriteSheet.drawIndexedClipped(ctx, drawTile, ppos[0], ppos[1], (1+adj[0])/2, (1+adj[1])/2, 0.5*Math.abs(adj[0]), 0.5*Math.abs(adj[1]));
                }
            }
        }
        i++;
    }
}

/**
 * 
 * @param {MissionMap} map 
 */
function generatePenthouseMap(map) {
    //Beach/cityscape below (printed half sized)
}

/**
 * 
 * @param {MissionMap} map 
 */
function generateCorporateOfficeMap(map) {

}

/**
 * 
 * @param {MissionMap} map 
 */
function generateWarehouseMap(map) {

}

/**
 * 
 * @param {MissionMap} map 
 */
function generateStarbase(map) {

}

/**
 * 
 * @param {MissionMap} map 
 */
function generateMoonBase(map) {

}


export class GameWindow extends eskv.Widget {

}

export class PositionSelector extends eskv.Widget {
    /**@type {Vec2[]} */
    _validCells = [];
    /**@type {Character[]} */
    _validCharacters = [];
    /**@type {number} */
    activeCell = -1;
    constructor(props={}) {
        super();
        if(props) this.updateProperties(props);        
    }
    set validCharacters(value) {
        this._validCharacters = value;
        this._validCells = this.validCharacters.map((v)=>v.gpos);
        this.setupValidCells();
    }
    get validCharacters() {
        return this._validCharacters;
    }
    set validCells(value) {
        this._validCharacters = [];
        this._validCells = value;
        this.setupValidCells();
    }
    get validCells() {
        return this._validCells;
    }
    setupValidCells() {
        const children = [];
        let i = 0;
        for(let pos of this._validCells) {
            children.push(new SpriteWidget({
                spriteSheet: eskv.App.resources['sprites'],
                x: pos[0],
                y: pos[1],
                w: 1,
                h: 1,
                frames: [this.activeCell===i?6:5],
            }));
            i++;
        }
        this.children = children;
        this.activeCell = this._validCells.length>0? 0: -1;
    }
    on_activeCell(e, o, v) {
        let i = 0;
        for(let w of this.children) {
            if(w instanceof SpriteWidget) w.frames = [this.activeCell===i?6:5];
            i++;
        }
    }
    /**
     * 
     * @param {Vec2} direction 
     */
    moveActiveCell(direction) {
        const deltas = [];
        const activePos = this.validCells[this.activeCell];
        let maxDist = 0;
        let minDist = +Infinity;
        let minDistInd = -1;
        let maxDistInd = this.activeCell;
        let i = 0;
        for(let pos of this.validCells) {
            const delta = pos.sub(activePos);
            const dist = delta.mul(direction).sum() + eskv.vec2(1,1).sub(direction.abs()).mul(delta).sum();
            if(dist>0 && dist<minDist) {
                minDist = dist;
                minDistInd = i;
            }
            if(dist<0 && dist<maxDist) {
                maxDist = dist;
                maxDistInd = i;
            }
            i++;
        }
        this.activeCell = minDistInd>=0? minDistInd : maxDistInd;
    }
}

export class MissionMap extends eskv.Widget {
    rng = new eskv.rand.PRNG_sfc32(); //.setPRNG('sfc32');
    clipRegion = new Rect();
    tileMap = new LayeredTileMap();
    metaTileMap = new LayeredTileMap();
    /**@type {Character[]} */
    enemies = [
        new Character({id:'Alfred'}),
        new Character({id:'Bennie'}),
        new Character({id:'Charlie'}),
        new Character({id:'Devon'}),
    ];
    entities = new eskv.Widget({hints:{h:1, w:1}});
    /**@type {Character[]} */
    playerCharacters = [
        new PlayerCharacter({id:'Randy', x:0,y:0, activeCharacter:true}),
        new PlayerCharacter({id:'Maria', activeCharacter:false})
    ];
    characters = [...this.enemies, ...this.playerCharacters]
    /**@type {Character|null} */
    activeCharacter = this.playerCharacters[0];
    /**@type {SpriteSheet|null} */
    spriteSheet = null;
    constructor(props=null) {
        super();
        this.positionSelector = new PositionSelector()
        this.children = [this.tileMap, this.entities, this.positionSelector, ...this.enemies, ...this.playerCharacters];
        this.rng.seed(100);
        if(props) this.updateProperties(props);
    }
    setupLevel() {
        generateMansionMap(this, this.rng);
        this.playerCharacters[0].setupForLevelStart(this, this.rng);
        this.enemies.forEach(e=>e.setupForLevelStart(this, this.rng));
        this.playerCharacters[0].actions.add(new Rifle());
    }
    on_spriteSheet() {
        this.tileMap.spriteSheet = this.spriteSheet;
        this.setupLevel();
    }
    on_parent(e,o,v) {
        const scroller = this.parent;
        if(!(scroller instanceof eskv.ScrollView)) return;
        scroller.bind('scrollX', (e,o,v)=>this.updateClipRegion(o));
        scroller.bind('scrollY', (e,o,v)=>this.updateClipRegion(o));
        scroller.bind('zoom', (e,o,v)=>this.updateClipRegion(o));
        this.updateClipRegion(scroller);
    }
    updateClipRegion(scroller) {
        this.tileMap.clipRegion = new Rect([
            Math.floor(scroller._scrollX), 
            Math.floor(scroller._scrollY), 
            Math.ceil(scroller.w/scroller.zoom), 
            Math.ceil(scroller.h/scroller.zoom)
        ]);
    }
    /**
     * 
     * @param {boolean} refresh 
     */
    updateCharacterVisibility(refresh=false) {
        const char = this.activeCharacter;
        for(let e of this.enemies) {
            if(refresh) e.visibleToPlayer = false;
            e.visibleToPlayer = e.visibleToPlayer || this.activeCharacter?._visibleLayer.get(e.gpos)===1;
        }
    }
    /**
     * 
     * @param {string} message 
     * @param {'enemy'|'position'|'posAdjacent'} targetType 
     * @param {(map:MissionMap, target:Vec2)=>void} callback 
     */
    targetSelector(message, targetType, callback) {

    }
    /**
     * 
     * @param {string} message 
     * @param {'success'|'failure'|'info'} messageType 
     */
    prompt(message, messageType) {

    }
    /**
     * 
     * @param {Vec2} position 
     */
    getCharacterAt(position) {
        for(let c of this.characters) {
            if(c.gpos.equals(position)) return c;
        }
        return null;
    }


}