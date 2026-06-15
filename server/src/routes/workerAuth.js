const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, workerOnly } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const isProduction = process.env.NODE_ENV === 'production';

// POST /auth/worker/login
router.post('/login', async (req, res) => {
    try {
        const { workerId, pin } = req.body;
        if (!workerId || !pin) {
            return res.status(400).json({ error: 'Worker ID and PIN required' });
        }

        const worker = await prisma.worker.findUnique({ where: { workerId } });
        if (!worker || !worker.isActive) {
            return res.status(401).json({ error: 'Invalid credentials or inactive account' });
        }

        const pinValid = await bcrypt.compare(pin, worker.pinHash);
        if (!pinValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const accessToken = jwt.sign(
            { id: worker.id, workerId: worker.workerId, name: worker.name, role: 'worker' },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        const refreshToken = jwt.sign(
            { id: worker.id, role: 'worker', type: 'refresh' },
            process.env.REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'strict',
            path: '/auth/refresh',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });

        res.json({
            accessToken,
            worker: {
                id: worker.id,
                workerId: worker.workerId,
                name: worker.name,
                requiresPinReset: worker.requiresPinReset,
            },
        });
    } catch (err) {
        console.error('Worker login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// POST /auth/worker/change-pin
router.post('/change-pin', verifyToken, workerOnly, async (req, res) => {
    try {
        const { newPin } = req.body;
        if (!newPin || newPin.length < 4) {
            return res.status(400).json({ error: 'PIN must be at least 4 digits' });
        }

        const pinHash = await bcrypt.hash(newPin, 12);
        await prisma.worker.update({
            where: { id: req.user.id },
            data: { pinHash, requiresPinReset: false },
        });

        res.json({ message: 'PIN updated successfully' });
    } catch (err) {
        console.error('Change PIN error:', err);
        res.status(500).json({ error: 'Failed to update PIN' });
    }
});

module.exports = router;
