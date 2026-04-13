//@ts-check

import * as eskv from "eskv/lib/eskv.js";
import {parse} from "eskv/lib/modules/markup.js";
import { SpriteWidget } from "eskv/lib/modules/sprites.js";
import { MissionMap } from "./map.js";
import { ActionItem } from "./action.js";
import { Facing } from "./facing.js";
import { GameState } from "./game_state.js";

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
            id: 'gameplayRoot'
            orientation: 'vertical'
            hints: {center_x:0.5, center_y:0.5, w:1, h:1}
            BoxLayout:
                id: 'topHeader'
                orientation: 'horizontal'
                hints: {w:1, h:'1.0'}
                bgColor: 'rgb(16,16,24)'
                paddingX: '0.3'
                paddingY: '0.2'
                FPS:
                    id: 'fpsHeader'
                    hints: {w:'3'}
                    align:'left'
                    sizeGroup: 'uiHeader'
                    fontSize: '0.34'
                Label:
                    id: 'globalHeaderLabel'
                    text: 'Mission: active | turn:1 tick:0 live'
                    align: 'center'
                    sizeGroup: 'uiHeader'
                    fontSize: '0.34'
                Label:
                    id: 'headerPromptLabel'
                    hints: {w:'6'}
                    text: ''
                    align: 'right'
                    sizeGroup: 'uiHeader'
                    fontSize: '0.30'
            BoxLayout:
                orientation: 'horizontal'
                id: 'game'
                hints: {w:1, h:1}
                BoxLayout:
                    id: 'leftPanel'
                    hints: {w:'8', h:1}
                    orientation: 'vertical'
                    bgColor: 'rgb(24,24,32)'
                    paddingX: '0.4'
                    paddingY: '0.35'
                    Label:
                        text: 'Randy'
                        align: 'left'
                        sizeGroup: 'uiSection'
                        fontSize: '0.32'
                    BoxLayout:
                        hints: {h:'2.5'}
                        orientation: 'horizontal'
                        SpriteWidget:
                            id: 'randyPortrait'
                            spriteSheet: resources['sprites']
                            frames: [355]
                            hints: {w:'2.6', h:'2.6'}
                        Label:
                            id: 'randyStatusLabel'
                            text: 'HP: -'
                            wrap: true
                            align: 'left'
                            sizeGroup: 'uiBody'
                            fontSize: '0.29'
                    BoxLayout:
                        hints: {h:'3.5'}
                        id: 'firstPlayerInventory'
                        orientation: 'horizontal'
                    Label:
                        text: 'Maria'
                        align: 'left'
                        sizeGroup: 'uiSection'
                        fontSize: '0.32'
                    BoxLayout:
                        hints: {h:'2.5'}
                        orientation: 'horizontal'
                        SpriteWidget:
                            id: 'mariaPortrait'
                            spriteSheet: resources['sprites']
                            frames: [451]
                            hints: {w:'2.6', h:'2.6'}
                        Label:
                            id: 'mariaStatusLabel'
                            text: 'HP: -'
                            wrap: true
                            align: 'left'
                            sizeGroup: 'uiBody'
                            fontSize: '0.29'
                    BoxLayout:
                        hints: {h:'3.5'}
                        id: 'secondPlayerInventory'
                        orientation: 'horizontal'
                    Label:
                        text: 'Event Log'
                        align: 'left'
                        sizeGroup: 'uiSection'
                        fontSize: '0.32'
                    ScrollView:
                        id: 'logScroller'
                        uiZoom: false
                        hints: {h:null}
                        Label:
                            id: 'logLabel'
                            text: 'No events yet.'
                            wrap: true
                            align: 'left'
                            sizeGroup: 'uiBody'
                            fontSize: '0.29'
                    BoxLayout:
                        hints: {h:'1.2'}
                        orientation: 'horizontal'
                        Button: 
                            text: 'Help'
                            hints: {w: '3'}
                            sizeGroup: 'uiControl'
                            fontSize: '0.3'
                            on_press:
                                const help = window.app.findById('help');
                                help.helpVal = 0;
                                const nb = window.app.findById('notebook');
                                nb.activePage = 1;
                        Button: 
                            text: '100%'
                            hints: {w: '3'}
                            id: 'zoomButton'
                            sizeGroup: 'uiControl'
                            fontSize: '0.3'
                            on_press:
                                const scroller = window.app.findById('scroller');
                                if(!scroller) return;
                                const zoom = Math.floor(scroller.zoom + 1);
                                scroller.zoom = zoom<4? zoom:0.5;
                BoxLayout:
                    bgColor: 'rgb(35,35,45)'
                    orientation: 'horizontal'
                    MapScrollView:
                        id: 'scroller'
                        uiZoom: false
                        hints: {h:1, w:1}
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
                    'Controls',
                    'Instructions',
                    'Backstory',
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
                    'Use W/A/S/D to move, SPACE to pause, F fire, C suppress, Q aim, X decoy, G arrest, T takedown, H/J/K/B/U for breaching tools, and N/M for frag/smoke grenades. Hold SHIFT plus an action key to queue a free Maria request from Randy. L toggles full-map vision, P toggles patrol routes, [ and ] rewind/fast-forward timeline, and O starts Maria obligation loop.',
                    'Navigate the level to complete the mission objectives.',
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
                    [0], [0], [0], [355], [451], [0], [832], [833],[0],[834],[835]
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
    _badFrameCount = 0;
    update(app, millis) {
        super.update(app, millis);
        const tref = Date.now()
        this._counter += tref - this._tref;
        this._frames += 1;
        const currentFPS = 1000/(tref-this._tref);
        this._tref= tref;
        this._badFrameCount += currentFPS<50?1:0;
        if(currentFPS<this._worst) this._worst = currentFPS;
        if(this._counter>=1000) {
            this.text = `FPS: ${Math.round(this._frames/this._counter*1000)} (worst: ${Math.round(this._worst)}, # >20ms: ${Math.round(this._badFrameCount)})`;
            this._counter = 0;
            this._frames = 0;
            this._worst = 300;
            this._badFrameCount = 0;
        }
    }
}

class MapScrollView extends eskv.ScrollView {
    /** @type {boolean} */
    dragDebug = true;
    /** @type {number} */
    lastDragLogTime = 0;

    /** @returns {{x:number,y:number,id:string|number,time:number,vel:[number,number]|null}|null} */
    summarizeOldTouch() {
        const oldTouch = /** @type {any} */ (this)._oldTouch;
        if (!oldTouch) return null;
        const vel = oldTouch[4];
        return {
            x: oldTouch[0],
            y: oldTouch[1],
            id: oldTouch[2],
            time: oldTouch[3],
            vel: vel ? [vel.x, vel.y] : null,
        };
    }

    /**
     * @param {string} stage
     * @param {import('eskv/lib/modules/input.js').Touch} touch
     * @param {boolean} handled
     * @param {boolean=} force
     */
    logDrag(stage, touch, handled, force = false) {
        if (!this.dragDebug) return;
        const now = Date.now();
        if (!force && now - this.lastDragLogTime < 40) return;
        this.lastDragLogTime = now;
        const local = touch.asChildTouch(this);
        console.log(`[MapScrollView.drag.${stage}]`, {
            handled,
            id: touch.identifier,
            appPos: [touch.x, touch.y],
            childPos: [local.x, local.y],
            scroll: { targetX: this.scrollX, targetY: this.scrollY, actualX: this._scrollX, actualY: this._scrollY },
            zoom: this.zoom,
            oldTouch: this.summarizeOldTouch(),
            vel: this.vel ? [this.vel.x, this.vel.y] : null,
            buttons: touch.nativeObject instanceof MouseEvent ? touch.nativeObject.buttons : undefined,
        });
    }

    on_touch_down(event, object, touch) {
        const handled = super.on_touch_down(event, object, touch);
        this.logDrag('down', touch, handled, true);
        return handled;
    }

    on_touch_move(event, object, touch) {
        const beforeChild = touch.asChildTouch(this);
        const beforeScroll = { targetX: this.scrollX, targetY: this.scrollY, actualX: this._scrollX, actualY: this._scrollY };
        const beforeOldTouch = this.summarizeOldTouch();
        const handled = super.on_touch_move(event, object, touch);
        if (this.dragDebug) {
            const afterChild = touch.asChildTouch(this);
            const tileStep = 1 / Math.max(1, eskv.App.get().tileSize);
            console.log('[MapScrollView.drag.move.delta]', {
                handled,
                id: touch.identifier,
                beforeChildPos: [beforeChild.x, beforeChild.y],
                afterChildPos: [afterChild.x, afterChild.y],
                deltaChildPos: [afterChild.x - beforeChild.x, afterChild.y - beforeChild.y],
                beforeScroll,
                afterScroll: { targetX: this.scrollX, targetY: this.scrollY, actualX: this._scrollX, actualY: this._scrollY },
                beforeOldTouch,
                afterOldTouch: this.summarizeOldTouch(),
                tileSnapStep: tileStep,
                viewPos: [this.x, this.y],
                viewSize: [this.w, this.h],
            });
        }
        this.logDrag('move', touch, handled);
        return handled;
    }

    on_touch_up(event, object, touch) {
        const handled = super.on_touch_up(event, object, touch);
        this.logDrag('up', touch, handled, true);
        return handled;
    }

    on_touch_cancel(event, object, touch) {
        const handled = super.on_touch_cancel(event, object, touch);
        this.logDrag('cancel', touch, handled, true);
        return handled;
    }

    on_wheel(event, object, touch) {
        const app = eskv.App.get();
        if (!app.inputHandler) return true;
        if (!this.collide(touch.rect) && (!this.unboundedW || !this.unboundedH)) return false;
        const wheel = touch.nativeObject;
        if (!(wheel instanceof WheelEvent)) return false;
        if (this.uiZoom && app.inputHandler.isKeyDown('Control')) {
            return super.on_wheel(event, object, touch);
        }
        if (!this.uiMove) return false;
        const canScrollX = this.scrollW && (this.scrollableW > 0 || this.unboundedW);
        const canScrollY = this.scrollH && (this.scrollableH > 0 || this.unboundedH);
        const shiftHorizontal = app.inputHandler.isKeyDown('Shift') && Math.abs(wheel.deltaX) < 1e-6;
        const deltaX = shiftHorizontal ? wheel.deltaY : wheel.deltaX;
        const deltaY = shiftHorizontal ? 0 : wheel.deltaY;
        let handled = false;
        if (canScrollX && Math.abs(deltaX) > 1e-6) {
            this.scrollX += this.w / this.zoom * (deltaX / app.w);
            if (this.scrollX !== this._scrollX) this.scrollX = this._scrollX;
            handled = true;
        }
        if (canScrollY && Math.abs(deltaY) > 1e-6) {
            this.scrollY += this.h / this.zoom * (deltaY / app.h);
            if (this.scrollY !== this._scrollY) this.scrollY = this._scrollY;
            handled = true;
        }
        return handled;
    }
}

class Game extends eskv.App {
    /** @type {GameState|null} */
    gameState = null;
    /** @type {boolean} */
    debugOverlayVisible = false;
    /** @type {boolean} */
    pendingCameraSync = true;
    constructor(props={}) {
        super();
        if (this.inputHandler) {
            // Disable automatic focus cycling from connected gamepads/keyboard tab navigation in this game UI.
            this.inputHandler.pollGamepads = () => {};
            this.inputHandler._connectedGamepads.clear();
            this.inputHandler.clearFocus();
        }
        Game.resources['sprites'] = new eskv.sprites.SpriteSheet(spriteUrl, 16);
        this.continuousFrameUpdates = true;
        window.focus();
        this.canvas?.focus();
        if(props) this.updateProperties(props);
    }
    static get() {
        return /**@type {Game}*/(eskv.App.get());
    }
    /** @returns {MissionMap} */
    getMissionMap() {
        return /**@type {MissionMap}*/(this.findById('MissionMap'));
    }
    /** @returns {GameState} */
    getGameState() {
        if(this.gameState) return this.gameState;
        const state = new GameState(this.getMissionMap());
        this.gameState = state;
        return state;
    }
    update(app, millis) {
        super.update(app, millis);
        if (!this.pendingCameraSync) return;
        this.pendingCameraSync = !this.updateCameraFromGameState();
    }
    syncUiWithGameState() {
        const state = this.getGameState();
        const view = state.helpers.view.getView();
        const globalHeaderLabel = /**@type {eskv.Label}*/(this.findById('globalHeaderLabel'));
        const levelName = `Mansion ${view.missionIndex + 1}`;
        const activeName = view.activeCharacterId === 'none'
            ? 'None'
            : `${view.activeCharacterId[0].toUpperCase()}${view.activeCharacterId.slice(1)}`;
        const gameStateTag = view.missionStatus === 'failure'
            ? ' | GAME OVER'
            : view.missionStatus === 'success'
                ? ' | COMPLETE'
                : '';
        globalHeaderLabel.text = `${levelName} | T${view.timelineTurn} | Active: ${activeName} | Actions This Turn: ${view.activeTurnActionsTaken}/${view.activeTurnActionLimit}${gameStateTag}`;
        const headerPromptLabel = /**@type {eskv.Label}*/(this.findById('headerPromptLabel'));
        if (headerPromptLabel) {
            if (view.awaitingSelection) {
                headerPromptLabel.text = view.message;
                headerPromptLabel.color = view.selectionKind === 'order'
                    ? 'rgba(255,190,70,0.98)'
                    : 'rgba(90,220,255,0.96)';
            } else {
                headerPromptLabel.text = '';
                headerPromptLabel.color = 'rgba(215,215,225,0.92)';
            }
        }
        const mmap = this.getMissionMap();
        const randy = mmap.playerCharacters.find((player) => player.id === 'randy') ?? null;
        const maria = mmap.playerCharacters.find((player) => player.id === 'maria') ?? null;
        /**
         * @param {import('./character.js').Character|null} character
         * @returns {eskv.Widget[]}
         */
        const buildInventoryRows = (character) => {
            if (!character) return [];
            /** @type {{iconFrames:number[], lines:string[]}[]} */
            const groups = [];
            /** @type {Map<string, {iconFrames:number[], lines:string[]}>} */
            const byIcon = new Map();
            for (const action of character.actions) {
                const key = action.keyControl ? action.keyControl.toUpperCase() : '?';
                const verb = action.name;
                const iconFrames = Array.isArray(action?.sprite?.frames) ? action.sprite.frames : [736];
                const iconKey = iconFrames.join(',');
                let group = byIcon.get(iconKey);
                if (!group) {
                    group = { iconFrames, lines: [] };
                    byIcon.set(iconKey, group);
                    groups.push(group);
                }
                group.lines.push(`${verb} [${key}]`);
            }
            const rows = [];
            for (const group of groups) {
                const rowHeight = Math.max(1.05, 0.8 + group.lines.length * 0.5);
                const row = eskv.BoxLayout.a({ orientation: 'horizontal', hints: { h: `${rowHeight}` } });
                const icon = SpriteWidget.a({
                    spriteSheet: eskv.App.resources['sprites'],
                    frames: group.iconFrames,
                    hints: { w: '1.0', h: '1.0' },
                });
                const label = eskv.Label.a({
                    text: group.lines.join('\n'),
                    wrap: true,
                    align: 'left',
                    sizeGroup: 'uiBody',
                    fontSize: '0.29',
                    hints: { w: 1 },
                });
                row.children = [icon, label];
                rows.push(row);
            }
            return rows;
        };
        /**
         * @param {import('./character.js').Character|null} character
         * @returns {eskv.Widget[]}
         */
        const buildInventoryContent = (character) => {
            const column = eskv.BoxLayout.a({ orientation: 'vertical', hints: { w: 1, h: 1 } });
            column.children = buildInventoryRows(character);
            return [column];
        };
        /** @returns {eskv.Widget[]} */
        const buildMariaOrderContent = () => {
            const column = eskv.BoxLayout.a({ orientation: 'vertical', hints: { w: 1, h: 1 } });
            const mariaOrderLines = maria
                ? [...maria.actions].map((action) => `${action.name} [${action.keyControl ? action.keyControl.toUpperCase() : '?'}]`)
                : [];
            const orders = eskv.Label.a({
                text: `Orders (Shift)\n${mariaOrderLines.join('\n')}`,
                wrap: true,
                align: 'left',
                sizeGroup: 'uiBody',
                fontSize: '0.29',
                hints: { w: 1, h: 1 },
            });
            column.children = [orders];
            return [column];
        };
        const randyStatusLabel = /**@type {eskv.Label}*/(this.findById('randyStatusLabel'));
        const mariaStatusLabel = /**@type {eskv.Label}*/(this.findById('mariaStatusLabel'));
        const isRandyActive = mmap.activeCharacter===randy;
        const isMariaActive = mmap.activeCharacter===maria;
        const randyVitals = randy ? `HP ${randy.health}/${randy.maxHealth} | AP ${randy.actionsThisTurn}` : 'Unavailable';
        const mariaVitals = maria ? `HP ${maria.health}/${maria.maxHealth} | AP ${maria.actionsThisTurn}` : 'Unavailable';
        randyStatusLabel.text = randy
            ? `${randyVitals}\nMove [W/A/S/D], Wait [SPACE]\n${isRandyActive ? 'ACTIVE' : 'STANDBY'}`
            : 'Unavailable';
        mariaStatusLabel.text = maria
            ? isMariaActive
                ? `${mariaVitals}\nMove [W/A/S/D], Wait [SPACE]\nACTIVE`
                : `${mariaVitals}\nWAITING IN BREACH`
            : 'Unavailable';
        const firstPlayerInventory = /**@type {eskv.Widget}*/(this.findById('firstPlayerInventory'));
        const secondPlayerInventory = /**@type {eskv.Widget}*/(this.findById('secondPlayerInventory'));
        if (firstPlayerInventory) firstPlayerInventory.children = buildInventoryContent(randy);
        if (secondPlayerInventory) {
            secondPlayerInventory.children = isMariaActive
                ? buildInventoryContent(maria)
                : buildMariaOrderContent();
        }
        const logLabel = /**@type {eskv.Label}*/(this.findById('logLabel'));
        logLabel.text = `${view.objectiveText}\n${view.enemyStatusText}\n${view.logText}`;
        const zoomButton = /**@type {eskv.Button}*/(this.findById('zoomButton'));
        const scroller = /**@type {eskv.ScrollView}*/(this.findById('scroller'));
        if (zoomButton && scroller) {
            zoomButton.text = `${Math.round(scroller.zoom * 100)}%`;
        }
        const ps = mmap.positionSelector;
        ps.validCells = view.selectorCells;
        ps.cellLabels = view.selectorCellLabels ?? [];
        ps.activeCell = view.selectorIndex;
        ps.selectionKind = view.selectionKind === 'order' ? 'order' : 'action';
        mmap.setObligationOverlayData({
            replayMode: view.replayMode,
            timelineTurn: view.timelineTurn,
            obligationTurns: view.obligationTurns,
            randyEchoPos: view.randyEchoPos,
            randyPath: view.randyPath,
            obligationObjectives: view.obligationObjectives,
            showPatrolRoutes: view.showPatrolRoutes,
            patrolRoutes: view.patrolRoutes,
            enemyIntents: view.enemyIntents,
        });
    }
    /** @returns {boolean} */
    updateCameraFromGameState() {
        const camera = /**@type {eskv.ScrollView|null}*/(this.findById('scroller'));
        const mmap = this.getMissionMap();
        const active = mmap.activeCharacter;
        if(!camera || !active) return false;
        const zoom = camera.zoom > 0 ? camera.zoom : 1;
        const viewportW = camera.w / zoom;
        const viewportH = camera.h / zoom;
        if (viewportW <= 0 || viewportH <= 0) return false;
        const target = active.gpos.add([0.5, 0.5]);
        const maxScrollX = Math.max(0, mmap.w - viewportW);
        const maxScrollY = Math.max(0, mmap.h - viewportH);
        let scrollX = Math.min(Math.max(target[0] - viewportW / 2, 0), maxScrollX);
        let scrollY = Math.min(Math.max(target[1] - viewportH / 2, 0), maxScrollY);
        const ts = eskv.App.get().tileSize;
        scrollX = Math.floor(scrollX*ts)/ts;
        scrollY = Math.floor(scrollY*ts)/ts;
        camera.scrollX = scrollX;
        camera.scrollY = scrollY;
        return true;
    }
    on_key_down(e, o, v) {
        const rawKey = v?.event?.key;
        if(typeof rawKey!=='string') return;
        const key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;
        if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') return;
        const shift = Boolean(v?.event?.shiftKey);
        const state = this.getGameState();
        if (key==='\\') {
            this.debugOverlayVisible = !this.debugOverlayVisible;
            this.syncUiWithGameState();
            this.updateCameraFromGameState();
            return;
        }
        if (key==='l') {
            state.helpers.view.toggleFullVision();
            this.syncUiWithGameState();
            this.updateCameraFromGameState();
            return;
        }
        if (key==='p') {
            state.helpers.view.togglePatrolRoutes();
            this.syncUiWithGameState();
            this.updateCameraFromGameState();
            return;
        }
        if (key==='o') {
            state.helpers.timeline.dispatchIntent({type:'startObligationLoop'});
            this.syncUiWithGameState();
            this.updateCameraFromGameState();
            return;
        }
        if (state.helpers.timeline.isAwaitingSelection()) {
            const orderable = typeof state.helpers.timeline.isSupportedRequestKey === 'function'
                ? state.helpers.timeline.isSupportedRequestKey(key)
                : false;
            if (key==='w') state.helpers.timeline.dispatchIntent({type:'moveSelection', direction: Facing.north});
            else if (key==='a') state.helpers.timeline.dispatchIntent({type:'moveSelection', direction: Facing.west});
            else if (key==='s') state.helpers.timeline.dispatchIntent({type:'moveSelection', direction: Facing.south});
            else if (key==='d') state.helpers.timeline.dispatchIntent({type:'moveSelection', direction: Facing.east});
            else if (key==='e' || key==='Enter') state.helpers.timeline.dispatchIntent({type:'confirmSelection'});
            else if (key==='Escape' || key==='Backspace') state.helpers.timeline.dispatchIntent({type:'cancelSelection'});
            else if (shift && orderable) {
                state.helpers.timeline.dispatchIntent({type:'cancelSelection'});
                state.helpers.timeline.dispatchIntent({type:'requestActionFromKey', key});
            }
            else if (this.getMissionMap().activeCharacter?.getActionForKey?.(key)) {
                state.helpers.timeline.dispatchIntent({type:'cancelSelection'});
                state.helpers.timeline.dispatchIntent({type:'startActionFromKey', key});
            }
                else return;
        } else {
            const active = this.getMissionMap().activeCharacter;
            const requestable = typeof state.helpers.timeline.isSupportedRequestKey === 'function'
                ? state.helpers.timeline.isSupportedRequestKey(key)
                : false;
            const queueRequest = shift && requestable;
            if (key==='v') state.helpers.timeline.dispatchIntent({type:'debugRevealMap'});
            else if (key==='[') state.helpers.timeline.dispatchIntent({type:'rewindToTick', tick: Math.max(0, state.timelineTick-1)});
            else if (key===']') state.helpers.timeline.dispatchIntent({type:'rewindToTick', tick: Number.MAX_SAFE_INTEGER});
            else if (queueRequest) state.helpers.timeline.dispatchIntent({type:'requestActionFromKey', key});
            else if (key==='w') state.helpers.timeline.dispatchIntent({type:'move', direction: Facing.north});
            else if (key==='a') state.helpers.timeline.dispatchIntent({type:'move', direction: Facing.west});
            else if (key==='s') state.helpers.timeline.dispatchIntent({type:'move', direction: Facing.south});
            else if (key==='d') state.helpers.timeline.dispatchIntent({type:'move', direction: Facing.east});
            else if (key===' ') state.helpers.timeline.dispatchIntent({type:'rest'});
            else {
                const hasAction = active?.getActionForKey?.(key);
                if (!hasAction) return;
                state.helpers.timeline.dispatchIntent({type:'startActionFromKey', key});
            }
        }
        this.syncUiWithGameState();
        this.updateCameraFromGameState();
    }
}

Game.registerClass('Action', ActionItem, 'Label');
Game.registerClass('FPS', FPS, 'Label');
Game.registerClass('MapScrollView', MapScrollView, 'ScrollView');
Game.registerClass('Game', Game, 'App');
Game.registerClass('MissionMap', MissionMap, 'Widget');
Game.rules.add('Button', { canFocus: false });
Game.rules.add('BasicButton', { canFocus: false });
Game.rules.add('ToggleButton', { canFocus: false });
Game.rules.add('CheckBox', { canFocus: false });

const result = parse(markup);

//Start the app
const game = Game.get()
const mmap = /**@type {MissionMap}*/(game.findById('MissionMap'));
const gameState = game.getGameState();
gameState.helpers.setup.setupLevel();
mmap.playerCharacters[0].actionInventory = game.findById('firstPlayerInventory');
mmap.playerCharacters[1].actionInventory = game.findById('secondPlayerInventory');
game.syncUiWithGameState();
game.updateCameraFromGameState();
game.start();
