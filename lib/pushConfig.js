const webPush = require('web-push');

const configuredVapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const configuredVapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidKeys = (configuredVapidPublicKey && configuredVapidPrivateKey)
    ? { publicKey: configuredVapidPublicKey, privateKey: configuredVapidPrivateKey }
    : webPush.generateVAPIDKeys();

if (!configuredVapidPublicKey || !configuredVapidPrivateKey) {
    console.warn('[push] VAPID keys are not configured in .env. Generated temporary keys for this process only.');
}

webPush.setVapidDetails(
    process.env.VAPID_CONTACT || 'mailto:admin@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

function getPublicKey() {
    return vapidKeys.publicKey;
}

module.exports = {
    webPush,
    getPublicKey
};
