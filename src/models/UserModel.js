import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minLength: 6,
        maxLength: 254,
    },

    password: {
        type: String,
        required: true,
        trim: true,
        minLength: 6,
        maxLength: 254,
    },
    username: {
        type: String,
        default: '',
        required: true,
        trim: true,
        minLength: 3,
        maxLength: 20,
    },
    isAdmin: {
        type: Boolean,
        default: false,
        required: true,
    },
    resetPasswordTokenHash: {
        type: String,
        default: null,
        select: false,
    },
    resetPasswordExpiresAt: {
        type: Date,
        default: null,
        select: false,
    },
})

export default mongoose.model('User', UserSchema)
