const { Markup, Scenes } = require('telegraf');
const moment = require('moment-timezone');
const { updateReminderBefore, updateTimezone } = require('../user/service/userService');

const mainMenuKeyboard = Markup.keyboard([
    ['➕ Добавить напоминание'],
    ['❌ Удалить напоминание'],
    ['📋 Все напоминания']
]).resize();

const settingMenuKeyboard = Markup.keyboard([
    ['⏳ Изменить время напоминаний'],
    ['🌍 Изменить регион'],
    ['🔙 Вернуться назад']
]).resize();

const settingsWizard = new Scenes.WizardScene(
    'settings',
    async (ctx) => {
        await ctx.reply('⚙️ Настройки', settingMenuKeyboard);
        return ctx.wizard.next();
    },
    async (ctx) => {
        const text = ctx.message.text;

        if (text === '⏳ Изменить время напоминаний') {
            await ctx.reply(
                'Когда напоминать?',
                Markup.inlineKeyboard([
                    [Markup.button.callback('5 минут', 'remind_5M')],
                    [Markup.button.callback('1 час', 'remind_1H')],
                    [Markup.button.callback('1 день', 'remind_1D')],
                    [Markup.button.callback('🔙 Вернуться назад', 'remind_back')]
                ])
            );
        } else if (text === '🌍 Изменить регион') {
            await ctx.reply(
                '📍 Отправьте свою геолокацию, чтобы установить часовой пояс:',
                Markup.keyboard([
                    [Markup.button.locationRequest('📍 Отправить геолокацию')],
                    ['🔙 Вернуться назад']
                ]).resize()
            );
            return ctx.wizard.selectStep(2); // Остаёмся в сцене, ждём геолокацию
        } else if (text === '🔙 Вернуться назад') {
            await ctx.reply('🚀 Главное меню', mainMenuKeyboard);
            return ctx.scene.leave();
        } else {
            await ctx.reply('❗ Пожалуйста, выберите действие из меню.', settingMenuKeyboard);
        }
    },
    async (ctx) => {
        if (ctx.message?.location) {
            const { latitude, longitude } = ctx.message.location;

            try {
                const timezone = moment.tz.guess({ lat: latitude, lon: longitude });

                if (!timezone) {
                    return await ctx.reply('❌ Не удалось определить часовой пояс. Попробуйте снова.');
                }

                const result = await updateTimezone({ telegramId: ctx.from.id.toString(), timezone });

                await ctx.reply(result.message || '✅ Часовой пояс обновлён!');
                await ctx.reply('⚙️ Настройки', settingMenuKeyboard);
                return ctx.wizard.selectStep(1); // Возвращаем пользователя в меню настроек
            } catch (error) {
                console.error('❌ Ошибка при обновлении часового пояса:', error);
                await ctx.reply('❌ Произошла ошибка. Попробуйте снова.', settingMenuKeyboard);
            }
        } else if (ctx.message.text === '🔙 Вернуться назад') {
            await ctx.reply('⚙️ Настройки', settingMenuKeyboard);
            return ctx.wizard.selectStep(1); // Возвращаемся в меню настроек
        } else {
            await ctx.reply('❌ Пожалуйста, отправьте вашу геолокацию.', settingMenuKeyboard);
        }
    }
);

settingsWizard.action(/^remind_(.*)$/, async (ctx) => {
    const reminderTime = ctx.match[1]; // 5M, 1H, 1D
    const telegramId = ctx.from.id.toString();

    if (reminderTime === 'back') {
        await ctx.reply('⚙️ Настройки', settingMenuKeyboard);
        return ctx.wizard.selectStep(1);
    }

    const result = await updateReminderBefore({ telegramId, time: reminderTime });

    await ctx.reply(result.message || '✅ Время напоминаний обновлено!');
    await ctx.reply('⚙️ Настройки', settingMenuKeyboard);
    return ctx.wizard.selectStep(1)
});

module.exports = settingsWizard;
