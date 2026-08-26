# ViewMind — 20-point implementation tracker

This document tracks the Draft implementation. A point is marked COMPLETE only after its code path is implemented and reviewed; it is not a claim that the live site has passed production testing.

1. Firebase authentication — IN PROGRESS
2. One email/account → permanent Firebase UID — IN PROGRESS
3. Same UID across devices — IN PROGRESS
4. Reject invalid passwords through Firebase Auth — IN PROGRESS
5. Secure authenticated session/logout — IN PROGRESS
6. Realtime Room Radar — IN PROGRESS
7. Realtime UID/email search — IN PROGRESS
8. Realtime invite/request — IN PROGRESS
9. Accept → synchronized room state — IN PROGRESS
10. Host-only START + player waiting state — IN PROGRESS
11. Server-authoritative multiplayer start/state — IN PROGRESS
12. Reconnect/state resynchronization — IN PROGRESS
13. Duplicate socket/session handling — IN PROGRESS
14. Realtime multiplayer quiz — IN PROGRESS
15. Server-authoritative 60-second quiz timer — IMPLEMENTED FOUNDATION
16. Final-5-second warning signal — IMPLEMENTED FOUNDATION
17. Timeout result/ranking screen data — IMPLEMENTED FOUNDATION
18. Music room: remove artificial 10-second restriction — IMPLEMENTED DRAFT
19. Music room: solo playback + room synchronization groundwork — IMPLEMENTED DRAFT
20. Admin/security + persistent Firebase data/analytics — IN PROGRESS

## Rule
Do not merge this branch to `main` merely because the tracker exists. Each IN PROGRESS item must be implemented in the actual application/server and then reviewed. Live deployment must be verified separately after merge.
