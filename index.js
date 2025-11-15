const express = require('express');
const app = express();
const path = require('path');
const db = require('./db');

const authRoutes = require('./routes/auth');
const queueRoutes = require('./routes/queue');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.use('/api', authRoutes);
app.use('/auth', authRoutes);
app.use('/api/queue', queueRoutes);

// Welcome page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'welcomepage.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
