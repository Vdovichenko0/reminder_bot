const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    telegramId: {
        type: String,
        required: true,
        unique: true,
    },
    firstName: {
        type: String,
        default: null,
    },
    lastName: {
        type: String,
        default: null,
    },
    username: {
        type: String,
        default: null,
    },
    phoneNumber: {
        type: String,
        default: null,
    },
    isBot: {
        type: Boolean,
        default: false,
    },
    languageCode: {
        type: String,
        default: null,
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
    countReminders:{
        type: Number,
        default: 0
    },
    countExistsReminders:{
        type: Number,
        default: 0
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
            isSendNotify: {
                type: Boolean,
                default: false,
            },
            isSendNotifyNow: {
                type: Boolean,
                default: false,
            },
        },
        default: {},
    },
    timezone: {
        type: String,
        default: "UTC"
    }

});

module.exports = mongoose.model('User', userSchema, "user-reminder-bot-express");