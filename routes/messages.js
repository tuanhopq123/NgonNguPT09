var express = require("express");
var router = express.Router();
let messageModel = require('../schemas/messages');
let { checkLogin } = require('../utils/authHandler');
const mongoose = require('mongoose');

// Cấu hình Multer để upload file
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, 'uploads/') },
    filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname) }
});
const upload = multer({ storage: storage });

// ============================================================
// 1. GET / - Lấy message cuối cùng của mỗi cuộc hội thoại
// (LƯU Ý: API '/' phải đặt trên API '/:userID' để Express không bị nhầm đường dẫn)
// ============================================================
router.get('/', checkLogin, async function (req, res, next) {
    try {
        let currentUserId = new mongoose.Types.ObjectId(req.user.id);

        let lastMessages = await messageModel.aggregate([
            {
                // Bước 1: Lấy tất cả tin nhắn mình gửi hoặc nhận
                $match: { $or: [{ from: currentUserId }, { to: currentUserId }] }
            },
            {
                // Bước 2: Sắp xếp theo thời gian giảm dần (mới nhất lên đầu)
                $sort: { createdAt: -1 }
            },
            {
                // Bước 3: Nhóm theo "Người chat cùng"
                $group: {
                    _id: {
                        // Nếu 'from' là mình, thì người chat cùng là 'to'. Và ngược lại.
                        $cond: [{ $eq: ["$from", currentUserId] }, "$to", "$from"]
                    },
                    lastMessage: { $first: "$$ROOT" } // Lấy tin nhắn đầu tiên của mỗi nhóm (tin mới nhất)
                }
            },
            {
                // Bước 4: Đẩy cục dữ liệu ra ngoài cho đẹp
                $replaceRoot: { newRoot: "$lastMessage" }
            },
            {
                $sort: { createdAt: -1 } // Sắp xếp lại danh sách hội thoại theo thời gian
            }
        ]);

        // (Tùy chọn) Join với bảng user để lấy tên hiển thị cho đẹp
        await messageModel.populate(lastMessages, { path: 'from to', select: 'username' });

        res.send(lastMessages);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// ============================================================
// 2. POST / - Gửi tin nhắn (Hỗ trợ cả Text và File)
// ============================================================
router.post('/', checkLogin, upload.single('file'), async function (req, res, next) {
    try {
        let { to, text } = req.body;
        if (!to) return res.status(400).send({ message: "Thiếu ID người nhận (to)" });

        let msgType = 'text';
        let msgText = text;

        // Nếu người dùng có upload file
        if (req.file) {
            msgType = 'file';
            msgText = req.file.path; // Lưu đường dẫn file
        } else if (!msgText) {
            return res.status(400).send({ message: "Nội dung tin nhắn không được để trống" });
        }

        let newMessage = new messageModel({
            from: req.user.id, // Lấy ID từ token người đang đăng nhập
            to: to,
            messageContent: {
                type: msgType,
                text: msgText
            }
        });

        await newMessage.save();
        res.send(newMessage);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// ============================================================
// 3. GET /:userID - Lấy lịch sử chat giữa mình và 1 user khác
// ============================================================
router.get('/:userID', checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user.id;
        let targetUserId = req.params.userID;

        let messages = await messageModel.find({
            $or: [
                { from: currentUserId, to: targetUserId },
                { from: targetUserId, to: currentUserId }
            ]
        }).sort({ createdAt: 1 }) // Sắp xếp tăng dần (tin cũ ở trên, mới ở dưới như Messenger)
          .populate('from to', 'username'); 

        res.send(messages);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;