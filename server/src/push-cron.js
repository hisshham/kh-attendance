const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const webpush = require('web-push');
const { getISTDate, getISTTime } = require('./utils/date');

async function sendDailyNotifications() {
    try {
        console.log('[CRON] 🔔 Running daily notification check...');
        const settings = await prisma.systemSettings.findFirst();
        if (!settings || !settings.vapidPublic) {
            console.log('[CRON] ⏭️  No VAPID keys configured, skipping notifications.');
            return;
        }

        // Make sure webpush uses the keys
        webpush.setVapidDetails('mailto:admin@workcomm.local', settings.vapidPublic, settings.vapidPrivate);

        // Find workers who haven't punched in today
        const today = getISTDate();

        // Who has punched in?
        const todaysPunches = await prisma.attendance.findMany({
            where: { date: today },
            select: { workerId: true }
        });
        const presentWorkerIds = new Set(todaysPunches.map(p => p.workerId));

        // Find active workers NOT in presentWorkerIds, and get their subscriptions
        const missingWorkers = await prisma.worker.findMany({
            where: {
                isActive: true,
                id: { notIn: Array.from(presentWorkerIds) }
            },
            include: { subscriptions: true }
        });

        if (missingWorkers.length === 0) {
            console.log('[CRON] ✅ All workers have punched in today. No notifications needed.');
            return;
        }

        let sentCount = 0;
        let failCount = 0;
        for (const worker of missingWorkers) {
            for (const sub of worker.subscriptions) {
                try {
                    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
                    await webpush.sendNotification(pushSub, JSON.stringify({
                        title: '📋 Daily Attendance Reminder',
                        body: `Hi ${worker.name}, please remember to mark your attendance for today!`
                    }));
                    sentCount++;
                } catch (e) {
                    failCount++;
                    if (e.statusCode === 410 || e.statusCode === 404) {
                        // Subscription expired, clean up
                        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
                        console.log(`[CRON] 🗑️  Cleaned up expired subscription for ${worker.name}`);
                    }
                }
            }
        }
        console.log(`[CRON] 📊 Notification summary: ${sentCount} sent, ${failCount} failed, ${missingWorkers.length} absent workers.`);
    } catch (err) {
        console.error('[CRON] ❌ Error:', err);
    }
}

function startNotificationCron() {
    // Run every minute and check if current time matches notificationTime
    cron.schedule('* * * * *', async () => {
        try {
            const settings = await prisma.systemSettings.findFirst();
            if (!settings) return;

            const timeParts = (settings.notificationTime || "08:30").split(':');
            const targetHour = parseInt(timeParts[0]);
            const targetMin = parseInt(timeParts[1]);

            const { hour, minute } = getISTTime();
            if (hour === targetHour && minute === targetMin) {
                console.log(`[CRON] ⏰ It's ${settings.notificationTime} — triggering daily notifications!`);
                sendDailyNotifications();
            }
        } catch (err) {
            console.error('[CRON] Error checking schedule:', err);
        }
    });
    console.log('✅ Daily Notification Cron started (checks every minute)');
}

module.exports = { startNotificationCron };
