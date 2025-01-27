const User = require('../model/User');
const moment = require('moment-timezone');
const sanitizeHtml = require('sanitize-html');

const registerUser = async (userRegisterDto) => {
    const { isValid, errors } = userRegisterDto.validate();

    if (!isValid) {
        const errorMessages = Object.values(errors).join(' ');
        throw new Error(`Validation failed: ${errorMessages}`);
    }

    const { telegramId, firstName, lastName, username, phoneNumber, language, reminderBefore, timezone, isBot, languageCode } = userRegisterDto;
    const existingUser = await User.findOne({ telegramId });
    if (existingUser) {
        throw new Error('User already exists with this telegramId: ' + telegramId);
    }

    const newUser = new User({
        telegramId,
        firstName,
        lastName,
        username,
        phoneNumber,
        language,
        reminderBefore,
        timezone,
        isBot,
        languageCode
    });

    // const newUser = new User({
    //     telegramId,
    //     language,
    //     reminderBefore,
    //     timezone
    //     // all other data set auto like dateRegister
    // });

    await newUser.save();

    return newUser;
};

const addReminder = async ({ telegramId, date, text }) => {
    console.log("here 1")
    try {
        const bot= require('../../bot/bot');

        if (!bot || !bot.telegram) {
            throw new Error('❌ Error bot not initialized');
        }

        const user = await User.findOne({ telegramId });
        if (!user) {
            return { success: false, error: '❌ Пользователь не найден.' };
        }

        const safeText = sanitizeHtml(text, {
            allowedTags: [],
            allowedAttributes: {}
        });

        const userTimezone = user.timezone || 'UTC';
        const localMoment = moment.tz(date, 'DD.MM.YYYY HH:mm', userTimezone);
        const utcMoment = localMoment.clone().utc();

        if (!localMoment.isValid()) {
            return { success: false, error: '❌ Некорректная дата.' };
        }

        const reminderData = {
            date: utcMoment.toDate(),
            message: safeText
        };

        const key = utcMoment.toISOString().replace(/\./g, '_');

        await User.findOneAndUpdate(
            { telegramId },
            { $set: { [`reminders.${key}`]: reminderData } },
            { upsert: true, new: true }
        );

        await bot.telegram.sendMessage(
            user.telegramId,
            `⏰ Напоминание добавлено: \n*${date}*\n${safeText}`,
            { parse_mode: 'Markdown' }
        );

        console.log("reminder added success");
        return { success: true };
    } catch (error) {
        return { success: false, error: '❌ Ошибка сохранения. Попробуйте снова.' };
    }
};


const validateReminderDate = async ({ telegramId, date }) => {
    console.log("start here")
    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            return { success: false, error: '❌ Пользователь не найден.' };
        }

        const userTimezone = user.timezone || 'UTC';

        const momentDate = moment.tz(date, 'DD.MM.YYYY HH:mm', userTimezone);

        if (!momentDate.isValid()) {
            return { success: false, error: '❌ Некорректная дата или формат. Используйте "ДД.ММ.ГГГГ ЧЧ:ММ".' };
        }
        const dateUTC = momentDate.clone().utc();

        const nowUTC = moment.utc();

        if (dateUTC.isBefore(nowUTC)) {
            return { success: false, error: '❌ Нельзя установить напоминание на прошедшую дату.' };
        }

        const key = dateUTC.toISOString().replace(/\./g, '_');

        if (user.reminders && user.reminders.has(key)) {
            return { success: false, error: '⚠️ Напоминание на эту дату уже существует!' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error validate date:', error);
        return { success: false, error: '❌ Ошибка при валидации даты.' };
    }
};

const getAllReminders = async ({ telegramId }) => {
    try {
        const user = await User.findOne({ telegramId });
        // console.log(user);

        if (!user || !user.reminders || user.reminders.size === 0) {
            return { success: false, error: '🔍 У вас пока нет напоминаний.' };
        }

        const userTimezone = user.timezone || 'UTC';
        // console.log(`Timezone of user: ${userTimezone}`);

        const remindersArray = Array.from(user.reminders.entries()).map(([key, reminder]) => {
            if (!reminder.date) return null;

            const utcMoment = moment.utc(reminder.date); // UTC
            const userMoment = utcMoment.clone().tz(userTimezone); // timezone

            // console.log('📅 Original date (UTC):', utcMoment.format());
            // console.log('🌍 Date in user’s timezone:', userMoment.format('YYYY-MM-DD HH:mm:ss Z'));

            return {
                date: userMoment.format('DD.MM.YYYY HH:mm'),
                message: reminder.message,
                key: key,
                id: reminder._id.toString(),
            };
        }).filter(Boolean);

        if (remindersArray.length === 0) {
            return { success: false, error: '❌ Ошибка в данных напоминаний. Проверьте их формат.' };
        }

        remindersArray.sort((a, b) => {
            return moment(a.date, 'DD.MM.YYYY HH:mm').toDate() - moment(b.date, 'DD.MM.YYYY HH:mm').toDate();
        });

        return { success: true, reminders: remindersArray };
    } catch (error) {
        // console.error('Error fetching reminders:', error);
        return { success: false, error: '❌ Ошибка получения напоминаний. Попробуйте снова.' };
    }
};

const deleteReminder = async ({ telegramId, key }) => {
    try {
        const user = await User.findOne({ telegramId });

        if (!user || !user.reminders || !user.reminders.has(key)) {
            return { success: false, error: '❌ Напоминание не найдено.' };
        }

        user.reminders.delete(key);
        await user.save();

        return { success: true };
    } catch (error) {
        console.error('Error remove reminder:', error);
        return { success: false, error: '❌ Ошибка удаления напоминания. Попробуйте снова.' };
    }
};

const sendScheduledMessages = async (bot) => {
    try {
        const users = await User.find({});

        for (const user of users) {
            //console.log(`---------------------------------------------------`);
            //console.log(`👤 User: ${user.telegramId}`);

            if (!user || !user.reminders || user.reminders.size === 0) {
                // console.log(`🔍 The user has no reminders.`);
                continue;
            }

            const userTimezone = user.timezone || "UTC";
            const nowUser = moment().tz(userTimezone);

            //console.log(`🌍 User's timezone: ${userTimezone}`);
            //console.log(`⏳ Current time (User's timezone): ${nowUser.format('YYYY-MM-DD HH:mm:ss')}`);

            const remindersArray = [...user.reminders.values()].map(reminder => ({
                id: reminder._id.toString(),
                date: moment.utc(reminder.date),  // ❗ The date is stored in UTC in the database
                message: reminder.message
            }));

            const validReminders = remindersArray.filter(reminder => reminder.date.isValid());

            if (validReminders.length === 0) {
                //console.log(`🔍 The user has no valid reminders.`);
                continue;
            }

            validReminders.sort((a, b) => a.date - b.date);

            for (const reminder of validReminders) {
                const reminderTimeUTC = reminder.date;
                const reminderTimeUser = reminderTimeUTC.clone().tz(userTimezone);

                let notifyBeforeMs;
                switch (user.reminderBefore) {
                    case '5M':
                        notifyBeforeMs = 5 * 60 * 1000; // 5 минут
                        break;
                    case '1H':
                        notifyBeforeMs = 60 * 60 * 1000; // 1 час
                        break;
                    case '1D':
                        notifyBeforeMs = 24 * 60 * 60 * 1000; // 1 день
                        break;
                    default:
                        notifyBeforeMs = 60 * 60 * 1000; // По умолчанию 1 час
                }

                const notifyTimeUser = reminderTimeUser.clone().subtract(notifyBeforeMs, 'milliseconds');

                //console.log(`📆 Event date (User's timezone): ${reminderTimeUser.format('YYYY-MM-DD HH:mm:ss')}`);
                //console.log(`📩 Notification time (User's timezone): ${notifyTimeUser.format('YYYY-MM-DD HH:mm:ss')}`);
               // console.log("--------------");
                if (Math.abs(notifyTimeUser.diff(nowUser, 'minutes')) <= 1) {
                    await bot.telegram.sendMessage(
                        user.telegramId,
                        `⏰ Reminder (${user.reminderBefore} before the event): ${reminder.message}`
                    );
                    await deleteReminderById({ telegramId: user.telegramId, reminderId: reminder.id });
                    console.log(`✅ Напоминание отправлено пользователю ${user.telegramId}`);
                    console.log(`🗑 Напоминание удалено: ${reminder.id}`);
                }
            }
        }
        // console.log(`✅ Completed checking all users.`);
    } catch (error) {
        console.error("❌ Error processing reminders:", error);
    }
};

const deleteReminderById = async ({ telegramId, reminderId }) => {
    try {
        const user = await User.findOne({ telegramId });

        if (!user || !user.reminders) {
            return { success: false, error: '❌ Напоминание не найдено.' };
        }

        const keyToDelete = [...user.reminders.entries()]
            .find(([key, reminder]) => reminder._id.toString() === reminderId)?.[0];

        if (!keyToDelete) {
            return { success: false, error: '❌ Напоминание не найдено.' };
        }

        user.reminders.delete(keyToDelete);
        await user.save();

        return { success: true };
    } catch (error) {
        console.error('Error delete reminder:', error);
        return { success: false, error: '❌ Ошибка удаления напоминания. Попробуйте снова.' };
    }
};

const updateReminderBefore = async ({ telegramId, time }) => {
    try {
        if (!['5M', '1H', '1D'].includes(time)) {
            return { success: false, error: '❌ Недопустимое значение времени напоминания.' };
        }

        const user = await User.findOneAndUpdate(
            { telegramId },
            { $set: { reminderBefore: time } },
            { new: true }
        );

        if (!user) {
            return { success: false, error: '⚠️ Пользователь не найден.' };
        }

        return { success: true, message: `✅ Время напоминаний обновлено: ${time}` };
    } catch (error) {
        console.error('❌ Ошибка при обновлении времени напоминаний:', error);
        return { success: false, error: '❌ Ошибка обновления времени напоминаний.' };
    }
};

const updateTimezone = async ({ telegramId, timezone }) => {
    try {
        if (!moment.tz.zone(timezone)) {
            return { success: false, error: '❌ Некорректный часовой пояс.' };
        }

        const user = await User.findOneAndUpdate(
            { telegramId },
            { $set: { timezone } },
            { new: true }
        );

        if (!user) {
            return { success: false, error: '⚠️ Пользователь не найден.' };
        }

        return { success: true, message: `✅ Часовой пояс обновлён: ${timezone}` };
    } catch (error) {
        console.error('❌ Ошибка при обновлении часового пояса:', error);
        return { success: false, error: '❌ Ошибка обновления часового пояса.' };
    }
};

module.exports = {
    registerUser,
    addReminder,
    getAllReminders,
    validateReminderDate,
    deleteReminder,
    sendScheduledMessages,
    updateReminderBefore,
    updateTimezone
};