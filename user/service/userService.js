const User = require('../model/User');
const moment = require('moment-timezone');
const sanitizeHtml = require('sanitize-html');

const registerUser = async (userRegisterDto) => {
    const {isValid, errors} = userRegisterDto.validate();

    if (!isValid) {
        const errorMessages = Object.values(errors).join(' ');
        throw new Error(`Validation failed: ${errorMessages}`);
    }

    const {
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
    } = userRegisterDto;
    const existingUser = await User.findOne({telegramId});
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
    console.log("add reminder: here 1");
    try {
        const bot = require('../../bot/bot');

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

        const nowUTC = moment.utc();
        let autoSendNotify = false;

        switch (user.reminderBefore) {
            case '5M':
                autoSendNotify = utcMoment.diff(nowUTC, 'minutes') < 5;
                break;
            case '1H':
                autoSendNotify = utcMoment.diff(nowUTC, 'hours') < 1;
                break;
            case '1D':
                autoSendNotify = utcMoment.diff(nowUTC, 'days') < 1;
                break;
            default:
                autoSendNotify = false;
        }

        const reminderData = {
            date: utcMoment.toDate(),
            message: safeText,
            isSendNotify: autoSendNotify,
            isSendNotifyNow: false
        };

        const key = utcMoment.toISOString().replace(/\./g, '_');

        const updatedUser = await User.findOneAndUpdate(
            { telegramId },
            { $set: { [`reminders.${key}`]: reminderData } },
            { upsert: true, new: true }
        );

        // update `markModified`, if `reminders` - `Map`
        if (updatedUser) {
            updatedUser.markModified('reminders');
            await updatedUser.save();
        }

        await bot.telegram.sendMessage(
            user.telegramId,
            `⏰ Напоминание добавлено: \n*${date}*\n${safeText}`,
            { parse_mode: 'Markdown' }
        );

        console.log("✅ Reminder added successfully");
        return { success: true };
    } catch (error) {
        console.error("❌ Error saving reminder:", error);
        return { success: false, error: '❌ Ошибка сохранения. Попробуйте снова.' };
    }
};

const validateReminderDate = async ({telegramId, date}) => {
    console.log("start here")
    try {
        const user = await User.findOne({telegramId});
        if (!user) {
            return {success: false, error: '❌ Пользователь не найден.'};
        }

        const userTimezone = user.timezone || 'UTC';

        const momentDate = moment.tz(date, 'DD.MM.YYYY HH:mm', userTimezone);

        if (!momentDate.isValid()) {
            return {success: false, error: '❌ Некорректная дата или формат. Используйте "ДД.ММ.ГГГГ ЧЧ:ММ".'};
        }
        const dateUTC = momentDate.clone().utc();

        const nowUTC = moment.utc();

        if (dateUTC.isBefore(nowUTC)) {
            return {success: false, error: '❌ Нельзя установить напоминание на прошедшую дату.'};
        }

        const key = dateUTC.toISOString().replace(/\./g, '_');

        if (user.reminders && user.reminders.has(key)) {
            return {success: false, error: '⚠️ Напоминание на эту дату уже существует!'};
        }

        return {success: true};
    } catch (error) {
        console.error('Error validate date:', error);
        return {success: false, error: '❌ Ошибка при валидации даты.'};
    }
};

const getAllReminders = async ({telegramId}) => {
    try {
        const user = await User.findOne({telegramId});
        // console.log(user);

        if (!user || !user.reminders || user.reminders.size === 0) {
            return {success: false, error: '🔍 У вас пока нет напоминаний.'};
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
            return {success: false, error: '❌ Ошибка в данных напоминаний. Проверьте их формат.'};
        }

        remindersArray.sort((a, b) => {
            return moment(a.date, 'DD.MM.YYYY HH:mm').toDate() - moment(b.date, 'DD.MM.YYYY HH:mm').toDate();
        });

        return {success: true, reminders: remindersArray};
    } catch (error) {
        // console.error('Error fetching reminders:', error);
        return {success: false, error: '❌ Ошибка получения напоминаний. Попробуйте снова.'};
    }
};

const deleteReminder = async ({telegramId, key}) => {
    try {
        const user = await User.findOne({telegramId});

        if (!user || !user.reminders || !user.reminders.has(key)) {
            return {success: false, error: '❌ Напоминание не найдено.'};
        }

        user.reminders.delete(key);
        await user.save();

        return {success: true};
    } catch (error) {
        console.error('Error remove reminder:', error);
        return {success: false, error: '❌ Ошибка удаления напоминания. Попробуйте снова.'};
    }
};

const sendScheduledMessages = async (bot) => {
    try {
        const users = await User.find({});

        for (const user of users) {
            // console.log(`---------------------------------------------------`);
            // console.log(`👤 User: ${user.telegramId}`);

            if (!user || !user.reminders || user.reminders.size === 0) {
                // console.log(`🔍 The user has no reminders.`);
                continue;
            }

            const userTimezone = user.timezone || "UTC";
            const nowUser = moment().tz(userTimezone);

            // console.log(`🌍 User's timezone: ${userTimezone}`);
            // console.log(`⏳ Current time (User's timezone): ${nowUser.format('YYYY-MM-DD HH:mm:ss')}`);

            // const remindersArray = [...user.reminders.values()].map(reminder => ({
            const remindersArray = [...user.reminders.entries()].map(([key, reminder]) => ({
                id: reminder._id.toString(),
                key,
                date: moment.utc(reminder.date),  //  The date is stored in UTC in the database
                message: reminder.message,
                isSendNotify: reminder.isSendNotify,
                isSendNotifyNow: reminder.isSendNotifyNow
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
                        notifyBeforeMs = 5 * 60 * 1000; // 5 min
                        break;
                    case '1H':
                        notifyBeforeMs = 60 * 60 * 1000; // 1 hour
                        break;
                    case '1D':
                        notifyBeforeMs = 24 * 60 * 60 * 1000; // 1 day
                        break;
                    default:
                        notifyBeforeMs = 60 * 60 * 1000; // by def 1 hour
                }

                const notifyTimeUser = reminderTimeUser.clone().subtract(notifyBeforeMs, 'milliseconds');

                //  console.log(`📆 Event date (User's timezone): ${reminderTimeUser.format('YYYY-MM-DD HH:mm:ss')}`);
                //  console.log(`📩 Notification time (User's timezone): ${notifyTimeUser.format('YYYY-MM-DD HH:mm:ss')}`);
                //  console.log("--------------");

                //  1. Skip already sent reminders
                if (reminder.isSendNotify && reminder.isSendNotifyNow) {
                    await deleteReminderById({telegramId: user.telegramId, reminderId: reminder.id});
                    console.log(`🗑 Reminder deleted (already sent): ${reminder.id}`);
                    continue;
                }
                // 2. When reminder time = now, send message + delete
                if (!reminder.isSendNotifyNow && Math.abs(reminderTimeUser.diff(nowUser, 'minutes')) <= 1) {
                    await bot.telegram.sendMessage(
                        user.telegramId,
                        `⏰ Reminder: ${reminder.message}`
                    );
                    await setStatusNotify({
                        telegramId: user.telegramId,
                        key: reminder.key,
                        notify: reminder.isSendNotify,
                        notifyNow: true
                    });
                    console.log(`✅ Reminder sent (exact time): ${user.telegramId}`);

                    // Если напоминание уже было отправлено заранее, удаляем его
                    if (reminder.isSendNotify) {
                        await deleteReminderById({telegramId: user.telegramId, reminderId: reminder.id});
                        console.log(`🗑 Reminder deleted (sent at event time): ${reminder.id}`);
                    }
                    continue;
                }
                //  3. Send reminder by notify time + after this we send + one message in time reminder
                if (!reminder.isSendNotify && Math.abs(notifyTimeUser.diff(nowUser, 'minutes')) <= 1) {
                    await bot.telegram.sendMessage(
                        user.telegramId,
                        `⏰ Reminder (${user.reminderBefore} before the event): ${reminder.message}`
                    );
                    await setStatusNotify({
                        telegramId: user.telegramId,
                        key: reminder.key,
                        notify: true,
                        notifyNow: reminder.isSendNotifyNow
                    });
                    console.log(`✅ Reminder notification sent: ${user.telegramId}`);
                    continue;
                }
                // 4. If error service etc, send message but not delete, like reminder on 11.11.11 11:11 and 1D, now 11.11.11 09:00
                if (!reminder.isSendNotify && notifyTimeUser.isBefore(nowUser)) {
                    await bot.telegram.sendMessage(
                        user.telegramId,
                        `⚠️ Delayed Reminder!\n\n🕒 Original time: *${reminderTimeUser.format('YYYY-MM-DD HH:mm:ss')}*\n📌 ${reminder.message}`,
                        {parse_mode: "Markdown"}
                    );

                    await setStatusNotify({
                        telegramId: user.telegramId,
                        key: reminder.key,
                        notify: true,
                        notifyNow: reminder.isSendNotifyNow
                    });

                    console.log(`⚠️ Delayed reminder sent: ${user.telegramId}`);

                    if (reminder.isSendNotify && reminder.isSendNotifyNow) {
                        await deleteReminderById({ telegramId: user.telegramId, reminderId: reminder.id });
                        console.log(`🗑 Reminder deleted (delayed message was last): ${reminder.id}`);
                    };
                }
            }
        }
        // console.log(`✅ Completed checking all users.`);
    } catch (error) {
        console.error("❌ Error processing reminders:", error);
    }
};

const deleteReminderById = async ({telegramId, reminderId}) => {
    try {
        const user = await User.findOne({telegramId});

        if (!user || !user.reminders) {
            return {success: false, error: '❌ Напоминание не найдено.'};
        }

        const keyToDelete = [...user.reminders.entries()]
            .find(([key, reminder]) => reminder._id.toString() === reminderId)?.[0];

        if (!keyToDelete) {
            return {success: false, error: '❌ Напоминание не найдено.'};
        }

        user.reminders.delete(keyToDelete);
        await user.save();

        return {success: true};
    } catch (error) {
        console.error('Error delete reminder:', error);
        return {success: false, error: '❌ Ошибка удаления напоминания. Попробуйте снова.'};
    }
};

const updateReminderBefore = async ({ telegramId, time }) => {
    try {
        if (!['5M', '1H', '1D'].includes(time)) {
            return { success: false, error: '❌ Недопустимое значение времени напоминания.' };
        }

        const user = await User.findOne({ telegramId });

        if (!user) {
            return { success: false, error: '⚠️ Пользователь не найден.' };
        }

        const nowUTC = moment.utc();
        let notifyThresholdMinutes;

        switch (time) {
            case '5M':
                notifyThresholdMinutes = 5;
                break;
            case '1H':
                notifyThresholdMinutes = 60;
                break;
            case '1D':
                notifyThresholdMinutes = 1440; // 24 * 60
                break;
            default:
                return { success: false, error: '❌ Некорректное время напоминания.' };
        }

        user.reminderBefore = time;

        // all reminders
        user.reminders.forEach((reminder, key) => {
            const reminderTime = moment.utc(reminder.date);
            const diffMinutes = reminderTime.diff(nowUTC, 'minutes');

            if (diffMinutes <= 0) return;

            // set notify
            const newSendNotifyStatus = diffMinutes < notifyThresholdMinutes;
            if (reminder.isSendNotify !== newSendNotifyStatus) {
                console.log(`🔄 Update notify status for: ${key}, new status: ${newSendNotifyStatus}`);
            }

            reminder.isSendNotify = newSendNotifyStatus;
            user.reminders.set(key, reminder);
        });

        user.markModified('reminders'); // update map
        await user.save();

        return { success: true, message: `✅ Время напоминаний обновлено: ${time}` };
    } catch (error) {
        console.error('❌ Error update reminders/time notify:', error);
        return { success: false, error: '❌ Ошибка обновления времени напоминаний.' };
    }
};

const updateTimezone = async ({telegramId, timezone}) => {
    try {
        if (!moment.tz.zone(timezone)) {
            return {success: false, error: '❌ Некорректный часовой пояс.'};
        }

        const user = await User.findOneAndUpdate(
            {telegramId},
            {$set: {timezone}},
            {new: true}
        );

        if (!user) {
            return {success: false, error: '⚠️ Пользователь не найден.'};
        }

        return {success: true, message: `✅ Часовой пояс обновлён: ${timezone}`};
    } catch (error) {
        console.error('❌ Ошибка при обновлении часового пояса:', error);
        return {success: false, error: '❌ Ошибка обновления часового пояса.'};
    }
};

const setStatusNotify = async ({ telegramId, key, notify, notifyNow }) => {
    try {
        // Find the user by Telegram ID
        const user = await User.findOne({ telegramId });

        if (!user) {
            console.log(`❌ User not found: ${telegramId}`);
            return { success: false, error: "User not found" };
        }

        // Check if the reminder with the given key exists
        if (!user.reminders.has(key)) {
            console.log(`❌ Reminder not found for key: ${key}`);
            return { success: false, error: "Reminder not found" };
        }

        // Get the existing reminder
        let reminder = user.reminders.get(key);

        console.log(`🔍 Before update:`, reminder);

        // Update the status fields
        reminder.isSendNotify = notify !== undefined ? notify : reminder.isSendNotify;
        reminder.isSendNotifyNow = notifyNow !== undefined ? notifyNow : reminder.isSendNotifyNow;

        user.reminders.set(key, reminder);
        user.markModified("reminders"); // Important for MongoDB to recognize changes

        // Save the updated user document
        await user.save();

        console.log(`✅ Reminder status updated for user: ${telegramId}, key: ${key}`);

        // If both flags are true, delete the reminder
        if (reminder.isSendNotify && reminder.isSendNotifyNow) {
            await deleteReminderById({ telegramId, reminderId: key });
            console.log(`🗑 Reminder deleted automatically after status update: ${key}`);
        }

        return { success: true };
    } catch (error) {
        console.error("❌ Error updating reminder status:", error);
        return { success: false, error: "Database error" };
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