# Changelog

## v0.11.1 - Vercel Create Room Hotfix

Release notes: [docs/releases/v0.11.1.md](docs/releases/v0.11.1.md)

### Fixed

- Fixed the online create-room page crashing on empty or non-JSON API responses in deployed environments.
- Added JSON error handling for missing Supabase server environment variables in the create-room API.
- Improved Chinese error messages for online room creation failures.

### Notes

- No game rules, local play behavior, or remote action logic were changed.

## v0.11.0 - Online Multiplayer MVP

Release notes: [docs/releases/v0.11.0.md](docs/releases/v0.11.0.md)

### Added

- Added local / online play entry points.
- Added online room creation, joining, waiting room member sync, placeholder players, placeholder deletion, and player leave flow.
- Added Supabase schema draft, Supabase client wrappers, and online room/member/game/action types.
- Added online game state storage in `game_states` with Realtime refresh support.
- Added remote `submitAction` API backed by `validateGameAction` and `reduceGameAction`.
- Added RPC-style `submit_game_action` database function to atomically write `game_actions` and update `game_states`.
- Added storyteller online controls for phase advance, day sub-phase, manual notes, player status, nominations, Slayer ability, and generic night actions.
- Added visibility filtering for online game reads so player and spectator views do not receive full storyteller state.

### Changed

- Bumped package version from `0.10.0` to `0.11.0`.
- Refactored local game mutations toward action-based flow while preserving local play behavior.
- Added `GameStore` abstractions and local / remote store shells for future remote persistence.

### Notes

- Online multiplayer is an MVP. It supports room flow, state sync, visibility filtering, and storyteller-driven actions, but it does not yet provide player-submitted game actions or full role-specific online UI.
- Supabase SQL changes must be applied manually from `supabase/schema.sql`.

## v0.10.0 - Local Storyteller Aid

Initial broadly usable local storyteller aid with local script/game management, Trouble Brewing role helpers, day/night phase flow, player state tracking, and structured storyteller logs.
