const express = require('express');
const { auth } = require('../middleware/auth');
const { NotificationService } = require('../services/notification.service');

const router = express.Router();
router.use(auth);

// Get all notifications
router.get('/', async (req, res) => {
  try {
    const notifications = await NotificationService.getAll(req.user.id);
    const unreadCount = await NotificationService.getUnreadCount(req.user.id);
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark single as read
router.patch('/:id/read', async (req, res) => {
  try {
    await NotificationService.markRead(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all as read
router.patch('/mark-all-read', async (req, res) => {
  try {
    await NotificationService.markAllRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete notification
router.delete('/:id', async (req, res) => {
  try {
    await NotificationService.delete(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all notifications
router.delete('/', async (req, res) => {
  try {
    await NotificationService.clearAll(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
