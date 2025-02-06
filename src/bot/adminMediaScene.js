const { Scenes, Markup } = require('telegraf');

const adminSessions = new Map();
const ADMIN_COMMAND_MEDIA = process.env.ADMIN_COMMAND_MEDIA;

const mainMenuKeyboard = Markup.keyboard([
    ['➕ Добавить напоминание'],
    ['❌ Удалить напоминание'],
    ['📋 Все напоминания']
]).resize();

const cancelKeyboard = Markup.keyboard([
    ['New ID'],
    ['❌ Cancel'],
]).resize();

const adminMediaScene = new Scenes.WizardScene(
    'admin-media',
    async (ctx) => {
        const senderId = ctx.from.id.toString();

        if (senderId !== process.env.ADMIN_TG) {
            return ctx.reply('403');
        }

        const args = ctx.message.text.split(' ').slice(1);
        if (args.length < 1) {
            return ctx.reply(`⚠️ Использование: /${ADMIN_COMMAND_MEDIA} <UserID>`);
        }

        const userId = args[0].trim();
        adminSessions.set(senderId, { userId, timestamp: Date.now(), awaitingNewId: false });

        ctx.reply(
            `📷 Отправьте фото или видео, которое нужно переслать пользователю ${userId}.\n\n⏳ У вас есть 3 минуты.`,
            cancelKeyboard
        );

        setTimeout(() => {
            if (adminSessions.has(senderId)) {
                adminSessions.delete(senderId);
                ctx.reply('⏳ Время ожидания истекло. Повторите команду заново.', mainMenuKeyboard);
                ctx.scene.leave();
            }
        }, 180000);

        return ctx.wizard.next();
    },
    async (ctx) => {
        const senderId = ctx.from.id.toString();

        // Если нажата кнопка "❌ Cancel"
        if (ctx.message.text === '❌ Cancel') {
            ctx.reply('🚀 Главное меню', mainMenuKeyboard);
            return ctx.scene.leave();
        }

        if (ctx.message.text === 'New ID') {
            adminSessions.set(senderId, { awaitingNewId: true });
            return ctx.reply('✏️ Введите новый ID пользователя:', Markup.removeKeyboard());
        }

        if (adminSessions.get(senderId)?.awaitingNewId) {
            const newUserId = ctx.message.text.trim();
            if (!/^\d+$/.test(newUserId)) {
                return ctx.reply('❌ Ошибка: ID должен содержать только цифры. Попробуйте снова.');
            }
            adminSessions.set(senderId, { userId: newUserId, timestamp: Date.now(), awaitingNewId: false });
            return ctx.reply(`✅ Новый ID установлен: ${newUserId}\nТеперь отправьте фото или видео.`, cancelKeyboard);
        }

        if (!adminSessions.has(senderId)) {
            return ctx.scene.leave();
        }

        const { userId } = adminSessions.get(senderId);
        adminSessions.delete(senderId);

        try {
            if (ctx.message.photo) {
                const photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
                await ctx.telegram.sendPhoto(userId, photoFileId);
                ctx.reply(`✅ Фото успешно отправлено пользователю ${userId}.`);
            } else if (ctx.message.video) {
                const videoFileId = ctx.message.video.file_id;
                await ctx.telegram.sendVideo(userId, videoFileId);
                ctx.reply(`✅ Видео успешно отправлено пользователю ${userId}.`);
            } else {
                ctx.reply('❌ Ошибка: поддерживаются только фото и видео.', cancelKeyboard);
            }
        } catch (error) {
            console.error('❌ Ошибка отправки медиа:', error);
            ctx.reply('❌ Ошибка отправки. Проверьте ID пользователя.');
        }

        return ctx.scene.leave();
    }
);

module.exports = adminMediaScene;
