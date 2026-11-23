import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const files = new Set([
  'index.html', 'style.css', 'spark.svg', 'logic.js', 'view.js', 'game.js',
  'vendor/three.module.min.js', 'vendor/three.core.min.js', 'vendor/THREE-LICENSE', 'LICENSE'
]);
const types = { html: 'text/html', css: 'text/css', svg: 'image/svg+xml', js: 'text/javascript' };

export async function serve(port = 0) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname.replace(/^\/(?:viverse-spark-2026(?:\/|$))?/, '') || 'index.html';
    if (!files.has(path)) { res.writeHead(404).end('Not found'); return; }
    try {
      const body = await readFile(new URL('../' + path, import.meta.url));
      res.writeHead(200, { 'Content-Type': types[path.split('.').at(-1)] || 'text/plain' }).end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  await new Promise((resolve, reject) => server.listen(port, '127.0.0.1', resolve).once('error', reject));
  return { server, url: 'http://127.0.0.1:' + server.address().port };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url } = await serve(Number(process.env.PORT) || 8080);
  console.log('Spark Drift: ' + url);
}
