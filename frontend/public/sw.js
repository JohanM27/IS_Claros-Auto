const STATIC_CACHE = 'claros-auto-static-v1'
const PUBLIC_CACHE = 'claros-auto-public-v1'
const OFFLINE_PAGE = '/offline.html'
const SHELL_PATH = '/index.html'

async function precacheAppShell() {
  const cache = await caches.open(STATIC_CACHE)
  const response = await fetch(SHELL_PATH, { cache: 'reload' })
  if (!response.ok) throw new Error('No se pudo guardar la aplicación para uso sin conexión.')
  const html = await response.text()
  await cache.put(
    SHELL_PATH,
    new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  )
  await cache.put(
    '/',
    new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  )

  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path.startsWith('/'))
  const urls = new Set([
    ...assetPaths,
    OFFLINE_PAGE,
    '/manifest.webmanifest',
    '/icons/claros-auto.svg',
    '/icons/claros-auto-192.png',
    '/icons/claros-auto-512.png',
    '/robots.txt',
    '/sw.js',
  ])
  await Promise.all(
    [...urls].map(async (path) => {
      try {
        const asset = await fetch(path, { cache: 'reload' })
        if (asset.ok) await cache.put(path, asset)
      } catch {
        // Un asset opcional que no responda no impide instalar el resto del shell.
      }
    }),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith('claros-auto-') && ![STATIC_CACHE, PUBLIC_CACHE].includes(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isPrivatePage(pathname) {
  return /^\/(?:login|admin|citas)(?:\/|$)/.test(pathname)
}

async function fetchPublicServices(request) {
  const cache = await caches.open(PUBLIC_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok && response.status === 200) await cache.put(request, response.clone())
    return response
  } catch {
    return (
      (await cache.match(request)) ??
      new Response(
        JSON.stringify({
          error: { code: 'OFFLINE', message: 'El catálogo no está disponible sin conexión.' },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      )
    )
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (url.pathname === '/api/servicios') {
    event.respondWith(fetchPublicServices(request))
    return
  }

  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request)
        } catch {
          const cache = await caches.open(STATIC_CACHE)
          if (isPrivatePage(url.pathname))
            return (await cache.match(OFFLINE_PAGE)) ?? Response.error()
          return (
            (await cache.match(SHELL_PATH)) ?? (await cache.match(OFFLINE_PAGE)) ?? Response.error()
          )
        }
      })(),
    )
    return
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE)
        return (await cache.match(request)) ?? fetch(request)
      })(),
    )
  }
})
