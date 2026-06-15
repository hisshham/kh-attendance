const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifyToken, workerOnly } = require('../middleware/auth');

// Automatically handle VAPID keys
async function ensureVapidKeys() {
    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
        settings = await prisma.systemSettings.create({ data: { categories: '["Fully Skilled","Semi Skilled","Unskilled"]' } });
    }

    if (!settings.vapidPublic || !settings.vapidPrivate) {
        const vapidKeys = webpush.generateVAPIDKeys();
        settings = await prisma.systemSettings.update({
            where: { id: settings.id },
            data: {
                vapidPublic: vapidKeys.publicKey,
                vapidPrivate: vapidKeys.privateKey
            }
        });
    }

    webpush.setVapidDetails(
        'mailto:admin@workcomm.local',
        settings.vapidPublic,
        settings.vapidPrivate
    );
    return settings.vapidPublic;
}

// Ensure keys are loaded when route starts
let vapidPublicKey = null;
ensureVapidKeys().then(key => vapidPublicKey = key).catch(console.error);

router.get('/vapid-key', async (req, res) => {
    if (!vapidPublicKey) {
        vapidPublicKey = await ensureVapidKeys();
    }
    res.json({ publicKey: vapidPublicKey });
});

router.post('/subscribe', verifyToken, workerOnly, async (req, res) => {
    try {
        const subscription = req.body;
        // Check if endpoint exists
        const existing = await prisma.pushSubscription.findUnique({
            where: { endpoint: subscription.endpoint }
        });

        if (existing) {
            // Update worker mapping if existing
            await prisma.pushSubscription.update({
                where: { id: existing.id },
                data: { workerId: req.user.id }
            });
        } else {
            await prisma.pushSubscription.create({
                data: {
                    workerId: req.user.id,
                    endpoint: subscription.endpoint,
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth
                }
            });
        }
        res.status(201).json({});
    } catch (err) {
        console.error('Push subscribe error:', err);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});

module.exports = router;
