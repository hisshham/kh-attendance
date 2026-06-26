const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifyToken, workerOnly } = require('../middleware/auth');
const { sendNotifications } = require('../push-cron');

// External Webhook to trigger cron manually (fixes Render sleep issue)
router.get('/trigger-cron/:type', async (req, res) => {
    const type = req.params.type === 'call_alert' ? 'call_alert' : 'notification';
    console.log(`[EXTERNAL CRON] Triggering ${type} via webhook...`);
    
    // Fire and forget so we don't hold the request
    sendNotifications(type).catch(console.error);
    
    res.json({ success: true, message: `${type} triggered` });
});

// Automatically handle VAPID keys
async function ensureVapidKeys() {
    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
        settings = await prisma.systemSettings.create({
            data: {
                masterData: JSON.stringify({
                    lineData: [],
                    categories: [],
                    experience: []
                }),
                notificationTime: '08:30',
            },
        });
    }

    if (!settings.vapidPublic || !settings.vapidPrivate) {
        const vapidKeys = webpush.generateVAPIDKeys();
        settings = await prisma.systemSettings.update({
            where: { id: settings.id },
            data: {
                vapidPublic: vapidKeys.publicKey,
                vapidPrivate: vapidKeys.privateKey,
            },
        });
    }

    webpush.setVapidDetails(
        'mailto:admin@kh-attendance.com',
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

        // Remove any existing subscription for this endpoint (handles VAPID key mismatch)
        const existing = await prisma.pushSubscription.findUnique({
            where: { endpoint: subscription.endpoint }
        });

        if (existing) {
            // Update the existing subscription with new keys and worker mapping
            await prisma.pushSubscription.update({
                where: { id: existing.id },
                data: {
                    workerId: req.user.id,
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth,
                },
            });
        } else {
            await prisma.pushSubscription.create({
                data: {
                    workerId: req.user.id,
                    endpoint: subscription.endpoint,
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth,
                },
            });
        }
        res.status(201).json({});
    } catch (err) {
        console.error('Push subscribe error:', err);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});

// POST /api/push/unsubscribe — remove a subscription (used for VAPID key mismatch recovery)
router.post('/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (endpoint) {
            await prisma.pushSubscription.deleteMany({ where: { endpoint } });
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('Push unsubscribe error:', err);
        res.status(500).json({ error: 'Failed to unsubscribe' });
    }
});

module.exports = router;
