const db = require('./db');

function listHabits(userId) {
    const sql = 'SELECT id, name, streak, last_completed, created_at FROM habits WHERE user_id = ? ORDER BY created_at DESC';
    return db.promise().query(sql, [userId]);
}

function createHabit(userId, name) {
    const sql = 'INSERT INTO habits (user_id, name, streak, last_completed) VALUES (?, ?, 0, NULL)';
    return db.promise().query(sql, [userId, name]);
}

function updateHabit(userId, id, { streak, lastCompleted }) {
    const sql = 'UPDATE habits SET streak = ?, last_completed = ? WHERE id = ? AND user_id = ?';
    return db.promise().query(sql, [streak, lastCompleted, id, userId]);
}

function deleteHabit(userId, id) {
    const sql = 'DELETE FROM habits WHERE id = ? AND user_id = ?';
    return db.promise().query(sql, [id, userId]);
}

module.exports = {
    listHabits,
    createHabit,
    updateHabit,
    deleteHabit
};
