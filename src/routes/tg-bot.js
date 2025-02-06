// /routes/tg-bot.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Если необходимо разрешить CORS
const { addReminder } = require('../user/service/userService');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

app.post('/addReminder', async (req, res) => {
    const { telegramId, date, text } = req.body;

    if (!telegramId || !date || !text) {
        return res.status(400).json({ success: false, error: 'Не все поля заполнены.' });
    }

    try {
        const result = await addReminder({ telegramId, date, text });

        if (result.success) {
            return res.json({ success: true });
        } else {
            return res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Ошибка на сервере при добавлении напоминания:', error);
        return res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера.' });
    }
});

module.exports = app;
