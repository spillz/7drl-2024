//@ts-check

import * as eskv from "../eskv/lib/eskv.js";
import {parse} from "../eskv/lib/modules/markup.js";
import { MissionMap } from "./map.js";
import { Character} from "./character.js";
import { Facing } from "./facing.js";
import { Action } from "./action.js";

//@ts-ignore
import spriteUrl from '/images/spritesheet.png';

//The markup specifies the overall UI layout of the App
const markup = `

Game:
    prefDimW: 20
    prefDimH: 21
    integerTileSize: true
    tileSize: 16
    Notebook:
        hints: {w:1, h:1}
        id: 'notebook'
        BoxLayout:
            id: 'game'
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
                    text: 'Help'
                    hints: {w: '3'}
                    on_press:
                        const help = window.app.findById('help');
                        help.helpVal = 0;
                        const nb = window.app.findById('notebook');
                        nb.activePage = 1;
                Button: 
                    text: '100%'
                    hints: {w: '3'}
                    id: 'zoomButton'
                    on_press:
                        const scroller = window.app.findById('scroller');
                        if(!scroller) return;
                        const zoom = Math.floor(scroller.zoom + 1);
                        scroller.zoom = zoom<4? zoom:0.5;
                        this.text = String(scroller.zoom*100)+'%';
            BoxLayout:
                bgColor: 'rgb(35,35,45)'
                orientation: 'horizontal'
                BoxLayout:
                    orientation: 'vertical'
                    hints: {w:'4'}
                    Label:
                        text:\`Randy \${Randy.gpos}\`
                        hints: {h:'1'}
                        sizeGroup: 'actionItems'
                        align: 'left'
                    SpriteWidget:
                        spriteSheet: resources['sprites']
                        frames: [354]
                        hints: {w:'3', h:'3'}
                    Label:
                        text:'1: Fire rifle'
                        hints: {h:'1'}
                        sizeGroup: 'actionItems'
                        align: 'left'
                    Action:
                        frames: [736]
                        labelText: 'Fire rifle'
                        spriteSheet: resources['sprites']
                        hints: {w:'3', h:'3'}
                    Label:
                        text:'2: Set C4'
                        hints: {h:'1'}
                        sizeGroup: 'actionItems'
                        align: 'left'
                    Action:
                        frames: [739]
                        labelText: 'Set C4'
                        spriteSheet: resources['sprites']
                        hints: {w:'3', h:'3'}
                    Label:
                        text:'3: Throw grenade'
                        hints: {h:'1'}
                        sizeGroup: 'actionItems'
                        align: 'left'
                    Action:
                        frames: [738]
                        labelText: 'Throw Grenade'
                        spriteSheet: resources['sprites']
                        hints: {w:'3', h:'3'}
                    Label:
                        text:'4: Use halligan'
                        hints: {h:'1'}
                        sizeGroup: 'actionItems'
                        align: 'left'
                    Action:
                        frames: [740]
                        labelText: 'Use Halligan'
                        spriteSheet: resources['sprites']
                        hints: {w:'3', h:'3'}
                    Widget:
                        id: 'padding2'
                BoxLayout:
                    hints: {w:'4', h:null}
                    padding: '2'
                    orientation: 'vertical'
                    Label:
                        text:'5: Fire phaser'
                        hints: {h:'1'}
                        sizeGroup: 'actionItems'
                        align: 'left'
                    Action:
                        frames: [737]
                        labelText: 'Fire phased'
                        spriteSheet: resources['sprites']
                        hints: {w:'3', h:'3'}
                    Label:
                        text:'6: Place endoscope'
                        hints: {h:'1'}
                        sizeGroup: 'actionItems'
                        align: 'left'
                    Action:
                        frames: [743]
                        labelText: 'Endoscope'
                        spriteSheet: resources['sprites']
                        hints: {w:'3', h:'3'}
                    Label:
                        text:'7: Use dusters'
                        hints: {h:'1'}
                        sizeGroup: 'actionItems'
                        align: 'left'
                    Action:
                        frames: [745]
                        labelText: 'Use knuckle dusters'
                        spriteSheet: resources['sprites']
                        sizeGroup: 'actionItems'
                        hints: {w:'3', h:'3'}
                    Label:
                        text:'8: Teleport'
                        hints: {h:'1'}
                        sizeGroup: 'actionItems'
                        align: 'left'
                    Action:
                        frames: [744]
                        labelText: 'Teleport'
                        spriteSheet: resources['sprites']
                        sizeGroup: 'actionItems'
                        hints: {w:'3', h:'3'}
                    Label:
                        text:\`Maria \${Maria.status}\`
                        wrap: true;
                        hints: {h:'1'}
                        sizeGroup: 'actionItems'
                        align: 'right'
                    SpriteWidget:
                        spriteSheet: resources['sprites']
                        frames: [450]
                        hints: {w:'3', h:'3'}
                    Widget:
                        id: 'padding2'
                ScrollView:
                    id: 'scroller'
                    uiZoom: false
                    hints: {h:'20'}
                    MissionMap:
                        id: 'MissionMap'
                        hints: {w:null, h:null}
                        spriteSheet: resources['sprites']
        BoxLayout:
            hints: {h:1, w:1}
            h:20
            w:20
            orientation:'vertical'
            bgColor: 'rgb(25,25,35)'
            id: 'help'
            paddingX: '1'
            paddingY: '1'
            helpVal: 0
            on_helpVal:
                this.parent._needsLayout=true;
                const helpHeader = window.app.findById('helpHeader');
                helpHeader.text = [
                    'Introduction',
                    'Agent Randy',
                    'Agent Maria',
                    'Director Stevens',
                    'Conrad Couli',
                    'Flint Ironsights',
                    'Mitch Crawford',
                    'Roland Kennedy',
                    'Irvina Schlitz',                            
                ][this.helpVal];
                const helpText = window.app.findById('helpText');
                helpText.text = [
                    'Intro: In the 22nd century, mankind has moved to the stars and conquered space. However, the realm of time is still one that has eluded them. Until now. Deep in the Unified Space Government’s most classified labs, the beginnings of time looping technology are being created.'+ 
                    '\\n\\nHowever, such a powerful technology always attracts those who want to use it for evil. Thanks to an inside mole, a group of reckless idealists have managed to get their hands on this technology. This group wants to wield the tech on a global sale by selling it to the highest bidder in violation of arms control laws. They hope that this will be the final step needed to bring about the “final revolution” that will ultimately achieve a stable universal government and a world where history can finally, truly be rewritten.'+
                    '\\n\\nGiven the severity of the situation, the Unified Space Government has given two of their top agents a secret, limited, and local version of the time loop tech to provide an edge on missions so that they can stop the syndicate before it’s too late.',
                    'Player Character 1. A tanky close-combat specialist. He began his work as a soldier fighting on the frontlines of various conflicts. His combat skills, even during severe ammo shortages, were noticed by those around him and he rose through the ranks. His special training included close-quarters combat training and cybernetic augments that make him more resilient to damage.',
                    'Player Character 2. A stealthy ranged specialist. A former agent in the United Space Government’s Intelligence division, she specialized in monitoring and, on occasion, eliminating targets with a minimum of fuss. She trained in the use of firearms and being able to move quickly yet silently.',
                    'The no-nonsense director of the player characters’ unit, who provides important details before each mission.',
                    'The head of one of the galaxy’s leading space travel companies, along with several companies that have gone bankrupt thanks to his leadership. His wealthy eccentricity, combined with an unhealthy interest in government-based conspiracy theories, has led him to offer financial assistance to the criminal conspiracy.',
                    'One of the galaxy’s most notorious dealers in military-grade and black market weapons. Often sells weapons to both sides in wars and may have helped stared a few.',
                    'A defector from the galaxy’s main government. Formerly a high-ranking agent, they’re believed to be the main suspect in leaking the time loop technology.',
                    'A moderate-ranking politician on a highly urbanized planet. He reached his current position by appealing to jingoists and is rumored to be linked to a few notorious hate groups. ',
                    'A scientist with an incredible curiosity… and a severe lack of empathy and restraint. They have avoided the authorities as they performed immoral experiments in highly regulated fields. Getting to field test a technology as powerful as time looping would be the height of her career.',
                ][this.helpVal];
                const helpSprite = window.app.findById('helpSprite');
                helpSprite.frames = [
                    [0], [355], [451], [0], [832], [833],[0],[834],[835]
                ][this.helpVal];
            Label:
                id: 'helpHeader'
                hints: {h:'2'}
            SpriteWidget:
                id: 'helpSprite'
                spriteSheet: resources['sprites']
                hints: {w:'3', h:'3'}
            Label:
                id: 'helpText'
                fontSize: '0.5'
                wrap: true
                vAlign: 'top'
                hints: {h:null}
            BoxLayout:
                hints: {h:'1', w:'8'}
                orientation: 'horizontal'
                Button:
                    text: 'Next'
                    bgColor: 'rgb(15,15,25)'
                    on_press:
                        const help = window.app.findById('help');
                        help.helpVal = (help.helpVal+1)%9;
                Button:
                    text: 'Exit'
                    bgColor: 'rgb(15,15,25)'
                    on_press:
                        const nb = window.app.findById('notebook');
                        nb.activePage = 0;
                
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
        } else if(ip.isKeyDown(' ')) {
            char.rest(mmap);
        } else {
            return;
        }
        mmap.updateCharacterVisibility();
        if(char.actionsThisTurn===0) {
            for(let e of mmap.enemies) {
                e.takeTurn(mmap);
            }
            char.actionsThisTurn=2;
            mmap.updateCharacterVisibility(true);
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
