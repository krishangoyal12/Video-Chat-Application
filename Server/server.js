const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const cors = require('cors');
const registerSocketHandlers = require('./socket');
require('dotenv').config();

const app = express();

const allowedOrigins = [
  'https://krishan-video-call-app.netlify.app',
  'http://localhost:5173'
];

let frontendUrl = process.env.FRONTEND_URL;
if (frontendUrl) {
  if (!frontendUrl.startsWith('http')) {
    frontendUrl = 'https://' + frontendUrl;
  }
  if (!allowedOrigins.includes(frontendUrl)) {
    allowedOrigins.push(frontendUrl);
  }
}

console.log('CORS allowed origins:', allowedOrigins);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, false);
    }
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        console.log('Socket.IO CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  transports: ['polling', 'websocket']
});

io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id);
});

registerSocketHandlers(io);

app.get('/', (req, res) => {
    res.send('Video Call Server is running');
});

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