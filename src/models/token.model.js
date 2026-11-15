const { Schema } = require('mongoose');
const mongoose = require('mongoose');

const tokenSchema = new Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true,
    },
    token: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['refresh', 'passwordReset'],
        default: 'refresh'
    },
    expiresAt: {
        type: Date,
        default: null
    },
    attempts: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 604800 // 7 days in seconds - auto-delete for refresh tokens
    }
});

// Index for faster queries
tokenSchema.index({ token: 1, type: 1 });
tokenSchema.index({ user: 1, type: 1 });
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Token', tokenSchema);