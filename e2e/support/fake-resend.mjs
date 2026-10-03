// Stand-in for the Resend API used by the e2e stack: the worker is pointed
// at it with RESEND_API_URL, every "sent" letter is kept in memory and the
// tests read them back over HTTP to follow the links inside.
//
//   POST   /emails            -> what the worker calls to send (answers {id})
//   GET    /_mailbox?to=addr  -> letters sent to that address, oldest first
//   DELETE /_mailbox          -> forget everything
//   GET    /health            -> readiness probe for Playwright
import { createServer } from 'node:http';

const port = Number(process.env.FAKE_RESEND_PORT ?? 18_025);
const mailbox = [];

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${port}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    return sendJson(response, 200, { status: 'ok' });
  }

  if (request.method === 'POST' && url.pathname === '/emails') {
    const letter = JSON.parse((await readBody(request)) || '{}');
    mailbox.push({ ...letter, receivedAt: Date.now() });
    return sendJson(response, 200, { id: `fake-${mailbox.length}` });
  }

  if (request.method === 'GET' && url.pathname === '/_mailbox') {
    const to = url.searchParams.get('to')?.toLowerCase();
    const letters = mailbox.filter(
      (letter) =>
        !to ||
        [letter.to].flat().some((address) => address?.toLowerCase() === to),
    );
    return sendJson(response, 200, letters);
  }

  if (request.method === 'DELETE' && url.pathname === '/_mailbox') {
    mailbox.length = 0;
    return sendJson(response, 200, { success: true });
  }

  return sendJson(response, 404, { error: 'not found' });
}).listen(port, () => {
  console.log(`fake resend listening on :${port}`);
});
