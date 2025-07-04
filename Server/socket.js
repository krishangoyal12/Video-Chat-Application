function registerSocketHandlers(io) {
    // Store active rooms and their participants
    const rooms = new Map();
    // Track last activity time for each socket
    const lastActivity = new Map();
    // Track connection info for identifying duplicates
    const connectionInfo = new Map();

    // Clean up stale connections every minute
    setInterval(() => {
        const now = Date.now();
        lastActivity.forEach((lastActiveTime, socketId) => {
            // If inactive for more than 45 seconds
            if (now - lastActiveTime > 45000) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    console.log(`🧹 Cleaning up stale connection: ${socketId}`);
                    socket.disconnect(true);
                }
                lastActivity.delete(socketId);
                connectionInfo.delete(socketId);
            }
        });
    }, 60000);

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);
        let currentRoomId = null;
        lastActivity.set(socket.id, Date.now());
        
        // Store connection info for identifying duplicates
        connectionInfo.set(socket.id, {
            ip: socket.handshake.address,
            userAgent: socket.handshake.headers['user-agent'],
        });

        // Update activity timestamp on any event
        socket.onAny(() => {
            lastActivity.set(socket.id, Date.now());
        });

        // Join room event
        socket.on('join-room', (roomId) => {
            console.log(`📥 ${socket.id} joined room ${roomId}`);
            currentRoomId = roomId;
            socket.join(roomId);

            // Track room participants
            if (!rooms.has(roomId)) {
                rooms.set(roomId, new Set());
            }
            const room = rooms.get(roomId);
            
            // Clean up any ghost connections from the same client
            const currentInfo = connectionInfo.get(socket.id);
            if (currentInfo) {
                const socketsToRemove = [];
                
                // Find any other sockets from the same client in this room
                room.forEach(existingId => {
                    if (existingId !== socket.id) {
                        const existingInfo = connectionInfo.get(existingId);
                        // If same IP and user agent, likely same client
                        if (existingInfo && 
                            existingInfo.ip === currentInfo.ip && 
                            existingInfo.userAgent === currentInfo.userAgent) {
                            socketsToRemove.push(existingId);
                        }
                    }
                });
                
                // Remove ghost connections
                socketsToRemove.forEach(id => {
                    console.log(`🔄 Removing ghost connection ${id} for client ${socket.id}`);
                    room.delete(id);
                    connectionInfo.delete(id);
                    lastActivity.delete(id);
                    socket.to(roomId).emit('user-disconnected', id);
                    
                    // Force disconnect if socket still exists
                    const ghostSocket = io.sockets.sockets.get(id);
                    if (ghostSocket) {
                        ghostSocket.disconnect(true);
                    }
                });
            }
            
            // Send the list of existing users to the new user
            const otherUsers = Array.from(room);
            socket.emit('all-users', otherUsers);

            room.add(socket.id);

            // Notify others in the room
            socket.to(roomId).emit('user-joined', socket.id);

            console.log(`Room ${roomId} has ${room.size} participants`);
        });

        // WebRTC signaling
        socket.on('signal', ({ to, data }) => {
            io.to(to).emit('signal', { from: socket.id, data });
        });
        
        // Explicit leave-room event
        socket.on('leave-room', () => {
            handleDisconnect();
        });

        // Handle disconnection
        const handleDisconnect = () => {
            console.log(`❌ ${socket.id} disconnected`);
            if (currentRoomId) {
                const room = rooms.get(currentRoomId);
                if (room) {
                    room.delete(socket.id);
                    socket.to(currentRoomId).emit('user-disconnected', socket.id);
                    if (room.size === 0) {
                        rooms.delete(currentRoomId);
                    } else {
                        console.log(`Room ${currentRoomId} has ${room.size} participants remaining`);
                    }
                }
            }
            lastActivity.delete(socket.id);
            connectionInfo.delete(socket.id);
        };

        socket.on('disconnect', handleDisconnect);
    });
}

module.exports = registerSocketHandlers;