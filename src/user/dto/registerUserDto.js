const { Language, ReminderBefore } = require('../../middleware/constants');
const moment = require('moment-timezone');
class RegisterUserDto {
    constructor({ telegramId, firstName, lastName, username, phoneNumber, language = Language.RU, reminderBefore = ReminderBefore.ONE_HOUR, timezone, isBot, languageCode }) {
        this.telegramId = telegramId;
        this.firstName = firstName;
        this.lastName = lastName;
        this.username = username;
        this.phoneNumber = phoneNumber;
        this.language = language;
        this.reminderBefore = reminderBefore;
        this.timezone = timezone;
        this.isBot = isBot;
        this.languageCode = languageCode;
    }


    validate() {
        const errors = {};

        if (!this.telegramId || typeof this.telegramId !== 'string') {
            errors.telegramId = 'Telegram ID is required and must be a string.';
        }

        if (this.firstName && typeof this.firstName !== 'string') {
            errors.firstName = 'First name must be a string.';
        }

        if (this.lastName && typeof this.lastName !== 'string') {
            errors.lastName = 'Last name must be a string.';
        }

        if (this.username && typeof this.username !== 'string') {
            errors.username = 'Username must be a string.';
        }

        if (this.phoneNumber && typeof this.phoneNumber !== 'string') {
            errors.phoneNumber = 'Phone number must be a string.';
        }

        const validLanguages = Object.values(Language);
        if (this.language && !validLanguages.includes(this.language)) {
            errors.language = `Language must be one of: ${validLanguages.join(', ')}`;
        }

        const validReminderBefore = Object.values(ReminderBefore);
        if (this.reminderBefore && !validReminderBefore.includes(this.reminderBefore)) {
            errors.reminderBefore = `ReminderBefore must be one of: ${validReminderBefore.join(', ')}`;
        }

        if (!this.timezone || typeof this.timezone !== 'string' || !moment.tz.zone(this.timezone)) {
            errors.timezone = '❌ Timezone is invalid or missing. Please provide a valid timezone.';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
        };
    }
}

module.exports = RegisterUserDto;
