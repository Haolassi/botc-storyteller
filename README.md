# Storyteller Notes

Version: `0.10.0`

Storyteller Notes is a local-first Next.js utility for running social deduction games as a storyteller aid. It is designed to support offline, in-person play: the app records the storyteller's private backend state and provides rule references, but the storyteller still makes the final ruling and decides what information to give.

This project does not implement authentication, online multiplayer, a database, official artwork, or automatic full rules adjudication.

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

## Version 0.10 Scope

The `0.10.0` version marks the first broadly usable local storyteller aid:

- Local script and game management.
- Trouble Brewing role data and interaction helpers.
- Usable storyteller game table.
- Day/night phase flow.
- Player state tracking.
- Structured backend logs with readable timeline display and JSON export.

Future versions may add broader script coverage, richer rule references, better log editing/correction UI, import/export for full games, and optional online collaboration.
