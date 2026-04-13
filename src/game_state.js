//@ts-check

import { Facing } from "./facing.js";
import { MissionMap } from "./map.js";
import { Character, PlayerCharacter } from "./character_widget.js";
import { CharacterStateData } from "./character_state.js";
import { MissionSpatial } from "./mission_spatial.js";
import { createGameStateComposition } from "./game_state_helpers.js";

/**
 * @typedef {'notStarted'|'active'|'success'|'failure'} MissionStatus
 */

/**
 * @typedef {'pending'|'complete'|'failed'} ObjectiveState
 */

/**
 * @typedef {{
 *   id: string,
 *   text: string,
 *   state: ObjectiveState,
 * }} MissionObjective
 */

/**
 * @typedef {{
 *   type: 'move',
 *   direction: Facing,
 * } | {
 *   type: 'rest',
 * } | {
 *   type: 'startActionFromKey',
 *   key: string,
 * } | {
 *   type: 'requestActionFromKey',
 *   key: string,
 *   targetCharacterId?: string,
 *   targetPosition?: import('eskv/lib/eskv.js').VecLike,
 * } | {
 *   type: 'moveSelection',
 *   direction: Facing,
 * } | {
 *   type: 'confirmSelection',
 * } | {
 *   type: 'cancelSelection',
 * } | {
 *   type: 'debugRevealMap',
 * } | {
 *   type: 'rewindToTick',
 *   tick: number,
 * } | {
 *   type: 'startObligationLoop',
 * }} GameIntent
 */

/**
 * @typedef {{
 *   turn: number,
 *   tick: number,
 *   actorId: string,
 *   actorPos: import('eskv/lib/eskv.js').VecLike | null,
 *   intent: GameIntent,
 *   result: 'applied'|'ignored'|'blocked'|'rewind',
 *   message: string,
 * }} TimelineEvent
 */

/**
 * @typedef {{
 *   turn: number,
 *   tick: number,
 *   actorId: string,
 *   position: import('eskv/lib/eskv.js').VecLike,
 *   label: string,
 *   color?: string,
 * }} ObligationObjective
 */

/**
 * @typedef {{
 *   id: string,
 *   position: import('eskv/lib/eskv.js').VecLike,
 *   kind: 'attack'|'advance'|'search'|'patrol'|'post'|'passive'|'flee'|'comply'|'arrested'|'down'|'dead',
 *   label: string,
 *   color: string,
 * }} EnemyIntentGlyph
 */

/**
 * @typedef {{
 *   id: string,
 *   role: 'guard'|'scientist',
 *   points: import('eskv/lib/eskv.js').VecLike[],
 * }} PatrolRouteGlyph
 */

/**
 * @typedef {{
 *   message: string,
 *   awaitingSelection: boolean,
 *   selectionKind: 'none'|'action'|'order',
 *   selectorCells: import('eskv/lib/eskv.js').Vec2[],
 *   selectorCellLabels: string[],
 *   selectorIndex: number,
 *   objectiveText: string,
 *   missionStatus: MissionStatus,
 *   runSeed: number,
 *   missionSeed: number,
 *   missionIndex: number,
 *   timelineTick: number,
 *   timelineTurn: number,
 *   replayMode: boolean,
 *   activeTurnActionsTaken: number,
 *   activeTurnActionLimit: number,
 *   squadStatusText: string,
 *   playerStatusText: string,
 *   inventoryStatusText: string,
 *   enemyStatusText: string,
 *   signalStatusText: string,
 *   shortcutsText: string,
 *   logText: string,
 *   activeCharacterId: string,
 *   randyEchoPos: import('eskv/lib/eskv.js').VecLike | null,
 *   obligationObjectives: ObligationObjective[],
 *   obligationTurns: number[],
 *   randyPath: {turn:number, position: import('eskv/lib/eskv.js').VecLike}[],
 *   anomalyCount: number,
 *   requestSummaryText: string,
 *   enemyIntents: EnemyIntentGlyph[],
 *   showPatrolRoutes: boolean,
 *   patrolRoutes: PatrolRouteGlyph[],
 * }} GameView
 */

/**
 * @typedef {{
 *   turn: number,
 *   key: string,
 *   sourcePos: import('eskv/lib/eskv.js').VecLike,
 *   targetCharacterId: string | null,
 *   targetPosition: import('eskv/lib/eskv.js').VecLike | null,
 *   earliestTurn?: number,
 *   feasible?: boolean,
 *   fulfilled: boolean,
 *   fulfilledTick: number | null,
 *   label: string,
 * }} MariaRequest
 */

/**
 * @typedef {'player'|'enemy'|'target'} CharacterRole
 */

/**
 * @typedef {'patrol'|'post'|'passive'|'investigate'|'engage'|'unaware'|'usingSkype'|'seekingGuards'|'fleeing'|'comply'|'surrendering'|'dead'} CharacterBehaviorState
 */

/**
 * @typedef {'standing'|'prone'} CharacterPosture
 */

/**
 * @typedef {'combatEffective'|'wounded'|'critical'|'unconscious'|'detained'|'dead'} CharacterCasualtyState
 */

/**
 * @typedef {'unaware'|'aware'|'investigating'|'engaging'} CharacterAwarenessState
 */

export class GameState {
    /** @type {MissionMap} */
    missionMap;
    /** @type {MissionSpatial} */
    spatial;
    /** @type {Map<string, CharacterStateData>} */
    characterState = new Map();
    /** @type {import('./action.js').ActionItem | null} */
    activePlayerAction = null;
    /** @type {import('./action.js').ActionResponseData | null} */
    activePlayerActionData = null;
    /** @type {{key:string, validTargetCharacters?: Character[], validTargetPositions?: import('eskv/lib/eskv.js').Vec2[]} | null} */
    pendingMariaRequestSelection = null;
    /** @type {number|null} */
    mariaSelectionPreviewEarliestTurn = null;
    /** @type {boolean|null} */
    mariaSelectionPreviewFeasible = null;
    /** @type {GameIntent | null} */
    timelineIntentOverride = null;
    /** @type {string} */
    message = 'Welcome to the mansion';
    /** @type {MissionStatus} */
    missionStatus = 'notStarted';
    /** @type {number} */
    runSeed = 20260405;
    /** @type {number} */
    missionIndex = 0;
    /** @type {number} */
    missionSeed = 0;
    /** @type {MissionObjective[]} */
    objectives = [];
    /** @type {string[]} */
    guardIds = ['guard1', 'guard2', 'guard3', 'guard4', 'guard5', 'guard6'];
    /** @type {string[]} */
    scientistIds = ['scientist1', 'scientist2', 'scientist3', 'scientist4'];
    /** @type {Set<string>} */
    supportedRequestKeys = new Set(['f', 'c', 'q', 'x', 'g', 't', 'h', 'j', 'k', 'b', 'u', 'n', 'm']);
    /** @type {Set<string>} */
    escapedScientistIds = new Set();
    /** @type {Map<string, import('eskv/lib/eskv.js').Vec2>} */
    scientistPreviousPositions = new Map();
    /** @type {Map<string, number>} */
    scientistFleeStallTurns = new Map();
    /** @type {Map<string, number>} */
    scientistPassiveWaitTurns = new Map();
    /** @type {import('eskv/lib/eskv.js').Vec2[]} */
    selectorCells = [];
    selectorIndex = -1;

    /** @type {TimelineEvent[]} */
    timeline = [];
    /** @type {number} */
    timelineTick = 0;
    /** @type {number} */
    timelineTurn = 1;
    /** @type {boolean} */
    replayMode = false;
    /** @type {boolean} */
    hostilityEscalated = false;
    /** @type {string} */
    hostilityReason = '';
    /** @type {ObligationObjective[]} */
    obligationObjectives = [];
    /** @type {MariaRequest[]} */
    mariaRequests = [];
    /** @type {{turn:number, position: import('eskv/lib/eskv.js').VecLike}[]} */
    randyPath = [];
    /** @type {Map<number, GameIntent[]>} */
    randyReplayScriptByTurn = new Map();
    /** @type {Map<string, number>} */
    playerTurnActionsTaken = new Map();
    /** @type {number} */
    anomalyCount = 0;
    /** @type {string[]} */
    eventLog = [];
    /** @type {string} */
    lastCompletedActionKey = '';
    /** @type {Set<string>} */
    persistentSeenCells = new Set();
    /** @type {boolean} */
    debugFullVision = false;
    /** @type {boolean} */
    showPatrolRoutes = false;
    /** @type {Map<string, import('eskv/lib/eskv.js').VecLike>} */
    initialPlayerPositions = new Map();
    /** @type {any} */
    helpers = null;

    /** @param {MissionMap} missionMap */
    constructor(missionMap) {
        this.missionMap = missionMap;
        this.spatial = new MissionSpatial(missionMap);
        this.helpers = createGameStateComposition(this);
    }

}

