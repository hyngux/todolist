const express = require('express');
const entries = require('../models/entries');
const habits = require('../models/habits');

const router = express.Router();

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
    const { title, content, category } = req.body;
    if (!content || !category) return res.status(400).json({ error: 'Invalid input' });
    try {
        const [result] = await entries.createEntry(req.user.id, title, content, category);
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
    const { title, content, category } = req.body;
    if (!content || !category) return res.status(400).json({ error: 'Invalid input' });
    try {
        await entries.updateEntry(req.user.id, req.params.id, title, content, category);
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

router.get('/habits', async (req, res) => {
    try {
        const [rows] = await habits.listHabits(req.user.id);
        res.json(rows);
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

        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        if (habit.last_completed === todayStr) return res.json(habit);

        let nextStreak = 1;
        if (habit.last_completed) {
            const last = new Date(habit.last_completed + 'T00:00:00');
            const diff = Math.round((new Date(todayStr) - last) / 86400000);
            nextStreak = diff === 1 ? (habit.streak + 1) : 1;
        }

        await habits.updateHabit(req.user.id, habit.id, { streak: nextStreak, lastCompleted: todayStr });
        res.json({ ...habit, streak: nextStreak, last_completed: todayStr });
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

module.exports = router;
