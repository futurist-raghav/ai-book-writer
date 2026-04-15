interface ProxyRequestContext {
  request: Request;
  next: () => Promise<Response>;
}

export const onRequest = async (context: ProxyRequestContext): Promise<Response> => {
  const url = new URL(context.request.url);
  
  if (!url.pathname.startsWith('/api/v1/')) {
    return context.next();
  }

  const backendUrl = 'http://35.200.193.248:8000';
  const forwardPath = url.pathname + url.search;
  const targetUrl = backendUrl + forwardPath;

  const headers = new Headers(context.request.headers);
  headers.delete('host');
  headers.set('x-forwarded-proto', 'https');
  headers.set('x-forwarded-host', url.hostname);

  const init: RequestInit = {
    method: context.request.method,
    headers,
    body: context.request.body,
  };

  try {
    const response = await fetch(targetUrl, init);
    const newResponse = new Response(response.body, response);
    
    // Add CORS headers to allow requests from Cloudflare Pages
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    return newResponse;
  } catch (error) {
    console.error('Backend proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Backend service unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
