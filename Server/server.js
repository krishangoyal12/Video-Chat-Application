const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const cors = require('cors');
const registerSocketHandlers = require('./socket');
require('dotenv').config()

const app = express();

// Define allowed origins as an array with complete URLs
const allowedOrigins = [
  'https://krishan-video-call-app.netlify.app',
  'http://localhost:5173'
];

// Get frontend URL from environment, with protocol
let frontendUrl = process.env.FRONTEND_URL;
if (frontendUrl) {
  if (!frontendUrl.startsWith('http')) {
    frontendUrl = 'https://' + frontendUrl;
  }
  // Add to allowed origins if not already there
  if (!allowedOrigins.includes(frontendUrl)) {
    allowedOrigins.push(frontendUrl);
  }
}

// Log configuration for debugging
console.log('CORS allowed origins:', allowedOrigins);

// Configure Express CORS
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

const server = http.createServer(app);

// Configure Socket.IO CORS (needs to be exact same format)
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    transports: ['polling', 'websocket']
});

// Simple connection logging
io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id);
});

registerSocketHandlers(io);

app.get('/', (req, res) => {
    res.send('Video Call Server is running');
});

// Health check endpoint with CORS info
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        connections: io.engine.clientsCount,
        allowedOrigins: allowedOrigins 
    });
});

server.on('error', (error) => {
    console.error('Server error:', error);
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`CORS configured for: ${allowedOrigins.join(', ')}`);
});