// const mongoose = require('mongoose');
//
// const reminderSchema = new mongoose.Schema({
//     user: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//         required: true,
//     },
//     date: {
//         type: Date,
//         required: true,
//     },
//     message: {
//         type: String,
//         required: true,
//     },
//     createdAt: {
//         type: Date,
//         default: Date.now,
//     },
// });
//
// module.exports = mongoose.model('Reminder', reminderSchema, "reminder-reminder-bot-express");