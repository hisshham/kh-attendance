require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
const { initSocket } = require('./socket');

const workerAuthRoutes = require('./routes/workerAuth');
const managerAuthRoutes = require('./routes/managerAuth');
const tokenRefreshRoutes = require('./routes/tokenRefresh');
const managerRoutes = require('./routes/manager');
const workerRoutes = require('./routes/worker');
const pushRoutes = require('./routes/push');
const { startNotificationCron } = require('./push-cron');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

app.set('prisma', prisma);

// Trust proxy for Render.com / production reverse proxies
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// CORS — support multiple origins
const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP to allow inline styles, fonts, etc.
}));
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/auth/worker', workerAuthRoutes);
app.use('/auth/manager', managerAuthRoutes);
app.use('/auth', tokenRefreshRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/push', pushRoutes);

// Serve static client build in production (single-server deployment)
if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
        res.sendFile(path.join(clientDist, 'index.html'));
    });
}

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const io = initSocket(server, prisma);
app.set('io', io);

// Start Cron
startNotificationCron();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Attendance server running on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   CORS origins: ${allowedOrigins.join(', ')}`);
});

process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    server.close(() => process.exit(0));
});
