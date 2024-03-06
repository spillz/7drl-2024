Game related
============

 - Core objects
    - SpriteSheet
        - 2D vs 2.5D
        - Animations
    - Entity (object in the game world) extends SpriteWidget?
      - Player characters
        - 4 vs. 8 way movement
        - Abilities
        - Running vs Walking
        - Health/KO'd/Dead
      - NPC
        - Primary objective
        - Patrols
        - Basic movement
        - Running when alerted/afraid
        - Health/KO'd/Dead
        - Attacks (on player, hostages etc)
      - Items
    - Map extends TileMap
      - Generated by seeded procgen
      - Restarted at the end of the the first players run
      - Walls, doors, locked doors, different floor types
      - Multi-story builings feasible?
    - InventoryItem
    - StopWatch
        - Tracks all actions on the map and all RNG
        - Logs all actions the second character must complete on their run
        - Plays back all actions from the first run
    - Menu system
        - Mission briefing
        - Loadout screen
        - In-game menu
            - Help
            - Controls
            - Info on Inventory Items
    - Input system
        - Keyboard
        - Touch/mouse
        - Gamepad
 - Core algos/mechanics
    - Simple room placement
    - Line of sight
    - Shortest path (Dijkstra)
    - Environment damage
 - SpriteSheet constants for indexes
 - Level settings
    - Space station
    - Spaceship
    - Palace Compound
    - Hotel
    - Armory
    - Lab
 - Mission objectives
    - Assassination (main villain/key character)
    - Elimination (clear out a hive of enemies)
    - Rescue (free a hostage)
    - Retrieve item
    - Destroy item
    - Plant evidence
    - Survive
    - Escort 
    - Listen in
 - Side objectives
    - Gather intel (see all map)
    - Don't be seen/alert enemy
    - Confiscate property
    - Disable/destroy weapons
    - Pass/get message
 - Sound
    - Howler lib again
    - Enemy chatter
    - Sound fx (footsteps, hits, gunfire, explosions, rubble, slams)
    - Mission briefings

ESKV related
============
 - Two finger pan, fix zoom (center of zoom should stay between fingers)
 - Auto-orienting box layout
 - Do something about string rules properties specified in code (rather than markup)

TileMapper
==========
 - Import/export eskv code for SpriteSheet and TileMaps [mostly done day 2]
 - Export PNG tilemaps [done day 1]
 - Painter UI:
  - Resize tilemaps [done day 2]
  - Minimize data loss after resize [done day 2]
  - Add clear option
 - Load spritesheet (local file system, server installed, and localStorage) and set spritesize
 - Animation creation and painting [done day 2]
 - Tilestamp creation and painting
 - Autotile creation and painting
 - Paste operations (spritesheet and tilemap)
