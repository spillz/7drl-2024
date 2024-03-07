//@ts-check
import * as eskv from "../eskv/lib/eskv.js";
import { parse } from "../eskv/lib/modules/markup.js";
import { MissionMap } from "./map.js";

eskv.App.resources['sprites'] = new eskv.sprites.SpriteSheet('/images/spritesheet.png', 16);
eskv.App.registerClass('MissionMap', MissionMap, 'Widget');

//The markup specifies the overall UI layout in the App
const markup = `
App:
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
                id: 'missionMap'
                hints: {w:null, h:null}
                w: 80
                h: 40
                spriteSheet: resources['sprites']
`;

parse(markup);


const tilemap = eskv.App.get().findById('tilemap')
function test() {
    const scroller = window.app.findById('scroller');
    if(!scroller) return;
    const zoom = Math.floor(scroller.zoom + 1);
    console.log(scroller, zoom);
    scroller.zoom = zoom<=4? zoom:0.5;
    this.text = String(zoom*100)+'%';    
}


//Start the app
eskv.App.get().start();
