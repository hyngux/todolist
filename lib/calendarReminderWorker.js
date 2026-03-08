const calendarTasks = require('../models/calendarTasks');
const pushSubscriptions = require('../models/pushSubscriptions');
const { webPush } = require('./pushConfig');

async function sendPushToUser(userId, payload) {
    const subscriptions = await pushSubscriptions.listSubscriptions(userId);
    if (!subscriptions.length) return;

    const body = JSON.stringify(payload);
    await Promise.all(subscriptions.map(async (subscription) => {
        try {
            await webPush.sendNotification(subscription, body);
        } catch (err) {
            const status = err?.statusCode;
            if (status === 404 || status === 410) {
                await pushSubscriptions.removeSubscriptionByEndpoint(subscription.endpoint);
            } else {
                throw err;
            }
        }
    }));
}

async function processCalendarReminders() {
    const now = new Date();
    const oneHourAhead = new Date(now.getTime() + 60 * 60 * 1000);

    const dueSoon = await calendarTasks.listDueSoon(now, oneHourAhead);
    for (const task of dueSoon) {
        await sendPushToUser(task.user_id, {
            title: 'Task Due in 1 Hour',
            body: `${task.title} is due at ${formatDue(task.due_at)}.`,
            url: '/calendar.html'
        });
    }
    await calendarTasks.markReminder(dueSoon.map(t => t.id), 'reminded_1h');

    const overdue = await calendarTasks.listOverdue(now);
    for (const task of overdue) {
        await sendPushToUser(task.user_id, {
            title: 'Task Overdue',
            body: `${task.title} is overdue. Open Calendar to update it.`,
            url: '/calendar.html'
        });
    }
    await calendarTasks.markReminder(overdue.map(t => t.id), 'reminded_overdue');
}

function formatDue(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'soon';
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

module.exports = {
    processCalendarReminders
};
