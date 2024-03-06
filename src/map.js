//@ts-check

import * as eskv from "../eskv/lib/eskv.js";
import { parse } from "../eskv/lib/modules/markup.js";
import { LayeredTileMap } from "../eskv/lib/modules/sprites.js";
import { Character } from "./character.js";
import { NPC } from "./npc.js";

export const TileProp = {
    hidden: 0, //whether the characters have seen that part of the map
    traversible: 1, //direction of traversibility
    allowsSight: 2, //direction of sight
    allowsSound: 3,
    cover: 4, //direction that cover is provided from
    moveCost: 5,
}

export const LayoutTiles = {
    outside:0,
    floor:1,
    wall:2,
    doorway:3,
    window:4,
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
 * @param {MissionMap} map 
 */
function generateMansionMap(map) {
    const tdim = new eskv.Vec2([80, 50]);
    const tmap = map.tileMap;
    tmap.numLayers = 3;
    tmap.tileDim = tdim;
    tmap.activeLayer = 0;

    const mmap = map.metaTileMap;
    mmap.numLayers = 3;
    mmap.tileDim = tdim;
    mmap.activeLayer = 0; //Ground/flooring/wall layout layer
    for (const p of mmap.iterAll()) {
        mmap.set(p, LayoutTiles.outside);
    }

    const houseRect = new eskv.Rect([4,4,tdim[0]-8, tdim[1]-8]);
    


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

export class MissionMap extends eskv.Widget {
    tileMap = new LayeredTileMap();
    metaTileMap = new LayeredTileMap();
    /**@type {NPC[]} */
    enemies = [];
    /**@type {Character[]} */
    characters = [];
    constructor(props=null) {
        super();
        if(props) this.updateProperties(props);
    }

}