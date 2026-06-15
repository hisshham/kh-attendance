const { Server } = require('socket.io');

function initSocket(server) {
    const io = new Server(server, {
        cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true },
    });

    io.on('connection', (socket) => {
        socket.on('join_manager', () => {
            socket.join('manager');
        });
        socket.on('disconnect', () => { });
    });

    return io;
}

module.exports = { initSocket };
