# ViewMind Realtime Contract v1

## Identity
- Firebase ID token is the authentication credential at the realtime boundary.
- Firebase UID is the canonical account identifier; client-generated UID values are not authoritative.

## Room lifecycle
- `room:create` creates a room owned by the authenticated host.
- `room:join` adds an authenticated player to a room.
- Only the host may start a room/game.
- Non-host players remain in `waiting` until the server broadcasts `room:started`.
- Reconnect must receive a fresh authoritative room snapshot.

## Music
- Solo playback is allowed without an artificial countdown.
- Inside a room, host playback state is authoritative.
- Playback changes are broadcast to all connected room members through the existing music event channel.

## Quiz
- The server owns start time, deadline, question state, score and ranking.
- Clients submit answers; the server validates them against server-owned quiz data.
- Client-supplied `correct` flags are never trusted for scoring.
- At timeout, the server emits a final result/ranking snapshot.

## Security
- Never embed administrator passwords or service-account private keys in frontend JavaScript.
- Realtime handlers must reject unauthenticated or unauthorized state-changing events.
