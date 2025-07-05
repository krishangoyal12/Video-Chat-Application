function registerSocketHandlers(io) {
    // Store active rooms and their participants
    const rooms = new Map();

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);
        let currentRoomId = null;

        // Acknowledge client heartbeats to keep connection alive
        socket.on('heartbeat', () => {
            socket.emit('heartbeat-ack');
        });

        // Join room event
        socket.on('join-room', (roomId) => {
            // Leave any previous room
            if (currentRoomId) {
                socket.leave(currentRoomId);
                const prevRoom = rooms.get(currentRoomId);
                if (prevRoom) {
                    prevRoom.delete(socket.id);
                    socket.to(currentRoomId).emit('user-disconnected', socket.id);
                }
            }
            
            console.log(`📥 ${socket.id} joined room ${roomId}`);
            currentRoomId = roomId;
            socket.join(roomId);

            // Initialize room if it doesn't exist
            if (!rooms.has(roomId)) {
                rooms.set(roomId, new Set());
            }
            const room = rooms.get(roomId);
            
            // Send the list of existing users to the new user
            const otherUsers = Array.from(room);
            socket.emit('all-users', otherUsers);

            // Add the new user to the room and notify others
            room.add(socket.id);
            socket.to(roomId).emit('user-joined', socket.id);

            console.log(`Room ${roomId} has ${room.size} participants:`, Array.from(room));
        });

        // WebRTC signaling
        socket.on('signal', ({ to, from, data }) => {
            // Ensure 'from' is the sender's socket.id for security
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
                        console.log(`🗑️ Deleting empty room: ${currentRoomId}`);
                        rooms.delete(currentRoomId);
                    } else {
                        console.log(`Room ${currentRoomId} has ${room.size} participants remaining`);
                    }
                }
            }
        };

        socket.on('disconnect', handleDisconnect);
    });
}

module.exports = registerSocketHandlers;