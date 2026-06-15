const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function managerOnly(req, res, next) {
    if (!req.user || req.user.role !== 'manager') {
        return res.status(403).json({ error: 'Manager access required' });
    }
    next();
}

function workerOnly(req, res, next) {
    if (!req.user || req.user.role !== 'worker') {
        return res.status(403).json({ error: 'Worker access required' });
    }
    next();
}

module.exports = { verifyToken, managerOnly, workerOnly };
