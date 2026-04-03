const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product", // Lưu ý: Tên ref này phải khớp chuẩn với tên model Product của bạn
        required: true,
        unique: true
    },
    stock: {
        type: Number,
        min: [0, "Stock không được âm"],
        default: 0
    },
    reserved: {
        type: Number,
        min: [0, "Reserved không được âm"],
        default: 0
    },
    soldCount: {
        type: Number,
        min: [0, "SoldCount không được âm"],
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("inventory", inventorySchema);