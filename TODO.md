Game related
============

 - Map rendering
    - Put visibility on it's own layer instead of using visibility to darken and only
      partially re-render to speed up the render caching
 - Get actions working [PARTIAL WORK 3/25/24]
    - Basic setup with good separation of concerns (See actions below)
    - Rifle (accurate, wide range, suppression)
    - Pistol
    - Halligan
    - Concussion grenade
    - Smoke grenade
    - C4
    - Endoscope
    - Drone
 - Time mechanics
    - Level restart with second character playing back first characters run deterministically
    - First run character gets to request second character to do things by a certain time
      - Incapacitate a character
      - Scope a room
      - Bust a door
      - Smash a window
      - Suppress enemies
      - Grenade room
 - Map gen
    - Basic room gen with twisting hallways. Try to ensure always close quarters with very few
    long/open areas
    - Map types
        - Mansion
        - Lab
        - Military compound
        - Moon base
        - Space station
        - Provide a overarching layout style and decoration for the map
    - Room decoration -- some destructible, some cover, some traversible, some blocking (Sight/     sound)
    - Door opening direction blocks sight
    - Breakable windows
 - Mission objectives
 - Sprite animations
 - Extra controls (touch, gamepad, mouse)
 - Sound FX
 - Music

Actions
=======

I'm clearly overthinking this but I'm still trying to map out how I want to handle multi-step player actions like firing a weapon at a specific target. This is what I'm currently thinking:

Firing a weapon
    - Player presses F key
    - Received by GUI as keystroke message, GUI determines that keystroke is a character action
    - GUI passes action message to player character object and awaits confirmation
    - Character looks up action and passes the message to the action handler object. Separating characters from actions because actions depend on what equipment and skills they have or collect.
    - Action object will request more data if needed (who the target is) by sending a more input needed message to the GUI (with a message for the player). The action object will check the map for available targets and send that info to the GUI as well.
    - GUI will prompt the player for the input in a status bar/popover and listen for that input
    - Once received, the input is returned to the action object then the action will confirm the weapon has been fired with a final message to the GUI; OR
    - The player cancels the action and the action object will receive a cancellation message from the GUI.
    - The GUI goes back to listening for new action keystrokes.

I have at least a dozen actions in the game and I think I can use this setup to also handle AI driven decisions symmetrically with how I handle player input. In past games, I've simply passed all control states to all action objects in an update loop and left it to them to decide whether to respond and to handle any needs for subsequent inputs. But that way tends to result in quite a bit of duplicative code in each action object and puts a bunch of GUI concerns into actions, both of which I'm trying to avoid with this setup.

ESKV related
============
 - Two finger pan, fix zoom (center of zoom should stay between fingers)
 - Auto-orienting box layout
 - Do something about string rules properties specified in code (rather than markup) [PARTIAL FIXED]
 - Cache static parts of tilemap for much faster redraws
