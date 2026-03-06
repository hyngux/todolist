const db = require('./db');

function createUser({ username, email, passwordHash }) {
    const sql = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
    return db.promise().query(sql, [username, email, passwordHash]);
}

function findByEmail(email) {
    const sql = 'SELECT id, username, email, password_hash FROM users WHERE email = ? LIMIT 1';
    return db.promise().query(sql, [email]);
}

function findById(id) {
    const sql = 'SELECT id, username, email FROM users WHERE id = ? LIMIT 1';
    return db.promise().query(sql, [id]);
}

module.exports = {
    createUser,
    findByEmail,
    findById
};
