function registerSocketHandlers(io) {
    // Store active rooms and their participants
    const rooms = new Map();

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);
        let currentRoomId = null;

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

        // Handle disconnection
        socket.on('disconnect', () => {
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
        });
    });
}

module.exports = registerSocketHandlers;