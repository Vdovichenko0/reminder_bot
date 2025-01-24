// i18n.js

const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const path = require('path');

i18next.use(Backend).init({
    fallbackLng: 'ru',
    preload: ['en', 'ru'],
    ns: ['translation'],
    defaultNS: 'translation',
    backend: {
        loadPath: path.join(__dirname, 'locales/{{lng}}/{{ns}}.json'),
    },
    interpolation: {
        escapeValue: false, // Не нужно экранировать, т.к. Telegraf уже обрабатывает текст
    },
});

module.exports = i18next;
