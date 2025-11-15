const express = require('express');
const router = express.Router();
const db = require('../db');
const QRCode = require('qrcode');
const speakeasy = require('speakeasy');
const bcrypt = require('bcryptjs');

// تسجيل مستخدم جديد
router.post('/signup', async (req, res) => {
  try {
    const { username, phone, password } = req.body;

    // التحقق من البيانات المدخلة
    if (!username || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // إنشاء OTP secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `BankApp:${username}`,
      issuer: 'BankApp'
    });

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    // حفظ المستخدم في قاعدة البيانات
    await db.runAsync(
      `INSERT INTO clients (username, phone, password, otp_secret) VALUES (?, ?, ?, ?)`,
      [username, phone, hashedPassword, secret.base32]
    );

    // إنشاء OTP URL يحتوي على الـ secret
    const otpUrl = speakeasy.otpauthURL({
      secret: secret.base32,      // secret to encode
      label: username,           // username as the label
      issuer: 'BankApp',         // issuer of the OTP
      encoding: 'base32'         // OTP encoding format
    });

    // تحويل OTP URL إلى QR code
    const qrImage = await QRCode.toDataURL(otpUrl);

    // إرسال QR code مع رسالة النجاح
    res.json({
      success: true,
      qrImage,                   // QR code image data URL
      message: 'Account created successfully. Please save your QR code for login.'
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// مسار لمسح QR code وتسجيل الدخول
router.post('/scan-qr', async (req, res) => {
  try {
    const { qrCode } = req.body;

    if (!qrCode) {
      return res.status(400).json({ error: 'QR code is required' });
    }

    // استخراج السر من QR code (يجب أن يحتوي QR code على secret=xxx)
    const secretMatch = qrCode.match(/secret=([^&]+)/);
    if (!secretMatch) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    const secret = secretMatch[1];
    // هنا يجب تنفيذ ما تود فعله بالـ secret
    // من الممكن أن تستخرج اسم العميل أو تحقق من البيانات باستخدامه.
    
    // مثال للتحقق من البيانات:
    db.get('SELECT * FROM clients WHERE otp_secret = ?', [secret], (err, client) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!client) return res.status(404).json({ error: 'Client not found' });

      return res.status(200).json({
        username: client.username,
        message: 'Client authenticated successfully'
      });
    });
    
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error processing the QR code' });
  }
});

// // تسجيل الدخول باستخدام اسم المستخدم وكلمة المرور
// router.post('/login', async (req, res) => {
//   try {
//     const { username, password } = req.body;
    
//     if (!username || !password) {
//       return res.status(400).json({ error: 'Username and password are required' });
//     }

//     // البحث عن المستخدم
//     const user = await db.getAsync(
//       `SELECT * FROM clients WHERE username = ?`,
//       [username]
//     );

//     if (!user) {
//       return res.status(401).json({ error: 'Invalid credentials' });
//     }

//     // التحقق من كلمة المرور
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(401).json({ error: 'Invalid credentials' });
//     }

//     res.json({
//       success: true,
//       username: user.username,
//       message: 'Login successful'
//     });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });
// تسجيل الدخول باستخدام اسم المستخدم وكلمة المرور
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // تحقق من وجود الحقول
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    // استعلام قاعدة البيانات
    const sql = 'SELECT * FROM clients WHERE username = ?';
    db.get(sql, [username], async (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }

      if (row) {
        // التحقق من كلمة المرور
        const isMatch = await bcrypt.compare(password, row.password);
        if (!isMatch) {
          return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        // ✅ تسجيل الدخول ناجح
        return res.status(200).json({ success: true, username: row.username });
      } else {
        // ❌ اسم المستخدم أو كلمة السر خاطئة
        return res.status(401).json({ success: false, message: 'Invalid username or password' });
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Unexpected error occurred' });
  }
});

// إضافة تذكرة جديدة إلى الطابور
 router.post('/queue', async (req, res) => {
  try {
    const { username, service_type, ticket_number } = req.body;

    if (!username || !service_type || !ticket_number) {
      return res.status(400).json({ error: 'Username, service type, and ticket number are required' });
    }

    await db.runAsync(
      `INSERT INTO queue (username, ticket_number, service_type) VALUES (?, ?, ?)`,
      [username, ticket_number, service_type]
    );

    res.json({
      success: true,
      ticket_number,
      message: 'Ticket created successfully'
    });
  } catch (error) {
    console.error('Queue error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all transactions (customers with their queue data)
router.get('/all-transactions', async (req, res) => {
  try {
    const transactions = await db.allAsync(`
      SELECT c.username AS name, c.phone, q.service_type, q.ticket_number
      FROM clients c
      JOIN queue q ON c.username = q.username
    `);

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
 

// تسجيل دخول الموظف
router.post('/employee', (req, res) => {
  const { username, password } = req.body;

  // بيانات الموظف الثابتة
  const EMPLOYEE_USERNAME = "Mariam";
  const EMPLOYEE_PASSWORD = "admin123";

  if (username === EMPLOYEE_USERNAME && password === EMPLOYEE_PASSWORD) {
    res.json({ success: true, message: "Employee login successful." });
  } else {
    res.json({ success: false, message: "Invalid credentials." });
  }
});

module.exports = router;


module.exports = router;
