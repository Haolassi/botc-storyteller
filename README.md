# Storyteller Notes

Version: `0.11.1`

Storyteller Notes is a local-first Next.js utility for running social deduction games as a storyteller aid. It is designed to support offline, in-person play: the app records the storyteller's private backend state and provides rule references, but the storyteller still makes the final ruling and decides what information to give.

This project does not implement authentication, official artwork, or automatic full rules adjudication. Online multiplayer is currently an MVP and still relies on storyteller-driven operations.

## Current Features

- Next.js App Router + TypeScript project structure.
- Tailwind CSS and shadcn/ui setup.
- Basic routes for scripts and games.
- Built-in script data for Trouble Brewing / An Liu Yong Dong.
- Global character library with scripts referencing character IDs.
- Local game creation with player seats, character assignment, and saved games in `localStorage`.
- Storyteller game view with round-table seats, player state, role information, alive/dead state, voting state, drunk/poison markers, and expandable player details.
- Day flow support for private chat, speeches, open discussion, nomination, dusk, night, and game end.
- Nomination, voting, execution, retreat, and reset helpers.
- Night action helpers for key Trouble Brewing roles, including Poisoner, Monk, Imp, Empath, Fortune Teller, Undertaker, Butler, Ravenkeeper, Soldier, Mayor, Scarlet Woman, Saint, Virgin, Slayer, Drunk, Recluse, Spy, and Fortune Teller red herring handling.
- Storyteller notes for day sub-phases.
- Structured storyteller-only game logs for phase changes, night actions, information, status changes, nomination, vote, execution, death, ability events, manual notes, corrections, and system events.
- Human-readable log timeline with filters and JSON export for later analysis.
- Local / online play entry points.
- Online room creation and joining by room code.
- Realtime online room member list updates.
- Placeholder players for online room testing.
- Online game start flow with `game_states` persistence.
- Online game state Realtime refresh.
- Remote storyteller action submission through `validateGameAction` and `reduceGameAction`.
- Visibility filtering for online player and spectator views.

## Release Notes

- Changelog: [CHANGELOG.md](CHANGELOG.md)
- v0.11.1 notes: [docs/releases/v0.11.1.md](docs/releases/v0.11.1.md)
- v0.11.0 notes: [docs/releases/v0.11.0.md](docs/releases/v0.11.0.md)

## Data Policy

- Character ability summaries are short paraphrases only.
- No official copyrighted long ability text is included.
- No official artwork, icons, or assets are included.
- Game data is stored locally in the browser through `localStorage`.

## Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Run checks:

```bash
npm run lint
npm run build
```

## Version 0.11.1 Scope

The `0.11.1` version is a Vercel deployment hotfix:

- Online room creation now handles empty or non-JSON API responses safely.
- The create-room API returns JSON errors when Supabase server environment variables are missing.
- The create-room page shows clearer Chinese error messages for deployment/runtime failures.

## Version 0.11 Scope

The `0.11.0` version marks the Online Multiplayer MVP:

- Local play is preserved.
- Online rooms can be created, joined, and synchronized.
- Storytellers can start an online game and drive core game actions remotely.
- Game state is stored in Supabase `game_states` and synchronized through Realtime.
- Remote action writes are recorded in `game_actions` and applied through an RPC-style database function.
- Player and spectator reads are filtered through `visibility.ts`.

## Version 0.10 Scope

The `0.10.0` version marks the first broadly usable local storyteller aid:

- Local script and game management.
- Trouble Brewing role data and interaction helpers.
- Usable storyteller game table.
- Day/night phase flow.
- Player state tracking.
- Structured backend logs with readable timeline display and JSON export.

Future versions may add Supabase Auth, player-submitted actions, richer role-specific online UI, broader script coverage, better log editing/correction UI, and import/export for full games.
