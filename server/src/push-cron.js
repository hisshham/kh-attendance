const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const webpush = require('web-push');
const { getISTDate, getISTTime } = require('./utils/date');

async function sendNotifications(type = 'notification') {
    try {
        const label = type === 'call_alert' ? 'CALL ALERT' : 'NOTIFICATION';
        console.log(`[CRON] 🔔 Running ${label} check...`);
        const settings = await prisma.systemSettings.findFirst();
        if (!settings || !settings.vapidPublic) {
            console.log(`[CRON] ⏭️  No VAPID keys configured, skipping.`);
            return;
        }

        webpush.setVapidDetails('mailto:admin@kh-attendance.com', settings.vapidPublic, settings.vapidPrivate);

        const today = getISTDate();

        // Who has punched in as present?
        const todaysPunches = await prisma.attendance.findMany({
            where: { date: today, isPresent: true },
            select: { workerId: true }
        });
        const presentWorkerIds = new Set(todaysPunches.map(p => p.workerId));

        // Active workers not present
        const missingWorkers = await prisma.worker.findMany({
            where: {
                isActive: true,
                id: { notIn: Array.from(presentWorkerIds) }
            },
            include: { subscriptions: true }
        });

        if (missingWorkers.length === 0) {
            console.log(`[CRON] ✅ All workers present. No ${label} needed.`);
            return;
        }

        const payload = type === 'call_alert'
            ? { title: '📞 Attendance Call Alert', body: 'Please mark your attendance NOW!', type: 'call_alert' }
            : { title: '📋 Daily Attendance Reminder', body: 'Please remember to mark your attendance for today!' };

        let sentCount = 0;
        let failCount = 0;
        for (const worker of missingWorkers) {
            const personalPayload = {
                ...payload,
                body: type === 'call_alert'
                    ? `${worker.name}, please mark your attendance NOW!`
                    : `Hi ${worker.name}, please remember to mark your attendance for today!`
            };
            for (const sub of worker.subscriptions) {
                try {
                    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
                    await webpush.sendNotification(pushSub, JSON.stringify(personalPayload));
                    sentCount++;
                } catch (e) {
                    failCount++;
                    if (e.statusCode === 410 || e.statusCode === 404) {
                        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
                        console.log(`[CRON] 🗑️  Cleaned up expired subscription for ${worker.name}`);
                    }
                }
            }
        }
        console.log(`[CRON] 📊 ${label} summary: ${sentCount} sent, ${failCount} failed, ${missingWorkers.length} absent workers.`);
    } catch (err) {
        console.error('[CRON] ❌ Error:', err);
    }
}

function startNotificationCron() {
    // Run every minute and check if current time matches notification or call alert time
    cron.schedule('* * * * *', async () => {
        try {
            const settings = await prisma.systemSettings.findFirst();
            if (!settings) return;

            const { hour, minute } = getISTTime();

            // Check notification time
            if (settings.notificationEnabled) {
                const timeParts = (settings.notificationTime || "08:30").split(':');
                const targetHour = parseInt(timeParts[0]);
                const targetMin = parseInt(timeParts[1]);

                if (hour === targetHour && minute === targetMin) {
                    console.log(`[CRON] ⏰ It's ${settings.notificationTime} — triggering daily notifications!`);
                    sendNotifications('notification');
                }
            }

            // Check call alert time
            if (settings.callAlertEnabled && settings.callAlertTime) {
                const callParts = settings.callAlertTime.split(':');
                const callHour = parseInt(callParts[0]);
                const callMin = parseInt(callParts[1]);

                if (hour === callHour && minute === callMin) {
                    console.log(`[CRON] 📞 It's ${settings.callAlertTime} — triggering call alerts!`);
                    sendNotifications('call_alert');
                }
            }
        } catch (err) {
            console.error('[CRON] Error checking schedule:', err);
        }
    });
    console.log('✅ Daily Notification & Call Alert Cron started (checks every minute)');
}

module.exports = { startNotificationCron, sendNotifications };
