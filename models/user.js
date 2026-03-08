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

function findAuthById(id) {
    const sql = 'SELECT id, username, email, password_hash FROM users WHERE id = ? LIMIT 1';
    return db.promise().query(sql, [id]);
}

function updateUsername(id, username) {
    const sql = 'UPDATE users SET username = ? WHERE id = ?';
    return db.promise().query(sql, [username, id]);
}

function updatePasswordHash(id, passwordHash) {
    const sql = 'UPDATE users SET password_hash = ? WHERE id = ?';
    return db.promise().query(sql, [passwordHash, id]);
}

module.exports = {
    createUser,
    findByEmail,
    findById,
    findAuthById,
    updateUsername,
    updatePasswordHash
};
