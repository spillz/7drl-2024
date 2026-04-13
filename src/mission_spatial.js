//@ts-check

import * as eskv from "eskv/lib/eskv.js";
import { Facing, FacingVec } from "./facing.js";
import { LayoutTiles, MetaLayers, MissionMap } from "./map.js";

/**
 * Spatial/pathing/LOS domain logic for mission simulation.
 * This class owns geometry queries so orchestration code does not.
 */
export class MissionSpatial {
    /** @type {MissionMap} */
    missionMap;

    /**
     * @param {MissionMap} missionMap
     */
    constructor(missionMap) {
        this.missionMap = missionMap;
    }

    /**
     * @param {import('eskv/lib/eskv.js').VecLike} pos
     * @returns {string}
     */
    posKey(pos) {
        return `${Math.floor(pos[0])},${Math.floor(pos[1])}`;
    }

    /**
     * @param {import('eskv/lib/eskv.js').VecLike} pos
     * @returns {boolean}
     */
    isDoorwayTile(pos) {
        return this.missionMap.metaTileMap.getFromLayer(MetaLayers.layout, pos) === LayoutTiles.doorway;
    }

    /**
     * @param {boolean=} hallwaysOnly
     * @returns {import('eskv/lib/eskv.js').Vec2[]}
     */
    collectWalkablePatrolCells(hallwaysOnly = false) {
        const cells = [];
        const layout = this.missionMap.metaTileMap.layer[MetaLayers.layout];
        for (const rawPos of layout.iterAll()) {
            const pos = eskv.v2([rawPos[0], rawPos[1]]);
            const tile = layout.get(pos);
            const walkable = tile === LayoutTiles.floor || tile === LayoutTiles.hallway;
            if (!walkable) continue;
            if (hallwaysOnly && tile !== LayoutTiles.hallway) continue;
            cells.push(pos);
        }
        return cells;
    }

    /** @returns {import('eskv/lib/eskv.js').Vec2[]} */
    collectRoomWorkCells() {
        const cells = [];
        const layout = this.missionMap.metaTileMap.layer[MetaLayers.layout];
        for (const rawPos of layout.iterAll()) {
            const pos = eskv.v2([rawPos[0], rawPos[1]]);
            const tile = layout.get(pos);
            if (tile !== LayoutTiles.floor) continue;
            cells.push(pos);
        }
        return cells;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    countOutsideNeighbors(x, y) {
        const layout = this.missionMap.metaTileMap.layer[MetaLayers.layout];
        let count = 0;
        for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
                if (ox === 0 && oy === 0) continue;
                const nx = x + ox;
                const ny = y + oy;
                if (nx < 0 || ny < 0 || nx >= this.missionMap.w || ny >= this.missionMap.h) continue;
                if (layout.get([nx, ny]) === LayoutTiles.outside) count++;
            }
        }
        return count;
    }

    /**
     * @param {number[]} allowedTiles
     * @param {number} missionSeed
     * @param {(text: string) => number} stableHash
     * @returns {{randy: import('eskv/lib/eskv.js').VecLike, maria: import('eskv/lib/eskv.js').VecLike}|null}
     */
    pickCenteredAdjacentSpawnPair(allowedTiles, missionSeed, stableHash) {
        const allowed = new Set(allowedTiles);
        const layout = this.missionMap.metaTileMap.layer[MetaLayers.layout];
        const cx = this.missionMap.w / 2;
        const cy = this.missionMap.h / 2;
        /** @type {{randy: [number, number], maria: [number, number], score: number}|null} */
        let best = null;
        for (const rawPos of layout.iterAll()) {
            const x = rawPos[0];
            const y = rawPos[1];
            if (!allowed.has(layout.get([x, y]))) continue;
            for (const [dx, dy] of [FacingVec[Facing.east], FacingVec[Facing.south], FacingVec[Facing.west], FacingVec[Facing.north]]) {
                const mx = x + dx;
                const my = y + dy;
                if (mx < 0 || my < 0 || mx >= this.missionMap.w || my >= this.missionMap.h) continue;
                if (!allowed.has(layout.get([mx, my]))) continue;
                const randyPos = x < mx || (x === mx && y <= my) ? [x, y] : [mx, my];
                const mariaPos = x < mx || (x === mx && y <= my) ? [mx, my] : [x, y];
                const midpointX = (randyPos[0] + mariaPos[0]) / 2;
                const midpointY = (randyPos[1] + mariaPos[1]) / 2;
                const centerDist = Math.hypot(midpointX - cx, midpointY - cy);
                const edgeDist = Math.min(
                    randyPos[0],
                    randyPos[1],
                    mariaPos[0],
                    mariaPos[1],
                    this.missionMap.w - 1 - randyPos[0],
                    this.missionMap.h - 1 - randyPos[1],
                    this.missionMap.w - 1 - mariaPos[0],
                    this.missionMap.h - 1 - mariaPos[1],
                );
                const openness = this.countOutsideNeighbors(randyPos[0], randyPos[1])
                    + this.countOutsideNeighbors(mariaPos[0], mariaPos[1]);
                const jitter = (stableHash(`${missionSeed}:spawn:${randyPos[0]},${randyPos[1]}:${mariaPos[0]},${mariaPos[1]}`) % 1000) / 1000000;
                const score = centerDist * 2.5 + Math.max(0, 2 - edgeDist) * 3 - openness * 0.35 + jitter;
                if (!best || score < best.score) {
                    best = { randy: [randyPos[0], randyPos[1]], maria: [mariaPos[0], mariaPos[1]], score };
                }
            }
        }
        if (!best) return null;
        return {
            randy: [best.randy[0], best.randy[1]],
            maria: [best.maria[0], best.maria[1]],
        };
    }

    /**
     * Seed player spawn positions near map center.
     * Prefers side-by-side outdoor (courtyard/grass) starts, then falls back to indoor walkable tiles.
     * @param {Map<string, import('eskv/lib/eskv.js').VecLike>} initialPlayerPositions
     * @param {number} missionSeed
     * @param {(text: string) => number} stableHash
     * @returns {boolean}
     */
    seedInitialPlayerPositionsFromMap(initialPlayerPositions, missionSeed, stableHash) {
        const pair = this.pickCenteredAdjacentSpawnPair([LayoutTiles.outside], missionSeed, stableHash)
            ?? this.pickCenteredAdjacentSpawnPair([LayoutTiles.floor, LayoutTiles.hallway], missionSeed, stableHash);
        if (!pair) return false;
        initialPlayerPositions.set('randy', [pair.randy[0], pair.randy[1]]);
        initialPlayerPositions.set('maria', [pair.maria[0], pair.maria[1]]);
        return true;
    }

    /**
     * @param {import('eskv/lib/eskv.js').Vec2[]} candidates
     * @param {import('eskv/lib/eskv.js').VecLike} anchor
     * @param {Set<string>} occupied
     * @param {(text: string) => number} stableHash
     * @param {import('eskv/lib/eskv.js').VecLike[]=} avoid
     * @returns {import('eskv/lib/eskv.js').Vec2|null}
     */
    pickNearestAvailableCell(candidates, anchor, occupied, stableHash, avoid = []) {
        let best = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const candidate of candidates) {
            const key = this.posKey(candidate);
            if (occupied.has(key)) continue;
            if (avoid.some((v) => candidate.dist(v) < 4.25)) continue;
            const pathDist = this.shortestTraverseDistance(anchor, candidate, true);
            if (!Number.isFinite(pathDist)) continue;
            const score = pathDist
                + candidate.dist(anchor) * 0.2
                + (stableHash(`${key}:${anchor[0]},${anchor[1]}`) % 1000) / 100000;
            if (score < bestScore) {
                bestScore = score;
                best = candidate;
            }
        }
        return best ? best.add([0, 0]) : null;
    }

    /**
     * @param {import('eskv/lib/eskv.js').VecLike} start
     * @param {import('eskv/lib/eskv.js').VecLike} target
     * @param {boolean=} allowClosedDoors
     * @returns {import('eskv/lib/eskv.js').Vec2[]}
     */
    shortestTraversePath(start, target, allowClosedDoors = false) {
        const w = this.missionMap.w;
        const h = this.missionMap.h;
        const sx = Math.floor(start[0]);
        const sy = Math.floor(start[1]);
        const tx = Math.floor(target[0]);
        const ty = Math.floor(target[1]);
        if (sx === tx && sy === ty) return [];
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) return [];
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) return [];
        const total = w * h;
        const visited = new Int32Array(total);
        visited.fill(-1);
        const queue = [[sx, sy]];
        const sidx = sx + sy * w;
        const tidx = tx + ty * w;
        visited[sidx] = sidx;
        let head = 0;
        while (head < queue.length) {
            const [x, y] = queue[head++];
            const idx = x + y * w;
            for (const direction of [Facing.north, Facing.east, Facing.south, Facing.west]) {
                const nx = x + FacingVec[direction][0];
                const ny = y + FacingVec[direction][1];
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const nidx = nx + ny * w;
                if (visited[nidx] >= 0) continue;
                const npos = [nx, ny];
                const ntraversible = this.missionMap.metaTileMap.getFromLayer(MetaLayers.traversible, npos);
                let stepAllowed = (ntraversible & (1 << direction)) !== 0;
                if (!stepAllowed && allowClosedDoors) {
                    stepAllowed = this.isDoorwayTile(npos);
                }
                if (!stepAllowed) continue;
                visited[nidx] = idx;
                if (nidx === tidx) {
                    const reverse = [];
                    let cursor = tidx;
                    while (cursor !== sidx) {
                        const cx = cursor % w;
                        const cy = Math.floor(cursor / w);
                        reverse.push(eskv.v2([cx, cy]));
                        cursor = visited[cursor];
                        if (cursor < 0) return [];
                    }
                    reverse.reverse();
                    return reverse;
                }
                queue.push([nx, ny]);
            }
        }
        return [];
    }

    /**
     * @param {import('eskv/lib/eskv.js').Vec2[]} anchors
     * @param {boolean=} allowClosedDoors
     * @returns {import('eskv/lib/eskv.js').Vec2[]}
     */
    buildPatrolLoopFromAnchors(anchors, allowClosedDoors = false) {
        if (anchors.length <= 1) return anchors.map((pos) => pos.add([0, 0]));
        const loop = [anchors[0].add([0, 0])];
        for (let i = 0; i < anchors.length; i++) {
            const from = anchors[i];
            const to = anchors[(i + 1) % anchors.length];
            const segment = this.shortestTraversePath(from, to, allowClosedDoors);
            if (segment.length === 0) {
                if (!loop[loop.length - 1].equals(to)) loop.push(to.add([0, 0]));
                continue;
            }
            for (const step of segment) {
                if (!loop[loop.length - 1].equals(step)) loop.push(step.add([0, 0]));
            }
        }
        return loop;
    }

    /**
     * @param {import('eskv/lib/eskv.js').VecLike} start
     * @param {import('eskv/lib/eskv.js').VecLike} target
     * @param {boolean=} allowClosedDoors
     * @returns {number}
     */
    shortestTraverseDistance(start, target, allowClosedDoors = false) {
        const w = this.missionMap.w;
        const h = this.missionMap.h;
        const sx = Math.floor(start[0]);
        const sy = Math.floor(start[1]);
        const tx = Math.floor(target[0]);
        const ty = Math.floor(target[1]);
        if (sx === tx && sy === ty) return 0;
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) return Number.POSITIVE_INFINITY;
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) return Number.POSITIVE_INFINITY;
        const total = w * h;
        /** @type {Int32Array} */
        const dist = new Int32Array(total);
        dist.fill(-1);
        /** @type {[number, number][]} */
        const queue = [[sx, sy]];
        const sidx = sx + sy * w;
        dist[sidx] = 0;
        let head = 0;
        while (head < queue.length) {
            const [x, y] = queue[head++];
            const idx = x + y * w;
            const cur = dist[idx];
            for (const direction of [Facing.north, Facing.east, Facing.south, Facing.west]) {
                const npos = [x + FacingVec[direction][0], y + FacingVec[direction][1]];
                const nx = npos[0];
                const ny = npos[1];
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const ntraversible = this.missionMap.metaTileMap.getFromLayer(MetaLayers.traversible, npos);
                let stepAllowed = (ntraversible & (1 << direction)) !== 0;
                if (!stepAllowed && allowClosedDoors) {
                    stepAllowed = this.isDoorwayTile(npos);
                }
                if (!stepAllowed) continue;
                const nidx = nx + ny * w;
                if (dist[nidx] >= 0) continue;
                dist[nidx] = cur + 1;
                if (nx === tx && ny === ty) return dist[nidx];
                queue.push([nx, ny]);
            }
        }
        return Number.POSITIVE_INFINITY;
    }

    /**
     * @param {import('eskv/lib/eskv.js').VecLike} from
     * @param {import('eskv/lib/eskv.js').VecLike} target
     * @returns {boolean}
     */
    hasLineOfSightBetween(from, target) {
        const fromPos = eskv.v2([Math.floor(from[0]), Math.floor(from[1])]);
        const targetPos = eskv.v2([Math.floor(target[0]), Math.floor(target[1])]);
        if (fromPos.equals(targetPos)) return true;
        const sightMap = this.missionMap.metaTileMap.layer[MetaLayers.allowsSight];
        const coverMap = this.missionMap.metaTileMap.layer[MetaLayers.cover];
        const w = sightMap.tileDim[0];
        let cover = false;
        for (const rawPos of sightMap.iterInBetween(fromPos, targetPos)) {
            const pos = eskv.v2(rawPos);
            if (!pos.equals(fromPos) && this.missionMap.isSmokeAt(pos)) return false;
            if (sightMap[pos[0] + pos[1] * w] === 0 || cover) return false;
            cover = coverMap[pos[0] + pos[1] * w] > 0 ? true : false;
        }
        return true;
    }

    /**
     * @param {import('eskv/lib/eskv.js').VecLike} a
     * @param {import('eskv/lib/eskv.js').VecLike} b
     * @returns {boolean}
     */
    isAdjacent8(a, b) {
        const dx = Math.abs(Math.floor(a[0]) - Math.floor(b[0]));
        const dy = Math.abs(Math.floor(a[1]) - Math.floor(b[1]));
        return dx <= 1 && dy <= 1 && (dx !== 0 || dy !== 0);
    }

    /**
     * @returns {import('eskv/lib/eskv.js').Vec2[]}
     */
    collectMariaPlanningCells() {
        /** @type {import('eskv/lib/eskv.js').Vec2[]} */
        const cells = [];
        const layout = this.missionMap.metaTileMap.layer[MetaLayers.layout];
        for (const rawPos of layout.iterAll()) {
            const pos = eskv.v2(rawPos);
            const traversible = this.missionMap.metaTileMap.getFromLayer(MetaLayers.traversible, pos);
            if (typeof traversible === 'number' && traversible > 0) {
                cells.push(pos.add([0, 0]));
            }
        }
        return cells;
    }

    /**
     * @param {{key:string, sourcePos: import('eskv/lib/eskv.js').VecLike, targetPosition: import('eskv/lib/eskv.js').VecLike | null}} request
     * @param {import('eskv/lib/eskv.js').VecLike} originPos
     * @returns {import('eskv/lib/eskv.js').Vec2[]}
     */
    getMariaExecutionCandidatesForRequest(request, originPos) {
        const origin = eskv.v2([originPos[0], originPos[1]]);
        const targetLike = request.targetPosition ?? request.sourcePos;
        const target = eskv.v2([targetLike[0], targetLike[1]]);
        if (request.key === 'q') {
            return [origin];
        }
        const planningCells = this.collectMariaPlanningCells();
        if (request.key === 'f' || request.key === 'c') {
            return planningCells.filter((cell) => this.hasLineOfSightBetween(cell, target));
        }
        if (request.key === 'x') {
            return planningCells.filter((cell) => cell.dist(target) <= 6.01);
        }
        if (request.key === 'n' || request.key === 'm') {
            return planningCells.filter((cell) => cell.dist(target) <= 8.11);
        }
        if (request.key === 'b') {
            return planningCells.filter((cell) => cell.dist(target) <= 4.11);
        }
        if (request.key === 'g' || request.key === 't' || request.key === 'h' || request.key === 'j' || request.key === 'k' || request.key === 'u') {
            return planningCells.filter((cell) => this.isAdjacent8(cell, target));
        }
        return planningCells.filter((cell) => cell.equals(target));
    }
}

