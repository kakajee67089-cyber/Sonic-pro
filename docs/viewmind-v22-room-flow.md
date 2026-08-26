# ViewMind v2.2 room flow

## Music room
1. Open the room radar.
2. The old automatic 10-second close is disabled by the v2.2 edge integration.
3. A user may join by a six-character team code.
4. Connected users are rendered from the Socket.IO `room:state` / `room:users` events.
5. The host is the only user allowed to START the room.
6. Non-host users remain in a waiting state until a host start event is received.
7. Host start is broadcast through the existing `music:event` channel with `action: start`.
8. Existing Firebase and Socket.IO systems are retained; the Admin client-side system is not removed by this change.

## Requests
- A logged-in user can enter a target UID/email identifier and send `game:request`.
- The existing server forwards requests to the target's online sockets.
- The target receives an accept/reject prompt and the response is sent back with `game:request:response`.

## Important limitation
The existing server's request lookup is UID-based. An email address must therefore be resolved to the account UID by the existing Firebase profile/search layer before the server can deliver a request by UID. This patch does not invent an email-to-UID lookup source.
