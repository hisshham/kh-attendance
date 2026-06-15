import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || '/';

let socket = null;

export function getSocket() {
    if (!socket) {
        socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    }
    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
