const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');
const routes = require('./routes');

const app = express();
const PORT = 3000;

// MySQL session store configuration
const sessionStore = new MySQLStore({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'Abishek7',
  database: 'testmgmt',
  clearExpired: true,
  checkExpirationInterval: 900000, // Check every 15 minutes
  expiration: 86400000              // Session valid for 24 hours
});

// Session middleware
app.use(session({
  key: 'sid', // simpler key
  secret: '094ebe7caa311bc65cdf144948e5430a93f3b0a93bf79776388938f1945fa400742a351123ef211322d9e226f0a7287c75823aa1e6a07690c92a049fd0fd76ed', // replace with a strong secret
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 86400000,     // 24 hours
    httpOnly: true,
    secure: false,        // false for HTTP (localhost); true for production with HTTPS
    sameSite: 'lax'
  }
}));

// Body parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// (Optional) Log session for debug
app.use((req, res, next) => {
  // console.log('Session:', req.session);
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', routes);

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/module', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'module.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}/login`);
  console.log('✅ MySQL session store is configured and ready');
});
