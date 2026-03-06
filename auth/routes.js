const express = require('express');
const bcrypt = require('bcryptjs');
const { isEmail, isStrongPassword, sanitize } = require('./validators');
const users = require('../models/user');

const router = express.Router();

router.post('/register', async (req, res) => {
    const username = sanitize(req.body.username);
    const email = sanitize(req.body.email).toLowerCase();
    const password = String(req.body.password || '');

    if (!username || !isEmail(email) || !isStrongPassword(password)) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        const [existing] = await users.findByEmail(email);
        if (existing.length) return res.status(409).json({ error: 'Email in use' });

        const passwordHash = await bcrypt.hash(password, 12);
        const [result] = await users.createUser({ username, email, passwordHash });

        return res.status(201).json({ ok: true });
    } catch (err) {
        console.error('Register error:', err.message);
        return res.status(500).json({ error: 'Registration failed' });
    }
});

router.post('/login', async (req, res) => {
    const email = sanitize(req.body.email).toLowerCase();
    const password = String(req.body.password || '');

    if (!isEmail(email) || !password) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        const [rows] = await users.findByEmail(email);
        if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

        const user = rows[0];
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

        req.session.user = { id: user.id, username: user.username, email: user.email };
        return res.json({ ok: true });
    } catch (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({ error: 'Login failed' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('hyxmind.sid');
        res.json({ ok: true });
    });
});

router.get('/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ user: req.session.user });
});

module.exports = router;
