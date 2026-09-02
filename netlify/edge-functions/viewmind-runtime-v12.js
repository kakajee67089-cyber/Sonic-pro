// SonicSync Pro v12 runtime fixes loader.
// The main app remains unchanged; this only loads the additive runtime compatibility layer.
export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  let html = await response.text();
  const patch = '<script id="sonicsync-fixes-v12" src="/sonicsync-fixes.js" defer></script>';
  if (!html.includes('id="sonicsync-fixes-v12"')) {
    html = html.includes('</body>') ? html.replace('</body>', patch + '</body>') : html + patch;
  }
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, {status: response.status, statusText: response.statusText, headers});
};
