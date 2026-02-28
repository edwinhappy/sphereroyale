# Sphere Royale Technical Audit

_Date: 2026-02-28_

## Executive Summary

- **Overall health:** Functional prototype with a coherent real-time architecture, but not production-ready.
- **Primary strengths:** Clear game-state lifecycle, defensive payment verification flow, and pragmatic use of Socket.IO + MongoDB + Redis + Agenda.
- **Primary risks:** Build/packaging drift between frontend and backend, physics instability edge cases, schedule API contract mismatch, and authentication/authorization flow gaps.
- **Technical debt:** **Medium-high** (several correctness and maintainability defects are concentrated in core paths).

## Architecture Overview (text diagram)

1. **Frontend (Vite + React)**
   - `index.tsx` mounts `App`.
   - `App.tsx` coordinates views, auth/session state, logs, and socket-driven game updates.
   - UI components render registration, admin dashboard, arena canvas, and controls.

2. **Backend (Express + Socket.IO + MongoDB + Redis + Agenda)**
   - `server/index.ts` bootstraps Express, Socket.IO, DB connection, Redis clients, scheduler, and game loop.
   - REST routes in `server/routes/api.ts` cover registration, admin auth, scheduling, and match history.
   - `server/services/physicsEngine.ts` runs authoritative server physics each tick.

3. **Data stores / infra**
   - MongoDB models: `Participant`, `Schedule`, `Match`.
   - Redis: Socket.IO adapter, token blacklist, leader lock, tx verification cache.
   - Agenda job queue schedules automatic game starts.

## Key Findings Snapshot

### Critical / Major

1. **Build pipeline is broken by monorepo coupling**
   - Root `tsconfig.json` includes both client and server files, but root dependencies do not include backend-only packages.
   - `npm run build` fails in normal environments.

2. **Physics loop can spike `dt` after leadership handoff**
   - `lastTime` updates only when leader; when leadership changes, `dt` can become very large and destabilize simulation.

3. **Collision resolution divides by distance without zero guard**
   - When two sphere centers coincide (`dist = 0`), normalization produces `NaN`, corrupting state.

4. **Schedule API contract mismatch (`null` unsupported in validator, but code expects it)**
   - Validation requires `nextGameTime` datetime; route contains an `else` branch intended for clearing schedule.

5. **TON payment return value appears incompatible with backend verifier expectations**
   - Frontend returns TON BOC from wallet call, but backend verification expects chain transaction hash for TonCenter lookup.

### Minor / Quality

- Multiple unused/dead code paths (`generateGladiators`, `generateCommentary`, `VerifyToasts`, `isTokenRefreshable`, unused physics constants).
- Hard-coded timezone offset (`+03:00`) in admin scheduling UI.
- Duplicate state checks and side-effect-heavy component orchestration in `App.tsx`.

## Prioritized Action Plan

1. **Stabilize build boundaries** (split tsconfigs per package, add workspace scripts).
2. **Patch physics safety** (`dt` clamp/substep + zero-distance guard + deterministic tick option).
3. **Fix schedule contract** (accept nullable `nextGameTime` end-to-end).
4. **Correct TON tx identity flow** (store real tx hash / message hash usable by backend verifier).
5. **Tighten auth & login UX** (server-backed participant login or explicit spectator mode).
6. **Refactor dead code and shared utilities**.
