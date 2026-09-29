# Ghost Hunter (Wii homebrew)

The room is pitch black and the Wiimote is your only tool:

| Control | Action |
|---|---|
| Point at screen | Aim (IR sensor bar); D-pad works if no sensor bar |
| Hold **B** | Flashlight (drains battery) - ghosts flee from light |
| **A** | Zap ghosts within the ring (costs battery) |
| **Shake** Wiimote | Recharge battery |
| Rumble | Ghost radar: pulses get faster as a hidden ghost gets closer |
| **HOME** | Exit to Homebrew Channel |

Catch every ghost before the timer runs out; each level adds a ghost.

## Build
Install [devkitPro](https://devkitpro.org) (`wii-dev` group), then:

    cd wii-ghost-hunter && make

Copy to SD: `apps/ghost-hunter/boot.dol` + `meta.xml`, launch via the Homebrew Channel
(or `wiiload ghost-hunter.dol`, or Dolphin). CI (`.github/workflows/wii-ghost-hunter.yml`)
builds it and uploads a ready-to-copy artifact.
