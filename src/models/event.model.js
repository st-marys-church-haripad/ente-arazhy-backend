const { Schema } = require('mongoose');
const mongoose = require('mongoose');

const event = new Schema({
    eventName: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    time: {
        type: String,
        required: true,
    }
});

module.exports = mongoose.model('Event', event);