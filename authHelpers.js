// authHelpers.js
const db = require('./db');
const bcrypt = require('bcrypt');

module.exports = {
  authenticateUser: async (username, password) => {
    try {
      const [rows] = await db.query(
        'SELECT id, username, password FROM users WHERE username = ?', 
        [username]
      );
      
      if (rows.length === 0) return null;
      
      const user = rows[0];
      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) return null;
      
      return { 
        id: user.id, 
        username: user.username 
      };
    } catch (err) {
      console.error('Authentication error:', err);
      throw err;
    }
  }
};