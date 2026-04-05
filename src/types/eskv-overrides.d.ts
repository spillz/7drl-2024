declare module "eskv/lib/eskv.js" {
  export type VecLike = [number, number] | Vec2 | number[];

  export class Vec2 extends Array<number> {
    constructor(value?: VecLike);
    add(v: VecLike): Vec2;
    sub(v: VecLike): Vec2;
    mul(v: VecLike): Vec2;
    scale(s: number): Vec2;
    abs(): Vec2;
    sum(): number;
    dist(v: VecLike): number;
    equals(v: VecLike): boolean;
  }

  export class Rect {
    constructor(value?: any);
    x: number;
    y: number;
    w: number;
    h: number;
    right: number;
    bottom: number;
    pos: Vec2;
    translate(v: VecLike): Rect;
  }

  export class Grid2D extends Array<number> {
    constructor(tileDim?: VecLike);
    tileDim: Vec2;
    fill(value: number): this;
    get(pos: VecLike): number;
    set(pos: VecLike, value: number): number;
    iterAll(): Iterable<Vec2>;
    iterAdjacent(pos: VecLike): Iterable<Vec2>;
    iterBetween(a: VecLike, b: VecLike): Iterable<Vec2>;
    iterRect(rect: any): Iterable<Vec2>;
    iterRectBoundary(rect: any): Iterable<Vec2>;
    iterInRange(pos: VecLike, radius: number): Iterable<Vec2>;
    hasTypesBetween(a: VecLike, b: VecLike, values: number[]): boolean;
    forEach(callback: (value: number, index: number) => void): void;
  }

  export class Widget {
    [key: string]: any;
    children: any[];
    parent: Widget | null;
    w: number;
    h: number;
    x: number;
    y: number;
    pos: Vec2;
    hints: Record<string, unknown>;
    constructor(props?: any);
    updateProperties(props: any): void;
    addChild(child: any): void;
    removeChild(child: any): void;
    bind(event: string, callback: (...args: any[]) => void): void;
    draw(app: App, ctx: any): void;
  }

  export class Label extends Widget {
    text: string;
    update(app: App, millis: number): void;
  }

  export class BoxLayout extends Widget {}

  export class ScrollView extends Widget {
    scrollX: number;
    scrollY: number;
    _scrollX: number;
    _scrollY: number;
    zoom: number;
  }

  export class WidgetAnimation {
    add(props: Record<string, number>, durationMs: number): void;
    start(target: any): void;
  }

  export class App extends Widget {
    static resources: Record<string, unknown>;
    static get(): App;
    static registerClass(name: string, klass: any, base: string): void;
    inputHandler: any;
    canvas?: any;
    tileSize: number;
    continuousFrameUpdates: boolean;
    findById(id: string): any;
    start(): void;
  }

  export function parse(markup: string): any;
  export function vec2(x?: number, y?: number): Vec2;
  export function v2(v: VecLike): Vec2;

  export namespace rand {
    class PRNG {
      random(): number;
      getRandomPos(w: number, h: number): [number, number];
      getRandomInt(max: number): number;
      seed(value: number): void;
    }

    class PRNG_sfc32 extends PRNG {}
  }

  export namespace sprites {
    class SpriteSheet {
      constructor(url: string, tileSize: number);
    }

    class AutoTiler {
      constructor(name: string, kinds: number[], blockers: number[], mapping: Record<number, number>);
      autoTile(pos: VecLike, metaMap: any, tileMap: any): void;
    }
  }
}

declare module "eskv/lib/modules/sprites.js" {
  import { Widget, Vec2 } from "eskv/lib/eskv.js";

  export class LayeredAnimationFrame {
    constructor(frames: number[], offsets?: number[][]);
  }

  export class SpriteSheet {
    constructor(url: string, tileSize: number);
  }

  export class TileMap extends Widget {
    data: any;
    tileDim: Vec2;
    useCache: boolean;
    activeLayer: number;
    numLayers: number;
    defaultValue: number;
    set(pos: any, value: number): number;
    get(pos: any): number;
    clearCache(): void;
  }

  export class LayeredTileMap extends TileMap {
    layer: any[];
    _layerData: any[];
    setInLayer(layer: number, pos: any, value: number): void;
    getFromLayer(layer: number, pos: any): number;
  }

  export class SpriteWidget extends Widget {
    spriteSheet: SpriteSheet | null;
    frames: any;
    visible: boolean;
    draw(app: any, ctx: any): void;
  }

  export function laf(frames: number[], offsets?: number[][]): LayeredAnimationFrame;
}

declare module "eskv/lib/modules/markup.js" {
  export function parse(markup: string): any;
}

declare module "eskv/lib/modules/random.js" {
  export class PRNG {
    random(): number;
    getRandomPos(w: number, h: number): [number, number];
    getRandomInt(max: number): number;
  }
}
