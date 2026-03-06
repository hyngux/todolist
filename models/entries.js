const db = require('./db');

function tableForCategory(category) {
    if (category === 'tarefa') return 'tasks';
    if (category === 'journal') return 'journal_entries';
    if (category === 'gratidao') return 'gratitude_entries';
    return null;
}

function listEntries(userId, category) {
    const table = tableForCategory(category);
    if (!table) return Promise.resolve([[]]);
    if (category === 'journal' || category === 'tarefa') {
        const sql = `SELECT id, title, content, status, created_at FROM ${table} WHERE user_id = ? ORDER BY created_at DESC`;
        return db.promise().query(sql, [userId]);
    }
    const sql = `SELECT id, content, status, created_at FROM ${table} WHERE user_id = ? ORDER BY created_at DESC`;
    return db.promise().query(sql, [userId]);
}

function createEntry(userId, title, content, category) {
    const table = tableForCategory(category);
    if (!table) return Promise.resolve([{ insertId: null }]);
    if (category === 'journal' || category === 'tarefa') {
        const sql = `INSERT INTO ${table} (user_id, title, content, status) VALUES (?, ?, ?, 0)`;
        return db.promise().query(sql, [userId, title || null, content]);
    }
    const sql = `INSERT INTO ${table} (user_id, content, status) VALUES (?, ?, 0)`;
    return db.promise().query(sql, [userId, content]);
}

function toggleEntry(userId, id, category) {
    const table = tableForCategory(category);
    if (!table) return Promise.resolve();
    const sql = `UPDATE ${table} SET status = NOT status WHERE id = ? AND user_id = ?`;
    return db.promise().query(sql, [id, userId]);
}

function updateEntry(userId, id, title, content, category) {
    const table = tableForCategory(category);
    if (!table) return Promise.resolve();
    if (category === 'journal' || category === 'tarefa') {
        const sql = `UPDATE ${table} SET title = ?, content = ? WHERE id = ? AND user_id = ?`;
        return db.promise().query(sql, [title || null, content, id, userId]);
    }
    const sql = `UPDATE ${table} SET content = ? WHERE id = ? AND user_id = ?`;
    return db.promise().query(sql, [content, id, userId]);
}

function deleteEntry(userId, id, category) {
    const table = tableForCategory(category);
    if (!table) return Promise.resolve();
    const sql = `DELETE FROM ${table} WHERE id = ? AND user_id = ?`;
    return db.promise().query(sql, [id, userId]);
}

module.exports = {
    listEntries,
    createEntry,
    toggleEntry,
    updateEntry,
    deleteEntry
};
