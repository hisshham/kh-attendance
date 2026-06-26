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
            select: { id: true, workerId: true, name: true, lineData: true, category: true, experience: true, isActive: true, requiresPinReset: true, createdAt: true },
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
        const { workerId, name, pin, lineData, category, experience } = req.body;
        if (!workerId || !name || !pin) {
            return res.status(400).json({ error: 'workerId, name, and pin are required' });
        }

        const existing = await prisma.worker.findUnique({ where: { workerId } });
        if (existing) return res.status(409).json({ error: 'Worker ID already exists' });

        const pinHash = await bcrypt.hash(pin, 12);
        const worker = await prisma.worker.create({
            data: { workerId, name, pinHash, lineData: lineData || null, category: category || null, experience: experience || null, requiresPinReset: true },
            select: { id: true, workerId: true, name: true, lineData: true, category: true, experience: true, isActive: true, createdAt: true },
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
        const { workerId, name, lineData, category, experience } = req.body;
        const updated = await prisma.worker.update({
            where: { id: parseInt(req.params.id) },
            data: { workerId, name, lineData: lineData || null, category: category || null, experience: experience || null },
        });
        res.json({ id: updated.id, workerId: updated.workerId, name: updated.name, lineData: updated.lineData, category: updated.category, experience: updated.experience });
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
            return res.json({
                masterData: { lineData: [], categories: [], experience: [] },
                notificationTime: '08:30',
                notificationEnabled: true,
                callAlertEnabled: false,
                callAlertTime: null,
                editDeadlineEnabled: false,
                editDeadlineTime: null,
            });
        }
        let masterData = { lineData: [], categories: [], experience: [] };
        try { masterData = JSON.parse(settings.masterData); } catch { }
        // Ensure all fields exist
        if (!masterData.lineData) masterData.lineData = [];
        if (!masterData.categories) masterData.categories = [];
        if (!masterData.experience) masterData.experience = [];
        res.json({
            ...settings,
            masterData,
        });
    } catch (err) {
        console.error('Get settings error:', err);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// PUT /api/manager/settings/master-data — save master data only
router.put('/settings/master-data', async (req, res) => {
    try {
        const { masterData } = req.body;
        const masterDataStr = JSON.stringify(masterData || { lineData: [], categories: [], experience: [] });

        let settings = await prisma.systemSettings.findFirst();
        if (settings) {
            settings = await prisma.systemSettings.update({
                where: { id: settings.id },
                data: { masterData: masterDataStr },
            });
        } else {
            settings = await prisma.systemSettings.create({
                data: { masterData: masterDataStr, notificationTime: '08:30' },
            });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Update master data error:', err);
        res.status(500).json({ error: 'Failed to save master data' });
    }
});

// PUT /api/manager/settings/notifications — save notification settings only
router.put('/settings/notifications', async (req, res) => {
    try {
        const { notificationEnabled, notificationTime } = req.body;
        let settings = await prisma.systemSettings.findFirst();
        const data = {
            notificationEnabled: notificationEnabled !== undefined ? notificationEnabled : true,
            notificationTime: notificationTime || '08:30',
        };
        if (settings) {
            await prisma.systemSettings.update({ where: { id: settings.id }, data });
        } else {
            await prisma.systemSettings.create({ data: { ...data, masterData: '{}' } });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Update notification settings error:', err);
        res.status(500).json({ error: 'Failed to save notification settings' });
    }
});

// PUT /api/manager/settings/call-alert — save call alert settings only
router.put('/settings/call-alert', async (req, res) => {
    try {
        const { callAlertEnabled, callAlertTime } = req.body;
        let settings = await prisma.systemSettings.findFirst();
        const data = {
            callAlertEnabled: callAlertEnabled !== undefined ? callAlertEnabled : false,
            callAlertTime: callAlertTime || null,
        };
        if (settings) {
            await prisma.systemSettings.update({ where: { id: settings.id }, data });
        } else {
            await prisma.systemSettings.create({ data: { ...data, masterData: '{}', notificationTime: '08:30' } });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Update call alert error:', err);
        res.status(500).json({ error: 'Failed to save call alert settings' });
    }
});

// PUT /api/manager/settings/edit-deadline — save edit deadline settings only
router.put('/settings/edit-deadline', async (req, res) => {
    try {
        const { editDeadlineEnabled, editDeadlineTime } = req.body;
        let settings = await prisma.systemSettings.findFirst();
        const data = {
            editDeadlineEnabled: editDeadlineEnabled !== undefined ? editDeadlineEnabled : false,
            editDeadlineTime: editDeadlineTime || null,
        };
        if (settings) {
            await prisma.systemSettings.update({ where: { id: settings.id }, data });
        } else {
            await prisma.systemSettings.create({ data: { ...data, masterData: '{}', notificationTime: '08:30' } });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Update edit deadline error:', err);
        res.status(500).json({ error: 'Failed to save edit deadline settings' });
    }
});

// PUT /api/manager/settings (legacy — save all at once, kept for backward compat)
router.put('/settings', async (req, res) => {
    try {
        const {
            masterData,
            notificationTime,
            notificationEnabled,
            callAlertEnabled,
            callAlertTime,
            editDeadlineEnabled,
            editDeadlineTime,
        } = req.body;

        const masterDataStr = JSON.stringify(masterData || { lineData: [], categories: [], experience: [] });

        const data = {
            masterData: masterDataStr,
            notificationTime: notificationTime || '08:30',
            notificationEnabled: notificationEnabled !== undefined ? notificationEnabled : true,
            callAlertEnabled: callAlertEnabled !== undefined ? callAlertEnabled : false,
            callAlertTime: callAlertTime || null,
            editDeadlineEnabled: editDeadlineEnabled !== undefined ? editDeadlineEnabled : false,
            editDeadlineTime: editDeadlineTime || null,
        };

        let settings = await prisma.systemSettings.findFirst();
        if (settings) {
            settings = await prisma.systemSettings.update({
                where: { id: settings.id },
                data,
            });
        } else {
            settings = await prisma.systemSettings.create({ data });
        }
        res.json({ ...settings, masterData: JSON.parse(settings.masterData) });
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
            include: { worker: { select: { workerId: true, name: true, lineData: true, category: true, experience: true } } },
            orderBy: { timestamp: 'desc' },
        });

        // All active workers for calculations
        const allWorkers = await prisma.worker.findMany({
            where: { isActive: true },
            select: { id: true, workerId: true, name: true, lineData: true, category: true, experience: true },
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
            select: { id: true, workerId: true, name: true, lineData: true, category: true, experience: true },
            orderBy: { workerId: 'asc' },
        });

        const attendances = await prisma.attendance.findMany({
            where: { date: dateStr },
        });

        const attendanceMap = {};
        attendances.forEach((a) => { attendanceMap[a.workerId] = a; });

        // Build CSV
        let csv = 'Worker ID,Name,Line Data,Category,Experience,Status,Time\n';
        allWorkers.forEach((w) => {
            const att = attendanceMap[w.id];
            if (att) {
                const timeStr = new Date(att.timestamp).toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit' });
                const status = att.isPresent ? 'Present' : 'Absent';
                csv += `${w.workerId},"${w.name}",${w.lineData || 'Unassigned'},${w.category || 'Unassigned'},${w.experience || 'Unassigned'},${status},${timeStr}\n`;
            } else {
                csv += `${w.workerId},"${w.name}",${w.lineData || 'Unassigned'},${w.category || 'Unassigned'},${w.experience || 'Unassigned'},No Response,\n`;
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

        webpush.setVapidDetails('mailto:admin@kh-attendance.com', settings.vapidPublic, settings.vapidPrivate);

        const today = getISTDate();

        const todaysPunches = await prisma.attendance.findMany({
            where: { date: today, isPresent: true },
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
