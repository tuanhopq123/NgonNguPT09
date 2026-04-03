var express = require("express");
var router = express.Router();

let { checkLogin } = require('../utils/authHandler');
// Lấy toàn bộ validator cần thiết
let { 
    userCreateValidator, 
    userUpdateValidator, 
    RegisterValidator, 
    ChangePasswordValidator, 
    handleResultValidator 
} = require('../utils/validatorHandler');

let userController = require("../controllers/users");
let bcrypt = require('bcrypt');
let jwt = require('jsonwebtoken');
let userModel = require('../schemas/users'); // Thay đổi đường dẫn model nếu cần cho khớp file của bạn
let roleModel = require('../schemas/roles');

const fs = require('fs');
const path = require('path');
// Đọc khóa Private Key cho thuật toán RS256
const privateKey = fs.readFileSync(path.join(__dirname, '../private.pem'), 'utf8');
const multer = require('multer');
// Hàm tạo độ trễ
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const upload = multer({ dest: 'uploads/' }); // Nơi lưu file tạm
const xlsx = require('xlsx');
const nodemailer = require('nodemailer');

function generateStrongPassword() {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";
    const all = upper + lower + numbers + symbols;

    let password = "";
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = 4; i < 16; i++) {
        password += all[Math.floor(Math.random() * all.length)];
    }
    // Đảo lộn các ký tự để bảo mật hơn
    return password.split('').sort(() => 0.5 - Math.random()).join('');
}
// ==========================================
// PHẦN 1: CÁC API XÁC THỰC (AUTH)
// Các đường dẫn cụ thể (/register, /login, /me) PHẢI nằm trên cùng
// ==========================================

router.post('/import', upload.single('file'), async function (req, res, next) {
    if (!req.file) {
        return res.status(400).send({ message: "Vui lòng đính kèm file CSV!" });
    }

    let results = [];
    
    try {
        // Đọc file Excel (hỗ trợ .xlsx, .xls, .csv, ...)
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const rawData = xlsx.utils.sheet_to_json(sheet, { defval: "" });
        
        // Chỉnh sửa tên cột để loại bỏ các ký tự ẩn (như BOM)
        results = rawData.map(row => {
            let normalizedRow = {};
            for (let key in row) {
                let cleanKey = key.trim().replace(/^[\u200B\u200C\u200D\u200E\u200F\uFEFF]/, '');
                normalizedRow[cleanKey] = row[key];
            }
            return normalizedRow;
        });


                let userRole = await roleModel.findOne({ name: 'user' }); 
                if (!userRole) return res.status(400).send({ message: "Không tìm thấy role 'user'" });

                let transporter = nodemailer.createTransport({
                    host: "sandbox.smtp.mailtrap.io",
                    port: 2525,
                    auth: {
                        user: "e055a67fb5d599", // Đừng quên điền lại 2 ô này nhé
                        pass: "1190c1771aceee"
                    }
                });

                let importedCount = 0;
                let usersToEmail = []; // Chứa danh sách cần gửi email
                
                // IN RA TERMINAL ĐỂ XEM NODE.JS ĐỌC ĐƯỢC GÌ
                console.log("=== BẮT ĐẦU IMPORT ===");
                console.log(`Đã đọc được ${results.length} dòng từ file upload.`);
                if (results.length > 0) console.log("Dữ liệu dòng đầu tiên:", results[0]);

                for (let row of results) {
                    // Dọn dẹp khoảng trắng thừa trong dữ liệu
                    let uName = row.username ? row.username.trim() : null;
                    let uEmail = row.email ? row.email.trim() : null;

                    if (!uName || !uEmail) {
                        console.log("❌ Bỏ qua dòng vì bị thiếu dữ liệu:", row);
                        continue;
                    }

                    // Vẫn giữ kiểm tra từng dòng, tuy không phải nhanh nhất nhưng đảm bảo đúng hash password
                    let isExist = await userModel.findOne({ 
                        $or: [{ username: uName }, { email: uEmail }] 
                    });
                    
                    if (isExist) {
                        console.log(`⚠️ Bỏ qua [${uName}] vì đã tồn tại trên Database Cloud.`);
                    } else {
                        let plainPassword = generateStrongPassword();
                        let newUser = new userModel({
                            username: uName,
                            email: uEmail,
                            password: plainPassword, 
                            role: userRole._id
                        });
                        
                        await newUser.save(); 
                        importedCount++;

                        // THAY VÌ GỬI EMAIL NGAY, TA LƯU LẠI VÀO MẢNG
                        usersToEmail.push({ uEmail, uName, plainPassword });
                    }
                }

                fs.unlinkSync(req.file.path);
                
                // 1) PHẢN HỒI NGAY LẬP TỨC CHO NGƯỜI DÙNG KHI LƯU DB XONG!
                console.log(`=== KẾT THÚC: Đã lưu thành công ${importedCount} users vào DB ===\n`);
                res.send({ message: `Import thành công ${importedCount} users. Hệ thống đang tiến hành gửi email ngầm...` });

                // 2) TIẾN TRÌNH CHẠY NGẦM GỬI EMAIL (BACKGROUND JOB)
                // Không 'await' tiến trình này để không block (treo) API response
                (async () => {
                    if (usersToEmail.length === 0) return;
                    console.log(`\n---> Bắt đầu gửi ${usersToEmail.length} emails trong nền...`);
                    
                    let sentCount = 0;
                    for (let emailTask of usersToEmail) {
                        try {
                            await transporter.sendMail({
                                from: '"Hệ thống Admin" <admin@cuahang.com>',
                                to: emailTask.uEmail,
                                subject: "Thông tin tài khoản đăng nhập",
                                text: `Chào ${emailTask.uName},\n\nTài khoản: ${emailTask.uName}\nMật khẩu: ${emailTask.plainPassword}`
                            });
                            console.log(`✅ [Nền] Đã gửi mail cho [${emailTask.uName}]`);
                            sentCount++;
                            
                            // Giữ nguyên delay(1000) để không dính Rate Limit của Mailtrap / SMTP
                            await delay(1000); 
                        } catch (mailError) {
                            console.log(`❌ [Nền] Lỗi gửi mail cho [${emailTask.uName}]:`, mailError.message);
                        }
                    }
                    console.log(`\n=== HOÀN THÀNH TIẾN TRÌNH NỀN: Đã gửi ${sentCount}/${usersToEmail.length} emails ===\n`);
                })();

    } catch (error) {
        console.log("Lỗi Server:", error);
        res.status(500).send({ message: "Lỗi server: " + error.message });
    }
});

router.post('/register', RegisterValidator, handleResultValidator, async function (req, res, next) {
    try {
        let newUser = userController.CreateAnUser(
            req.body.username,
            req.body.password,
            req.body.email,
            "69aa8360450df994c1ce6c4c" // ID mặc định của role, bạn có thể thay đổi
        );
        await newUser.save();
        res.send({ message: "dang ki thanh cong" });
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.post('/login', async function (req, res, next) {
    let { username, password } = req.body;
    let getUser = await userController.FindByUsername(username);
    
    if (!getUser) {
        return res.status(403).send("tai khoan khong ton tai");
    } 
    if (getUser.lockTime && getUser.lockTime > Date.now()) {
        return res.status(403).send("tai khoan dang bi ban");
    }
    
    if (bcrypt.compareSync(password, getUser.password)) {
        await userController.SuccessLogin(getUser);
        // Ký token RS256
        let token = jwt.sign(
            { id: getUser._id },
            privateKey,
            { algorithm: 'RS256', expiresIn: '30d' }
        );
        res.json({ token: token });
    } else {
        await userController.FailLogin(getUser);
        res.status(403).send("thong tin dang nhap khong dung");
    }
});

// Phải đặt /me lên trước /:id để không bị lỗi CastError
router.get('/me', checkLogin, async function(req, res, next){
    try {
        let user = await userModel.findById(req.user.id);
        res.send(user);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

router.post('/change-password', checkLogin, ChangePasswordValidator, handleResultValidator, async function(req, res, next) {
    try {
        let { oldpassword, newpassword } = req.body;
        
        let user = await userModel.findById(req.user.id); 
        if (!user) {
            return res.status(404).send("Không tìm thấy người dùng");
        }

        if (!bcrypt.compareSync(oldpassword, user.password)) {
            return res.status(400).send({ message: "Mật khẩu cũ không chính xác" });
        }

        // Schema đã có sẵn pre('save') băm mật khẩu, nên chỉ cần gán thẳng
        user.password = newpassword; 
        await user.save(); 
        
        res.send({ message: "Đổi mật khẩu thành công" });
    } catch (error) {
        res.status(500).send({ message: "Lỗi server: " + error.message });
    }
});


// ==========================================
// PHẦN 2: CÁC API QUẢN LÝ DỮ LIỆU CŨ (CRUD)
// ==========================================

router.get("/", checkLogin, async function (req, res, next) {
    let users = await userController.GetAllUser();
    res.send(users);
});

router.get("/:id", async function (req, res, next) {
    try {
        let result = await userModel.find({ _id: req.params.id, isDeleted: false });
        if (result.length > 0) {
            res.send(result);
        } else {
            res.status(404).send({ message: "id not found" });
        }
    } catch (error) {
        res.status(404).send({ message: "id not found" });
    }
});

router.post("/", userCreateValidator, handleResultValidator, async function (req, res, next) {
    try {
        let newItem = userController.CreateAnUser(
            req.body.username, req.body.password, req.body.email, req.body.fullName,
            req.body.avatarUrl, req.body.role, req.body.status, req.body.loginCount
        );
        await newItem.save();
        let saved = await userModel.findById(newItem._id);
        res.send(saved);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.put("/:id", userUpdateValidator, handleResultValidator, async function (req, res, next) {
    try {
        let id = req.params.id;
        let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedItem) return res.status(404).send({ message: "id not found" });
        let populated = await userModel.findById(updatedItem._id);
        res.send(populated);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.delete("/:id", async function (req, res, next) {
    try {
        let id = req.params.id;
        let updatedItem = await userModel.findByIdAndUpdate(
            id, { isDeleted: true }, { new: true }
        );
        if (!updatedItem) return res.status(404).send({ message: "id not found" });
        res.send(updatedItem);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;