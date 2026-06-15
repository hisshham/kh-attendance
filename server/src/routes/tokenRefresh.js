const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
    path: '/auth/refresh',
};

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token) return res.status(401).json({ error: 'Refresh token not found' });

        const decoded = jwt.verify(token, process.env.REFRESH_SECRET);
        let payload;

        if (decoded.role === 'worker') {
            const worker = await prisma.worker.findUnique({ where: { id: decoded.id } });
            if (!worker || !worker.isActive) return res.status(403).json({ error: 'Account deactivated' });
            payload = { id: worker.id, workerId: worker.workerId, name: worker.name, role: 'worker' };
        } else if (decoded.role === 'manager') {
            const manager = await prisma.manager.findUnique({ where: { id: decoded.id } });
            if (!manager) return res.status(403).json({ error: 'Account not found' });
            payload = { id: manager.id, username: manager.username, role: 'manager' };
        } else {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ accessToken });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            res.clearCookie('refreshToken', cookieOptions);
            return res.status(401).json({ error: 'Session expired. Please login again.' });
        }
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('refreshToken', cookieOptions);
    res.json({ message: 'Logged out' });
});

module.exports = router;
