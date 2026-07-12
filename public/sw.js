// Web Share Target(OSの共有シート)で受け取った音声を端末内に保管して/shareへ渡す。
// サーバーへPOSTしない=Vercelの4.5MBリクエスト制限を受けずに24MBまで扱える。
const SHARED_AUDIO_CACHE = 'shared-audio'
const SHARED_AUDIO_KEY = '/__shared-audio'

self.addEventListener('install', () => {
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url)

    if (event.request.method === 'POST' && url.pathname === '/api/share') {
        event.respondWith(handleShareTarget(event.request))
    }
})

async function handleShareTarget(request) {
    try {
        const formData = await request.formData()
        const file = formData.get('audio')
        const title = formData.get('title')
        const text = formData.get('text')

        const params = new URLSearchParams()
        if (typeof title === 'string' && title) params.set('title', title)
        if (typeof text === 'string' && text) params.set('text', text)

        if (file && typeof file !== 'string' && file.size > 0) {
            const cache = await caches.open(SHARED_AUDIO_CACHE)
            await cache.put(
                SHARED_AUDIO_KEY,
                new Response(file, {
                    headers: {
                        'Content-Type': file.type || 'application/octet-stream',
                        'X-Shared-File-Name': encodeURIComponent(file.name || 'shared-audio.m4a'),
                    },
                })
            )
            params.set('sharedAudio', '1')
        }

        const query = params.toString()
        return Response.redirect('/share' + (query ? '?' + query : ''), 303)
    } catch (error) {
        return Response.redirect('/share?error=share-failed', 303)
    }
}
