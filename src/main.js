//@ts-check
import * as eskv from "../eskv/lib/eskv.js";
import { parse } from "../eskv/lib/modules/markup.js";

eskv.App.resources['sprites'] = new eskv.sprites.SpriteSheet('/images/colored-transparent_packed.png', 16);

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
                text: 'Welcome to the pit'
                align: 'right'
        ScrollView:
            LayeredTileMap:
                id: 'tilemap'
                hints: {w:null, h:null}
                w: 50
                h: 30
                spriteSheet: resources['sprites']
                tileDim: [49,22]
`;

parse(markup);

const tilemap = eskv.App.get().findById('tilemap')


//Start the app
eskv.App.get().start();
