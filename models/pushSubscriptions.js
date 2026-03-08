const db = require('./db');

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    subscription_json LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_push_endpoint (endpoint(191)),
    INDEX idx_push_user (user_id)
)
`;

let initialized = false;

async function ensureTable() {
    if (initialized) return;
    await db.promise().query(CREATE_TABLE_SQL);
    initialized = true;
}

async function upsertSubscription(userId, subscription) {
    await ensureTable();
    const endpoint = String(subscription.endpoint || '').trim();
    const p256dh = String(subscription.keys?.p256dh || '').trim();
    const auth = String(subscription.keys?.auth || '').trim();
    const subscriptionJson = JSON.stringify(subscription);

    const sql = `
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, subscription_json)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            p256dh = VALUES(p256dh),
            auth = VALUES(auth),
            subscription_json = VALUES(subscription_json)
    `;
    return db.promise().query(sql, [userId, endpoint, p256dh, auth, subscriptionJson]);
}

async function removeSubscription(userId, endpoint) {
    await ensureTable();
    const sql = 'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?';
    return db.promise().query(sql, [userId, endpoint]);
}

async function removeSubscriptionByEndpoint(endpoint) {
    await ensureTable();
    const sql = 'DELETE FROM push_subscriptions WHERE endpoint = ?';
    return db.promise().query(sql, [endpoint]);
}

async function listSubscriptions(userId) {
    await ensureTable();
    const sql = 'SELECT endpoint, p256dh, auth, subscription_json FROM push_subscriptions WHERE user_id = ? ORDER BY updated_at DESC';
    const [rows] = await db.promise().query(sql, [userId]);
    return rows.map(row => {
        try {
            const parsed = typeof row.subscription_json === 'string'
                ? JSON.parse(row.subscription_json)
                : row.subscription_json;
            if (parsed && parsed.endpoint) return parsed;
        } catch {}
        return {
            endpoint: row.endpoint,
            keys: {
                p256dh: row.p256dh,
                auth: row.auth
            }
        };
    });
}

module.exports = {
    upsertSubscription,
    removeSubscription,
    removeSubscriptionByEndpoint,
    listSubscriptions
};
