export default {
    async fetch(request) {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders() });
        }

        if (url.pathname === '/health') {
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() }
            });
        }

        if (!url.pathname.startsWith('/api/metaculus/')) {
            return new Response('Not found', { status: 404, headers: corsHeaders() });
        }

        const targetPath = url.pathname.replace('/api/metaculus', '');
        const targetUrl = new URL(`https://www.metaculus.com/api${targetPath}`);
        url.searchParams.forEach((value, key) => {
            targetUrl.searchParams.append(key, value);
        });

        const upstream = await fetch(targetUrl.toString(), {
            method: 'GET',
            headers: { 'User-Agent': 'MarketAnalyzer/1.0' }
        });

        const body = await upstream.text();
        const contentType = upstream.headers.get('content-type') || 'application/json';

        return new Response(body, {
            status: upstream.status,
            headers: { 'Content-Type': contentType, ...corsHeaders() }
        });
    }
};

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
}
