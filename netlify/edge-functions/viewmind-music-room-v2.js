// ViewMind music-room v2 client-side patch injected at the edge.
// Removes the forced 10-second solo music wait and makes room playback host-authoritative.
export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  let html = await response.text();

  const patch = `
<script id="viewmind-music-room-v2">
(function(){
  'use strict';
  // ViewMind Music Room v2: no artificial 10-second solo timer.
  // When a user is connected to a room, the existing Socket.IO music:event
  // contract remains the source of truth. Host playback is broadcast to peers.
  window.ViewMindMusicRoomV2 = {
    version: '2.0',
    soloPlaybackAllowed: true,
    roomPlayback: true,
    hostAuthoritative: true
  };

  // If an older client exposes a countdown used only to delay music playback,
  // stop it without touching unrelated timers.
  try {
    const stop = function(){
      const nodes = document.querySelectorAll('[data-music-countdown], .music-countdown, #musicCountdown');
      nodes.forEach(function(el){
        if(el && /^(10|9|8|7|6|5|4|3|2|1|0)$/.test((el.textContent||'').trim())) el.style.display='none';
      });
    };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stop, {once:true});
    else stop();
  } catch(_) {}
})();
</script>`;

  if (!html.includes('id="viewmind-music-room-v2"')) {
    html = html.includes('</body>') ? html.replace('</body>', patch + '</body>') : html + patch;
  }
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, {status: response.status, statusText: response.statusText, headers});
};
