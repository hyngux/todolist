const express = require('express');
const entries = require('../models/entries');
const habits = require('../models/habits');
const calendarTasks = require('../models/calendarTasks');
const pushSubscriptions = require('../models/pushSubscriptions');
const { webPush, getPublicKey } = require('../lib/pushConfig');

const router = express.Router();
const DAY_MS = 24 * 60 * 60 * 1000;


function parseHabitDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const raw = String(value).trim();
    if (!raw) return null;
    const iso = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const direct = new Date(iso);
    if (!Number.isNaN(direct.getTime())) return direct;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const dayOnly = new Date(`${raw}T00:00:00`);
        if (!Number.isNaN(dayOnly.getTime())) return dayOnly;
    }
    return null;
}

function toMysqlDateTime(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function buildHabitView(habit, now = new Date()) {
    const lastAt = parseHabitDate(habit.last_completed);
    const view = { ...habit, streak: habit.streak || 0 };
    if (!lastAt) {
        view.next_available_at = null;
        view.expires_at = null;
        view.remaining_ms = 0;
        view.locked = false;
        return view;
    }

    const elapsed = now.getTime() - lastAt.getTime();
    const nextAvailableAt = new Date(lastAt.getTime() + DAY_MS);
    const expiresAt = new Date(lastAt.getTime() + DAY_MS * 2);
    const locked = elapsed < DAY_MS;
    const isExpired = elapsed >= DAY_MS * 2;

    view.streak = isExpired ? 0 : (habit.streak || 0);
    view.next_available_at = nextAvailableAt.toISOString();
    view.expires_at = expiresAt.toISOString();
    view.remaining_ms = locked ? (DAY_MS - elapsed) : 0;
    view.locked = locked;
    return view;
}

async function sendPushToUser(userId, payload) {
    const subscriptions = await pushSubscriptions.listSubscriptions(userId);
    if (!subscriptions.length) return 0;

    const body = JSON.stringify(payload);
    await Promise.all(subscriptions.map(async (subscription) => {
        try {
            await webPush.sendNotification(subscription, body);
        } catch (err) {
            const status = err?.statusCode;
            if (status === 404 || status === 410) {
                await pushSubscriptions.removeSubscriptionByEndpoint(subscription.endpoint);
                return;
            }
            throw err;
        }
    }));

    return subscriptions.length;
}

router.get('/entries/:category', async (req, res) => {
    try {
        const [results] = await entries.listEntries(req.user.id, req.params.category);
        res.json(results);
    } catch (err) {
        console.error('Failed to load entries:', err.message);
        res.status(500).json({ error: err.message || 'Failed to load entries' });
    }
});

router.post('/entries', async (req, res) => {
    const { title, content, category, dueAt } = req.body;
    if (!content || !category) return res.status(400).json({ error: 'Invalid input' });
    try {
        const [result] = await entries.createEntry(req.user.id, title, content, category, dueAt);

        if (category === 'tarefa') {
            const taskLabel = String(title || content || 'Task').trim();
            sendPushToUser(req.user.id, {
                title: 'New Task Created',
                body: `"${taskLabel}" was added successfully.`,
                url: '/'
            }).catch(err => {
                console.error('Failed to send task-created push:', err.message);
            });
        }

        res.status(201).json({ id: result.insertId, title, content, category });
    } catch (err) {
        console.error('Failed to save entry:', err.message);
        res.status(500).json({ error: err.message || 'Failed to save entry' });
    }
});

router.patch('/entries/:id/toggle', async (req, res) => {
    const category = req.query.category || req.body.category;
    if (!category) return res.status(400).json({ error: 'Invalid input' });
    try {
        await entries.toggleEntry(req.user.id, req.params.id, category);
        res.sendStatus(200);
    } catch (err) {
        console.error('Failed to update entry:', err.message);
        res.status(500).json({ error: err.message || 'Failed to update entry' });
    }
});

router.patch('/entries/:id', async (req, res) => {
    const { title, content, category, dueAt } = req.body;
    if (!content || !category) return res.status(400).json({ error: 'Invalid input' });
    try {
        await entries.updateEntry(req.user.id, req.params.id, title, content, category, dueAt);
        res.sendStatus(200);
    } catch (err) {
        console.error('Failed to update entry:', err.message);
        res.status(500).json({ error: err.message || 'Failed to update entry' });
    }
});

router.delete('/entries/:id', async (req, res) => {
    const category = req.query.category || req.body.category;
    if (!category) return res.status(400).json({ error: 'Invalid input' });
    try {
        await entries.deleteEntry(req.user.id, req.params.id, category);
        res.sendStatus(204);
    } catch (err) {
        console.error('Failed to delete entry:', err.message);
        res.status(500).json({ error: err.message || 'Failed to delete entry' });
    }
});

router.get('/calendar/tasks', async (req, res) => {
    const month = String(req.query.month || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
    }
    try {
        const rows = await calendarTasks.listTasksForMonth(req.user.id, month);
        res.json(rows);
    } catch (err) {
        console.error('Failed to list calendar tasks:', err.message);
        res.status(500).json({ error: 'Failed to list calendar tasks' });
    }
});

router.post('/calendar/tasks', async (req, res) => {
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const dueAt = String(req.body?.dueAt || '').trim();
    if (!title || !dueAt) {
        return res.status(400).json({ error: 'Title and dueAt are required' });
    }

    try {
        const id = await calendarTasks.createTask(req.user.id, { title, description, dueAt });
        sendPushToUser(req.user.id, {
            title: 'Calendar Task Created',
            body: `"${title}" was added to calendar.`,
            url: '/calendar.html'
        }).catch(err => {
            console.error('Failed to send calendar-created push:', err.message);
        });

        res.status(201).json({ id, title, description, due_at: dueAt, done: 0 });
    } catch (err) {
        console.error('Failed to create calendar task:', err.message);
        res.status(500).json({ error: 'Failed to create calendar task' });
    }
});

router.patch('/calendar/tasks/:id', async (req, res) => {
    const done = Boolean(req.body?.done);
    try {
        await calendarTasks.setDone(req.user.id, req.params.id, done);
        res.json({ ok: true });
    } catch (err) {
        console.error('Failed to update calendar task:', err.message);
        res.status(500).json({ error: 'Failed to update calendar task' });
    }
});

router.delete('/calendar/tasks/:id', async (req, res) => {
    try {
        await calendarTasks.deleteTask(req.user.id, req.params.id);
        res.sendStatus(204);
    } catch (err) {
        console.error('Failed to delete calendar task:', err.message);
        res.status(500).json({ error: 'Failed to delete calendar task' });
    }
});

router.get('/habits', async (req, res) => {
    try {
        const [rows] = await habits.listHabits(req.user.id);
        const now = new Date();
        res.json(rows.map(h => buildHabitView(h, now)));
    } catch (err) {
        res.status(500).json({ error: 'Failed to load habits' });
    }
});

router.post('/habits', async (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Invalid input' });
    try {
        const [result] = await habits.createHabit(req.user.id, name);
        res.status(201).json({ id: result.insertId, name, streak: 0, last_completed: null });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create habit' });
    }
});

router.patch('/habits/:id/complete', async (req, res) => {
    try {
        const [rows] = await habits.listHabits(req.user.id);
        const habit = rows.find(h => String(h.id) === String(req.params.id));
        if (!habit) return res.status(404).json({ error: 'Not found' });

        const now = new Date();
        const lastAt = parseHabitDate(habit.last_completed);
        let nextStreak = 1;

        if (lastAt) {
            const elapsed = now.getTime() - lastAt.getTime();
            if (elapsed < DAY_MS) {
                return res.status(409).json({
                    error: 'Habit is still cooling down',
                    remaining_ms: DAY_MS - elapsed,
                    habit: buildHabitView(habit, now)
                });
            }
            if (elapsed >= DAY_MS * 2) {
                nextStreak = 1;
            } else {
                nextStreak = (habit.streak || 0) + 1;
            }
        }

        const lastCompleted = toMysqlDateTime(now);
        await habits.updateHabit(req.user.id, habit.id, { streak: nextStreak, lastCompleted });
        res.json(buildHabitView({ ...habit, streak: nextStreak, last_completed: lastCompleted }, now));
    } catch (err) {
        res.status(500).json({ error: 'Failed to update habit' });
    }
});

router.delete('/habits/:id', async (req, res) => {
    try {
        await habits.deleteHabit(req.user.id, req.params.id);
        res.sendStatus(204);
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete habit' });
    }
});

router.get('/push/public-key', (req, res) => {
    res.json({ publicKey: getPublicKey() });
});

router.post('/push/subscribe', async (req, res) => {
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return res.status(400).json({ error: 'Invalid subscription payload' });
    }

    try {
        await pushSubscriptions.upsertSubscription(req.user.id, subscription);
        res.status(201).json({ ok: true });
    } catch (err) {
        console.error('Failed to save push subscription:', err.message);
        res.status(500).json({ error: 'Failed to save push subscription' });
    }
});

router.post('/push/unsubscribe', async (req, res) => {
    const endpoint = String(req.body?.endpoint || '').trim();
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });

    try {
        await pushSubscriptions.removeSubscription(req.user.id, endpoint);
        res.json({ ok: true });
    } catch (err) {
        console.error('Failed to remove push subscription:', err.message);
        res.status(500).json({ error: 'Failed to remove push subscription' });
    }
});

router.post('/push/test', async (req, res) => {
    try {
        const subscriptions = await pushSubscriptions.listSubscriptions(req.user.id);
        if (!subscriptions.length) {
            return res.status(404).json({ error: 'No push subscriptions for this user' });
        }

        const payload = {
            title: req.body?.title || 'HYX Reminder',
            body: req.body?.body || 'This is your test notification.',
            url: req.body?.url || '/'
        };

        await sendPushToUser(req.user.id, payload);

        res.json({ ok: true, sent: subscriptions.length });
    } catch (err) {
        console.error('Failed to send test push:', err.message);
        res.status(500).json({ error: 'Failed to send push notification' });
    }
});

module.exports = router;
