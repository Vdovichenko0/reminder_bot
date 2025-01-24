const { Markup, Scenes } = require('telegraf');
const { registerUser } = require('../user/service/userService');
const RegisterUserDto = require('../user/dto/registerUserDto');
const moment = require('moment-timezone');

const registrationWizard = new Scenes.WizardScene(
    'registration-wizard',
    (ctx) => {
        ctx.reply('Выберите язык:', Markup.inlineKeyboard([
            Markup.button.callback('English', 'lang_EN'),
            Markup.button.callback('Русский', 'lang_RU'),
        ]));
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('lang_')) {
            const lang = ctx.callbackQuery.data.split('_')[1];
            ctx.wizard.state.language = lang;
            ctx.reply('Когда напоминать?', Markup.inlineKeyboard([
                Markup.button.callback('5 минут', 'remind_5M'),
                Markup.button.callback('1 час', 'remind_1H'),
                Markup.button.callback('1 день', 'remind_1D'),
            ]));
            return ctx.wizard.next();
        } else {
            ctx.reply('Пожалуйста, выберите язык, используя кнопки.');
            return;
        }
    },
    (ctx) => {
        if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('remind_')) {
            const reminder = ctx.callbackQuery.data.split('_')[1];
            ctx.wizard.state.reminderBefore = reminder;

            // Спрашиваем пользователя его геопозицию
            ctx.reply(
                '🌍 Выберите свой город или отправьте геолокацию:',
                Markup.keyboard([
                    ['🇺🇸 New York', '🇬🇧 London', '🇮🇱 Jerusalem'],
                    [Markup.button.locationRequest('📍 Отправить геолокацию')]
                ]).resize().oneTime()
            );

            return ctx.wizard.next();
        } else {
            ctx.reply('Пожалуйста, выберите время напоминания, используя кнопки.');
            return;
        }
    },
    async (ctx) => {
        let timezone = 'UTC';

        if (ctx.message && ctx.message.location) {
            const { latitude, longitude } = ctx.message.location;

            timezone = moment.tz.guess({ lat: latitude, lon: longitude });

            ctx.reply(`🌍 Ваш часовой пояс: ${timezone}`);
        } else if (ctx.message && ctx.message.text) {
            const cityMapping = {
                '🇺🇸 New York': 'America/New_York',
                '🇬🇧 London': 'Europe/London',
                '🇮🇱 Jerusalem': 'Asia/Jerusalem'
            };

            if (cityMapping[ctx.message.text]) {
                timezone = cityMapping[ctx.message.text];
                ctx.reply(`🌍 Ваш часовой пояс: ${timezone}`);
            } else {
                ctx.reply('⚠️ Не могу определить ваш город. Попробуйте выбрать из списка.');
                return;
            }
        } else {
            ctx.reply('⚠️ Пожалуйста, выберите город или отправьте геолокацию.');
            return;
        }

        const dto = new RegisterUserDto({
            telegramId: ctx.from.id.toString(),
            language: ctx.wizard.state.language,
            reminderBefore: ctx.wizard.state.reminderBefore,
            timezone
        });

        try {
            await registerUser(dto);
            ctx.reply(`✅ Вы успешно зарегистрированы!`);
        } catch (error) {
            ctx.reply(`❌ Ошибка при регистрации: ${error.message}`);
        }
        return ctx.scene.leave();
    }
);

module.exports = registrationWizard;
