const express = require('express');
const bcrypt = require('bcrypt');
const db = require('./db');
const router = express.Router();

function isAuthenticated(req, res, next) {
    if (req.session?.isAuthenticated) {
        return next();
    }
    return res.status(401).json({ error: 'User not authenticated' });
}

// Middleware for Forge API Key Authentication
const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const serverApiKey = 'S3cr3t_f0r_TCM_@pp_gH7qP9zR2x'; // IMPORTANT: Use process.env for this!
  
    if (!apiKey || apiKey !== serverApiKey) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
    next();
  };

router.post('/register', async (req, res) => {
    try {
        const {
            username,
            email,
            password
        } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required.'
            });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email address.'
            });
        }
        if (username.length < 3 || username.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'Username must be 3–50 characters.'
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters.'
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            username
        });
    } catch (err) {
        console.error('Registration error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            const message = err.sqlMessage.includes('username') ? 'Username already exists' :
                err.sqlMessage.includes('email') ? 'Email already exists' :
                'Username or email already exists';
            return res.status(400).json({
                success: false,
                error: message
            });
        }
        res.status(500).json({
            success: false,
            error: 'Registration failed. Try again.'
        });
    }
});

router.post('/login', async (req, res) => {
    const {
        username,
        password
    } = req.body;
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }
        const user = rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }
        req.session.user = {
            id: user.id,
            username: user.username
        };
        req.session.isAuthenticated = true;
        req.session.save(err => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Session error'
                });
            }
            res.json({
                success: true,
                redirect: '/module',
                user: {
                    username: user.username
                }
            });
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
});

router.get('/check-auth', (req, res) => {
    if (req.session?.isAuthenticated) {
        res.json({
            authenticated: true,
            user: req.session.user
        });
    } else {
        res.status(401).json({
            authenticated: false
        });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).json({
                success: false,
                error: 'Logout failed.'
            });
        }
        res.json({
            success: true
        });
    });
})

const webUiRouter = express.Router();
webUiRouter.use(isAuthenticated);


// --- FOLDER ROUTES (Updated for nesting) ---

webUiRouter.get('/folders', async (req, res) => {
    try {
        // Fetch all folders along with their parentId and a count of test cases
        const [folders] = await db.query(`
        SELECT 
            f.id, 
            f.name, 
            f.parentId,
            (SELECT COUNT(*) FROM tests t WHERE t.folder_id = f.id) AS testCaseCount
        FROM folders f
        ORDER BY f.name ASC
      `);
        res.json(folders);
    } catch (err) {
        console.error('Fetch folders error:', err);
        res.status(500).json({
            error: 'Failed to fetch folders'
        });
    }
});

webUiRouter.post('/folders', async (req, res) => {
    try {
        const {
            name,
            parentId
        } = req.body; // parentId can be null
        if (!name) {
            return res.status(400).json({
                error: 'Folder name is required'
            });
        }
        const [result] = await db.query(
            'INSERT INTO folders (name, parentId) VALUES (?, ?)',
            [name, parentId || null]
        );
        // Return the full new folder object
        res.status(201).json({
            id: result.insertId,
            name: name,
            parentId: parentId || null
        });
    } catch (err) {
        console.error('Create folder error:', err);
        res.status(500).json({
            error: 'Failed to create folder'
        });
    }
});

// Recursive function to get all child folder IDs
async function getChildFolderIds(folderId, connection) {
    let childIds = [];
    const [rows] = await connection.query('SELECT id FROM folders WHERE parentId = ?', [folderId]);
    for (const row of rows) {
        childIds.push(row.id);
        const nestedChildIds = await getChildFolderIds(row.id, connection);
        childIds = childIds.concat(nestedChildIds);
    }
    return childIds;
}

webUiRouter.delete('/folders/:folderId', async (req, res) => {
    const {
        folderId
    } = req.params;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Find all nested child folders to delete
        const folderIdsToDelete = [parseInt(folderId, 10)];
        const childIds = await getChildFolderIds(folderId, connection);
        const allIds = folderIdsToDelete.concat(childIds);
        
        if (allIds.length > 0) {
            const placeholders = allIds.map(() => '?').join(',');
            
            // Delete all tests within the folder and all its sub-folders
            await connection.query(`DELETE FROM tests WHERE folder_id IN (${placeholders})`, allIds);
            
            // Delete the folder and all its sub-folders
            await connection.query(`DELETE FROM folders WHERE id IN (${placeholders})`, allIds);
        }

        await connection.commit();
        res.json({
            success: true,
            message: 'Folder and all its contents deleted successfully.'
        });
    } catch (err) {
        await connection.rollback();
        console.error('Delete folder error:', err);
        res.status(500).json({
            error: 'Failed to delete folder.'
        });
    } finally {
        connection.release();
    }
});


// --- TEST ROUTES (Updated with new fields) ---

webUiRouter.get('/tests', async (req, res) => {
    try {
        const {
            folderId
        } = req.query;
        let query = `
        SELECT 
          t.id,
          t.test_case_id,
          t.title,
          t.ticket_id,
          t.tags,
          t.preConditions,
          t.steps,
          t.testData,
          t.expected,
          t.actualOutput,
          t.test_status,
          t.created_date,
          t.created_by,
          f.id AS folder_id,
          f.name AS folder_name
        FROM tests t
        LEFT JOIN folders f ON t.folder_id = f.id
      `;
        const params = [];
        if (folderId && folderId !== 'all') {
            query += ' WHERE t.folder_id = ?';
            params.push(folderId);
        }
        query += ' ORDER BY t.created_at DESC';

        const [results] = await db.query(query, params);

        // Map database columns (snake_case) to frontend properties (camelCase)
        const formatted = results.map(test => ({
            id: test.id,
            testCaseId: test.test_case_id,
            title: test.title,
            ticketId: test.ticket_id,
            tags: test.tags,
            preConditions: test.preConditions,
            steps: test.steps,
            testData: test.testData,
            expected: test.expected,
            actualOutput: test.actualOutput,
            testStatus: test.test_status,
            createdDate: test.created_date,
            createdBy: test.created_by,
            folder: test.folder_id ? {
                id: test.folder_id,
                name: test.folder_name
            } : null
        }));

        res.json(formatted);
    } catch (err) {
        console.error('Fetch tests error:', err);
        res.status(500).json([]);
    }
});

webUiRouter.post('/tests', async (req, res) => {
    try {
        const {
            title, folderId, ticketId, tags, preConditions, steps, testData, 
            expected, actualOutput, createdBy, status 
        } = req.body;

        const [rows] = await db.query(`SELECT MAX(CAST(SUBSTRING(test_case_id, 3) AS UNSIGNED)) AS maxId FROM tests`);
        const newTestCaseId = 'TC' + String((rows[0].maxId || 0) + 1).padStart(4, '0');

        // FIX: Added the 'test_status' column to the list to match the values being sent.
        const [result] = await db.query(`
        INSERT INTO tests 
          (title, ticket_id, folder_id, tags, preConditions, steps, testData, expected, actualOutput, test_case_id, created_by, test_status, created_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
            title, 
            ticketId, 
            folderId, 
            tags, 
            preConditions, 
            steps, 
            testData, 
            expected, 
            actualOutput, 
            newTestCaseId, 
            createdBy, 
            status || 'Not Run' // This value corresponds to the 'test_status' column
        ]);

        res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('Create test error:', err);
        res.status(500).json({ error: 'Failed to create test case.' });
    }
});

webUiRouter.put('/tests', async (req, res) => {
    try {
        const {
            id,
            title,
            folderId,
            ticketId,
            tags,
            preConditions,
            steps,
            testData,
            expected,
            actualOutput,
            status
        } = req.body;
        await db.query(`
        UPDATE tests SET 
          title = ?, ticket_id = ?, folder_id = ?, tags = ?, preConditions = ?, steps = ?, 
          testData = ?, expected = ?, actualOutput = ?, test_status = ?
        WHERE id = ?
      `, [title, ticketId, folderId, tags, preConditions, steps, testData, expected, actualOutput, status, id]);
        res.json({
            success: true
        });
    } catch (err) {
        console.error('Update test error:', err);
        res.status(500).json({
            error: 'Failed to update test case.'
        });
    }
});

webUiRouter.patch('/tests/:testId/status', async (req, res) => {
    try {
        const {
            testId
        } = req.params;
        const {
            testStatus
        } = req.body;
        await db.query('UPDATE tests SET test_status = ? WHERE id = ?', [testStatus, testId]);
        res.json({
            success: true
        });
    } catch (err) {
        console.error('Update test status error:', err);
        res.status(500).json({
            error: 'Failed to update status.'
        });
    }
});

webUiRouter.patch('/tests/batch', async (req, res) => {
    const { testIds, updates } = req.body;

    if (!testIds || !Array.isArray(testIds) || testIds.length === 0) {
        return res.status(400).json({ error: 'An array of testIds is required.' });
    }
    if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'An updates object with fields to change is required.' });
    }

    // Map all the fields you want to be bulk-editable
    const columnMapping = {
        folderId: 'folder_id',
        ticketId: 'ticket_id',
        tags: 'tags',
        status: 'test_status',
        preConditions: 'preConditions', // Added
        steps: 'steps',                 // Added
        testData: 'testData',           // Added
        expected: 'expected',           // Added
        actualOutput: 'actualOutput'    // Added
    };

    const setClauses = [];
    const queryParams = [];

    // This part of the code dynamically builds the query, no changes needed here.
    for (const key in updates) {
        if (Object.prototype.hasOwnProperty.call(updates, key) && columnMapping[key]) {
            setClauses.push(`${columnMapping[key]} = ?`);
            queryParams.push(updates[key]);
        }
    }

    if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const sql = `
        UPDATE tests 
        SET ${setClauses.join(', ')} 
        WHERE id IN (?)
    `;
    queryParams.push(testIds);

    try {
        const [result] = await db.query(sql, queryParams);
        res.json({ 
            success: true, 
            message: `${result.affectedRows} test case(s) updated successfully.`,
            affectedRows: result.affectedRows 
        });
    } catch (err) {
        console.error('Batch update database error:', err);
        res.status(500).json({ error: 'A database error occurred during the bulk update.' });
    }
});

webUiRouter.delete('/tests/:testId', async (req, res) => {
    try {
        const {
            testId
        } = req.params;
        await db.query('DELETE FROM tests WHERE id = ?', [testId]);
        res.json({
            success: true
        });
    } catch (err) {
        console.error('Delete test error:', err);
        res.status(500).json({
            error: 'Failed to delete test.'
        });
    }
});

webUiRouter.delete('/selectedtests/batch', async (req, res) => {
    try {
        const {
            testIds
        } = req.body;
        if (!testIds || !Array.isArray(testIds) || testIds.length === 0) {
            return res.status(400).json({
                error: 'Invalid or empty test IDs provided.'
            });
        }
        const placeholders = testIds.map(() => '?').join(',');
        const query = `DELETE FROM tests WHERE id IN (${placeholders})`;
        await db.query(query, testIds);
        res.json({
            success: true,
            deletedCount: testIds.length
        });
    } catch (err) {
        console.error('Batch delete error:', err);
        res.status(500).json({
            error: 'Batch delete failed.'
        });
    }
});

router.use(webUiRouter);

const forgeApiRouter = express.Router();
forgeApiRouter.use(apiKeyAuth);

// This is the endpoint your 'searchTestCases' resolver calls.
forgeApiRouter.get('/tests', async (req, res) => {
    try {
        const { query } = req.query;
        const [rows] = await db.query(
          `SELECT id, test_case_id, title, steps, expected 
           FROM tests 
           WHERE title LIKE ? OR test_case_id LIKE ?`,
          [`%${query || ''}%`, `%${query || ''}%`]
        );
        res.json(rows);
    } catch (err) {
        console.error('API Search Error:', err);
        res.status(500).json({ error: 'API search failed.' });
    }
});

// Endpoint for 'getAddedTestCases' resolver
forgeApiRouter.get('/issue-testcases/:issueKey', async (req, res) => {
    try {
        const { issueKey } = req.params;
        const [rows] = await db.query(`SELECT test_id, test_case_id, title FROM issue_testcases WHERE issue_key = ?`, [issueKey]);
        res.json(rows.map(row => ({ id: row.test_id, test_case_id: row.test_case_id, title: row.title })));
    } catch (error) {
        res.status(500).json({ error: 'DB error' });
    }
});

// Endpoint for 'addTestCaseToIssue' resolver
forgeApiRouter.post('/issue-testcases', async (req, res) => {
    try {
        const { issueKey, test } = req.body;
        await db.query(`INSERT IGNORE INTO issue_testcases (issue_key, test_id, test_case_id, title) VALUES (?, ?, ?, ?)`, [issueKey, test.id, test.test_case_id, test.title]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'DB error' });
    }
});

// Endpoint for 'removeTestCaseFromIssue' resolver
forgeApiRouter.delete('/issue-testcases', async (req, res) => {
    try {
        const { issueKey, testId } = req.body;
        await db.query(`DELETE FROM issue_testcases WHERE issue_key = ? AND test_id = ?`, [issueKey, testId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'DB error' });
    }
});

// Mount the Forge API router under the /api path
router.use('/api', forgeApiRouter);


module.exports = router;