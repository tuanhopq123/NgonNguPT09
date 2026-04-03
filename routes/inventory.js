var express = require("express");
var router = express.Router();
let inventoryController = require("../controllers/inventory");

// Get All
router.get("/", async function (req, res, next) {
    try {
        let result = await inventoryController.GetAll();
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// Get By ID
router.get("/:id", async function (req, res, next) {
    try {
        let result = await inventoryController.GetById(req.params.id);
        if (!result) return res.status(404).send({ message: "Không tìm thấy" });
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// Add Stock
router.post("/add_stock", async function (req, res, next) {
    try {
        let { product, quantity } = req.body;
        let result = await inventoryController.AddStock(product, Number(quantity));
        res.send({ message: "Thêm kho thành công", data: result });
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

// Remove Stock
router.post("/remove_stock", async function (req, res, next) {
    try {
        let { product, quantity } = req.body;
        let result = await inventoryController.RemoveStock(product, Number(quantity));
        res.send({ message: "Giảm kho thành công", data: result });
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

// Reservation
router.post("/reservation", async function (req, res, next) {
    try {
        let { product, quantity } = req.body;
        let result = await inventoryController.Reservation(product, Number(quantity));
        res.send({ message: "Đặt hàng thành công", data: result });
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

// Sold
router.post("/sold", async function (req, res, next) {
    try {
        let { product, quantity } = req.body;
        let result = await inventoryController.Sold(product, Number(quantity));
        res.send({ message: "Bán hàng thành công", data: result });
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;