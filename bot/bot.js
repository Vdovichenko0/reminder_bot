const { Telegraf, Markup, Scenes, session } = require('telegraf');
const registrationWizard = require('./registrationWizard');
const addReminderScene = require('./addReminderScene');
const { getAllReminders, deleteReminder, sendScheduledMessages} = require('../user/service/userService');
const User = require('../user/model/User');

const TG_TOKEN = process.env.TG_TOKEN;
const ADMIN_ID = process.env.ADMIN_TG;
const ADMIN_COMMAND = process.env.ADMIN_MESSAGE;

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
        return ctx.reply(result.error, { reply_markup: mainMenuKeyboard });
    }

    if (result.reminders.length === 0) {
        return ctx.reply('🔍 У вас пока нет напоминаний.', { reply_markup: mainMenuKeyboard });
    }

    const buttons = result.reminders.map((reminder) =>
        [Markup.button.callback(`❌ ${reminder.date} - ${reminder.message}`, `delete_${reminder.key}`)]
    );

    buttons.push([Markup.button.callback('🚪 Выход', 'exit_delete_menu')]);

    return ctx.reply(
        '🗑 *Выберите напоминание для удаления:*',
        Markup.inlineKeyboard(buttons).resize(), { parse_mode: 'Markdown' }
    );
});

botTest.action(/^delete_(.*)$/, async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const keyToDelete = ctx.match[1]; //('2025-01-24T06:05:00_000Z')

    const result = await deleteReminder({ telegramId, key: keyToDelete });

    if (!result.success) {
        return ctx.reply(result.error, { reply_markup: mainMenuKeyboard });
    }

    const updatedResult = await getAllReminders({ telegramId });

    if (!updatedResult.success) {
        return ctx.reply('✅ Напоминание удалено! 🔄 У вас больше нет напоминаний.', { reply_markup: mainMenuKeyboard });
    }

    const buttons = updatedResult.reminders.map((reminder) => {
        return [Markup.button.callback(`❌ ${reminder.date} - ${reminder.message}`, `delete_${reminder.key}`)];
    });

    buttons.push([Markup.button.callback('🚪 Выход', 'exit_delete_menu')]);

    return ctx.reply(
        '✅ Напоминание удалено! 🔄 Обновленный список:',
        Markup.inlineKeyboard(buttons)
    );
});

botTest.hears('📋 Все напоминания', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const result = await getAllReminders({ telegramId });

    if (!result.success) {
        return ctx.reply(result.error, { reply_markup: mainMenuKeyboard });
    }

    const buttons = result.reminders.map((reminder) => {
        const formattedDate = reminder.date; // '24.01.2025 08:05'
        const message = reminder.message;
        const key = reminder.key; // '2025-01-24T06:05:00_000Z'

        return [Markup.button.callback(`📅 ${formattedDate} - ${message}`, `reminder_${key}`)];
    });

    ctx.reply(
        '📋 Ваши напоминания:',
        Markup.inlineKeyboard(buttons)
    );
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

setInterval(() => {
    sendScheduledMessages(botTest);
}, 60000);

//exit
botTest.action('exit_delete_menu', async (ctx) => {
    ctx.reply("🚀",mainMenuKeyboard);
});

//message from admin
botTest.command(ADMIN_COMMAND, async (ctx) => {
    const senderId = ctx.from.id.toString();

    if (senderId !== ADMIN_ID) {
        return ctx.reply('403.');
    }

    const args = ctx.message.text.split(' ').slice(1);

    if (args.length < 2) {
        return ctx.reply(`⚠️${ADMIN_COMMAND} <UserID> <Message>`);
    }

    const userId = args[0].trim();
    const messageText = args.slice(1).join(' ');

    try {
        await botTest.telegram.sendMessage(userId, `${messageText}`, { parse_mode: 'Markdown' });

        ctx.reply(`✅Send success: ${userId}:\n\n"${messageText}"`);
    } catch (error) {
        console.error('❌ Error:', error);
        ctx.reply('❌ Check id user.');
    }
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

// botTest.hears('📋 Все напоминания', async (ctx) => {
//     const telegramId = ctx.from.id.toString();
//     const result = await getAllReminders({ telegramId });
//
//     if (!result.success) {
//         return ctx.reply(result.error, { reply_markup: mainMenuKeyboard });
//     }
//
//     // console.log(result.reminders);
//
//     const reminderMessages = result.reminders.map((reminder) => {
//         const date = new Date(reminder.date);
//
//         const formattedDate = `${date.getUTCDate().toString().padStart(2, '0')}.` +
//             `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}.` +
//             `${date.getUTCFullYear()} ` +
//             `${date.getUTCHours().toString().padStart(2, '0')}:` +
//             `${date.getUTCMinutes().toString().padStart(2, '0')}`;
//
//         return `📅 ${formattedDate} - ${reminder.message}`;
//     });
//
//     ctx.reply(`📋 *Ваши напоминания:*\n\n${reminderMessages.join('\n')}`, { parse_mode: 'Markdown' });
//
//     // ctx.reply('📌 Главное меню', mainMenuKeyboard);
// });