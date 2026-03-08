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
            if (err && err.code === 'ER_DUP_FIELDNAME') continue;
            throw err;
        }
    }
    await db.promise().query('UPDATE tasks SET due_at = DATE_ADD(created_at, INTERVAL 1 HOUR) WHERE due_at IS NULL');
    tasksSchemaReady = true;
}

function toMysqlDateTime(value) {
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

async function listTasksForMonth(userId, month) {
    await ensureTaskColumns();
    const [y, m] = String(month || '').split('-').map(Number);
    if (!y || !m || m < 1 || m > 12) return [];
    const start = new Date(y, m - 1, 1, 0, 0, 0);
    const end = new Date(y, m, 1, 0, 0, 0);
    const sql = `
        SELECT id, user_id, title, content AS description, due_at, status AS done, reminded_1h, reminded_overdue, created_at
        FROM tasks
        WHERE user_id = ? AND due_at IS NOT NULL AND due_at >= ? AND due_at < ?
        ORDER BY due_at ASC
    `;
    const [rows] = await db.promise().query(sql, [userId, toMysqlDateTime(start), toMysqlDateTime(end)]);
    return rows;
}

async function createTask(userId, { title, description, dueAt }) {
    await ensureTaskColumns();
    const due = toMysqlDateTime(dueAt);
    if (!due) throw new Error('Invalid due date');
    const sql = `
        INSERT INTO tasks (user_id, title, content, status, due_at, reminded_1h, reminded_overdue)
        VALUES (?, ?, ?, 0, ?, 0, 0)
    `;
    const [result] = await db.promise().query(sql, [userId, title, description || '', due]);
    return result.insertId;
}

async function setDone(userId, id, done) {
    await ensureTaskColumns();
    const sql = `
        UPDATE tasks
        SET status = ?, reminded_1h = CASE WHEN ? = 1 THEN 1 ELSE reminded_1h END,
            reminded_overdue = CASE WHEN ? = 1 THEN 1 ELSE reminded_overdue END
        WHERE id = ? AND user_id = ?
    `;
    return db.promise().query(sql, [done ? 1 : 0, done ? 1 : 0, done ? 1 : 0, id, userId]);
}

async function deleteTask(userId, id) {
    await ensureTaskColumns();
    const sql = 'DELETE FROM tasks WHERE id = ? AND user_id = ?';
    return db.promise().query(sql, [id, userId]);
}

async function listDueSoon(now, oneHourAhead) {
    await ensureTaskColumns();
    const sql = `
        SELECT id, user_id, title, content AS description, due_at
        FROM tasks
        WHERE status = 0
          AND due_at IS NOT NULL
          AND reminded_1h = 0
          AND due_at > ?
          AND due_at <= ?
        ORDER BY due_at ASC
    `;
    const [rows] = await db.promise().query(sql, [toMysqlDateTime(now), toMysqlDateTime(oneHourAhead)]);
    return rows;
}

async function listOverdue(now) {
    await ensureTaskColumns();
    const sql = `
        SELECT id, user_id, title, content AS description, due_at
        FROM tasks
        WHERE status = 0
          AND due_at IS NOT NULL
          AND reminded_overdue = 0
          AND due_at <= ?
        ORDER BY due_at ASC
    `;
    const [rows] = await db.promise().query(sql, [toMysqlDateTime(now)]);
    return rows;
}

async function markReminder(ids, field) {
    await ensureTaskColumns();
    if (!Array.isArray(ids) || !ids.length) return;
    const safeField = field === 'reminded_1h' ? 'reminded_1h' : 'reminded_overdue';
    const placeholders = ids.map(() => '?').join(',');
    const sql = `UPDATE tasks SET ${safeField} = 1 WHERE id IN (${placeholders})`;
    return db.promise().query(sql, ids);
}

module.exports = {
    listTasksForMonth,
    createTask,
    setDone,
    deleteTask,
    listDueSoon,
    listOverdue,
    markReminder,
    toMysqlDateTime
};
