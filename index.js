const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Helper function to extract only the requested user fields
const formatUser = (user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  maidenName: user.maidenName,
  age: user.age,
  gender: user.gender,
  email: user.email,
  phone: user.phone,
  username: user.username,
  birthDate: user.birthDate
});

const USER_FIELDS = 'id,firstName,lastName,maidenName,age,gender,email,phone,username,birthDate';

// Root health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Node.js API Testing Server',
    endpoints: {
      getAllUsers: '/api/users',
      getUserById: '/api/users/:id',
      getUsersByRole: '/api/users/role/:role'
    }
  });
});

// GET /api/users - Fetch users from DummyJSON with filtered fields & optional pagination
app.get('/api/users', async (req, res) => {
  try {
    const { limit = 30, skip = 0 } = req.query;
    const response = await fetch(`https://dummyjson.com/users?limit=${limit}&skip=${skip}&select=${USER_FIELDS}`);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch users from external API' });
    }
    
    const data = await response.json();
    res.json({
      ...data,
      users: data.users.map(formatUser)
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/users/:id - Fetch single user by ID with filtered fields
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`https://dummyjson.com/users/${id}?select=${USER_FIELDS}`);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `User with ID ${id} not found` });
    }
    
    const data = await response.json();
    res.json(formatUser(data));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/users/role/:role - Filter users by role (admin, moderator, user) with filtered fields
app.get('/api/users/role/:role', async (req, res) => {
  try {
    const { role } = req.params;
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
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
