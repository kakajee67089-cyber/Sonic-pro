// SonicSync Pro v13 runtime loader.
// Keeps the existing app intact and loads additive compatibility/hotfix layers.
export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  let html = await response.text();
  const patches = [
    '<script id="sonicsync-fixes-v12" src="/sonicsync-fixes.js" defer></script>',
    '<script id="sonicsync-final-hotfix" src="/sonicsync-final-hotfix.js" defer></script>'
  ];
  for (const patch of patches) {
    const id = patch.match(/id="([^"]+)/)?.[1];
    if (id && html.includes('id="'+id+'"')) continue;
    html = html.includes('</body>') ? html.replace('</body>', patch + '</body>') : html + patch;
  }
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, {status: response.status, statusText: response.statusText, headers});
};
