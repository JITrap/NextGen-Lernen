/* Chromium erreicht den Agent-Proxy nicht (CONNECT wird zurückgesetzt),
   Node-fetch schon. Deshalb: alle Browser-Requests abfangen und über
   Node-fetch ausführen. Redirects werden IM Handler aufgelöst (ein vom
   Browser verfolgter fulfill-302 umgeht die Interception), Cookies laufen
   über einen eigenen Jar + den Browser-Context. */
const STRIP_RES = new Set(['content-encoding', 'transfer-encoding', 'content-length', 'connection', 'keep-alive', 'set-cookie', 'location']);

export async function routeThroughNode(context) {
  const jar = new Map(); // host -> Map(name -> value)

  const jarFor = host => {
    if (!jar.has(host)) jar.set(host, new Map());
    return jar.get(host);
  };
  const storeSetCookies = (url, res) => {
    const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const host = new URL(url).hostname;
    const forBrowser = [];
    for (const sc of list) {
      const parts = sc.split(';');
      const [pair] = parts;
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim(), value = pair.slice(eq + 1).trim();
      jarFor(host).set(name, value);
      // Auch in den Browser-Context spiegeln, damit document.cookie (CSRF-Flows) funktioniert.
      const attrs = Object.fromEntries(parts.slice(1).map(p => {
        const i = p.indexOf('=');
        return i > 0 ? [p.slice(0, i).trim().toLowerCase(), p.slice(i + 1).trim()] : [p.trim().toLowerCase(), true];
      }));
      forBrowser.push({
        name, value,
        domain: attrs.domain ? String(attrs.domain).replace(/^\./, '.') : host,
        path: attrs.path || '/',
        secure: true,
        httpOnly: 'httponly' in attrs,
      });
    }
    if (forBrowser.length) context.addCookies(forBrowser).catch(() => {});
  };
  const cookieHeader = async (url) => {
    const host = new URL(url).hostname;
    const merged = new Map();
    try {
      for (const c of await context.cookies(url)) merged.set(c.name, c.value);
    } catch {}
    for (const [k, v] of jarFor(host)) merged.set(k, v);
    return merged.size ? [...merged].map(([k, v]) => `${k}=${v}`).join('; ') : null;
  };

  await context.route('**/*', async route => {
    const req = route.request();
    let url = req.url();
    if (process.env.LP_ROUTE_DEBUG) console.log('INTERCEPT', req.method(), url.slice(0, 100));
    try {
      const baseHeaders = { ...req.headers() };
      delete baseHeaders['accept-encoding'];
      let method = req.method();
      let body = req.postDataBuffer() ?? undefined;
      let res;
      for (let hop = 0; hop < 6; hop++) {
        const headers = { ...baseHeaders };
        const ck = await cookieHeader(url);
        if (ck) headers.cookie = ck; else delete headers.cookie;
        res = await fetch(url, { method, headers, body, redirect: 'manual' });
        storeSetCookies(url, res);
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const loc = res.headers.get('location');
          if (!loc) break;
          url = new URL(loc, url).href;
          if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === 'POST')) {
            method = 'GET';
            body = undefined;
          }
          continue;
        }
        break;
      }
      const outHeaders = {};
      res.headers.forEach((v, k) => { if (!STRIP_RES.has(k.toLowerCase())) outHeaders[k] = v; });
      const buf = Buffer.from(await res.arrayBuffer());
      await route.fulfill({ status: res.status, headers: outHeaders, body: buf });
    } catch (e) {
      if (process.env.LP_ROUTE_DEBUG) console.log('ROUTE ERR', url.slice(0, 90), String(e).slice(0, 140));
      await route.abort('failed').catch(() => {});
    }
  });
}
