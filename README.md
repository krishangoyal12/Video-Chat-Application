# Real-Time Video Chat Application

This is a full-stack, real-time video and audio chat application built with modern web technologies. It allows multiple users to join a room and communicate via peer-to-peer connections, facilitated by a central signaling server.

## Live Demo

A live version of the application is deployed here: **[https://krishan-video-call-app.netlify.app](https://krishan-video-call-app.netlify.app)**

## Features

- **Real-Time Communication**: High-quality, low-latency video and audio streaming using WebRTC.
- **Room-Based System**: Users can create new, unique rooms or join existing ones using a room ID or a direct link.
- **Dynamic Video Grid**: The layout automatically adjusts to the number of participants in the call for an optimal viewing experience.
- **Media Controls**: Users can mute/unmute their microphone and enable/disable their camera at any time.
- **Active Speaker Detection**: The participant who is currently speaking is highlighted with a visual indicator.
- **Connection Status**: A clear indicator shows the current connection status to the signaling server.
- **Video-Off Avatars**: When a user's video is turned off, an avatar is displayed with their status.
- **Responsive Design**: The UI is fully responsive and works seamlessly on both desktop and mobile devices.

## Tech Stack

The project is a monorepo divided into a `Client` (frontend) and a `Server` (backend).

### Client (Frontend)

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Routing**: [React Router](https://reactrouter.com/)
- **Real-Time Engine**: [Socket.IO Client](https://socket.io/docs/v4/client-api/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Unique IDs**: [UUID](https://github.com/uuidjs/uuid)

### Server (Backend)

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Real-Time Engine**: [Socket.IO](https://socket.io/)
- **CORS**: [node-cors](https://github.com/expressjs/cors)
- **Environment Variables**: [dotenv](https://github.com/motdotla/dotenv)
- **Development**: [Nodemon](https://nodemon.io/)

## Project Structure

```
Video-Call-Application/
├── Client/
│   ├── public/
│   ├── src/
│   │   ├── Pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── Room.css
│   │   │   └── Room.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env
│   ├── netlify.toml
│   ├── package.json
│   └── vite.config.js
│
└── Server/
    ├── .env
    ├── package.json
    ├── server.js
    └── socket.js
```

## Getting Started

Follow these instructions to set up and run the project on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) (v18 or later recommended)
- [npm](https://www.npmjs.com/get-npm) (comes with Node.js)

### Installation & Setup

1.  **Clone the repository:**

    ```sh
    git clone https://github.com/krishangoyal12/Video-Chat-Application
    cd Video-Call-Application
    ```

2.  **Set up the Backend Server:**

    ```
    cd Server
    npm install
    ```

    Create a `.env` file in the `Server` directory and add the following variables:

    ```env
    # Server port
    PORT=8000
    # The URL of your running frontend client
    FRONTEND_URL=http://localhost:5173
    ```

    Now, start the server:

    ```
    npm start
    ```

    The server should now be running at `http://localhost:8000`.

3.  **Set up the Frontend Client:**
    Open a new terminal window.
    ```sh
    cd Client
    npm install
    ```
    Create a `.env` file in the `Client` directory and add the following:
    ```env
    # The URL of your running backend server
    VITE_BACKEND_URL=http://localhost:8000
    ```
    Now, start the client development server:
    ```sh
    npm run dev
    ```
    The application should now be running at `http://localhost:5173`.

## How It Works

The application leverages WebRTC for peer-to-peer media streaming, with a Node.js server acting as a **signaling server** to coordinate connections.

1.  **Joining a Room**: When a user joins a room, the client connects to the Socket.IO server and emits a `join-room` event.
2.  **Signaling**: The server adds the user to a room and notifies them of existing participants. For each existing participant, a new `RTCPeerConnection` is created.
3.  **Peer Connection**: The new user exchanges signaling messages (SDP offers/answers and ICE candidates) with other users in the room via the Socket.IO server. This process, known as the "handshake," establishes a direct peer-to-peer connection.
4.  **Media Streaming**: Once the connection is established, video and audio data are streamed directly between the users' browsers, minimizing latency and server load.
5.  **Disconnection**: When a user leaves, a `disconnect` event is fired, and the server notifies all other room participants to close the corresponding peer connection.

## Deployment

- **Client**: The frontend is deployed on **Netlify**.
- **Server**: The backend server is deployed to **Render**.
