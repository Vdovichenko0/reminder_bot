const { Telegraf, Markup, Scenes, session } = require('telegraf');
const registrationWizard = require('./registrationWizard');
const addReminderScene = require('./addReminderScene');
const { getAllReminders, deleteReminder } = require('../user/service/userService');
const User = require('../user/model/User');

const TG_TOKEN = process.env.TG_TOKEN;
if (!TG_TOKEN) {
    console.error('❌ TG_TOKEN is not set in environment');
    process.exit(1);
}

// initialization
const botTest = new Telegraf(TG_TOKEN);
botTest.use(session());

// 🎛
const stage = new Scenes.Stage([registrationWizard, addReminderScene]);
botTest.use(stage.middleware());

// 📌
const mainMenuKeyboard = Markup.keyboard([
    ['➕ Добавить напоминание'],
    ['❌ Удалить напоминание'],
    ['📋 Все напоминания']
]).resize();

botTest.hears('➕ Добавить напоминание', (ctx) => {
    ctx.scene.enter('add-reminder');
});

botTest.hears('❌ Удалить напоминание', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const result = await getAllReminders({ telegramId });

    if (!result.success) {
        return ctx.reply(result.error, mainMenuKeyboard);
    }

    const buttons = result.reminders.map((reminder) => {
        const date = new Date(reminder.date);
        const formattedDate = `${date.getUTCDate().toString().padStart(2, '0')}.` +
            `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}.` +
            `${date.getUTCFullYear()} ` +
            `${date.getUTCHours().toString().padStart(2, '0')}:` +
            `${date.getUTCMinutes().toString().padStart(2, '0')}`;

        return [Markup.button.callback(`❌ ${formattedDate} - ${reminder.message}`, `delete_${reminder.date.toISOString()}`)];
    });


    buttons.push([Markup.button.callback('🚪 Выход', 'exit_delete_menu')]);

    ctx.reply(
        '🗑 *Выберите напоминание для удаления:*',
        Markup.inlineKeyboard(buttons)
    );
});

botTest.action(/^delete_(.*)$/, async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const dateToDelete = ctx.match[1]; // Дата напоминания в ISO-формате

    const result = await deleteReminder({ telegramId, dateToDelete });

    if (!result.success) {
        return ctx.reply(result.error, mainMenuKeyboard);
    }

    // 🔄 После удаления обновляем список
    const updatedResult = await getAllReminders({ telegramId });

    if (!updatedResult.success) {
        return ctx.reply('✅ Напоминание удалено! 🔄 У вас больше нет напоминаний.', mainMenuKeyboard);
    }

    const buttons = updatedResult.reminders.map((reminder) => {
        const date = new Date(reminder.date);
        const formattedDate = `${date.getUTCDate().toString().padStart(2, '0')}.` +
            `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}.` +
            `${date.getUTCFullYear()} ` +
            `${date.getUTCHours().toString().padStart(2, '0')}:` +
            `${date.getUTCMinutes().toString().padStart(2, '0')}`;

        return [Markup.button.callback(`❌ ${formattedDate} - ${reminder.message}`, `delete_${reminder.date.toISOString()}`)];
    });

    ctx.reply(
        '✅ Напоминание удалено! 🔄 Обновленный список:',
        Markup.inlineKeyboard(buttons), mainMenuKeyboard
    );
    ctx.reply(mainMenuKeyboard);
});

botTest.hears('📋 Все напоминания', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const result = await getAllReminders({ telegramId });

    if (!result.success) {
        return ctx.reply(result.error, { reply_markup: mainMenuKeyboard });
    }

    // console.log(result.reminders);

    const reminderMessages = result.reminders.map((reminder) => {
        const date = new Date(reminder.date);

        const formattedDate = `${date.getUTCDate().toString().padStart(2, '0')}.` +
            `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}.` +
            `${date.getUTCFullYear()} ` +
            `${date.getUTCHours().toString().padStart(2, '0')}:` +
            `${date.getUTCMinutes().toString().padStart(2, '0')}`;

        return `📅 ${formattedDate} - ${reminder.message}`;
    });

    ctx.reply(`📋 *Ваши напоминания:*\n\n${reminderMessages.join('\n')}`, { parse_mode: 'Markdown' });

    // ctx.reply('📌 Главное меню', mainMenuKeyboard);
});


// 🚀 /start
botTest.start(async (ctx) => {
    const telegramId = ctx.from.id.toString();

    try {
        const user = await User.findOne({ telegramId });

        if (user) {
            console.log(`✅ С возвращением, ${ctx.from.first_name}!`);
            return ctx.reply(
                `С возвращением, ${ctx.from.first_name}!`,
                mainMenuKeyboard
            );
        } else {
            return ctx.scene.enter('registration-wizard');
        }
    } catch (error) {
        console.error('❌ Ошибка при проверке пользователя:', error);
        return ctx.reply('⚠️ Произошла ошибка. Попробуйте снова позже.');
    }
});

// /hello
botTest.command('hello', async (ctx) => {
    await ctx.reply('Шалом');
});

// /keyboard
botTest.command('keyboard', async (ctx) => {
    ctx.reply("🚀",mainMenuKeyboard);
});

//exit
botTest.action('exit_delete_menu', async (ctx) => {
    ctx.reply("🚀",mainMenuKeyboard);
});

// 🏁
botTest.launch()
    .then(() => console.log('🚀 Telegram bot connected'))
    .catch((err) => console.error('❌ Error launching bot:', err));

// 📌
process.once('SIGINT', () => {
    botTest.stop('SIGINT');
    process.exit(0);
});

process.once('SIGTERM', () => {
    botTest.stop('SIGTERM');
    process.exit(0);
});

module.exports = botTest;

// botTest.action('exit_delete_menu', async (ctx) => {
//     const sentMessage = await ctx.reply('.', { reply_markup: mainMenuKeyboard });
//
//     // Удаляем сообщение после отправки
//     setTimeout(() => ctx.deleteMessage(sentMessage.message_id), 100);
// });