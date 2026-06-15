const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

const isProduction = process.env.NODE_ENV === 'production';

// POST /auth/manager/login
router.post('/login', async (req, res) => {
    try {
        const { username, pin } = req.body;
        if (!username || !pin) {
            return res.status(400).json({ error: 'Username and PIN required' });
        }

        const manager = await prisma.manager.findUnique({ where: { username } });
        if (!manager) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const pinValid = await bcrypt.compare(pin, manager.pinHash);
        if (!pinValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const accessToken = jwt.sign(
            { id: manager.id, username: manager.username, role: 'manager' },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        const refreshToken = jwt.sign(
            { id: manager.id, role: 'manager', type: 'refresh' },
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
            manager: { id: manager.id, username: manager.username },
        });
    } catch (err) {
        console.error('Manager login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

module.exports = router;
