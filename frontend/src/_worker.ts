/**
 * Cloudflare Worker - API Proxy
 * 
 * This worker proxies all /api/* requests to the Cloud Run backend.
 * Static assets are served by Cloudflare Pages.
 */

interface Env {
  BACKEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Only proxy API requests
    if (!url.pathname.startsWith('/api/')) {
      // Let Pages handle non-API requests
      return new Response('Not an API request', { status: 404 });
    }

    // Remove /api prefix and construct backend URL
    const backendPath = url.pathname.replace(/^\/api/, '');
    const backendUrl = new URL(backendPath + url.search, env.BACKEND_URL);

    // Forward CORS headers from frontend
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
      'Access-Control-Max-Age': '86400',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // Create forwarded request
      const forwardedRequest = new Request(backendUrl.toString(), {
        method: request.method,
        headers: new Headers(request.headers),
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      });

      // Forward authorization header
      const authHeader = request.headers.get('Authorization');
      if (authHeader) {
        forwardedRequest.headers.set('Authorization', authHeader);
      }

      // Make the request to backend
      const response = await fetch(forwardedRequest);

      // Clone response and add CORS headers
      const responseClone = response.clone();
      const newHeaders = new Headers(responseClone.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      return new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(
        JSON.stringify({
          error: 'Backend request failed',
          message: errorMessage,
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  },
};
