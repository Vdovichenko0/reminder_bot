const { Language, ReminderBefore } = require('../../middleware/constants');

class RegisterUserDto {
    constructor({ telegramId, language = Language.RU, reminderBefore = ReminderBefore.ONE_HOUR }) {
        this.telegramId = telegramId;
        this.language = language;
        this.reminderBefore = reminderBefore;
    }

    validate() {
        const errors = {};

        // Валидация telegramId
        if (!this.telegramId || typeof this.telegramId !== 'string') {
            errors.telegramId = 'Telegram ID is required and must be a string.';
        }

        const validLanguages = Object.values(Language);
        if (this.language && !validLanguages.includes(this.language)) {
            errors.language = `Language must be one of: ${validLanguages.join(', ')}`;
        }

        const validReminderBefore = Object.values(ReminderBefore);
        if (this.reminderBefore && !validReminderBefore.includes(this.reminderBefore)) {
            errors.reminderBefore = `ReminderBefore must be one of: ${validReminderBefore.join(', ')}`;
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
        };
    }
}

module.exports = RegisterUserDto;
