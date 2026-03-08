const db = require('./db');
let tasksSchemaReady = false;

async function ensureTaskColumns() {
    if (tasksSchemaReady) return;
    const alters = [
        'ALTER TABLE tasks ADD COLUMN due_at DATETIME NULL',
        'ALTER TABLE tasks ADD COLUMN reminded_1h TINYINT(1) NOT NULL DEFAULT 0',
        'ALTER TABLE tasks ADD COLUMN reminded_overdue TINYINT(1) NOT NULL DEFAULT 0'
    ];
    for (const sql of alters) {
        try {
            await db.promise().query(sql);
        } catch (err) {
            if (err && (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_CANT_DROP_FIELD_OR_KEY')) continue;
            if (err && err.code === 'ER_BAD_FIELD_ERROR') continue;
            throw err;
        }
    }
    await db.promise().query('UPDATE tasks SET due_at = DATE_ADD(created_at, INTERVAL 1 HOUR) WHERE due_at IS NULL');
    tasksSchemaReady = true;
}

function toMysqlDateTime(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function tableForCategory(category) {
    if (category === 'tarefa') return 'tasks';
    if (category === 'journal') return 'journal_entries';
    if (category === 'gratidao') return 'gratitude_entries';
    return null;
}

async function listEntries(userId, category) {
    const table = tableForCategory(category);
    if (!table) return [[]];
    if (category === 'tarefa') {
        await ensureTaskColumns();
        const sql = `SELECT id, title, content, status, due_at, created_at FROM tasks WHERE user_id = ? ORDER BY COALESCE(due_at, created_at) ASC`;
        return db.promise().query(sql, [userId]);
    }
    if (category === 'journal') {
        const sql = `SELECT id, title, content, status, created_at FROM ${table} WHERE user_id = ? ORDER BY created_at DESC`;
        return db.promise().query(sql, [userId]);
    }
    const sql = `SELECT id, content, status, created_at FROM ${table} WHERE user_id = ? ORDER BY created_at DESC`;
    return db.promise().query(sql, [userId]);
}

async function createEntry(userId, title, content, category, dueAt) {
    const table = tableForCategory(category);
    if (!table) return [{ insertId: null }];
    if (category === 'tarefa') {
        await ensureTaskColumns();
        const due = toMysqlDateTime(dueAt || new Date(Date.now() + 60 * 60 * 1000));
        const sql = `INSERT INTO tasks (user_id, title, content, status, due_at, reminded_1h, reminded_overdue) VALUES (?, ?, ?, 0, ?, 0, 0)`;
        return db.promise().query(sql, [userId, title || null, content, due]);
    }
    if (category === 'journal') {
        const sql = `INSERT INTO ${table} (user_id, title, content, status) VALUES (?, ?, ?, 0)`;
        return db.promise().query(sql, [userId, title || null, content]);
    }
    const sql = `INSERT INTO ${table} (user_id, content, status) VALUES (?, ?, 0)`;
    return db.promise().query(sql, [userId, content]);
}

async function toggleEntry(userId, id, category) {
    const table = tableForCategory(category);
    if (!table) return;
    if (category === 'tarefa') {
        await ensureTaskColumns();
    }
    const sql = `UPDATE ${table} SET status = NOT status WHERE id = ? AND user_id = ?`;
    return db.promise().query(sql, [id, userId]);
}

async function updateEntry(userId, id, title, content, category, dueAt) {
    const table = tableForCategory(category);
    if (!table) return;
    if (category === 'tarefa') {
        await ensureTaskColumns();
        const due = toMysqlDateTime(dueAt);
        const sql = `
            UPDATE tasks
            SET title = ?,
                content = ?,
                due_at = COALESCE(?, due_at),
                reminded_1h = CASE WHEN ? IS NULL THEN reminded_1h ELSE 0 END,
                reminded_overdue = CASE WHEN ? IS NULL THEN reminded_overdue ELSE 0 END
            WHERE id = ? AND user_id = ?
        `;
        return db.promise().query(sql, [title || null, content, due, due, due, id, userId]);
    }
    if (category === 'journal') {
        const sql = `UPDATE ${table} SET title = ?, content = ? WHERE id = ? AND user_id = ?`;
        return db.promise().query(sql, [title || null, content, id, userId]);
    }
    const sql = `UPDATE ${table} SET content = ? WHERE id = ? AND user_id = ?`;
    return db.promise().query(sql, [content, id, userId]);
}

async function deleteEntry(userId, id, category) {
    const table = tableForCategory(category);
    if (!table) return;
    if (category === 'tarefa') {
        await ensureTaskColumns();
    }
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
