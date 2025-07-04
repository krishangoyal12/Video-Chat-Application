const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const cors = require('cors');
const registerSocketHandlers = require('./socket');
require('dotenv').config()

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST'],
  credentials: true
}));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*', // In production, specify actual origin
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000, // Add ping timeout
    transports: ['websocket', 'polling'] // Support both transport methods
});

// Simple connection logging
io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id);
});

registerSocketHandlers(io);

app.get('/', (req, res) => {
    res.send('Video Call Server is running');
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', connections: io.engine.clientsCount });
});

server.on('error', (error) => {
    console.error('Server error:', error);
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${process.env.PORT}`);
});