const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    telegramId: {
        type: String,
        required: true,
        unique: true,
    },
    dateRegister: {
        type: Date,
        default: Date.now,
    },
    language: {
        type: String,
        enum: ['EN', 'RU'],
        default: 'RU',
    },
    reminderBefore: {
        type: String,
        enum: ['5M', '1H', '1D'],
        default: '1H',
    },
    reminders: {
        type: Map,
        of: {
            date: {
                type: Date,
                required: true,
            },
            message: {
                type: String,
                required: true,
            },
        },
        default: {},
    },
});

module.exports = mongoose.model('User', userSchema, "user-reminder-bot-express");