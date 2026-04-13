/**
 * Cloudflare Worker - Proxy to Backend
 * 
 * This worker:
 * 1. Serves the Next.js frontend from Pages  
 * 2. Proxies /api/* requests to your backend
 */

import { getAssetFromKV } from '@cloudflare/kv-asset-handler'

interface Env {
  BACKEND_URL: string
  __STATIC_CONTENT_MANIFEST: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // API requests: proxy to backend
    if (url.pathname.startsWith('/api/')) {
      return handleAPIRequest(request, env)
    }

    // Static assets: serve from Pages
    try {
      return await getAssetFromKV({
        request,
        waitUntil: ctx => undefined,
      })
    } catch (e) {
      // Fallback to index.html for SPA routing
      const indexRequest = new Request(new URL('/', request.url), {
        method: 'GET',
        headers: request.headers,
      })
      return getAssetFromKV({
        request: indexRequest,
        waitUntil: ctx => undefined,
      })
    }
  },
}

async function handleAPIRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const backendUrl = new URL(url.pathname + url.search, env.BACKEND_URL)

  try {
    const forwardedRequest = new Request(backendUrl, {
      method: request.method,
      headers: new Headers(request.headers),
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    })

    const response = await fetch(forwardedRequest)
    const newResponse = new Response(response.body, response)

    // Add CORS headers
    newResponse.headers.set('Access-Control-Allow-Origin', '*')
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    return newResponse
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Backend failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
