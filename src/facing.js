//@ts-check

import {Vec2, vec2, Rect} from '../eskv/lib/eskv.js';

/**@readonly @enum {number}*/
export const Facing = {
    north:0,
    east:1,
    south:2,
    west:3,
    none:4,
}

/**@readonly @enum {Vec2} */
export const FacingVec = {
    0: vec2(0,-1),
    1: vec2(1,0),
    2: vec2(0,1),
    3: vec2(-1,0),
    4: vec2(0,0),
}

/**@readonly @enum {number} */
export const binaryFacing = {
    0: 0b1,
    1: 0b10,
    2: 0b100,
    3: 0b1000,
    4: 0b0000,
}

/**
 * 
 * @param {Vec2} vec 
 * @returns 
 */
export function facingFromVec(vec) {
    if(vec[1]<0) return 0
    if(vec[0]>0) return 1
    if(vec[1]>0) return 2
    if(vec[0]<0) return 3
    return 4;
}

/**
 * 
 * @param {Facing[]} facings 
 */
export function packValidFacing(facings) {
    let packedVal = 0;
    for(let f of facings) {
        packedVal |= binaryFacing[f];
    }
    return packedVal;
}
