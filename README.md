# Solmar Bay — An Open-World Crime Story

[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-ff5e78?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2Zz48L3N2Zz4)](https://make.fun/c/gta6-01)
[![Play in your browser](https://img.shields.io/badge/play-in%20your%20browser-2ecc71?style=for-the-badge)](https://make.fun/c/gta6-01)
[![Open world](https://img.shields.io/badge/open%20world-5%20missions-7b5cff?style=for-the-badge)](https://make.fun/c/gta6-01)

An original open-world crime game built for the **[make.fun](https://make.fun/c/gta6-01) "Make GTA 6" (gta6-01)** bounty. Steal cars, outrun the Solmar police, and work your way up from a broke wheelman to the legend of the Bay.

**Play it:** serve `game/` with any static file server (for example `node serve.ts`, then open http://localhost:8080) and open `game/index.html` in a desktop browser. No build step, no network requests, no libraries — plain JavaScript + Canvas 2D + synthesized WebAudio sound, all offline.

## The story

Dante "D" Reyes is back in **Solmar Bay**, broke and fresh out of the Old Harbor docks. Rosa at the diner needs wheels, Vince Corso of the Sunset Hills crew needs a driver, and the Saltwater crew wants them both gone. Five missions:

1. **First Wheels** — steal a car and bring it to Rosa's Diner.
2. **The Pickup** — grab Vince's crate at the Old Harbor Docks and deliver it to the Hideout.
3. **Getaway Driver** — thread three checkpoints through Downtown in 150 seconds with the cops on your tail.
4. **Turf War** — take out the five-strong Saltwater crew at the Marina Pier.
5. **The Big Score** — crack the vault of the Bank of Solmar and escape with the bag.

After the finale, repeatable courier jobs keep paying at the Hideout.

## Features

- **A city to explore** — a 3.6 km street grid with four districts (Old Harbor, Downtown, Marina, Sunset Hills), a beach and a pier, parks, and six named landmarks.
- **On foot and by car** — walk, sprint, steal any parked or driven car (`E`), arcade driving with skids, crashes, and car damage.
- **Traffic and pedestrians** — cars follow the roads and stop for each other; pedestrians stroll the sidewalks and flee gunfire.
- **Wanted level** — crimes raise 0–5 stars; police cruisers chase and ram, officers get out and arrest you on foot. Lose the heat by breaking line of sight.
- **Combat** — pistol (mouse aim, click to shoot) and fists (`F`), rival goons with health bars who shoot back.
- **HUD + live minimap** — health, cash, wanted stars, mission objective, clock and district, and a minimap with police, cars, and the mission marker.
- **Menus and saving** — title screen, pause menu, help, game over (Wasted / Busted), and autosave + manual save to `localStorage`.
- **Polish** — day/night cycle with golden hour and street-lamp glow, particles (blood, smoke, sparks), skid marks, synthesized engine hum, sirens, gunshots, and a bassline groove (all WebAudio, no audio files).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk, run (Shift), drive |
| E | Steal a car / get out / talk / pick up / crack the vault |
| Mouse + click | Aim and shoot |
| F | Punch |
| P / Esc | Pause |
| M | Mute |
| H | Help |

## Structure

All original code, split by job under `game/src/`:

| File | Job |
| --- | --- |
| `config.js` | Tuning, districts, landmarks, car models |
| `rng.js` | Seeded random generator |
| `city.js` | City generation, roads, buildings, collision |
| `input.js` | Keyboard + mouse |
| `audio.js` | Synthesized WebAudio SFX and music |
| `entities.js` | Player, traffic, pedestrians, police, goons, bullets, particles |
| `missions.js` | The five-mission story and the courier job |
| `save.js` | localStorage save / load |
| `render.js` | World, lighting, HUD, minimap, menus |
| `main.js` | Game loop, driving, combat, wanted, mission manager, screenshot staging |

Everything — the city, characters, vehicles, names, story, art, and sound — is original work made for this entry. Nothing here is from Rockstar Games or any other commercial game.

## License

MIT — see [LICENSE](LICENSE).
