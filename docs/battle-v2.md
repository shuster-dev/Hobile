# Battle model v2 — the contract

Changes to combat start here, not in the code.

## Who fights

The **team** fights; the trainer stands behind it.

- Combatant kinds: `trainer | creature | wild | boss`. `player` is gone — it is
  normalized to `creature` on construction. Anything still looking for it is
  broken.
- A battle fields the player's whole team. One creature is on the field, the
  rest are benched, each with its `slot` (team order). The trainer is a
  combatant too, and starts benched.
- `enemiesOf` skips the benched and the dead, and returns the trainer **only
  when its side has no living creature**. That one rule is what makes "my own
  health does not drop until all of them are down" true.

## Switching

- A switch costs a turn: `PROGRESSION.switchDelayMs` (1200 ms). Without the
  cost, switching is free immunity.
- Each side also has `SWITCH_COOLDOWN_MS` (6000 ms) between manual switches.
- Sending the trainer out is a switch like any other, and takes the same delay.
- The client asks by creature **uid**; `swapToUid` maps it to a combatant on
  the requester's own side. Ownership is checked: without it a player could
  switch in a party member's creature, or in PvP one of the opponent's.
- The active combatant must be read live (`Combat.activeOf`). A reference
  captured when the battle started points at the creature that just left the
  field, and every button then acts on a corpse.

## Capture

`PROGRESSION.captureWindowMs` (2400 ms) freezes **everyone**, not just the
target — otherwise a ball lands and the wild keeps attacking through it.

The anchor is absolute: 100% hp → 5%, 1 hp → 99%. Rarity and level are a
**penalty that fades as the target weakens**, never a flat multiplier:

```js
const t       = (maxHp - hp) / Math.max(1, maxHp - 1);   // 0 at full, 1 at 1 hp
const base    = 0.05 + 0.94 * t;
const hardness = RARITY[rarity] * Math.max(0.5, 1 - level / 120);
const applied  = hardness + (1 - hardness) * t;          // the penalty fades
```

A flat multiplier was tried first and gave 94% at 1 hp instead of 99%. The
difficulty has to live in *getting* something rare down to 1 hp, not in the
anchor. Measured: common lv6 → 5 / 51 / 99. Rare lv40 → 1 / 32 / 99.

**The same function runs client-side on the ball button.** The number shown to
the player is the number the server rolls.

## Trainer health

`PROGRESSION.trainerHp(level) = 60 + level * 14`, stored as `doc.trainerHp`,
normalized in `normalizeDoc`, restored by `healTeam`, exposed in
`publicProfile`. The UI marks the trainer row `shielded` or `exposed`.

## What the client must be told

`battleInit` carries `you` (the active combatant id), `team` (an array of
`{id, uid}` mapping combatants to creatures), `trainer` (the trainer's
combatant id), `inventory` and `profile`.

Synced combatant state carries `benched`, `slot` and `frozenUntil` alongside
hp and stamina. Without them the client cannot draw a bench, cannot order the
team, and shows a frozen combatant as idle.
