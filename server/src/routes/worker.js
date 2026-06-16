const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, workerOnly } = require('../middleware/auth');
const { getISTDate, getISTTime } = require('../utils/date');

const router = express.Router();
const prisma = new PrismaClient();

router.use(verifyToken, workerOnly);

// GET /api/worker/attendance/today — check if already punched in + get worker info & settings
router.get('/attendance/today', async (req, res) => {
    try {
        const today = getISTDate();

        const attendance = await prisma.attendance.findUnique({
            where: { workerId_date: { workerId: req.user.id, date: today } },
        });

        // Get worker's assigned category
        const worker = await prisma.worker.findUnique({
            where: { id: req.user.id },
            select: { category: true, name: true, workerId: true },
        });

        // Get settings for edit deadline info
        const settings = await prisma.systemSettings.findFirst();
        const editDeadlineEnabled = settings?.editDeadlineEnabled ?? false;
        const editDeadlineTime = settings?.editDeadlineTime || null;

        // Current IST time for client-side deadline check
        const { hour, minute } = getISTTime();
        const currentISTTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

        res.json({
            attendance,
            worker,
            editDeadlineEnabled,
            editDeadlineTime,
            currentISTTime,
            today,
        });
    } catch (err) {
        console.error('Get today attendance error:', err);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// POST /api/worker/attendance — mark attendance (YES or NO)
router.post('/attendance', async (req, res) => {
    try {
        const { isPresent } = req.body;
        if (typeof isPresent !== 'boolean') {
            return res.status(400).json({ error: 'isPresent (boolean) is required' });
        }

        const today = getISTDate();

        const existing = await prisma.attendance.findUnique({
            where: { workerId_date: { workerId: req.user.id, date: today } },
        });
        if (existing) {
            return res.status(400).json({ error: 'Attendance already marked for today' });
        }

        // Get worker's assigned category
        const worker = await prisma.worker.findUnique({
            where: { id: req.user.id },
            select: { category: true },
        });

        const attendance = await prisma.attendance.create({
            data: {
                workerId: req.user.id,
                category: worker?.category || 'Unassigned',
                isPresent,
                date: today,
            },
        });

        // Notify manager dashboard via socket
        const io = req.app.get('io');
        if (io) {
            io.to('manager').emit('attendance_update', {
                workerId: req.user.workerId,
                name: req.user.name,
                category: worker?.category || 'Unassigned',
                isPresent,
                date: today,
            });
        }

        res.status(201).json(attendance);
    } catch (err) {
        console.error('Submit attendance error:', err);
        if (err.code === 'P2002') {
            return res.status(400).json({ error: 'Attendance already marked for today' });
        }
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
});

// PATCH /api/worker/attendance/update — edit attendance (toggle yes/no)
router.patch('/attendance/update', async (req, res) => {
    try {
        const { isPresent } = req.body;
        if (typeof isPresent !== 'boolean') {
            return res.status(400).json({ error: 'isPresent (boolean) is required' });
        }

        const today = getISTDate();

        // Check edit deadline
        const settings = await prisma.systemSettings.findFirst();
        if (settings?.editDeadlineEnabled && settings?.editDeadlineTime) {
            const { hour, minute } = getISTTime();
            const [deadlineHour, deadlineMin] = settings.editDeadlineTime.split(':').map(Number);
            const currentMinutes = hour * 60 + minute;
            const deadlineMinutes = deadlineHour * 60 + deadlineMin;

            if (currentMinutes >= deadlineMinutes) {
                return res.status(403).json({
                    error: `Editing is locked after ${settings.editDeadlineTime}. Contact your manager.`,
                });
            }
        }

        const existing = await prisma.attendance.findUnique({
            where: { workerId_date: { workerId: req.user.id, date: today } },
        });

        if (!existing) {
            return res.status(404).json({ error: 'No attendance record found for today' });
        }

        const updated = await prisma.attendance.update({
            where: { id: existing.id },
            data: { isPresent },
        });

        // Notify manager
        const io = req.app.get('io');
        if (io) {
            io.to('manager').emit('attendance_update', {
                workerId: req.user.workerId,
                name: req.user.name,
                isPresent,
                date: today,
            });
        }

        res.json(updated);
    } catch (err) {
        console.error('Update attendance error:', err);
        res.status(500).json({ error: 'Failed to update attendance' });
    }
});

module.exports = router;
