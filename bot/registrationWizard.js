const { Markup, Scenes } = require('telegraf');
const { registerUser } = require('../user/service/userService');
const RegisterUserDto = require('../user/dto/registerUserDto');

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
    async (ctx) => {
        if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('remind_')) {
            const reminder = ctx.callbackQuery.data.split('_')[1];
            ctx.wizard.state.reminderBefore = reminder;

            const dto = new RegisterUserDto({
                telegramId: ctx.from.id.toString(),
                language: ctx.wizard.state.language,
                reminderBefore: reminder,
            });

            try {
                await registerUser(dto);
                ctx.reply('Вы успешно зарегистрированы!');
            } catch (error) {
                ctx.reply(`Ошибка при регистрации: ${error.message}`);
            }
            return ctx.scene.leave();
        } else {
            ctx.reply('Пожалуйста, выберите время напоминания, используя кнопки.');
            return;
        }
    }
);

module.exports = registrationWizard;
