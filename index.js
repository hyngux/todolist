require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const db = require('./models/db');
const authRoutes = require('./auth/routes');
const apiRoutes = require('./routes/api');
const { requireAuth, attachUser } = require('./middleware/auth');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionStore = new MySQLStore({ createDatabaseTable: true }, db.promise());

app.use(session({
    name: 'hyxmind.sid',
    secret: process.env.SESSION_SECRET || 'hyxmind_dev_secret',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

app.use(attachUser);

// Testar a conexão logo no arranque
db.getConnection((err, connection) => {
    if (err) {
        console.error('Erro de DB: Verifica se o MySQL está ligado.', err.message);
    } else {
        console.log('Base de Dados ligada com sucesso.');
        connection.release();
    }
});

app.use('/auth', authRoutes);
app.use('/api', requireAuth, apiRoutes);

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login', 'index.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register', 'index.html'));
});

app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/:any', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log('HYXMIND SYSTEM ONLINE');
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`Network: http://0.0.0.0:${PORT}`);
});
