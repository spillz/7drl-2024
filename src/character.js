//@ts-check

import * as eskv from "../eskv/lib/eskv.js";
import { parse } from "../eskv/lib/modules/markup.js";
import { SpriteWidget } from "../eskv/lib/modules/sprites.js";
import { Action } from "./action.js";
import { Entity } from "./entity.js";



export class Character extends Entity {
    /**@type {Action[]} */
    actions = [];

}