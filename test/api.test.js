const test = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');

let server;
let baseUrl;

test.before((t, done) => {
  server = app.listen(0, () => {
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    done();
  });
});

test.after((t, done) => {
  server.close(done);
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

test('GET /api/users/role/:role should return filtered users by role', async () => {
  const res = await fetch(`${baseUrl}/api/users/role/admin`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.role, 'admin');
  assert.ok(Array.isArray(data.users));
});
