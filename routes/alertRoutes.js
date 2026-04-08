const express = require('express');
const router = express.Router();

// GET /api/alerts
router.get('/', (req, res) => {
  res.json({ message: 'Alerts endpoint working' });
});

// POST /api/alerts
router.post('/', (req, res) => {
  res.json({ message: 'Alert created' });
});

module.exports = router;
