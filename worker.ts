// worker.ts — Cloudflare Worker entry point
export interface Env {
  AI_API_KEY?: string;
}

const HTML = `<!DOCTYPE html>
<html><head><title>ZeroClaw 🐾</title>
<style>
  body{background:#0a0a0a;color:#00ff41;font-family:monospace;max-width:700px;margin:40px auto;padding:20px}
  h1{font-size:2em}h2{color:#00cc33}a{color:#00ff41}pre{background:#111;padding:16px;border:1px solid #00ff4133;border-radius:4px}
</style></head><body>
<h1>🐾 ZeroClaw</h1>
<p><em>I Know Kung Fu. Now Guns Lots of Guns.</em></p>
<h2>The Minimum Repo-Native Agent Framework</h2>
<p>Skills = Kung Fu. Equipment = Guns Lots of Guns. Soul = Clothing. Vessel = The Cyborg.</p>
<pre>zeroclaw init my-vessel
cd my-vessel && npm install && npx zeroclaw run</pre>
<h2>API</h2>
<p><a href="/api/skills">/api/skills</a> · <a href="/api/equipment">/api/equipment</a></p>
<p>POST /api/chat — <code>{"message": "..."}</code> (BYOK: set <code>AI_API_KEY</code> env)</p>
</body></html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = { 'Content-Type': 'text/html;charset=utf-8' };

    if (url.pathname === '/' || url.pathname === '/health') {
      return url.pathname === '/health'
        ? Response.json({ status: 'alive', timestamp: Date.now() })
        : new Response(HTML, { headers });
    }

    if (url.pathname === '/api/skills') {
      return Response.json([
        { name: 'socratic', description: 'Responds with probing questions' },
        { name: 'debug', description: 'Systematic root-cause analysis' },
        { name: 'refactor', description: 'Code quality thinking' },
      ]);
    }

    if (url.pathname === '/api/equipment') {
      return Response.json({ mounted: [], available: [] });
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const { message } = await request.json() as { message: string };
      // BYOK: in production, wire this to your LLM provider
      return Response.json({
        response: `[ZeroClaw] Received: "${message}". Configure AI_API_KEY for full agent loop.`,
        skills: ['socratic', 'debug', 'refactor'],
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
