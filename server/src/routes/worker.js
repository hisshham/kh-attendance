const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, workerOnly } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(verifyToken, workerOnly);

// GET /api/worker/attendance/today — check if already punched in + get categories
router.get('/attendance/today', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const attendance = await prisma.attendance.findUnique({
            where: { workerId_date: { workerId: req.user.id, date: today } },
        });

        const settings = await prisma.systemSettings.findFirst();
        let categories = [];
        if (settings) {
            try { categories = JSON.parse(settings.categories); } catch { categories = []; }
        }

        res.json({ attendance, categories, today });
    } catch (err) {
        console.error('Get today attendance error:', err);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// POST /api/worker/attendance — mark attendance
router.post('/attendance', async (req, res) => {
    try {
        const { category } = req.body;
        if (!category) return res.status(400).json({ error: 'Category is required' });

        const today = new Date().toISOString().split('T')[0];

        const existing = await prisma.attendance.findUnique({
            where: { workerId_date: { workerId: req.user.id, date: today } },
        });
        if (existing) {
            return res.status(400).json({ error: 'Attendance already marked for today' });
        }

        const attendance = await prisma.attendance.create({
            data: { workerId: req.user.id, category, date: today },
        });

        // Notify manager dashboard via socket
        const io = req.app.get('io');
        if (io) {
            io.to('manager').emit('attendance_update', {
                workerId: req.user.workerId,
                name: req.user.name,
                category,
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

module.exports = router;
