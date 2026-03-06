function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').toLowerCase());
}

function isStrongPassword(value) {
    return typeof value === 'string' && value.length >= 8;
}

function sanitize(str) {
    return String(str || '').trim();
}

module.exports = {
    isEmail,
    isStrongPassword,
    sanitize
};
