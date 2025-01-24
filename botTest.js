// const { Telegraf, Markup } = require('telegraf');
//
// // Получаем токен из environment
// const TG_TOKEN = process.env.TG_TOKEN;
//
// if (!TG_TOKEN) {
//     console.error('TG_TOKEN is not set in environment');
//     process.exit(1); // Завершаем процесс, если токен не найден
// }
//
// const botTest = new Telegraf(TG_TOKEN);
//
// // Обработка команды /hello
// botTest.command('hello', async (ctx) => {
//     await ctx.reply('Шалом');
// });
//
// botTest.command('hi', async (ctx) => {
//     const userId = ctx.from.id; // Получаем Telegram ID пользователя
//     await ctx.reply(`Шалом! Твой Telegram ID: ${userId}`);
// });
//
// // Кнопка "Узнать айди"
// botTest.command('myid', async (ctx) => {
//     await ctx.reply(
//         'Нажми кнопку ниже, чтобы узнать свой Telegram ID:',
//         Markup.inlineKeyboard([
//             Markup.button.callback('Узнать айди', 'get_user_id')
//         ])
//     );
// });
//
// botTest.command('start', async (ctx) => {
//     await ctx.reply(
//         'Привет! Теперь ты можешь узнать свой Telegram ID кнопкой ниже.',
//         {
//             reply_markup: {
//                 keyboard: [
//                     [{ text: 'Узнать айди 🆔' }]
//                 ],
//                 resize_keyboard: true, // Подгоняет клавиатуру под экран
//                 one_time_keyboard: false // Клавиатура остаётся на экране
//             }
//         }
//     );
// });
//
//
// botTest.hears('Узнать айди 🆔', async (ctx) => {
//     const userId = ctx.from.id;
//     await ctx.reply(`Твой Telegram ID: ${userId}`);
// });
//
//
// botTest.action('get_user_id', async (ctx) => {
//     const userId = ctx.from.id;
//     await ctx.answerCbQuery(); // Убирает "часики" у кнопки
//     await ctx.reply(`Твой Telegram ID: ${userId}`);
// });
//
// // Запускаем бота
// botTest.launch()
//     .then(() => console.log('Telegram bot connected'))
//     .catch((err) => console.error('Error launching bot:', err));
//
// // Обработка завершения работы
// process.once('SIGINT', () => botTest.stop('SIGINT'));
// process.once('SIGTERM', () => botTest.stop('SIGTERM'));
//
// module.exports = botTest;
