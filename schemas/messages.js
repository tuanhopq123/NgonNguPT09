const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    messageContent: {
        type: { type: String, enum: ['file', 'text'], required: true },
        text: { type: String, required: true } // Lưu nội dung chat hoặc đường dẫn file
    }
}, { timestamps: true }); // BẮT BUỘC có timestamps để biết tin nhắn nào là mới nhất

module.exports = mongoose.model('message', messageSchema);