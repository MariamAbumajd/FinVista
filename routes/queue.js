const express = require('express');
const router = express.Router();
const db = require('../db');
const util = require('util');
db.allAsync = util.promisify(db.all).bind(db);

// عرض جميع المعاملات للموظف
router.get('/transactions', (req, res) => {
  db.all(`
    SELECT clients.username, clients.phone, queue.ticket_number, queue.service_type, queue.timestamp
    FROM queue
    JOIN clients ON queue.username = clients.username
    ORDER BY queue.timestamp DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

// عرض قائمة الانتظار للعملاء
router.get('/', async (req, res) => {
  try {
    const rows = await db.allAsync(`
      SELECT * FROM queue 
      WHERE status = 'waiting' 
      ORDER BY timestamp ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Fetch queue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// التحقق من حالة التذكرة
router.get('/status', (req, res) => {
  const ticket = req.query.ticket;
  if (!ticket) return res.json({ success: false, message: 'Missing ticket number' });

  db.get("SELECT status FROM queue WHERE ticket_number = ?", [ticket], (err, row) => {
    if (err) return res.json({ success: false, message: 'Database error' });
    if (!row) return res.json({ success: false, message: 'Ticket not found' });

    let message = 'Please wait for your turn.';
    if (row.status === 'called') {
      message = "It's your turn! Please proceed to the service desk.";
    }

    res.json({ success: true, status: row.status, message });
  });
});

// تعيين حالة التذكرة إلى "served"
router.post('/serve', (req, res) => {
  const ticket = req.query.ticket;
  if (!ticket) return res.json({ success: false, message: 'Missing ticket number' });

  db.run("UPDATE queue SET status = 'served' WHERE ticket_number = ?", [ticket], function (err) {
    if (err) return res.json({ success: false, message: 'Database error' });
    res.json({ success: true, message: 'Ticket updated to served' });
  });
});

// استدعاء التذكرة التالية (للموظف)
router.post('/call-next', (req, res) => {
  db.get("SELECT * FROM queue WHERE status = 'waiting' ORDER BY timestamp ASC LIMIT 1", [], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.json({ success: false, message: 'No customers in queue' });

    db.run("UPDATE queue SET status = 'called' WHERE ticket_number = ?", [row.ticket_number], function (err2) {
      if (err2) return res.status(500).json({ error: 'DB update error' });
      res.json({ success: true, ticket: row.ticket_number });
    });
  });
});

// الإحصائيات حسب نوع الخدمة (للرسم البياني)
router.get('/graph', (req, res) => {
  db.all("SELECT service_type, COUNT(*) as count FROM queue GROUP BY service_type", (err, rows) => {
    if (err) return res.json({ success: false, message: 'Database error' });
    res.json({ success: true, data: rows });
  });
});

// إحصائيات المعاملات
router.get('/transactionStats', (req, res) => {
  db.all(`
    SELECT service_type, COUNT(*) as count
    FROM queue
    GROUP BY service_type
    ORDER BY count DESC
  `, [], (err, rows) => {
    if (err) return res.json({ success: false, message: 'Database error' });
    res.json(rows);
  });
});

module.exports = router;
