const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bank.db');

// إنشاء الجداول
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    phone TEXT,
    qr_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    ticket_number INTEGER,
    service_type TEXT,
    status TEXT DEFAULT 'waiting',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (username) REFERENCES clients(username)
  )`);

  // التحقق من وجود العمود otp_secret وإضافته إذا لم يكن موجودًا
  db.all("PRAGMA table_info(clients)", function(err, columns) {
    if (err) {
      console.error('Error fetching table info:', err);
      return;
    }

    const hasOtpSecret = columns.some(column => column.name === 'otp_secret');
    if (!hasOtpSecret) {
      db.run(`ALTER TABLE clients ADD COLUMN otp_secret TEXT`, (alterErr) => {
        if (alterErr) {
          console.error('Error adding otp_secret column:', alterErr);
        } else {
          console.log('otp_secret column added successfully.');
        }
      });
    }
  });
});

// دوال مساعدة للتعامل مع الاستعلامات باستخدام Promise
db.getAsync = function(sql, params) {
  return new Promise((resolve, reject) => {
    this.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

db.runAsync = function(sql, params) {
  return new Promise((resolve, reject) => {
    this.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

// إضافة دالة allAsync
db.allAsync = function(sql, params) {
  return new Promise((resolve, reject) => {
    this.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// استخدام allAsync لاسترجاع البيانات
db.allAsync("SELECT * FROM clients")
  .then(rows => {
    console.log(rows); // جميع العملاء
  })
  .catch(err => {
    console.error('Error:', err);
  });

db.allAsync("SELECT * FROM queue")
  .then(rows => {
    console.log(rows); 
  })
  .catch(err => {
    console.error('Error:', err);
  });

module.exports = db;
