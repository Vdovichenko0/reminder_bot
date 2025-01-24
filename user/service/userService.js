const User = require('../model/User');
const RegisterUserDto = require('../dto/registerUserDto');

const registerUser = async (userRegisterDto) => {
    const { isValid, errors } = userRegisterDto.validate();

    if (!isValid) {
        const errorMessages = Object.values(errors).join(' ');
        throw new Error(`Validation failed: ${errorMessages}`);
    }

    const { telegramId, language, reminderBefore } = userRegisterDto;
    const existingUser = await User.findOne({ telegramId });
    if (existingUser) {
        throw new Error('User already exists with this telegramId: ' + telegramId);
    }

    const newUser = new User({
        telegramId,
        language,
        reminderBefore,
        // all other data set auto like dateRegister
    });

    await newUser.save();

    return newUser;
};

module.exports = {
    registerUser,
};