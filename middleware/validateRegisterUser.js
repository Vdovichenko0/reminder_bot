const validateRegisterUser = (data) => {
    const errors = {};

    if (!data.telegramId || typeof data.telegramId !== 'string') {
        errors.telegramId = 'Telegram ID is required and must be a string.';
    }

    const validLanguages = ['EN', 'RU'];
    if (data.language && !validLanguages.includes(data.language)) {
        errors.language = `Language must be one of: ${validLanguages.join(', ')}`;
    }

    const validReminderBefore = ['5M', '1H', '1D'];
    if (data.reminderBefore && !validReminderBefore.includes(data.reminderBefore)) {
        errors.reminderBefore = `ReminderBefore must be one of: ${validReminderBefore.join(', ')}`;
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
};

module.exports = validateRegisterUser;
