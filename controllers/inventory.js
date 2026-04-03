const InventoryModel = require('../schemas/inventory');

module.exports = {
    // Tự động tạo kho khi có sản phẩm mới
    InitInventory: async (productId) => {
        let newInv = new InventoryModel({ product: productId });
        return await newInv.save();
    },

    GetAll: async () => {
        return await InventoryModel.find().populate('product');
    },

    GetById: async (id) => {
        return await InventoryModel.findById(id).populate('product');
    },

    AddStock: async (productId, quantity) => {
        // $inc giúp cộng dồn quantity vào stock hiện tại
        let updated = await InventoryModel.findOneAndUpdate(
            { product: productId },
            { $inc: { stock: quantity } },
            { new: true }
        ).populate('product');
        return updated;
    },

    RemoveStock: async (productId, quantity) => {
        let inv = await InventoryModel.findOne({ product: productId });
        if (!inv) throw new Error("Không tìm thấy kho cho sản phẩm này");
        if (inv.stock < quantity) throw new Error("Lỗi: Số lượng tồn kho không đủ để xuất!");
        
        inv.stock -= quantity;
        return await inv.save(); // Model sẽ tự populate nếu cần, ở đây ta trả về raw
    },

    Reservation: async (productId, quantity) => {
        let inv = await InventoryModel.findOne({ product: productId });
        if (!inv) throw new Error("Không tìm thấy kho cho sản phẩm này");
        if (inv.stock < quantity) throw new Error("Lỗi: Không đủ hàng trong kho để đặt trước!");

        inv.stock -= quantity;
        inv.reserved += quantity;
        return await inv.save();
    },

    Sold: async (productId, quantity) => {
        let inv = await InventoryModel.findOne({ product: productId });
        if (!inv) throw new Error("Không tìm thấy kho cho sản phẩm này");
        if (inv.reserved < quantity) throw new Error("Lỗi: Số lượng hàng đặt trước không đủ để bán!");

        inv.reserved -= quantity;
        inv.soldCount += quantity;
        return await inv.save();
    }
};