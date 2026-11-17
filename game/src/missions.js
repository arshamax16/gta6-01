// Solmar Bay — the story. Five missions for Dante "D" Reyes, a wheelman
// fresh out of the Old Harbor docks, and the fixer network that hires him:
// Rosa at the diner, Vince Corso who runs the Sunset Hills crew, and the
// rival Saltwater crew that wants them both gone. Each mission is a list of
// steps; the mission manager in main.js starts a step and watches for its
// completion. After the finale a repeatable courier job keeps the city busy.

import { LANDMARKS } from './config.js';

// A step is one of:
//   goto    — reach the marker (x, y, radius)
//   talk    — press E at the marker to hear the lines, then continue
//   steal   — get into any car (E next to it)
//   pickup  — press E at the marker to grab the item
//   kill    — defeat `count` goons spawned at `spawn` (they come to you)
//   timed   — drive through every checkpoint before the timer runs out
//   hold    — stand in the marker zone for `seconds` (E to start the grab)
//   deliver — reach the marker while carrying the goods
export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Wheels',
    giver: "Rosa — Rosa's Diner",
    reward: 150,
    briefing: [
      "ROSA: Dante! You're back in Solmar Bay and already broke, huh?",
      "ROSA: I need wheels for the diner run. Borrow a car — any car. Nobody here locks theirs.",
      "ROSA: Bring it to the diner lot and I'll put you on the payroll.",
    ],
    steps: [
      { type: 'goto', x: LANDMARKS.diner.x, y: LANDMARKS.diner.y, radius: 90, label: "Go to Rosa's Diner" },
      { type: 'talk', x: LANDMARKS.diner.x, y: LANDMARKS.diner.y, radius: 100, label: 'Talk to Rosa (E)',
        lines: ["ROSA: There's a row of cars by the plaza. Take one — quick, before the owner finishes lunch."] },
      { type: 'steal', label: 'Steal a car (stand by it, press E)' },
      { type: 'goto', x: LANDMARKS.diner.x + 60, y: LANDMARKS.diner.y + 60, radius: 80, inCar: true, label: 'Drive the car back to the diner' },
    ],
    complete: ["ROSA: Clean job. $150, and the keys to a better life — eventually.", "VINCE (phone): Rosa says you can drive. Come see me at the Hideout."],
  },
  {
    id: 'm2',
    title: 'The Pickup',
    giver: 'Vince Corso',
    reward: 400,
    briefing: [
      "VINCE: The Saltwater crew is sniffing around my docks. A crate came in last night — mine, not theirs.",
      "VINCE: Pick it up at the Old Harbor Docks and bring it to the Hideout. Don't let the cops see you carrying it.",
    ],
    steps: [
      { type: 'goto', x: LANDMARKS.docks.x, y: LANDMARKS.docks.y, radius: 90, label: 'Go to the Old Harbor Docks' },
      { type: 'pickup', x: LANDMARKS.docks.x, y: LANDMARKS.docks.y, radius: 60, label: 'Grab the crate (E)', heat: 30 },
      { type: 'deliver', x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, radius: 90, label: 'Deliver the crate to the Hideout' },
    ],
    complete: ["VINCE: The crate's safe. $400. You're earning a name, Dante.", "VINCE: The Saltwaters won't forget this. Watch the pier."],
  },
  {
    id: 'm3',
    title: 'Getaway Driver',
    giver: 'Vince Corso',
    reward: 600,
    briefing: [
      "VINCE: My crew hit a warehouse in Downtown and the cops are all over it. They need a wheelman — you.",
      "VINCE: Thread the checkpoints through Downtown, then lose the heat at the Hideout. Don't stop for anything.",
    ],
    steps: [
      { type: 'timed', label: 'Hit all 3 checkpoints before time runs out', seconds: 150,
        checkpoints: [
          { x: 2200, y: 600 }, { x: 3000, y: 1400 }, { x: 2200, y: 2600 },
        ], heat: 50 },
      { type: 'deliver', x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, radius: 90, label: 'Lose the cops — reach the Hideout' },
    ],
    complete: ["VINCE: Beautiful driving. The crew's free and the cops are chasing ghosts.", "VINCE: $600. One more thing — the Saltwaters are massing at the Marina Pier."],
  },
  {
    id: 'm4',
    title: 'Turf War',
    giver: 'Vince Corso',
    reward: 800,
    briefing: [
      "VINCE: The Saltwater crew is moving on the Marina Pier tonight. Five of them, armed, claiming my turf.",
      "VINCE: Go down there and end it. Fists or the pistol Rosa sold you — your call. Come back breathing.",
    ],
    steps: [
      { type: 'goto', x: LANDMARKS.pier.x, y: LANDMARKS.pier.y, radius: 110, label: 'Go to the Marina Pier' },
      { type: 'kill', count: 5, spawn: { x: LANDMARKS.pier.x, y: LANDMARKS.pier.y }, label: 'Take out the Saltwater crew (0/5)' },
      { type: 'goto', x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, radius: 90, label: 'Report back to the Hideout' },
    ],
    complete: ["VINCE: The pier is ours again. $800, and the Saltwaters will think twice.", "VINCE: One last job, Dante. The big one. The Bank of Solmar."],
  },
  {
    id: 'm5',
    title: 'The Big Score',
    giver: 'Vince Corso',
    reward: 2000,
    briefing: [
      "VINCE: The Bank of Solmar moves its weekend take on Friday. One vault, one bag, one fast car.",
      "VINCE: Get inside, crack the vault, and bring the bag to the Hideout. The whole Solmar police force will be on you. Make it count.",
    ],
    steps: [
      { type: 'goto', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, radius: 100, label: 'Go to the Bank of Solmar' },
      { type: 'hold', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, radius: 70, seconds: 4, label: 'Crack the vault — hold E', heat: 75 },
      { type: 'deliver', x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, radius: 90, label: 'Escape! Deliver the bag to the Hideout' },
    ],
    complete: [
      "VINCE: Two thousand dollars' worth of clean getaway. You're a legend now, Dante.",
      "ROSA: Dinner's on me tonight. The whole Bay is talking about you.",
      "STORY COMPLETE — Solmar Bay is yours. Courier jobs keep paying at the Hideout.",
    ],
  },
];

// Repeatable side job after the story (or between missions, from the Hideout).
export function makeCourierJob(rng, index) {
  const spots = [LANDMARKS.docks, LANDMARKS.pier, LANDMARKS.plaza, LANDMARKS.bank, LANDMARKS.diner];
  const dest = spots[Math.floor(rng() * spots.length)];
  return {
    id: `courier-${index}`,
    title: 'Courier Run',
    giver: 'Rosa — side job',
    reward: 120,
    briefing: [`ROSA: A parcel needs to reach ${dest.name}. $120 if it's there in one piece.`],
    steps: [
      { type: 'pickup', x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, radius: 70, label: 'Pick up the parcel at the Hideout (E)' },
      { type: 'deliver', x: dest.x, y: dest.y, radius: 90, label: `Deliver the parcel to ${dest.name}` },
    ],
    complete: ['ROSA: Delivered. $120 — come back when you want another run.'],
  };
}

// Human-readable objective line for the HUD.
export function objectiveText(mission, stepIndex, stepState) {
  if (!mission) return 'Free roam — visit the Hideout for work';
  const step = mission.steps[stepIndex];
  if (!step) return mission.title;
  if (step.type === 'kill') {
    const done = stepState.kills || 0;
    return `Take out the Saltwater crew (${done}/${step.count})`;
  }
  if (step.type === 'timed') {
    const hit = stepState.checkpointsHit || 0;
    const left = Math.max(0, Math.ceil(stepState.timeLeft || 0));
    return `Checkpoints ${hit}/${step.checkpoints.length} — ${left}s left`;
  }
  if (step.type === 'hold' && stepState.holding) {
    return `Cracking the vault… ${Math.ceil(stepState.holdLeft || 0)}s`;
  }
  return step.label;
}
