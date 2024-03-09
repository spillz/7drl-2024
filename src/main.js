//@ts-check

import * as eskv from "eskv";
import {parse} from "eskv/lib/modules/markup.js";
import { MissionMap } from "./map.js";
import { Character} from "./character.js";
import { Facing } from "./facing.js";

//@ts-ignore
import spriteUrl from '/images/spritesheet.png';
import { Action } from "./action.js";

//The markup specifies the overall UI layout in the App
const markup = `
Game:
    prefDimW: 20
    prefDimH: 20
    integerTileSize: true
    tileSize: 16
    BoxLayout:
        orientation: 'vertical'
        hints: {center_x:0.5, center_y:0.5, w:1, h:1}
        BoxLayout:
            hints: {h:'1'}
            orientation: 'horizontal'
            FPS:
                align:'left'
            Label:
                id: 'zoomButton'
                text: 'Welcome to the mansion'
                align: 'right'
            Button: 
                text: '100%'
                hints: {w: '3'}
                on_press:
                    const scroller = window.app.findById('scroller');
                    if(!scroller) return;
                    const zoom = Math.floor(scroller.zoom + 1);
                    scroller.zoom = zoom<4? zoom:0.5;
                    this.text = String(scroller.zoom*100)+'%';
        BoxLayout:
            orientation: 'horizontal'
            BoxLayout:
                orientation: 'vertical'
                hints: {w:'4'}
                Label:
                    text:\`Randy \${Randy.gpos}\`
                    hints: {h:'1'}
                    align: 'left'
                SpriteWidget:
                    spriteSheet: resources['sprites']
                    frames: [354]
                    hints: {w:'3', h:'3'}
                Label:
                    text:'1: Fire rifle'
                    hints: {h:'1'}
                    align: 'left'
                Action:
                    frames: [736]
                    labelText: 'Fire rifle'
                    spriteSheet: resources['sprites']
                    hints: {w:'3', h:'3'}
                Label:
                    text:'2: Set C4'
                    hints: {h:'1'}
                    align: 'left'
                Action:
                    frames: [739]
                    labelText: 'Set C4'
                    spriteSheet: resources['sprites']
                    hints: {w:'3', h:'3'}
                Label:
                    text:'3: Throw grenade'
                    hints: {h:'1'}
                    align: 'left'
                Action:
                    frames: [738]
                    labelText: 'Throw Grenade'
                    spriteSheet: resources['sprites']
                    hints: {w:'3', h:'3'}
                Label:
                    text:'4: Use halligan'
                    hints: {h:'1'}
                    align: 'left'
                Action:
                    frames: [740]
                    labelText: 'Use Halligan'
                    spriteSheet: resources['sprites']
                    hints: {w:'3', h:'3'}
            BoxLayout:
                hints: {w:'4', h:null}
                padding: '2'
                orientation: 'vertical'
                Widget:
                    id: 'padding2'
                Label:
                    text:\`Maria \${Maria.status}\`
                    wrap: true;
                    hints: {h:'1'}
                    align: 'right'
                SpriteWidget:
                    spriteSheet: resources['sprites']
                    frames: [450]
                    hints: {w:'3', h:'3'}
            ScrollView:
                id: 'scroller'
                uiZoom: false
                hints: {h:'20'}
                MissionMap:
                    id: 'MissionMap'
                    hints: {w:null, h:null}
                    spriteSheet: resources['sprites']
`;

class FPS extends eskv.Label {
    _counter = 0;
    _frames = 0;
    _worst = 300;
    _tref = Date.now()
    /**@type {eskv.Label['update']} */
    update(app, millis) {
        super.update(app, millis);
        const tref = Date.now()
        this._counter += tref - this._tref;
        this._frames += 1;
        this._tref= tref;
        const currentFPS = 1000/millis;
        if(currentFPS<this._worst) this._worst = currentFPS;
        if(this._counter>=1000) {
            this.text = `FPS: ${Math.round(this._frames/this._counter*1000)} (worst: ${Math.round(this._worst)})` 
            this._counter = 0;
            this._frames = 0;
            this._worst = 300;
        }
    }
}

class Game extends eskv.App {
    constructor(props={}) {
        super();
        Game.resources['sprites'] = new eskv.sprites.SpriteSheet(spriteUrl, 16);
        this.continuousFrameUpdates = true;
        if(props) this.updateProperties(props);
    }
    static get() {
        return /**@type {Game}*/(eskv.App.get());
    }
    on_key_down(e, o, v) {
        const ip = this.inputHandler;
        if(ip===undefined) return;
        const mmap = /**@type {MissionMap|null}*/(this.findById('MissionMap'))
        if(mmap===null) return;
        const char = /**@type {Character|null}*/(this.findById('Randy'));
        if(char===null) return;
        if(ip.isKeyDown('w')) {
            char.move(Facing.north, mmap);
        } else if(ip.isKeyDown('a')) {
            char.move(Facing.west, mmap);
        } else if(ip.isKeyDown('s')) {
            char.move(Facing.south, mmap);
        } else if(ip.isKeyDown('d')) {
            char.move(Facing.east, mmap);
        }
    }
}

Game.registerClass('Action', Action, 'Label');
Game.registerClass('FPS', FPS, 'Label');
Game.registerClass('Game', Game, 'App');
Game.registerClass('MissionMap', MissionMap, 'Widget');

const result = parse(markup);

//Start the app
Game.get().start();
