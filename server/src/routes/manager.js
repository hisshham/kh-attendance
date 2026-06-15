const express = require('express');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, managerOnly } = require('../middleware/auth');
const { getISTDate } = require('../utils/date');

const router = express.Router();
const prisma = new PrismaClient();

router.use(verifyToken, managerOnly);

// ────────────────────────── WORKERS ──────────────────────────

// GET /api/manager/workers — list all workers
router.get('/workers', async (req, res) => {
    try {
        const workers = await prisma.worker.findMany({
            orderBy: { workerId: 'asc' },
            select: { id: true, workerId: true, name: true, isActive: true, requiresPinReset: true, createdAt: true },
        });
        res.json(workers);
    } catch (err) {
        console.error('Get workers error:', err);
        res.status(500).json({ error: 'Failed to fetch workers' });
    }
});

// POST /api/manager/workers — add a new worker
router.post('/workers', async (req, res) => {
    try {
        const { workerId, name, pin } = req.body;
        if (!workerId || !name || !pin) {
            return res.status(400).json({ error: 'workerId, name, and pin are required' });
        }

        const existing = await prisma.worker.findUnique({ where: { workerId } });
        if (existing) return res.status(409).json({ error: 'Worker ID already exists' });

        const pinHash = await bcrypt.hash(pin, 12);
        const worker = await prisma.worker.create({
            data: { workerId, name, pinHash, requiresPinReset: true },
            select: { id: true, workerId: true, name: true, isActive: true, createdAt: true },
        });
        res.status(201).json(worker);
    } catch (err) {
        console.error('Create worker error:', err);
        res.status(500).json({ error: 'Failed to create worker' });
    }
});

// PUT /api/manager/workers/:id — edit worker
router.put('/workers/:id', async (req, res) => {
    try {
        const { workerId, name } = req.body;
        const updated = await prisma.worker.update({
            where: { id: parseInt(req.params.id) },
            data: { workerId, name }
        });
        res.json({ id: updated.id, workerId: updated.workerId, name: updated.name });
    } catch (err) {
        console.error('Update worker error:', err);
        res.status(500).json({ error: 'Failed to update worker' });
    }
});

// DELETE /api/manager/workers/:id — permanently remove worker
router.delete('/workers/:id', async (req, res) => {
    try {
        await prisma.worker.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Worker deleted successfully' });
    } catch (err) {
        console.error('Delete worker error:', err);
        res.status(500).json({ error: 'Failed to delete worker' });
    }
});

// PATCH /api/manager/workers/:id/toggle — activate/deactivate
router.patch('/workers/:id/toggle', async (req, res) => {
    try {
        const worker = await prisma.worker.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!worker) return res.status(404).json({ error: 'Worker not found' });

        const updated = await prisma.worker.update({
            where: { id: worker.id },
            data: { isActive: !worker.isActive },
        });
        res.json({ id: updated.id, isActive: updated.isActive });
    } catch (err) {
        console.error('Toggle worker error:', err);
        res.status(500).json({ error: 'Failed to toggle worker' });
    }
});

// PATCH /api/manager/workers/:id/reset-pin — force PIN reset
router.patch('/workers/:id/reset-pin', async (req, res) => {
    try {
        const defaultPin = '123456';
        const pinHash = await bcrypt.hash(defaultPin, 12);
        await prisma.worker.update({
            where: { id: parseInt(req.params.id) },
            data: { pinHash, requiresPinReset: true },
        });
        res.json({ message: `PIN reset to ${defaultPin}. Worker must change on next login.` });
    } catch (err) {
        console.error('Reset PIN error:', err);
        res.status(500).json({ error: 'Failed to reset PIN' });
    }
});

// ────────────────────────── SETTINGS ──────────────────────────

// GET /api/manager/settings
router.get('/settings', async (req, res) => {
    try {
        const settings = await prisma.systemSettings.findFirst();
        if (!settings) {
            return res.json({ categories: [], notificationTime: '08:30' });
        }
        let categories = [];
        try { categories = JSON.parse(settings.categories); } catch { }
        res.json({ ...settings, categories });
    } catch (err) {
        console.error('Get settings error:', err);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// PUT /api/manager/settings
router.put('/settings', async (req, res) => {
    try {
        const { categories, notificationTime } = req.body;
        const categoriesStr = JSON.stringify(categories || []);

        let settings = await prisma.systemSettings.findFirst();
        if (settings) {
            settings = await prisma.systemSettings.update({
                where: { id: settings.id },
                data: { categories: categoriesStr, notificationTime: notificationTime || '08:30' },
            });
        } else {
            settings = await prisma.systemSettings.create({
                data: { categories: categoriesStr, notificationTime: notificationTime || '08:30' },
            });
        }
        res.json({ ...settings, categories: JSON.parse(settings.categories) });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// PUT /api/manager/profile
router.put('/profile', async (req, res) => {
    try {
        const { username, rawPin } = req.body;
        if (!username) return res.status(400).json({ error: 'Username is required' });

        const data = { username };
        if (rawPin && rawPin.length >= 4) {
            data.pinHash = await bcrypt.hash(rawPin, 12);
        }

        const updated = await prisma.manager.update({
            where: { id: req.user.id },
            data,
        });

        res.json({ id: updated.id, username: updated.username });
    } catch (err) {
        if (err.code === 'P2002') return res.status(400).json({ error: 'Username already exists' });
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ────────────────────────── ATTENDANCE ──────────────────────────

// GET /api/manager/attendance?date=YYYY-MM-DD
router.get('/attendance', async (req, res) => {
    try {
        const dateStr = req.query.date || getISTDate();

        const attendances = await prisma.attendance.findMany({
            where: { date: dateStr },
            include: { worker: { select: { workerId: true, name: true } } },
            orderBy: { timestamp: 'desc' },
        });

        // Also get all active workers for "absent" calculation
        const allWorkers = await prisma.worker.findMany({
            where: { isActive: true },
            select: { id: true, workerId: true, name: true },
        });

        res.json({ attendances, allWorkers, date: dateStr });
    } catch (err) {
        console.error('Get attendance error:', err);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// GET /api/manager/attendance/export?date=YYYY-MM-DD — CSV export
router.get('/attendance/export', async (req, res) => {
    try {
        const dateStr = req.query.date || getISTDate();

        const allWorkers = await prisma.worker.findMany({
            where: { isActive: true },
            select: { id: true, workerId: true, name: true },
            orderBy: { workerId: 'asc' },
        });

        const attendances = await prisma.attendance.findMany({
            where: { date: dateStr },
        });

        const attendanceMap = {};
        attendances.forEach((a) => { attendanceMap[a.workerId] = a; });

        // Build CSV
        let csv = 'Worker ID,Name,Status,Category,Time\n';
        allWorkers.forEach((w) => {
            const att = attendanceMap[w.id];
            if (att) {
                const timeStr = new Date(att.timestamp).toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit' });
                csv += `${w.workerId},"${w.name}",Present,${att.category},${timeStr}\n`;
            } else {
                csv += `${w.workerId},"${w.name}",Absent,,\n`;
            }
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=attendance_${dateStr}.csv`);
        res.send(csv);
    } catch (err) {
        console.error('Export CSV error:', err);
        res.status(500).json({ error: 'Failed to export' });
    }
});

// ────────────────────────── NOTIFICATIONS ──────────────────────────

// POST /api/manager/send-test-notification — manually trigger push to absent workers
router.post('/send-test-notification', async (req, res) => {
    try {
        const webpush = require('web-push');
        const settings = await prisma.systemSettings.findFirst();
        if (!settings || !settings.vapidPublic || !settings.vapidPrivate) {
            return res.status(400).json({ error: 'VAPID keys not configured. Wait for a worker to enable notifications first.' });
        }

        webpush.setVapidDetails('mailto:admin@workcomm.local', settings.vapidPublic, settings.vapidPrivate);

        // Find workers who haven't punched in today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const today = getISTDate();

        const todaysPunches = await prisma.attendance.findMany({
            where: { date: today },
            select: { workerId: true }
        });
        const presentWorkerIds = new Set(todaysPunches.map(p => p.workerId));

        const missingWorkers = await prisma.worker.findMany({
            where: {
                isActive: true,
                id: { notIn: Array.from(presentWorkerIds) }
            },
            include: { subscriptions: true }
        });

        let sentCount = 0;
        for (const worker of missingWorkers) {
            for (const sub of worker.subscriptions) {
                try {
                    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
                    await webpush.sendNotification(pushSub, JSON.stringify({
                        title: '📋 Attendance Reminder',
                        body: `Hi ${worker.name}, please mark your attendance for today!`
                    }));
                    sentCount++;
                } catch (e) {
                    if (e.statusCode === 410 || e.statusCode === 404) {
                        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
                    }
                }
            }
        }

        res.json({ message: `Test notification sent to ${sentCount} device(s) of ${missingWorkers.length} absent worker(s).` });
    } catch (err) {
        console.error('Test notification error:', err);
        res.status(500).json({ error: 'Failed to send test notification' });
    }
});

module.exports = router;
