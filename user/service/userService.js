const User = require('../model/User');
const { ObjectId } = require('mongoose').Types;

const registerUser = async (userRegisterDto) => {
    const { isValid, errors } = userRegisterDto.validate();

    if (!isValid) {
        const errorMessages = Object.values(errors).join(' ');
        throw new Error(`Validation failed: ${errorMessages}`);
    }

    const { telegramId, language, reminderBefore } = userRegisterDto;
    const existingUser = await User.findOne({ telegramId });
    if (existingUser) {
        throw new Error('User already exists with this telegramId: ' + telegramId);
    }

    const newUser = new User({
        telegramId,
        language,
        reminderBefore,
        // all other data set auto like dateRegister
    });

    await newUser.save();

    return newUser;
};

const addReminder = async ({ telegramId, date, text }) => {
    try {
        const reminderData = { date, message: text };

        await User.findOneAndUpdate(
            { telegramId },
            { $set: { [`reminders.${date.toISOString().replace(/\./g, '_')}`]: reminderData } },
            { upsert: true, new: true }
        );

        return { success: true };
    } catch (error) {
        console.error('Ошибка сохранения напоминания:', error);
        return { success: false, error: '❌ Ошибка сохранения. Попробуйте снова.' };
    }
};

const validateReminderDate = async ({ telegramId, date }) => {
    const now = new Date();

    if (date < now) {
        return { success: false, error: '❌ Нельзя установить напоминание на прошедшую дату.' };
    }

    const user = await User.findOne({ telegramId });

    if (user && user.reminders && user.reminders.has(date.toISOString().replace(/\./g, '_'))) {
        return { success: false, error: '⚠️ Напоминание на эту дату уже существует!' };
    }

    return { success: true };
};


const getAllReminders = async ({ telegramId }) => {
    try {
        const user = await User.findOne({ telegramId });
        // console.log(user);

        if (!user || !user.reminders || user.reminders.size === 0) {
            return { success: false, error: '🔍 У вас пока нет напоминаний.' };
        }

        const remindersArray = Array.from(user.reminders.values()).map(reminder => ({
            date: reminder.date instanceof Date ? reminder.date : new Date(reminder.date),
            message: reminder.message
        }));

        const validReminders = remindersArray.filter(reminder => reminder.date instanceof Date && !isNaN(reminder.date));

        if (validReminders.length === 0) {
            return { success: false, error: '❌ Ошибка в данных напоминаний. Проверьте их формат.' };
        }

        // sort by day > month > year
        validReminders.sort((a, b) => a.date - b.date);

        return { success: true, reminders: validReminders };
    } catch (error) {
        console.error('Ошибка получения напоминаний:', error);
        return { success: false, error: '❌ Ошибка получения напоминаний. Попробуйте снова.' };
    }
};

const deleteReminder = async ({ telegramId, dateToDelete }) => {
    try {
        const user = await User.findOne({ telegramId });

        if (!user || !user.reminders || !user.reminders.has(dateToDelete.replace(/\./g, '_'))) {
            return { success: false, error: '❌ Напоминание не найдено.' };
        }

        user.reminders.delete(dateToDelete.replace(/\./g, '_'));
        await user.save();

        return { success: true };
    } catch (error) {
        console.error('Ошибка удаления напоминания:', error);
        return { success: false, error: '❌ Ошибка удаления напоминания. Попробуйте снова.' };
    }
};

module.exports = {
    registerUser,
    addReminder,
    getAllReminders,
    validateReminderDate,
    deleteReminder
};