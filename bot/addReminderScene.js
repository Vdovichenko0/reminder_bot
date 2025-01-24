const { Markup, Scenes } = require('telegraf');
const { addReminder, validateReminderDate } = require('../user/service/userService');

const mainMenuKeyboard = Markup.keyboard([
    ['➕ Добавить напоминание'],
    ['❌ Удалить напоминание'],
    ['📋 Все напоминания']
]).resize();

// add reminder
const addReminderScene = new Scenes.WizardScene(
    'add-reminder',
    (ctx) => {
        ctx.session.waitingForReminder = true;
        ctx.reply(
            'Введите напоминание в формате:\n\n' +
            '📅 *ДД.ММ.ГГГГ ЧЧ:ММ - Текст напоминания*\n\n' +
            'Пример:\n' +
            '✅ *25.02.2025 14:30 - Позвонить врачу*',
            Markup.forceReply()
        );
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (!ctx.session.waitingForReminder) return ctx.scene.leave();

        const input = ctx.message.text.trim();
        const reminderRegex = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}) - (.+)$/;
        const match = input.match(reminderRegex);

        if (!match) {
            return ctx.reply(
                '❌ *Неверный формат! Попробуйте снова:*\n\n' +
                '📌 ДД.ММ.ГГГГ ЧЧ:ММ - Текст напоминания\n\n' +
                'Пример:\n' +
                '✅ 25.02.2025 14:30 - Позвонить врачу',
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'cancel_add_reminder' }]]
                    }
                }
            );
        }

        const [, day, month, year, hour, minute, text] = match;
        const date = `${day}.${month}.${year} ${hour}:${minute}`;

        const telegramId = ctx.from.id.toString();
        const validation = await validateReminderDate({ telegramId, date });

        if (!validation.success) {
            return ctx.reply(validation.error, ctx.scene.enter('add-reminder'));
        }

        ctx.session.newReminder = { date, text: text.trim() };
        ctx.session.waitingForReminder = false;

        console.log(`💾 saved in session: ${JSON.stringify(ctx.session.newReminder)}`);

        ctx.reply(
            `📅 Дата: *${day}.${month}.${year} ${hour}:${minute}*\n📝 Текст: *${text.trim()}*\n\n` +
            '✅ *Подтвердите добавление:*',
            Markup.inlineKeyboard([
                Markup.button.callback('✅ Добавить', 'confirm_add_reminder'),
                Markup.button.callback('❌ Отмена', 'cancel_add_reminder')
            ])
        );

        return ctx.wizard.next();
    }
);


// check add
addReminderScene.action('confirm_add_reminder', async (ctx) => {
    if (!ctx.session.newReminder) {
        return ctx.reply('❌ Ошибка: Нет данных для сохранения.', mainMenuKeyboard);
    }

    const { date, text } = ctx.session.newReminder;
    const telegramId = ctx.from.id.toString();

    console.log(`📤 save: ${telegramId} - ${date} - ${text}`);

    const result = await addReminder({ telegramId, date, text });

    ctx.session.newReminder = null;

    if (result.success) {
        ctx.reply('✅ Напоминание добавлено!', mainMenuKeyboard);
    } else {
        ctx.reply(result.error, mainMenuKeyboard);
    }

    return ctx.scene.leave();
});

// Cancel
addReminderScene.action('cancel_add_reminder', (ctx) => {
    ctx.session.newReminder = null;
    ctx.session.waitingForReminder = false;
    ctx.reply('❌ Добавление отменено.', mainMenuKeyboard);
    return ctx.scene.leave();
});

module.exports = addReminderScene;
