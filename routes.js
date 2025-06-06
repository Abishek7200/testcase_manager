const express = require('express');
const bcrypt = require('bcrypt');
const db = require('./db');
const router = express.Router();

// Auth Middleware
function isAuthenticated(req, res, next) {
  if (['/login', '/register', '/check-auth'].includes(req.path)) {
    return next();
  }
  
  if (req.path.endsWith('.html') || req.path.startsWith('/public/')) {
    return next();
  }

  if (!req.session?.isAuthenticated) {
    console.log('Unauthorized access attempt to:', req.path);
    return req.xhr || req.accepts('json')
      ? res.status(401).json({ error: 'Unauthorized' })
      : res.redirect('/login.html');
  }

  next();
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address.' });
    }

    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ success: false, error: 'Username must be 3–50 characters.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);

    res.status(201).json({ success: true, message: 'Registration successful', username });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      const message = err.sqlMessage.includes('username') ? 'Username already exists'
        : err.sqlMessage.includes('email') ? 'Email already exists'
        : 'Username or email already exists';
      return res.status(400).json({ success: false, error: message });
    }
    res.status(500).json({ success: false, error: 'Registration failed. Try again.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    req.session.user = { id: user.id, username: user.username };
    req.session.isAuthenticated = true;

    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ success: false, error: 'Session error' });
      }
      res.json({ 
        success: true, 
        redirect: '/module',
        user: { username: user.username }
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Check Auth
router.get('/check-auth', (req, res) => {
  if (req.session?.isAuthenticated) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ success: false, error: 'Logout failed.' });
    }
    res.json({ success: true });
  });
});

// Apply auth middleware to all following routes
router.use(isAuthenticated);


router.get('/folders', async (req, res) => {
  try {
    
    const [results] = await db.query(`
      SELECT f.id, f.name, COUNT(t.id) AS testCaseCount
      FROM folders f
      LEFT JOIN tests t ON f.id = t.folder_id
      GROUP BY f.id, f.name
      ORDER BY f.name ASC
      `);
    
    console.log('Query results:', results); // Add this
    res.json(results);
  } catch (err) {
    console.error('Fetch folders error:', err);
    res.status(500).json([]);
  }
});

router.post('/folders', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Folder name is required' });
    }

    const [result] = await db.query(
      'INSERT INTO folders (name) VALUES (?)',
      [name]
    );

    res.json({ success: true, folderId: result.insertId });
  } catch (err) {
    console.error('Create folder error:', err.message);
    res.status(500).json({ success: false, error: 'Create folder failed.' });
  }
});


router.delete('/folders/:folderId', async (req, res) => {
  const { folderId } = req.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM tests WHERE folder_id = ?', [folderId]);
    await connection.query('DELETE FROM folders WHERE id = ?', [folderId]);
    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error('Delete folder error:', err);
    res.status(500).json({ success: false, error: 'Delete folder failed.' });
  } finally {
    connection.release();
  }
});

// Test Routes
router.get('/tests', async (req, res) => {
  try {
    const { folderId } = req.query;

    let query = `
      SELECT t.*, f.name AS folder_name
      FROM tests t
      LEFT JOIN folders f ON t.folder_id = f.id
      WHERE 1=1`;
    const params = [];

    if (folderId) {
      query += ' AND t.folder_id = ?';
      params.push(folderId);
    }

    query += ' ORDER BY t.created_at DESC';

    const [results] = await db.query(query, params);

    const formatted = results.map(test => ({
      id: test.id,
      testCaseId: test.test_case_id,
      title: test.title,
      steps: test.steps,
      expected: test.expected,
      comments: test.comments,
      createdDate: test.created_date,
      createdBy: test.created_by,
      testStatus: test.test_status,
      folder: test.folder_id ? { id: test.folder_id, name: test.folder_name } : null
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Fetch tests error:', err);
    res.status(500).json([]);
  }
});

router.post('/tests', async (req, res) => {
  try {
    const { title, steps, expected, comments, folderId, testCaseId, createdDate, createdBy } = req.body;
    
    const [result] = await db.query(`
      INSERT INTO tests 
      (title, steps, expected, comments, folder_id, test_case_id, created_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [title, steps, expected, comments, folderId || null, testCaseId, createdDate, createdBy]);

    res.json({ 
      success: true, 
      id: result.insertId,
      testCaseId,
      createdDate,
      createdBy
    });
  } catch (err) {
    console.error('Create test error:', err);
    res.status(500).json({ success: false, error: 'Create test failed.' });
  }
});

router.put('/tests', async (req, res) => {
  try {
    const { id, title, steps, expected, comments, folderId } = req.body;
    await db.query(`
      UPDATE tests
      SET title = ?, steps = ?, expected = ?, comments = ?, folder_id = ?
      WHERE id = ?
    `, [title, steps, expected, comments, folderId || null, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update test error:', err);
    res.status(500).json({ success: false, error: 'Update failed.' });
  }
});

router.patch('/tests/:testId/status', async (req, res) => {
  try {
    const { testId } = req.params;
    const { testStatus } = req.body;
    if (!testStatus) {
      return res.status(400).json({ success: false, error: 'Test status is required.' });
    }

    await db.query('UPDATE tests SET test_status = ? WHERE id = ?', [testStatus, testId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update test status error:', err);
    res.status(500).json({ success: false, error: 'Failed to update test status.' });
  }
});

router.delete('/tests/:testId', async (req, res) => {
  try {
    const { testId } = req.params;
    await db.query('DELETE FROM tests WHERE id = ?', [testId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete test case error:', err);
    res.status(500).json({ success: false, error: 'Delete test failed.' });
  }
});

module.exports = router;