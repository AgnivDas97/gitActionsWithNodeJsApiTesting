const express = require('express');
const path = require('path');
const { pool } = require('./db');
const { getCache, setCache } = require('./redis');
const { initWebSocket, broadcast } = require('./websocket');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static view files (HTML, CSS, JS) from the view directory
app.use('/view', express.static(path.join(__dirname, 'view')));

app.get('/view', (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'index.html'));
});

// Helper function to extract only the requested user fields
const formatUser = (user) => {
  let birthDate = user.birthDate || user.birth_date;
  if (birthDate instanceof Date) {
    birthDate = birthDate.toISOString().split('T')[0];
  } else if (birthDate) {
    birthDate = String(birthDate).split('T')[0];
  }
  return {
    id: user.id,
    firstName: user.firstName ?? user.first_name,
    lastName: user.lastName ?? user.last_name,
    maidenName: user.maidenName ?? user.maiden_name ?? null,
    age: user.age,
    gender: user.gender,
    email: user.email,
    phone: user.phone,
    username: user.username,
    birthDate: birthDate ?? null
  };
};

const USER_FIELDS = 'id,firstName,lastName,maidenName,age,gender,email,phone,username,birthDate';

// Root health check endpoint (renders dashboard for browser HTML requests, JSON for API/tests)
app.get('/', (req, res) => {
  if (req.headers.accept && req.headers.accept.includes('text/html') && !req.headers.accept.startsWith('*/*')) {
    return res.sendFile(path.join(__dirname, 'view', 'index.html'));
  }
  res.json({
    status: 'online',
    message: 'Node.js API Testing Server',
    endpoints: {
      getAllUsers: '/api/users',
      getUserById: '/api/users/:id',
      getUsersByRole: '/api/users/role/:role',
      dashboardView: '/view',
      webSocket: '/ws'
    }
  });
});

// GET /api/users - Fetch users from PostgreSQL database with Redis caching (previously DummyJSON fetch)
app.get('/api/users', async (req, res) => {
  try {
    const { limit = 10, skip = 0 } = req.query;

    /*
    // --- PREVIOUS FETCH METHOD (Commented Out) ---
    const response = await fetch(`https://dummyjson.com/users?limit=${limit}&skip=${skip}&select=${USER_FIELDS}`);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch users from external API' });
    }
    
    const data = await response.json();
    res.json({
      ...data,
      users: data.users.map(formatUser)
    });
    // --- END PREVIOUS FETCH METHOD ---
    */

    const cacheKey = `users:limit=${limit}:skip=${skip}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      broadcast({
        type: 'CACHE_EVENT',
        status: 'HIT',
        endpoint: '/api/users',
        cacheKey,
        count: cachedData.users ? cachedData.users.length : 0,
        timestamp: new Date().toISOString()
      });
      return res.json(cachedData);
    }

    res.setHeader('X-Cache', 'MISS');

    // Fetch user records from PostgreSQL database
    const usersResult = await pool.query(
      `SELECT id, first_name AS "firstName", last_name AS "lastName", maiden_name AS "maidenName",
              age, gender, email, phone, username, to_char(birth_date, 'YYYY-MM-DD') AS "birthDate"
       FROM users
       ORDER BY id ASC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit, 10), parseInt(skip, 10)]
    );

    const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM users');
    const total = countResult.rows[0].total;

    const responseData = {
      users: usersResult.rows.map(formatUser),
      total,
      skip: parseInt(skip, 10),
      limit: parseInt(limit, 10)
    };

    await setCache(cacheKey, responseData);
    broadcast({
      type: 'CACHE_EVENT',
      status: 'MISS',
      endpoint: '/api/users',
      cacheKey,
      count: responseData.users.length,
      timestamp: new Date().toISOString()
    });
    res.json(responseData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/users/:id - Fetch single user by ID from PostgreSQL database with Redis caching
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    /*
    // --- PREVIOUS FETCH METHOD (Commented Out) ---
    const response = await fetch(`https://dummyjson.com/users/${id}?select=${USER_FIELDS}`);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `User with ID ${id} not found` });
    }
    
    const data = await response.json();
    res.json(formatUser(data));
    // --- END PREVIOUS FETCH METHOD ---
    */

    const cacheKey = `user:${id}`;
    const cachedUser = await getCache(cacheKey);

    if (cachedUser) {
      res.setHeader('X-Cache', 'HIT');
      broadcast({
        type: 'CACHE_EVENT',
        status: 'HIT',
        endpoint: `/api/users/${id}`,
        cacheKey,
        userId: id,
        timestamp: new Date().toISOString()
      });
      return res.json(cachedUser);
    }

    res.setHeader('X-Cache', 'MISS');

    // Fetch single user from PostgreSQL database
    const result = await pool.query(
      `SELECT id, first_name AS "firstName", last_name AS "lastName", maiden_name AS "maidenName",
              age, gender, email, phone, username, to_char(birth_date, 'YYYY-MM-DD') AS "birthDate"
       FROM users
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `User with ID ${id} not found` });
    }

    const formattedUser = formatUser(result.rows[0]);
    await setCache(cacheKey, formattedUser);
    broadcast({
      type: 'CACHE_EVENT',
      status: 'MISS',
      endpoint: `/api/users/${id}`,
      cacheKey,
      userId: id,
      timestamp: new Date().toISOString()
    });
    res.json(formattedUser);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/users/role/:role - Filter users by role from PostgreSQL database with Redis caching
app.get('/api/users/role/:role', async (req, res) => {
  try {
    const { role } = req.params;

    /*
    // --- PREVIOUS FETCH METHOD (Commented Out) ---
    const response = await fetch(`https://dummyjson.com/users?limit=0&select=${USER_FIELDS},role`);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch users' });
    }
    
    const data = await response.json();
    const filteredUsers = data.users.filter(
      user => user.role && user.role.toLowerCase() === role.toLowerCase()
    );
    
    res.json({
      role,
      count: filteredUsers.length,
      users: filteredUsers.map(formatUser)
    });
    // --- END PREVIOUS FETCH METHOD ---
    */

    const cacheKey = `users:role:${role.toLowerCase()}`;
    const cachedRoleData = await getCache(cacheKey);

    if (cachedRoleData) {
      res.setHeader('X-Cache', 'HIT');
      broadcast({
        type: 'CACHE_EVENT',
        status: 'HIT',
        endpoint: `/api/users/role/${role}`,
        cacheKey,
        role,
        count: cachedRoleData.count || 0,
        timestamp: new Date().toISOString()
      });
      return res.json(cachedRoleData);
    }

    res.setHeader('X-Cache', 'MISS');

    // Check if role column exists in the users table
    const colCheck = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role'`
    );

    let users = [];
    if (colCheck.rowCount > 0) {
      const result = await pool.query(
        `SELECT id, first_name AS "firstName", last_name AS "lastName", maiden_name AS "maidenName",
                age, gender, email, phone, username, to_char(birth_date, 'YYYY-MM-DD') AS "birthDate", role
         FROM users
         WHERE LOWER(role) = LOWER($1)
         ORDER BY id ASC`,
        [role]
      );
      users = result.rows.map(formatUser);
    }

    const responseData = {
      role,
      count: users.length,
      users
    };

    await setCache(cacheKey, responseData);
    broadcast({
      type: 'CACHE_EVENT',
      status: 'MISS',
      endpoint: `/api/users/role/${role}`,
      cacheKey,
      role,
      count: responseData.count,
      timestamp: new Date().toISOString()
    });
    res.json(responseData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Wrap app.listen to automatically attach WebSocketServer to the HTTP server
const originalListen = app.listen.bind(app);
app.listen = function (...args) {
  const server = originalListen(...args);
  initWebSocket(server);
  return server;
};

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`WebSocket server is active at ws://localhost:${PORT}/ws`);
  });
}

module.exports = app;

