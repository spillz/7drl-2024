//@ts-check
import * as eskv from "../eskv/lib/eskv.js";
import { parse } from "../eskv/lib/modules/markup.js";
import { MissionMap } from "./map.js";
import { Character} from "./character.js";
import { Facing } from "./facing.js";

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
                hints: {w: '4'}
                on_press:
                    const scroller = window.app.findById('scroller');
                    if(!scroller) return;
                    const zoom = Math.floor(scroller.zoom + 1);
                    scroller.zoom = zoom<4? zoom:0.5;
                    this.text = String(scroller.zoom*100)+'%';
        ScrollView:
            id: 'scroller'
            uiZoom: false
            MissionMap:
                id: 'MissionMap'
                hints: {w:null, h:null}
                w: 80
                h: 40
                spriteSheet: resources['sprites']
`;

class FPS extends eskv.Label {
    _counter = 0;
    _frames = 0;
    _worst = 300;
    /**@type {eskv.Label['update']} */
    update(app, millis) {
        super.update(app, millis);
        this._counter+=millis;
        this._frames += 1;
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
        Game.resources['sprites'] = new eskv.sprites.SpriteSheet('/images/spritesheet.png', 16);
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
        }
        if(ip.isKeyDown('a')) {
            char.move(Facing.west, mmap);
        }
        if(ip.isKeyDown('s')) {
            char.move(Facing.south, mmap);
        }
        if(ip.isKeyDown('d')) {
            char.move(Facing.east, mmap);
        }
    }
}

Game.registerClass('FPS', FPS, 'Label');
Game.registerClass('Game', Game, 'App');
Game.registerClass('MissionMap', MissionMap, 'Widget');

const result = parse(markup);

//Start the app
Game.get().start();
