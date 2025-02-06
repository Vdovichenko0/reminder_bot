const deleteLastMessages = async (ctx, userId, count) => {
    try {
        const chatId = ctx.chat.id.toString();

        if (!ctx.session || !ctx.session[chatId] || !ctx.session[chatId][userId]) {
            return { success: false, error: '❌ Нет сохранённых сообщений для удаления.' };
        }

        const messages = ctx.session[chatId][userId].slice(-count); // Берём последние N сообщений

        for (const messageId of messages) {
            try {
                await ctx.deleteMessage(messageId);
            } catch (err) {
                console.warn(`⚠️ Не удалось удалить сообщение ${messageId}:`, err);
            }
        }

        ctx.session[chatId][userId].splice(-count); // Убираем удалённые

        console.log(`✅ Удалено ${messages.length} сообщений у ${userId}`);
        return { success: true, deleted: messages.length };
    } catch (error) {
        console.error('❌ Ошибка при удалении сообщений:', error);
        return { success: false, error: '❌ Ошибка удаления сообщений. Попробуйте снова.' };
    }
};

module.exports = { deleteLastMessages };
