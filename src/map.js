//@ts-check

import * as eskv from "eskv/lib/eskv.js";
import {Rect, Vec2} from "eskv/lib/eskv.js";
import { PRNG } from "eskv/lib/modules/random.js";
import { LayeredAnimationFrame, LayeredTileMap, SpriteSheet, SpriteWidget, TileMap } from "eskv/lib/modules/sprites.js";
import { Character, PlayerCharacter } from "./character.js";
import { DoorWidget, Entity } from "./entity.js";
import { FacingVec } from "./facing.js";

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
    hallway:2,
    water:3,
    wall:4,
    doorway:5,
    window:6,
    coveredWindow:7,
    brokenWindow:8,
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

const wallSet4 = {
    0b0001: 1056+96,
    0b0010: 32+96,
    0b0100: 1056+96,
    0b1000: 32+96,
    0b0101: 1056+96,
    0b1010: 32+96,
    0b0011: 33+96,
    0b0110: 1057+96,
    0b1100: 2081+96,
    0b1001: 3105+96,
    0b0111: 1058+96,
    0b1011: 34+96,
    0b1101: 3106+96,
    0b1110: 2082+96,
    0b1111: 35+96,
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
            0b0001: 74, //3111, 
            0b0010: 74, //39,
            0b0100: 74, //1063, 
            0b1000: 74, //2087, 
            0b0101: 74, //3111, 
            0b1010: 74, //39,
    }), 
    window:new eskv.sprites.AutoTiler('mansionWindow',
        [LayoutTiles.window], 
        [LayoutTiles.wall, LayoutTiles.doorway, LayoutTiles.window],
        {
            0b0001: 3111-2,
            0b0010: 39-2,
            0b0100: 1063-2,
            0b1000: 2087-2,
            0b0101: 3111-2,
            0b1010: 39-2,
    }),
    coveredWindow:new eskv.sprites.AutoTiler('mansionCoveredWindow',
        [LayoutTiles.coveredWindow], 
        [LayoutTiles.wall, LayoutTiles.doorway, LayoutTiles.window, LayoutTiles.coveredWindow],
        {
            0b0001: 3111-2,
            0b0010: 39-2,
            0b0100: 1063-2,
            0b1000: 2087-2,
            0b0101: 3111-2,
            0b1010: 39-2,
    }),
    brokenWindow:new eskv.sprites.AutoTiler('mansionBrokenWindow',
        [LayoutTiles.brokenWindow], 
        [LayoutTiles.wall, LayoutTiles.doorway, LayoutTiles.window, LayoutTiles.coveredWindow, LayoutTiles.brokenWindow],
        {
            0b0001: 3111-1,
            0b0010: 39-1,
            0b0100: 1063-1,
            0b1000: 2087-1,
            0b0101: 3111-1,
            0b1010: 39-1,
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
    const w = rect.w;
    const h = rect.h;
    const p = rect.pos;
    // for(let pos of map.data.iterBetween(p, p.add([w,0]))) if(LayoutTiles.outside===map.get(pos)) map.set(pos, LayoutTiles.wall);
    // for(let pos of map.data.iterBetween(p, p.add([0,h]))) if(LayoutTiles.outside===map.get(pos)) map.set(pos, LayoutTiles.wall);
    // for(let pos of map.data.iterBetween(p.add([0,h]), p.add([w,h]))) if(LayoutTiles.outside===map.get(pos)) map.set(pos, LayoutTiles.wall);
    // for(let pos of map.data.iterBetween(p.add([w,0]), p.add([w,h]))) if(LayoutTiles.outside===map.get(pos)) map.set(pos, LayoutTiles.wall);
    for(let pos of map.data.iterBetween(p, p.add([w,0]))) map.set(pos, LayoutTiles.wall);
    for(let pos of map.data.iterBetween(p, p.add([0,h]))) map.set(pos, LayoutTiles.wall);
    for(let pos of map.data.iterBetween(p.add([0,h]), p.add([w,h]))) map.set(pos, LayoutTiles.wall);
    for(let pos of map.data.iterBetween(p.add([w,0]), p.add([w,h]))) map.set(pos, LayoutTiles.wall);
}

/**
 * 
 * @param {TileMap} map 
 * @param {Vec2} pos 
 */
function placeValidDoor(map, pos) {
    if( map.get(pos.add(FacingVec[0]))===LayoutTiles.wall && 
        map.get(pos.add(FacingVec[2]))===LayoutTiles.wall &&
        map.get(pos.add(FacingVec[1]))!==LayoutTiles.wall && 
        map.get(pos.add(FacingVec[3]))!==LayoutTiles.wall) {
        map.set(pos, LayoutTiles.doorway)
        return true;
    }
    if( map.get(pos.add(FacingVec[1]))===LayoutTiles.wall && 
        map.get(pos.add(FacingVec[3]))===LayoutTiles.wall &&
        map.get(pos.add(FacingVec[0]))!==LayoutTiles.wall && 
        map.get(pos.add(FacingVec[2]))!==LayoutTiles.wall) {
        map.set(pos, LayoutTiles.doorway)
        return true;
    }
    return false;
}

/**
 * 
 * @param {TileMap} map 
 * @param {Vec2} pos 
 * @param {[Vec2, number][]} doors
 * @param {Vec2[]} windows 
 */
function placeValidOpening(map, pos, doors, windows) {
    const p0 = pos.add(FacingVec[0]);
    const p1 = pos.add(FacingVec[1]);
    const p2 = pos.add(FacingVec[2]);
    const p3 = pos.add(FacingVec[3]);
    const mp0 = map.get(p0);
    const mp1 = map.get(p1);
    const mp2 = map.get(p2);
    const mp3 = map.get(p3);
    if( mp0===LayoutTiles.wall && 
        mp2===LayoutTiles.wall) {
        if( mp1!==LayoutTiles.wall && mp3==LayoutTiles.outside ||
            mp3!==LayoutTiles.wall && mp1==LayoutTiles.outside) {
            map.set(pos, LayoutTiles.window);
            windows.push(pos);
            return true;
        } else if(mp1!==LayoutTiles.wall && mp3!==LayoutTiles.wall) {
            map.set(pos, LayoutTiles.doorway)
            doors.push([pos, 1]);
            return true;
        }
    }
    if( mp1===LayoutTiles.wall && 
        mp3===LayoutTiles.wall) {
        if( mp0!==LayoutTiles.wall && mp2==LayoutTiles.outside ||
            mp2!==LayoutTiles.wall && mp0==LayoutTiles.outside) {
            map.set(pos, LayoutTiles.window)
            windows.push(pos);
            return true;    
        } else if(mp0!==LayoutTiles.wall && mp2!==LayoutTiles.wall) {
            map.set(pos, LayoutTiles.doorway)
            doors.push([pos, 0]);
            return true;    
        }
    }
    return false;
}


/**
 * 
 * @param {TileMap} map 
 * @param {Rect} rect 
 */
function placeHallway(map, rect) {
    for(let p of map.data.iterRect([rect[0],rect[1],rect[2]+1,rect[3]+1])) {
        map.set(p, LayoutTiles.hallway);
    }
}

/**
 * 
 * @param {TileMap} map 
 * @param {Rect} rect 
 */
function placeRoom(map, rect) {
    for(let p of map.data.iterRect([rect[0]+1,rect[1]+1,rect[2]-1,rect[3]-1])) {
        map.set(p, LayoutTiles.floor);
    }
    placeWalledRect(map, rect);
}

/**
 * 
 * @param {TileMap} map 
 */
function encloseHallways(map) {
    for(let p of map.data.iterAll()) {
        if(map.data.get(p)===LayoutTiles.hallway) {
            for(let pa of map.data.iterInRange(p,1.5)) {
                const mpa = map.data.get(pa)
                if(mpa===LayoutTiles.floor||mpa===LayoutTiles.outside) {
                    map.data.set(p, LayoutTiles.wall);
                    break;
                }
            }
        }
    }
    for(let p of map.data.iterAll()) {
        if(map.data.get(p)===LayoutTiles.hallway) {
            map.data.set(p, LayoutTiles.floor);
        }
    }
}

/**
 * 
 * @param {TileMap} map 
 * @param {Rect} rect 
 * @param {[Vec2, number][]} doors
 * @param {Vec2[]} windows
 * @param {eskv.rand.PRNG} rng 
 */
function placeRoomOpenings(map, rect, doors, windows, rng){
    if(!map.data.hasTypesBetween([rect[0],rect[1]],[rect[0]+rect[2],rect[1]], [LayoutTiles.doorway,LayoutTiles.floor])) {
        const doorPosX1 = rect[0]+1+rng.getRandomInt(rect[2]-2);
        let x = doorPosX1;
        while(!placeValidOpening(map, new Vec2([x, rect[1]]), doors, windows)) {
            x++;
            if(x>=rect.right) x = rect[0]+1;
            if(x===doorPosX1) break;
        }
    }
    if(!map.data.hasTypesBetween([rect[0],rect[1]+rect[3]],[rect[0]+rect[2],rect[1]+rect[3]], [LayoutTiles.doorway,LayoutTiles.floor])) {
        const doorPosX2 = rect[0]+1+rng.getRandomInt(rect[2]-2);
        let x = doorPosX2;
        while(!placeValidOpening(map, new Vec2([x, rect[1]+rect[3]]), doors, windows)) {
            x++;
            if(x>=rect.right) x = rect[0]+1;
            if(x===doorPosX2) break;
        }
    }
    if(!map.data.hasTypesBetween([rect[0],rect[1]],[rect[0],rect[1]+rect[3]], [LayoutTiles.doorway,LayoutTiles.floor])) {
        const doorPosY1 = rect[1]+1+rng.getRandomInt(rect[3]-2);
        let y = doorPosY1;
        while(!placeValidOpening(map, new Vec2([rect[0], y]), doors, windows)) {
            y++;
            if(y>=rect.bottom) y = rect[1]+1;
            if(y===doorPosY1) break;
        }
    }
    if(!map.data.hasTypesBetween([rect[0]+rect[2],rect[1]],[rect[0]+rect[2],rect[1]+rect[3]], [LayoutTiles.doorway,LayoutTiles.floor])) {
        let doorPosY2 = rect[1]+1+rng.getRandomInt(rect[3]-2);
        let y = doorPosY2;
        while(!placeValidOpening(map, new Vec2([rect[0]+rect[2], doorPosY2]), doors, windows)) {
            y++;
            if(y>=rect.bottom) y = rect[1]+1;
            if(y===doorPosY2) break;
        }
    }

}


/**
 * 
 * @param {Rect} rect 
 * @param {Rect} extent 
 */
function isBoundaryRoom(rect, extent) {
    return rect.x<=extent.x || rect.y<=extent.y || rect.right>=extent.right || rect.bottom>=extent.bottom;
}

/**
 * 
 * @param {Rect} room1 
 * @param {Rect} room2 
 */
function isAdjacent(room1, room2) {
    // Checks if room1 is adjacent to room2 (assuming room2 is a discarded room)
    const touchHorizontal = (room1.x < room2.right) && (room1.right > room2.x);
    const touchVertical = (room1.y < room2.bottom) && (room1.bottom > room2.y);
    const adjacent = (touchHorizontal && (room1.y === room2.bottom || room1.bottom === room2.y)) ||
                     (touchVertical && (room1.x === room2.right || room1.right === room2.x));
    return adjacent;
}

/**
 * 
 * @param {Rect} rect 
 * @param {Rect[]} boundaryRooms 
 */
function isAdjacentBoundary(rect, boundaryRooms) {
    for(let bRect of boundaryRooms) {
        if(isAdjacent(rect, bRect)) return true;
    }
}

/**
 * Generates a binary space partition for a mansion
 * @param {Rect} rect The current room to divide
 * @param {number} minSize Minimum size of a room in either dimension
 * @param {number} hallSize The widgth of a hallway (should be < minSize)
 * @param {Rect[]} rooms The list of rooms that have been added
 * @param {PRNG} rng The random number generator
 * @param {Rect} extent The rect containing the full map dimensions (assumed 0,0 upper left)
 * @returns 
 */
function bspMansion(rect, minSize, hallSize, rooms, rng, extent, bias=0.5, hvBias=0, hhBias=0) {
    if (rect.w < minSize * 2 && rect.h < minSize * 2 /* || rect.w <= hallSize || rect.h <= hallSize */) {
        rooms.push(rect);
        return true;
        // // Add rect if it doesn't touch the border (with a 1-unit buffer for simplicity)
        // if (rect.x > 0 && rect.y > 0 && 
        //     rect.x + rect.w < extent.w-1 && 
        //     rect.y + rect.h < extent.h-1) {
        //     rooms.push(rect);
        //     return true;
        // }
        // return false;
    }
    //Choose split direction
    const dir = rect.w<minSize+hallSize?0:
                rect.h<minSize+hallSize?1:
                rect.w>rect.h?1:
                rect.h<rect.w?0:
                rng.random()>bias? 1: 0;
    const atEdge = rect.x<=0 || rect.y<=0 || rect.right>=extent.w || rect.bottom>=extent.h;
    if (dir===0) { // Horizontal splitter
        //Add a hall as the splitter if enough space and long enough to justify
        if(!atEdge && rect.h>=2*minSize+hallSize && rect.w>minSize && rng.random()>hhBias) {
            const b = Math.floor((rect.h - 2*minSize - hallSize)/4);
            const split = Math.floor(rng.random() * (rect.h - 2*minSize - hallSize - 2*b)) + minSize +b;
            if(bspMansion(new Rect([rect.x, rect.y + split, rect.w, hallSize]), minSize, hallSize, rooms, rng, extent, 0, hvBias, hhBias)) {
                bspMansion(new Rect([rect.x, rect.y, rect.w, split]), minSize, hallSize, rooms, rng, extent, 0, hvBias, hhBias);
                bspMansion(new Rect([rect.x, rect.y + split + hallSize, rect.w, rect.h - split - hallSize]), minSize, hallSize, rooms, rng, extent, 0, hvBias, hhBias);        
                return true;
            }
        }
        //otherwise split normally
        const b = Math.floor((rect.h - 2*minSize)/4);
        const split = Math.floor(rng.random() * (rect.h - 2*minSize -2*b)) + minSize +b;
        bspMansion(new Rect([rect.x, rect.y, rect.w, split]), minSize, hallSize, rooms, rng, extent, 0, hvBias, hhBias);
        bspMansion(new Rect([rect.x, rect.y + split, rect.w, rect.h - split]), minSize, hallSize, rooms, rng, extent, 0, hvBias, hhBias);
    } else { // Vertical splitter
        //Add a hall as the splitter if enough space and long enough to justify
        if(!atEdge && rect.w>=2*minSize+hallSize && rect.h>minSize && rng.random()>hvBias) {
            const b = Math.floor((rect.w - 2*minSize - hallSize)/4);
            const split = Math.floor(rng.random() * (rect.w - 2*minSize - hallSize -2*b)) + minSize + b;
            if(bspMansion(new Rect([rect.x + split, rect.y, hallSize, rect.h]), minSize, hallSize, rooms, rng, extent, 1, hvBias, hhBias)) {
                bspMansion(new Rect([rect.x, rect.y, split, rect.h]), minSize, hallSize, rooms, rng, extent, 1, hvBias, hhBias);
                bspMansion(new Rect([rect.x + split + hallSize, rect.y, rect.w - split - hallSize, rect.h]), minSize, hallSize, rooms, rng, extent, 1, hvBias, hhBias);
                return true;
            }
        }
        //otherwise split normally
        const b = Math.floor((rect.w - 2*minSize)/4);
        const split = Math.floor(rng.random() * (rect.w - 2*minSize - 2*b)) + minSize + b;
        // const rect1 = new Rect([rect.x, rect.y, split, rect.h]);
        // const rect2 = new Rect([rect.x + split, rect.y, rect.w - split, rect.h]);
        bspMansion(new Rect([rect.x, rect.y, split, rect.h]), minSize, hallSize, rooms, rng, extent, 1, hvBias, hhBias);
        bspMansion(new Rect([rect.x + split, rect.y, rect.w - split, rect.h]), minSize, hallSize, rooms, rng, extent, 1, hvBias, hhBias);    
    }
    return true;
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

    //Create the basic layout for the mansion as a BSP of rectangles
    /**@type {Rect[]} */
    const allRooms = [];
    const mapRect = new Rect([0,0,w,h,]);
    bspMansion(mapRect, 5, 3, allRooms, rng, mapRect);

    //Rects at the boundary are exterior areas "boundaryRooms"
    const boundaryRooms = allRooms.filter((r)=>isBoundaryRoom(r, mapRect));
    //Non-boundary rooms are parts of the mansion structure
    const rooms = allRooms.filter((r)=>!boundaryRooms.includes(r));
    //Exterior rooms are adjacent to boundary areas
    const exteriorRooms = rooms.filter((r)=>isAdjacentBoundary(r, boundaryRooms));
    //Interior rooms are mansions rooms that are not exterior
    let interiorRooms = rooms.filter((r)=>(!exteriorRooms.includes(r)&&r.w>3&&r.h>3));
    interiorRooms.sort((a,b)=>((b.w<=3||b.h<=3?-100:b.w*b.h)-(a.w<=3||a.h<=3?-100:a.w*a.h)));
    //We will mark some interior rooms as courtyards, making them outdoor areas
    //which ensures that most rooms have natural light
    /**@type {Rect[]} */
    const courtyards = [];
    while(interiorRooms.length>0.04*rooms.length) //0.05*rooms.length)
    {
        rooms.splice(rooms.indexOf(interiorRooms[0]), 1);
        //@ts-ignore
        courtyards.push(interiorRooms.shift());
        interiorRooms = rooms.filter((r)=>(!isAdjacentBoundary(r, [...boundaryRooms, ...courtyards])&&r.w>3&&r.h>3));
        interiorRooms.sort((a,b)=>((b.w<=3||b.h<=3?-100:b.w*b.h)-(a.w<=3||a.h<=3?-100:a.w*a.h)));
    }

    for(let room of rooms) if(room.w<=3||room.h<=3) placeHallway(mmap, room);
    for(let room of rooms) if(room.w>3&&room.h>3) placeRoom(mmap, room);
    encloseHallways(mmap);
    const doorways = /**@type {[Vec2, number][]}*/([]);
    const windows = /**@type {Vec2[]}*/([]);
    for(let room of rooms) placeRoomOpenings(mmap, room, doorways, windows, rng);
    for(let [doorPos, doorFacing] of doorways) {
        const door = DoorWidget.a();
        door.pos = doorPos;
        door.w = 1;
        door.h = 1;
        door.facing = doorFacing;
        door.state = 'closed';
        map.entities.addChild(door)
    }


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
            MansionAutotiles.brokenWindow.autoTile(vpos, mmap, tmap);
        }
        let traversible = index===LayoutTiles.wall||index===LayoutTiles.window?0:0b1111;
        for(let e of map.entities.children) {
            if(e instanceof Entity && e.pos.equals(pos)) traversible &= e.traversible;
        }
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
        for(let e of map.entities.children) {
            if(e instanceof Entity && e.pos.equals(p)) sightData[ind] &= e.allowsSight;
        }
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
    /** @type {string[]} */
    cellLabels = [];
    /** @type {'action'|'order'} */
    selectionKind = 'action';
    /**@type {number} */
    activeCell = -1;
    constructor(props={}) {
        super();
        if(props) this.updateProperties(props);        
    }
    set validCharacters(value) {
        this._validCharacters = value;
        this._validCells = this.validCharacters.map((v)=>v.gpos);
        this.cellLabels = this._validCells.map(() => '');
        this.setupValidCells();
    }
    get validCharacters() {
        return this._validCharacters;
    }
    set validCells(value) {
        this._validCharacters = [];
        this._validCells = value;
        this.cellLabels = this._validCells.map(() => '');
        this.setupValidCells();
    }
    get validCells() {
        return this._validCells;
    }
    setupValidCells() {
        const children = [];
        let i = 0;
        for(let pos of this._validCells) {
            children.push(SpriteWidget.a({
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
    draw(app, ctx) {
        super.draw(app, ctx);
        const oldFill = ctx.fillStyle;
        const oldFont = ctx.font;
        const oldStroke = ctx.strokeStyle;
        const oldLineWidth = ctx.lineWidth;
        ctx.font = '0.22px monospace';
        for (let i = 0; i < this._validCells.length; i++) {
            const text = this.cellLabels[i];
            if (!text) continue;
            const pos = this._validCells[i];
            ctx.fillStyle = 'rgba(12,12,20,0.82)';
            ctx.fillRect(pos[0] + 0.58, pos[1] - 0.18, 0.56, 0.2);
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 0.03;
            ctx.strokeRect(pos[0] + 0.58, pos[1] - 0.18, 0.56, 0.2);
            ctx.fillStyle = 'rgba(235,245,255,0.98)';
            ctx.fillText(text, pos[0] + 0.62, pos[1] - 0.03);
        }
        ctx.fillStyle = oldFill;
        ctx.font = oldFont;
        ctx.strokeStyle = oldStroke;
        ctx.lineWidth = oldLineWidth;
        if (this.activeCell < 0 || this.activeCell >= this._validCells.length) return;
        const pos = this._validCells[this.activeCell];
        const color = this.selectionKind === 'order'
            ? 'rgba(255,190,70,0.98)'
            : 'rgba(90,220,255,0.96)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.08;
        ctx.strokeRect(pos[0] + 0.08, pos[1] + 0.08, 0.84, 0.84);
        ctx.lineWidth = 0.04;
        ctx.strokeRect(pos[0] + 0.18, pos[1] + 0.18, 0.64, 0.64);
        ctx.strokeStyle = oldStroke;
        ctx.lineWidth = oldLineWidth;
    }
}

export class ObligationMapOverlay extends eskv.Widget {
    replayMode = false;
    /** @type {Vec2|null} */
    randyEchoPos = null;
    /** @type {{turn:number, position: Vec2}[]} */
    randyPath = [];
    /** @type {{turn:number, position: Vec2, label:string, color?:string}[]} */
    objectivePositions = [];
    constructor(props={}) {
        super();
        if (props) this.updateProperties(props);
    }
    update(app, millis) {
        super.update(app, millis);
        const map = this.parent;
        if (!(map instanceof eskv.Widget)) return;
        this.x = 0;
        this.y = 0;
        this.w = map.w;
        this.h = map.h;
    }
    /**
     * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx
     * @param {Vec2} pos
     * @param {string} color
     * @param {string} label
     * @param {number=} radius
     */
    drawMarker(ctx, pos, color, label, radius = 0.23) {
        const cx = pos[0] + 0.5;
        const cy = pos[1] + 0.5;
        const oldFill = ctx.fillStyle;
        const oldStroke = ctx.strokeStyle;
        const oldLineWidth = ctx.lineWidth;
        const oldFont = ctx.font;
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = 0.07;
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = '0.4px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillText(label, cx + 0.32, cy - 0.32);
        ctx.fillStyle = oldFill;
        ctx.strokeStyle = oldStroke;
        ctx.lineWidth = oldLineWidth;
        ctx.font = oldFont;
    }
    draw(app, ctx) {
        for (const objective of this.objectivePositions) {
            this.drawMarker(
                ctx,
                objective.position,
                objective.color ?? 'rgba(255,165,0,0.86)',
                objective.label ?? `T${objective.turn}`,
                0.18,
            );
        }
        if (!this.replayMode) return;
        for (const step of this.randyPath) {
            this.drawMarker(ctx, step.position, 'rgba(60,120,255,0.58)', `R${step.turn}`, 0.13);
        }
        if (this.randyEchoPos) {
            this.drawMarker(ctx, this.randyEchoPos, 'rgba(50,170,255,0.85)', 'R');
        }
    }
}

export class TimelineBarOverlay extends eskv.Widget {
    replayMode = false;
    timelineTurn = 1;
    /** @type {number[]} */
    obligationTurns = [];
    constructor(props={}) {
        super();
        if (props) this.updateProperties(props);
    }
    update(app, millis) {
        super.update(app, millis);
        const map = this.parent;
        const scroller = map?.parent;
        if (!(scroller instanceof eskv.ScrollView)) return;
        const viewportW = Math.max(2, Math.ceil(scroller.w / scroller.zoom));
        const viewportH = Math.max(2, Math.ceil(scroller.h / scroller.zoom));
        const barH = 1.35;
        this.x = Math.floor(scroller._scrollX);
        this.y = Math.floor(scroller._scrollY + viewportH - barH);
        this.w = viewportW;
        this.h = barH;
    }
    /**
     * @param {number} turn
     * @param {number} left
     * @param {number} right
     * @param {number} maxTurn
     */
    turnToX(turn, left, right, maxTurn) {
        if (maxTurn <= 1) return left;
        const clampedTurn = Math.max(1, Math.min(maxTurn, turn));
        return left + (right - left) * ((clampedTurn - 1) / (maxTurn - 1));
    }
    draw(app, ctx) {
        if (!this.replayMode) return;
        const left = this.x + 0.35;
        const right = this.x + Math.max(0.35, this.w - 0.35);
        const top = this.y + 0.1;
        const baseline = this.y + this.h * 0.72;
        const oldFill = ctx.fillStyle;
        const oldStroke = ctx.strokeStyle;
        const oldLineWidth = ctx.lineWidth;
        const oldFont = ctx.font;

        ctx.fillStyle = 'rgba(20,20,30,0.78)';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.04;
        ctx.strokeRect(this.x, this.y, this.w, this.h);

        const turns = [...new Set(this.obligationTurns.filter((turn) => Number.isFinite(turn) && turn > 0))]
            .map((turn) => Math.floor(turn))
            .sort((a, b) => a - b);
        const maxTurn = Math.max(1, this.timelineTurn, ...turns);

        ctx.beginPath();
        ctx.moveTo(left, baseline);
        ctx.lineTo(right, baseline);
        ctx.strokeStyle = 'rgba(210,210,220,0.55)';
        ctx.lineWidth = 0.06;
        ctx.stroke();

        ctx.font = '0.34px monospace';
        for (const turn of turns) {
            const tx = this.turnToX(turn, left, right, maxTurn);
            ctx.beginPath();
            ctx.moveTo(tx, baseline - 0.24);
            ctx.lineTo(tx, baseline + 0.2);
            ctx.strokeStyle = 'rgba(255,165,0,0.95)';
            ctx.lineWidth = 0.06;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,185,80,0.98)';
            ctx.fillText(`O${turn}`, tx - 0.24, top + 0.35);
        }

        const currentX = this.turnToX(this.timelineTurn, left, right, maxTurn);
        ctx.beginPath();
        ctx.moveTo(currentX, baseline - 0.3);
        ctx.lineTo(currentX, baseline + 0.24);
        ctx.strokeStyle = 'rgba(70,220,255,0.98)';
        ctx.lineWidth = 0.08;
        ctx.stroke();
        ctx.fillStyle = 'rgba(180,245,255,0.98)';
        ctx.fillText(`T${this.timelineTurn}`, currentX - 0.26, top + 0.05);

        ctx.fillStyle = oldFill;
        ctx.strokeStyle = oldStroke;
        ctx.lineWidth = oldLineWidth;
        ctx.font = oldFont;
    }
}

export class PatrolRouteOverlay extends eskv.Widget {
    /** @type {boolean} */
    showRoutes = false;
    /** @type {{id:string, role:'guard'|'scientist', points: Vec2[]}[]} */
    routes = [];
    constructor(props = {}) {
        super();
        if (props) this.updateProperties(props);
    }
    update(app, millis) {
        super.update(app, millis);
        const map = this.parent;
        if (!(map instanceof eskv.Widget)) return;
        this.x = 0;
        this.y = 0;
        this.w = map.w;
        this.h = map.h;
    }
    /**
     * @param {string} id
     * @returns {string}
     */
    compactNpcLabel(id) {
        if (id.startsWith('guard')) return `G${id.slice(5)}`;
        if (id.startsWith('scientist')) return `S${id.slice(9)}`;
        return id;
    }
    draw(app, ctx) {
        if (!this.showRoutes || this.routes.length === 0) return;
        const oldFill = ctx.fillStyle;
        const oldStroke = ctx.strokeStyle;
        const oldLineWidth = ctx.lineWidth;
        const oldFont = ctx.font;
        const oldDash = ctx.getLineDash();
        for (const route of this.routes) {
            if (route.points.length === 0) continue;
            const isGuard = route.role === 'guard';
            const routeStroke = isGuard ? 'rgba(255,180,78,0.76)' : 'rgba(84,220,255,0.76)';
            const routeNode = isGuard ? 'rgba(255,215,145,0.9)' : 'rgba(174,242,255,0.9)';
            if (route.points.length > 1) {
                ctx.beginPath();
                for (let i = 0; i < route.points.length; i++) {
                    const point = route.points[i];
                    const px = point[0] + 0.5;
                    const py = point[1] + 0.5;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.setLineDash(isGuard ? [] : [0.15, 0.1]);
                ctx.strokeStyle = routeStroke;
                ctx.lineWidth = isGuard ? 0.09 : 0.07;
                ctx.stroke();
            }
            ctx.setLineDash([]);
            for (let i = 0; i < route.points.length; i++) {
                const point = route.points[i];
                const px = point[0] + 0.5;
                const py = point[1] + 0.5;
                ctx.beginPath();
                ctx.fillStyle = i === 0 ? routeStroke : routeNode;
                ctx.arc(px, py, i === 0 ? 0.13 : 0.08, 0, Math.PI * 2);
                ctx.fill();
            }
            const origin = route.points[0];
            ctx.fillStyle = routeNode;
            ctx.font = '0.2px monospace';
            ctx.fillText(this.compactNpcLabel(route.id), origin[0] + 0.62, origin[1] + 0.38);
        }
        ctx.fillStyle = oldFill;
        ctx.strokeStyle = oldStroke;
        ctx.lineWidth = oldLineWidth;
        ctx.font = oldFont;
        ctx.setLineDash(oldDash);
    }
}

export class AttackMapOverlay extends eskv.Widget {
    /** @type {{from: Vec2, to: Vec2, hit: boolean, attackerId: string, targetId: string, ttl: number}[]} */
    attackEvents = [];
    constructor(props={}) {
        super();
        if (props) this.updateProperties(props);
    }
    update(app, millis) {
        super.update(app, millis);
        const map = this.parent;
        if (!(map instanceof eskv.Widget)) return;
        this.x = 0;
        this.y = 0;
        this.w = map.w;
        this.h = map.h;
    }
    /**
     * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx
     * @param {Vec2} pos
     * @param {string} color
     * @param {string} label
     */
    drawPoint(ctx, pos, color, label) {
        const cx = pos[0] + 0.5;
        const cy = pos[1] + 0.5;
        const oldFill = ctx.fillStyle;
        const oldStroke = ctx.strokeStyle;
        const oldFont = ctx.font;
        const oldLineWidth = ctx.lineWidth;
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 0.07;
        ctx.arc(cx, cy, 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = '0.34px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillText(label, cx + 0.2, cy - 0.22);
        ctx.fillStyle = oldFill;
        ctx.strokeStyle = oldStroke;
        ctx.font = oldFont;
        ctx.lineWidth = oldLineWidth;
    }
    draw(app, ctx) {
        if (this.attackEvents.length === 0) return;
        const oldStroke = ctx.strokeStyle;
        const oldLineWidth = ctx.lineWidth;
        for (const attack of this.attackEvents) {
            const ax = attack.from[0] + 0.5;
            const ay = attack.from[1] + 0.5;
            const tx = attack.to[0] + 0.5;
            const ty = attack.to[1] + 0.5;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(tx, ty);
            ctx.strokeStyle = attack.hit ? 'rgba(255,80,80,0.95)' : 'rgba(255,220,120,0.86)';
            ctx.lineWidth = 0.06;
            ctx.stroke();
            this.drawPoint(ctx, attack.from, 'rgba(255,90,90,0.9)', attack.hit ? 'FIRE!' : 'SHOT');
            this.drawPoint(ctx, attack.to, attack.hit ? 'rgba(255,50,50,0.92)' : 'rgba(255,205,110,0.9)', attack.hit ? 'HIT' : 'MISS');
        }
        ctx.strokeStyle = oldStroke;
        ctx.lineWidth = oldLineWidth;
    }
}

export class IntentGlyphOverlay extends eskv.Widget {
    /** @type {{id:string, position: Vec2, kind: 'attack'|'advance'|'search'|'patrol'|'post'|'passive'|'flee'|'comply'|'arrested'|'down'|'dead', label:string, color:string}[]} */
    enemyIntents = [];
    constructor(props={}) {
        super();
        if (props) this.updateProperties(props);
    }
    update(app, millis) {
        super.update(app, millis);
        const map = this.parent;
        if (!(map instanceof eskv.Widget)) return;
        this.x = 0;
        this.y = 0;
        this.w = map.w;
        this.h = map.h;
    }
    /**
     * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx
     * @param {number} cx
     * @param {number} cy
     * @param {'attack'|'advance'|'search'|'patrol'|'post'|'passive'|'flee'|'comply'|'arrested'|'down'|'dead'} kind
     * @param {string} color
     */
    drawSymbol(ctx, cx, cy, kind, color) {
        const oldFill = ctx.fillStyle;
        const oldStroke = ctx.strokeStyle;
        const oldLineWidth = ctx.lineWidth;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 0.06;
        if (kind === 'attack') {
            ctx.beginPath();
            ctx.arc(cx, cy, 0.16, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 0.24, cy);
            ctx.lineTo(cx - 0.1, cy);
            ctx.moveTo(cx + 0.1, cy);
            ctx.lineTo(cx + 0.24, cy);
            ctx.moveTo(cx, cy - 0.24);
            ctx.lineTo(cx, cy - 0.1);
            ctx.moveTo(cx, cy + 0.1);
            ctx.lineTo(cx, cy + 0.24);
            ctx.stroke();
        } else if (kind === 'advance') {
            ctx.beginPath();
            ctx.moveTo(cx - 0.2, cy - 0.14);
            ctx.lineTo(cx - 0.02, cy);
            ctx.lineTo(cx - 0.2, cy + 0.14);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx + 0.02, cy - 0.14);
            ctx.lineTo(cx + 0.2, cy);
            ctx.lineTo(cx + 0.02, cy + 0.14);
            ctx.stroke();
        } else if (kind === 'search') {
            ctx.beginPath();
            ctx.arc(cx - 0.05, cy - 0.02, 0.12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx + 0.03, cy + 0.06);
            ctx.lineTo(cx + 0.2, cy + 0.2);
            ctx.stroke();
        } else if (kind === 'patrol') {
            ctx.beginPath();
            ctx.arc(cx - 0.12, cy, 0.05, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 0.02, cy - 0.06, 0.05, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 0.16, cy + 0.02, 0.05, 0, Math.PI * 2);
            ctx.fill();
        } else if (kind === 'post') {
            ctx.beginPath();
            ctx.rect(cx - 0.15, cy - 0.15, 0.3, 0.3);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, 0.05, 0, Math.PI * 2);
            ctx.fill();
        } else if (kind === 'passive') {
            ctx.beginPath();
            ctx.arc(cx - 0.06, cy - 0.03, 0.08, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 0.14, cy + 0.12);
            ctx.lineTo(cx + 0.14, cy + 0.12);
            ctx.stroke();
        } else if (kind === 'flee') {
            ctx.beginPath();
            ctx.moveTo(cx + 0.18, cy - 0.14);
            ctx.lineTo(cx + 0.02, cy);
            ctx.lineTo(cx + 0.18, cy + 0.14);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 0.02, cy - 0.14);
            ctx.lineTo(cx - 0.18, cy);
            ctx.lineTo(cx - 0.02, cy + 0.14);
            ctx.stroke();
        } else if (kind === 'comply') {
            ctx.beginPath();
            ctx.moveTo(cx - 0.16, cy + 0.15);
            ctx.lineTo(cx - 0.06, cy - 0.18);
            ctx.lineTo(cx + 0.03, cy + 0.02);
            ctx.lineTo(cx + 0.14, cy - 0.18);
            ctx.lineTo(cx + 0.2, cy + 0.15);
            ctx.stroke();
        } else if (kind === 'arrested') {
            ctx.beginPath();
            ctx.arc(cx - 0.1, cy, 0.08, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx + 0.1, cy, 0.08, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 0.02, cy - 0.05);
            ctx.lineTo(cx + 0.02, cy + 0.05);
            ctx.stroke();
        } else if (kind === 'down') {
            ctx.beginPath();
            ctx.moveTo(cx - 0.2, cy - 0.12);
            ctx.lineTo(cx, cy + 0.16);
            ctx.lineTo(cx + 0.2, cy - 0.12);
            ctx.stroke();
        } else if (kind === 'dead') {
            ctx.beginPath();
            ctx.moveTo(cx - 0.18, cy - 0.16);
            ctx.lineTo(cx + 0.18, cy + 0.16);
            ctx.moveTo(cx + 0.18, cy - 0.16);
            ctx.lineTo(cx - 0.18, cy + 0.16);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 0.13, cy + 0.19);
            ctx.lineTo(cx + 0.13, cy + 0.19);
            ctx.stroke();
        }
        ctx.fillStyle = oldFill;
        ctx.strokeStyle = oldStroke;
        ctx.lineWidth = oldLineWidth;
    }
    draw(app, ctx) {
        if (this.enemyIntents.length === 0) return;
        const oldFill = ctx.fillStyle;
        const oldStroke = ctx.strokeStyle;
        const oldLineWidth = ctx.lineWidth;
        const oldFont = ctx.font;
        for (const intent of this.enemyIntents) {
            const x = intent.position[0] + 0.5;
            const y = intent.position[1] - 0.08;
            ctx.fillStyle = 'rgba(10,10,15,0.78)';
            ctx.strokeStyle = 'rgba(255,255,255,0.26)';
            ctx.lineWidth = 0.05;
            ctx.fillRect(x - 0.54, y - 0.42, 1.08, 0.4);
            ctx.strokeRect(x - 0.54, y - 0.42, 1.08, 0.4);
            this.drawSymbol(ctx, x - 0.26, y - 0.21, intent.kind, intent.color);
            ctx.font = '0.22px monospace';
            ctx.fillStyle = 'rgba(235,235,245,0.95)';
            ctx.fillText(intent.label, x - 0.08, y - 0.12);
        }
        ctx.fillStyle = oldFill;
        ctx.strokeStyle = oldStroke;
        ctx.lineWidth = oldLineWidth;
        ctx.font = oldFont;
    }
}

export class MissionMap extends eskv.Widget {
    rng = new eskv.rand.PRNG_mulberry32(); // PRNG_sfc32 in current ESKV mixes BigInt/number during seed()
    /** @type {number} */
    runtimeRandomSeed = 0;
    /** @type {Map<string, import('eskv/lib/eskv.js').rand.PRNG>} */
    runtimeRandomStreams = new Map();
    clipRegion = new Rect();
    tileMap = LayeredTileMap.a();
    metaTileMap = LayeredTileMap.a();
    /**@type {Character[]} */
    enemies = [
        Character.a({id:'guard1'}),
        Character.a({id:'guard2'}),
        Character.a({id:'guard3'}),
        Character.a({id:'guard4'}),
        Character.a({id:'guard5'}),
        Character.a({id:'guard6'}),
        Character.a({id:'scientist1'}),
        Character.a({id:'scientist2'}),
        Character.a({id:'scientist3'}),
        Character.a({id:'scientist4'}),
    ];
    entities = eskv.Widget.a({hints:{h:1, w:1}});
    /**@type {PlayerCharacter[]} */
    playerCharacters = [
        PlayerCharacter.a({id:'randy', x:0,y:0, activeCharacter:true}),
        PlayerCharacter.a({id:'maria', activeCharacter:false})
    ];
    /** @type {{position: Vec2, radius: number, ttl: number, source: string}[]} */
    soundEvents = [];
    /** @type {{position: Vec2, radius: number, ttl: number, source: string}[]} */
    decoyEvents = [];
    /** @type {{position: Vec2, maxRange: number, ttl: number, ageTurns: number, spreadPerTurn: number, source: string}[]} */
    smokeClouds = [];
    /** @type {Set<string>} */
    smokeOccupiedKeys = new Set();
    /** @type {{position: Vec2, ttlTurns: number, source: string, kind: 'breach'}[]} */
    timedCharges = [];
    /** @type {{source: string, doorPos: Vec2, sensorPos: Vec2, radius: number}[]} */
    fiberCameras = [];
    /** @type {Set<string>} */
    activeDirectVisibleKeys = new Set();
    /** @type {{from: Vec2, to: Vec2, hit: boolean, attackerId: string, targetId: string, ttl: number}[]} */
    attackEvents = [];
    characters = [...this.enemies, ...this.playerCharacters]
    /**@type {Character|null} */
    activeCharacter = this.playerCharacters[0];
    /**@type {SpriteSheet|null} */
    spriteSheet = null;
    obligationOverlay = ObligationMapOverlay.a();
    patrolOverlay = PatrolRouteOverlay.a();
    intentOverlay = IntentGlyphOverlay.a();
    attackOverlay = AttackMapOverlay.a();
    timelineOverlay = TimelineBarOverlay.a();
    constructor(props=null) {
        super();
        this.positionSelector = PositionSelector.a()
        this.children = [this.tileMap, this.entities, this.positionSelector, ...this.enemies, ...this.playerCharacters, this.obligationOverlay, this.patrolOverlay, this.intentOverlay, this.attackOverlay, this.timelineOverlay];
        // this.rng.seed(100);
        if(props) this.updateProperties(props);
    }
    /**
     * @param {number} seed
     */
    setupLevel(seed) {
        this.rng.seed(seed);
        this.runtimeRandomSeed = seed >>> 0;
        this.runtimeRandomStreams.clear();
        this.entities.children = [];
        this.soundEvents = [];
        this.decoyEvents = [];
        this.smokeClouds = [];
        this.smokeOccupiedKeys.clear();
        this.timedCharges = [];
        this.fiberCameras = [];
        this.activeDirectVisibleKeys.clear();
        this.attackEvents = [];
        generateMansionMap(this, this.rng);
        this.playerCharacters[0].setupForLevelStart(this);
        this.playerCharacters[1].setupForLevelStart(this);
        this.enemies.forEach(e=>e.setupForLevelStart(this, this.rng));
    }

    /**
     * @param {string} key
     * @returns {number}
     */
    sampleRuntimeRandom(key) {
        let stream = this.runtimeRandomStreams.get(key);
        if (!stream) {
            let hash = 2166136261 >>> 0;
            for (let i = 0; i < key.length; i++) {
                hash ^= key.charCodeAt(i);
                hash = Math.imul(hash, 16777619) >>> 0;
            }
            const mixedSeed = (this.runtimeRandomSeed ^ hash ^ 0x9e3779b9) >>> 0;
            stream = new eskv.rand.PRNG_mulberry32();
            stream.seed(mixedSeed);
            this.runtimeRandomStreams.set(key, stream);
        }
        return stream.random();
    }
    on_spriteSheet() {
        this.tileMap.spriteSheet = this.spriteSheet;
        // this.setupLevel();
    }
    on_parent(e,o,v) {
        const scroller = v;
        if(!(scroller instanceof eskv.ScrollView)) return;
        scroller.listen('scrollX', ()=>this.updateClipRegion(scroller));
        scroller.listen('scrollY', ()=>this.updateClipRegion(scroller));
        scroller.listen('zoom', ()=>this.updateClipRegion(scroller));
        this.updateClipRegion(scroller);
    }
    /**
     * Keep tile clipping synced with scroll view size/position.
     * Parent attachment can occur before final layout, so a one-time clip calc can be stale.
     */
    update(app, millis) {
        super.update(app, millis);
        const scroller = this.parent;
        if(scroller instanceof eskv.ScrollView) {
            this.updateClipRegion(scroller);
        }
        this.attackOverlay.attackEvents = this.attackEvents.map((event) => ({
            from: eskv.v2(event.from),
            to: eskv.v2(event.to),
            hit: event.hit,
            attackerId: event.attackerId,
            targetId: event.targetId,
            ttl: event.ttl,
        }));
    }
    /**
     * 
     * @param {Vec2} pos 
     */
    updateTileInfo(pos) {
        const layout = this.metaTileMap.layer[MetaLayers.layout].get(pos);
        const mmap = this.metaTileMap
        mmap.activeLayer = MetaLayers.layout;
        const tmap = this.tileMap;
        tmap.activeLayer = 0;
        if(layout in MansionTileIndexes) {
            tmap.set(pos, MansionTileIndexes[layout]);
            tmap.clearCache();
        } else {
            MansionAutotiles.wall.autoTile(pos, mmap, tmap);
            MansionAutotiles.doorway.autoTile(pos, mmap, tmap);
            MansionAutotiles.window.autoTile(pos, mmap, tmap);
            MansionAutotiles.brokenWindow.autoTile(pos, mmap, tmap);
        }
        //TODO: Read this sight+traversal info from a dictionary of sight/traversal values
        let traversible = layout===LayoutTiles.wall||layout===LayoutTiles.window?0:0b1111;
        for(let e of this.entities.children) {
            if(e instanceof Entity && e.pos.equals(pos)) traversible &= e.traversible;
        }
        this.metaTileMap.setInLayer(MetaLayers.traversible, pos, traversible);
        let sight = (layout===LayoutTiles.wall?0:0b1111); //see through if not a wall
        for(let e of this.entities.children) {
            if(e instanceof Entity && e.pos.equals(pos)) sight &= e.allowsSight;
        }
        this.metaTileMap.setInLayer(MetaLayers.allowsSight, pos, sight);
        this.recomputeSmokeCoverage();
        
    }
    updateClipRegion(scroller) {
        const pad = 2;
        const viewportW = Math.ceil(scroller.w / scroller.zoom);
        const viewportH = Math.ceil(scroller.h / scroller.zoom);
        this.tileMap.clipRegion = new Rect([
            Math.floor(scroller._scrollX) - pad,
            Math.floor(scroller._scrollY) - pad,
            viewportW + pad * 2 + 1,
            viewportH + pad * 2 + 1,
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

    captureActiveDirectVisibility() {
        const visibleLayer = this.metaTileMap.layer[MetaLayers.visible];
        this.activeDirectVisibleKeys.clear();
        if (!visibleLayer) return;
        for (const rawPos of visibleLayer.iterAll()) {
            const pos = eskv.v2(rawPos);
            if (visibleLayer.get(pos) > 0) {
                this.activeDirectVisibleKeys.add(`${pos[0]},${pos[1]}`);
            }
        }
    }

    /**
     * @param {import('eskv/lib/eskv.js').VecLike} pos
     * @returns {boolean}
     */
    canActivePlayerDirectlySee(pos) {
        const x = Math.floor(pos[0]);
        const y = Math.floor(pos[1]);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
        return this.activeDirectVisibleKeys.has(`${x},${y}`);
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

    /**
     * @param {Vec2} position
     * @param {number} radius
     * @param {string} source
     * @param {number=} ttl
     */
    emitSound(position, radius, source, ttl = 1) {
        this.soundEvents.push({ position: position.add([0, 0]), radius, ttl, source });
    }

    /**
     * @param {Vec2} position
     * @param {string} source
     * @param {boolean=} silenced
     * @param {number=} ttl
     */
    emitGunfire(position, source, silenced = false, ttl = 1) {
        const radius = silenced ? 5 : Math.max(this.w, this.h) * 2;
        this.emitSound(position, radius, silenced ? `${source}:silenced` : `${source}:gunfire`, ttl);
    }

    /**
     * @param {Vec2} position
     * @param {number} radius
     * @param {string} source
     * @param {number=} ttl
     */
    emitDecoy(position, radius, source, ttl = 2) {
        this.decoyEvents.push({ position: position.add([0, 0]), radius, ttl, source });
    }

    /**
     * @param {Vec2} position
     * @param {number} radius
     * @param {string} source
     * @param {number=} ttl
     */
    emitSmoke(position, radius, source, ttl = 3) {
        const maxRange = Math.max(1, Math.floor(radius));
        const spreadTurns = 3;
        const spreadPerTurn = Math.max(1, Math.ceil((maxRange - 1) / Math.max(1, spreadTurns - 1)));
        this.smokeClouds.push({
            position: position.add([0, 0]),
            maxRange,
            ttl,
            ageTurns: 0,
            spreadPerTurn,
            source,
        });
        this.recomputeSmokeCoverage();
    }

    /**
     * @param {import('eskv/lib/eskv.js').VecLike} position
     * @param {string} source
     * @param {number=} delayTurns
     * @returns {boolean}
     */
    armTimedBreachCharge(position, source, delayTurns = 2) {
        const pos = eskv.v2([Math.floor(position[0]), Math.floor(position[1])]);
        if (pos[0] < 0 || pos[1] < 0 || pos[0] >= this.w || pos[1] >= this.h) return false;
        this.timedCharges = this.timedCharges.filter((charge) => !charge.position.equals(pos));
        this.timedCharges.push({
            position: pos.add([0, 0]),
            ttlTurns: Math.max(1, Math.floor(delayTurns)),
            source,
            kind: 'breach',
        });
        return true;
    }

    /**
     * Advance turn-based hazards once per full turn.
     * @returns {{position: Vec2, source: string, kind: 'breach'}[]}
     */
    advanceTurnHazards() {
        /** @type {{position: Vec2, source: string, kind: 'breach'}[]} */
        const detonations = [];
        const nextCharges = [];
        for (const charge of this.timedCharges) {
            const ttl = charge.ttlTurns - 1;
            if (ttl <= 0) {
                detonations.push({
                    position: charge.position.add([0, 0]),
                    source: charge.source,
                    kind: charge.kind,
                });
                continue;
            }
            nextCharges.push({
                position: charge.position.add([0, 0]),
                ttlTurns: ttl,
                source: charge.source,
                kind: charge.kind,
            });
        }
        this.timedCharges = nextCharges;
        this.smokeClouds = this.smokeClouds
            .map((cloud) => ({ ...cloud, ttl: cloud.ttl - 1, ageTurns: cloud.ageTurns + 1 }))
            .filter((cloud) => cloud.ttl > 0);
        this.recomputeSmokeCoverage();
        return detonations;
    }

    /**
     * @param {import('eskv/lib/eskv.js').VecLike} pos
     * @returns {boolean}
     */
    isSmokeAt(pos) {
        const p = eskv.v2([Math.floor(pos[0]), Math.floor(pos[1])]);
        return this.smokeOccupiedKeys.has(`${p[0]},${p[1]}`);
    }

    /**
     * @param {import('eskv/lib/eskv.js').VecLike} pos
     * @returns {DoorWidget|null}
     */
    getDoorEntityAt(pos) {
        for (const entity of this.entities.children) {
            if (entity instanceof DoorWidget && entity.pos.equals(pos)) return entity;
        }
        return null;
    }

    /**
     * @param {import('eskv/lib/eskv.js').VecLike} pos
     * @returns {boolean}
     */
    canSmokeOccupyCell(pos) {
        const x = Math.floor(pos[0]);
        const y = Math.floor(pos[1]);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
        const layout = this.metaTileMap.layer[MetaLayers.layout];
        const tile = layout.get([x, y]);
        if (tile === LayoutTiles.wall || tile === LayoutTiles.window || tile === LayoutTiles.coveredWindow) {
            return false;
        }
        const door = this.getDoorEntityAt([x, y]);
        if (door && door.state === 'closed') return false;
        return true;
    }

    recomputeSmokeCoverage() {
        this.smokeOccupiedKeys.clear();
        if (this.smokeClouds.length === 0) return;
        const dirs = [FacingVec[0], FacingVec[1], FacingVec[2], FacingVec[3]];
        for (const cloud of this.smokeClouds) {
            const origin = eskv.v2([Math.floor(cloud.position[0]), Math.floor(cloud.position[1])]);
            if (!this.canSmokeOccupyCell(origin)) continue;
            const spreadRange = Math.min(cloud.maxRange, 1 + cloud.ageTurns * cloud.spreadPerTurn);
            const visited = new Set([`${origin[0]},${origin[1]}`]);
            /** @type {{pos: Vec2, dist:number}[]} */
            const queue = [{ pos: origin, dist: 0 }];
            let head = 0;
            while (head < queue.length) {
                const item = queue[head++];
                const pos = item.pos;
                const dist = item.dist;
                this.smokeOccupiedKeys.add(`${pos[0]},${pos[1]}`);
                if (dist >= spreadRange) continue;
                for (const dir of dirs) {
                    const npos = pos.add(dir);
                    const key = `${npos[0]},${npos[1]}`;
                    if (visited.has(key)) continue;
                    if (!this.canSmokeOccupyCell(npos)) continue;
                    visited.add(key);
                    queue.push({ pos: npos, dist: dist + 1 });
                }
            }
        }
    }

    /**
     * Deploy a persistent fiber camera feed under a door.
     * @param {string} source
     * @param {import('eskv/lib/eskv.js').VecLike} observerPos
     * @param {import('eskv/lib/eskv.js').VecLike} doorPos
     * @param {number=} radius
     * @returns {{source: string, doorPos: Vec2, sensorPos: Vec2, radius: number} | null}
     */
    deployFiberCamera(source, observerPos, doorPos, radius = 7) {
        const door = eskv.v2([Math.floor(doorPos[0]), Math.floor(doorPos[1])]);
        const observer = eskv.v2([Math.floor(observerPos[0]), Math.floor(observerPos[1])]);
        const delta = door.sub(observer);
        /** @type {Vec2[]} */
        const candidateSteps = [];
        if (Math.abs(delta[0]) >= Math.abs(delta[1])) {
            const sx = Math.sign(delta[0]);
            if (sx !== 0) candidateSteps.push(eskv.v2([sx, 0]));
        }
        if (Math.abs(delta[1]) >= Math.abs(delta[0])) {
            const sy = Math.sign(delta[1]);
            if (sy !== 0) candidateSteps.push(eskv.v2([0, sy]));
        }
        for (const step of [FacingVec[0], FacingVec[1], FacingVec[2], FacingVec[3]]) {
            const candidate = eskv.v2(step);
            if (!candidateSteps.some((s) => s.equals(candidate))) {
                candidateSteps.push(candidate);
            }
        }
        /** @type {Vec2[]} */
        const candidates = [];
        for (const step of candidateSteps) {
            candidates.push(door.add(step));
            candidates.push(door.sub(step));
        }
        let sensorPos = null;
        for (const candidate of candidates) {
            const x = candidate[0];
            const y = candidate[1];
            if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
            const traversible = this.metaTileMap.getFromLayer(MetaLayers.traversible, candidate);
            if (typeof traversible !== 'number' || traversible <= 0) continue;
            sensorPos = candidate.add([0, 0]);
            break;
        }
        if (!sensorPos) return null;
        this.fiberCameras = this.fiberCameras.filter((camera) => !camera.doorPos.equals(door));
        const camera = {
            source,
            doorPos: door.add([0, 0]),
            sensorPos: sensorPos.add([0, 0]),
            radius,
        };
        this.fiberCameras.push(camera);
        return camera;
    }

    /**
     * @param {Vec2} from
     * @param {Vec2} to
     * @param {boolean} hit
     * @param {string} attackerId
     * @param {string} targetId
     * @param {number=} ttl
     */
    emitAttack(from, to, hit, attackerId, targetId, ttl = 1) {
        this.attackEvents.push({
            from: from.add([0, 0]),
            to: to.add([0, 0]),
            hit,
            attackerId,
            targetId,
            ttl,
        });
    }

    /**
     * @param {{
     *   replayMode: boolean,
     *   timelineTurn: number,
     *   obligationTurns: number[],
     *   randyEchoPos: import('eskv/lib/eskv.js').VecLike|null,
     *   randyPath: {turn:number, position:import('eskv/lib/eskv.js').VecLike}[],
     *   obligationObjectives: {turn:number, position:import('eskv/lib/eskv.js').VecLike, label:string, color?:string}[],
     *   showPatrolRoutes: boolean,
     *   patrolRoutes: {id:string, role:'guard'|'scientist', points:import('eskv/lib/eskv.js').VecLike[]}[],
     *   enemyIntents: {id:string, position:import('eskv/lib/eskv.js').VecLike, kind:'attack'|'advance'|'search'|'patrol'|'post'|'passive'|'flee'|'comply'|'arrested'|'down'|'dead', label:string, color:string}[],
     * }} value
     */
    setObligationOverlayData(value) {
        this.obligationOverlay.replayMode = value.replayMode;
        this.obligationOverlay.randyEchoPos = value.randyEchoPos ? eskv.v2(value.randyEchoPos) : null;
        this.obligationOverlay.randyPath = value.randyPath.map((step) => ({
            turn: step.turn,
            position: eskv.v2(step.position),
        }));
        this.obligationOverlay.objectivePositions = value.obligationObjectives.map((objective)=>({
            turn: objective.turn,
            position: eskv.v2(objective.position),
            label: objective.label,
            color: objective.color,
        }));
        this.timelineOverlay.replayMode = value.replayMode;
        this.timelineOverlay.timelineTurn = value.timelineTurn;
        this.timelineOverlay.obligationTurns = value.obligationTurns.slice();
        this.patrolOverlay.showRoutes = value.showPatrolRoutes;
        this.patrolOverlay.routes = value.patrolRoutes.map((route) => ({
            id: route.id,
            role: route.role,
            points: route.points.map((point) => eskv.v2(point)),
        }));
        this.intentOverlay.enemyIntents = value.enemyIntents.map((intent) => ({
            id: intent.id,
            position: eskv.v2(intent.position),
            kind: intent.kind,
            label: intent.label,
            color: intent.color,
        }));
        this.attackOverlay.attackEvents = this.attackEvents.map((event) => ({
            from: eskv.v2(event.from),
            to: eskv.v2(event.to),
            hit: event.hit,
            attackerId: event.attackerId,
            targetId: event.targetId,
            ttl: event.ttl,
        }));
    }


}
