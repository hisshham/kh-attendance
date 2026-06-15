const { Server } = require('socket.io');

function initSocket(server) {
    const io = new Server(server, {
        cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true },
    });

    // Track online workers
    const onlineWorkers = new Map(); // workerId -> Set of socketIds

    function broadcastOnlineWorkers() {
        const ids = Array.from(onlineWorkers.keys());
        io.to('manager').emit('online_workers', ids);
    }

    io.on('connection', (socket) => {
        socket.on('join_manager', () => {
            socket.join('manager');
            // Send current online workers immediately
            const ids = Array.from(onlineWorkers.keys());
            socket.emit('online_workers', ids);
        });

        socket.on('worker_online', (workerId) => {
            if (!workerId) return;
            socket._workerId = workerId;
            if (!onlineWorkers.has(workerId)) {
                onlineWorkers.set(workerId, new Set());
            }
            onlineWorkers.get(workerId).add(socket.id);
            broadcastOnlineWorkers();
        });

        socket.on('worker_offline', (workerId) => {
            if (!workerId) return;
            if (onlineWorkers.has(workerId)) {
                onlineWorkers.get(workerId).delete(socket.id);
                if (onlineWorkers.get(workerId).size === 0) {
                    onlineWorkers.delete(workerId);
                }
            }
            broadcastOnlineWorkers();
        });

        socket.on('disconnect', () => {
            const workerId = socket._workerId;
            if (workerId && onlineWorkers.has(workerId)) {
                onlineWorkers.get(workerId).delete(socket.id);
                if (onlineWorkers.get(workerId).size === 0) {
                    onlineWorkers.delete(workerId);
                }
                broadcastOnlineWorkers();
            }
        });
    });

    return io;
}

module.exports = { initSocket };
