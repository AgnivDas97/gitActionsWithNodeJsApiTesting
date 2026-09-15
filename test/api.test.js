process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const { pool } = require('../db.js');
const { closeRedis } = require('../redis.js');

let server;
let baseUrl;

test.before((t, done) => {
  server = app.listen(0, () => {
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    done();
  });
});

test.after(async () => {
  const { closeWebSocket } = require('../websocket.js');
  closeWebSocket();
  await new Promise((resolve) => server.close(resolve));
  await closeRedis();
  await pool.end();
});

test('GET / should return health status and available endpoints', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'online');
  assert.ok(data.endpoints);
});

test('GET /api/users should return users with filtered fields', async () => {
  const res = await fetch(`${baseUrl}/api/users?limit=5`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.users));
  assert.ok(data.users.length > 0);

  const firstUser = data.users[0];
  assert.ok('id' in firstUser);
  assert.ok('firstName' in firstUser);
  assert.ok('lastName' in firstUser);
  assert.ok('maidenName' in firstUser);
  assert.ok('age' in firstUser);
  assert.ok('gender' in firstUser);
  assert.ok('email' in firstUser);
  assert.ok('phone' in firstUser);
  assert.ok('username' in firstUser);
  assert.ok('birthDate' in firstUser);
  
  // Ensure unrequested sensitive fields like password/bank/crypto are excluded
  assert.strictEqual(firstUser.password, undefined);
  assert.strictEqual(firstUser.bank, undefined);
});

test('GET /api/users/:id should return single user details', async () => {
  const res = await fetch(`${baseUrl}/api/users/1`);
  assert.strictEqual(res.status, 200);
  const user = await res.json();
  assert.strictEqual(user.id, 1);
  assert.ok(user.firstName);
  assert.ok(user.email);
});

test('GET /api/users/:id should return 404 for non-existent user', async () => {
  const res = await fetch(`${baseUrl}/api/users/99999`);
  assert.strictEqual(res.status, 404);
  const data = await res.json();
  assert.ok(data.error);
});

test('GET /api/users/role/:role should return filtered users by role', async () => {
  const res = await fetch(`${baseUrl}/api/users/role/admin`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.role, 'admin');
  assert.ok(Array.isArray(data.users));
});

test('GET /api/users?limit=2&skip=1 should support pagination', async () => {
  const res = await fetch(`${baseUrl}/api/users?limit=2&skip=1`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.users.length, 2);
  assert.strictEqual(data.skip, 1);
  assert.strictEqual(data.limit, 2);
  assert.strictEqual(data.users[0].id, 2);
});

test('GET /api/users should return X-Cache header (MISS or HIT)', async () => {
  const res = await fetch(`${baseUrl}/api/users?limit=1`);
  assert.strictEqual(res.status, 200);
  const cacheHeader = res.headers.get('x-cache');
  assert.ok(cacheHeader === 'MISS' || cacheHeader === 'HIT');
});

test('GET /api/users/:id should return X-Cache: HIT on subsequent request when cache is available', async () => {
  const res1 = await fetch(`${baseUrl}/api/users/1`);
  assert.strictEqual(res1.status, 200);
  const res2 = await fetch(`${baseUrl}/api/users/1`);
  assert.strictEqual(res2.status, 200);
  const { isReady } = require('../redis.js');
  if (isReady()) {
    assert.strictEqual(res2.headers.get('x-cache'), 'HIT');
  }
});

test('GET /view should return HTML dashboard', async () => {
  const res = await fetch(`${baseUrl}/view`);
  assert.strictEqual(res.status, 200);
  const contentType = res.headers.get('content-type');
  assert.ok(contentType.includes('text/html'));
  const html = await res.text();
  assert.ok(html.includes('User Directory'));
});

test('GET /view/style.css should return CSS stylesheet', async () => {
  const res = await fetch(`${baseUrl}/view/style.css`);
  assert.strictEqual(res.status, 200);
  const contentType = res.headers.get('content-type');
  assert.ok(contentType.includes('text/css'));
  const css = await res.text();
  assert.ok(css.includes('--accent-primary'));
});

test('GET /view/script.js should return JavaScript client file', async () => {
  const res = await fetch(`${baseUrl}/view/script.js`);
  assert.strictEqual(res.status, 200);
  const contentType = res.headers.get('content-type');
  assert.ok(contentType.includes('javascript'));
  const js = await res.text();
  assert.ok(js.includes('loadUsers'));
});

test('WebSocket should accept connection and send INIT handshake', async () => {
  const { WebSocket } = require('ws');
  const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/ws`;
  const ws = new WebSocket(wsUrl);

  const message = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WS handshake timeout')), 4000);
    ws.on('message', (data) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()));
    });
    ws.on('error', reject);
  });

  assert.strictEqual(message.type, 'INIT');
  assert.ok(message.clientsCount >= 1);
  assert.ok(message.timestamp);
  ws.close();
});

test('WebSocket should respond to PING with PONG', async () => {
  const { WebSocket } = require('ws');
  const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/ws`;
  const ws = new WebSocket(wsUrl);

  await new Promise((resolve) => ws.on('open', resolve));

  const pongPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WS pong timeout')), 4000);
    ws.on('message', (data) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.type === 'PONG') {
        clearTimeout(timeout);
        resolve(parsed);
      }
    });
    ws.on('error', reject);
  });

  ws.send(JSON.stringify({ type: 'PING' }));
  const response = await pongPromise;
  assert.strictEqual(response.type, 'PONG');
  assert.ok(response.timestamp);
  ws.close();
});

test('WebSocket should broadcast CACHE_EVENT when API endpoint is requested', async () => {
  const { WebSocket } = require('ws');
  const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/ws`;
  const ws = new WebSocket(wsUrl);

  await new Promise((resolve) => ws.on('open', resolve));

  const cacheEventPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Broadcast timeout')), 5000);
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'CACHE_EVENT' && parsed.endpoint === '/api/users') {
          clearTimeout(timeout);
          resolve(parsed);
        }
      } catch (err) {
        // ignore other messages
      }
    });
    ws.on('error', reject);
  });

  // Trigger HTTP API request
  await fetch(`${baseUrl}/api/users?limit=1`);

  const event = await cacheEventPromise;
  assert.strictEqual(event.type, 'CACHE_EVENT');
  assert.strictEqual(event.endpoint, '/api/users');
  assert.ok(event.status === 'HIT' || event.status === 'MISS');
  assert.ok(event.timestamp);
  ws.close();
});









