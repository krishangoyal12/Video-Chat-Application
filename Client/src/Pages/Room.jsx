import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

// Use environment variable with fallback for local development
const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

// Create socket instance outside component to prevent re-creation
const socket = io(baseUrl, {
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 3000,
});

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  // State variables
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  // Refs for WebRTC and component state
  const localVideoRef = useRef();
  const localStream = useRef(null);
  const peerConnections = useRef({});
  const remoteVideoRefs = useRef({});

  // ICE server configuration
  const iceConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
  };

  const createPeerConnection = useCallback((remoteUserId) => {
    console.log(`Creating peer connection for ${remoteUserId}`);
    if (peerConnections.current[remoteUserId]) {
      console.log(`Connection for ${remoteUserId} already exists.`);
      return;
    }

    const pc = new RTCPeerConnection(iceConfig);
    peerConnections.current[remoteUserId] = pc;

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });
    }

    pc.ontrack = (event) => {
      console.log(`Received track from ${remoteUserId}`);
      if (event.streams && event.streams[0]) {
        if (remoteVideoRefs.current[remoteUserId]) {
          remoteVideoRefs.current[remoteUserId].srcObject = event.streams[0];
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", {
          to: remoteUserId,
          data: { type: "candidate", candidate: event.candidate },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(
        `Connection state with ${remoteUserId}: ${pc.connectionState}`
      );
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        console.log(`Connection with ${remoteUserId} lost.`);
        if (peerConnections.current[remoteUserId]) {
          peerConnections.current[remoteUserId].close();
          delete peerConnections.current[remoteUserId];
        }
        setRemoteUsers((prev) => prev.filter((id) => id !== remoteUserId));
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        if (socket.id > remoteUserId) {
          console.log(`Negotiation needed. Creating offer for ${remoteUserId}`);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("signal", {
            to: remoteUserId,
            data: { type: "offer", sdp: pc.localDescription },
          });
        }
      } catch (err) {
        console.error("Error during negotiation:", err);
      }
    };
  }, []);

  useEffect(() => {
    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        localStream.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        socket.connect();
      } catch (err) {
        console.error("Failed to get media:", err);
        alert(
          "Camera and microphone access is required. Please allow access and refresh."
        );
        navigate("/");
      }
    };

    const onConnect = () => {
      console.log("Socket connected:", socket.id);
      setConnectionStatus("connected");
      socket.emit("join-room", roomId);
    };

    const onDisconnect = () => {
      console.log("Socket disconnected");
      setConnectionStatus("disconnected");
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      peerConnections.current = {};
      setRemoteUsers([]);
    };

    const onAllUsers = (users) => {
      console.log("Received all users:", users);
      setRemoteUsers(users);
      users.forEach((userId) => createPeerConnection(userId));
    };

    const onUserJoined = (userId) => {
      console.log("User joined:", userId);
      setRemoteUsers((prev) => [...prev, userId]);
      createPeerConnection(userId);
    };

    const onUserDisconnected = (userId) => {
      console.log("User disconnected:", userId);
      if (peerConnections.current[userId]) {
        peerConnections.current[userId].close();
        delete peerConnections.current[userId];
      }
      setRemoteUsers((prev) => prev.filter((id) => id !== userId));
    };

    const onSignal = async ({ from, data }) => {
      const pc = peerConnections.current[from];
      if (!pc) return;

      try {
        if (data.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("signal", {
            to: from,
            data: { type: "answer", sdp: pc.localDescription },
          });
        } else if (data.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } else if (data.type === "candidate") {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error("Error handling signal:", err);
      }
    };

    setupMedia();

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("all-users", onAllUsers);
    socket.on("user-joined", onUserJoined);
    socket.on("user-disconnected", onUserDisconnected);
    socket.on("signal", onSignal);

    return () => {
      console.log("Cleaning up Room component.");
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => track.stop());
      }
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("all-users", onAllUsers);
      socket.off("user-joined", onUserJoined);
      socket.off("user-disconnected", onUserDisconnected);
      socket.off("signal", onSignal);
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [roomId, navigate, createPeerConnection]);

  const handleHangUp = () => {
    socket.disconnect();
    navigate("/");
  };

  const toggleAudio = () => {
    if (localStream.current) {
      localStream.current
        .getAudioTracks()
        .forEach((track) => (track.enabled = !track.enabled));
      setIsMuted((prev) => !prev);
    }
  };

  const toggleVideo = () => {
    if (localStream.current) {
      localStream.current
        .getVideoTracks()
        .forEach((track) => (track.enabled = !track.enabled));
      setIsVideoEnabled((prev) => !prev);
    }
  };

  const getGridLayout = (userCount) => {
    const total = userCount + 1;
    if (total <= 2) return { gridTemplateColumns: `repeat(${total}, 1fr)` };
    if (total <= 4)
      return { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" };
    const columns = Math.ceil(Math.sqrt(total));
    return { gridTemplateColumns: `repeat(${columns}, 1fr)` };
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>Room: {roomId.substring(0, 8)}...</h2>
        <div style={styles.statusBox}>
          {connectionStatus === "connected"
            ? "✅ Connected"
            : "⏳ Connecting..."}
        </div>
      </div>

      <div
        style={{ ...styles.videoGrid, ...getGridLayout(remoteUsers.length) }}
      >
        <div style={styles.videoCard}>
          {!isVideoEnabled && <div style={styles.avatar}>You</div>}
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              ...styles.video,
              ...styles.localVideo,
              display: isVideoEnabled ? "block" : "none",
            }}
          />
          <div style={styles.videoLabel}>
            <span>You</span>
            <span style={styles.micIcon}>{isMuted ? "🔇" : "🎤"}</span>
          </div>
        </div>
        {remoteUsers.map((userId) => (
          <div key={userId} style={styles.videoCard}>
            <video
              ref={(el) => (remoteVideoRefs.current[userId] = el)}
              autoPlay
              playsInline
              style={styles.video}
            />
            <div style={styles.videoLabel}>
              <span>User {userId.substring(0, 6)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.controls}>
        <button
          onClick={toggleAudio}
          style={{
            ...styles.controlButton,
            background: isMuted ? "#5f6368" : "#3c4043",
          }}
        >
          {isMuted ? "Unmute" : "Mute"}
        </button>
        <button
          onClick={toggleVideo}
          style={{
            ...styles.controlButton,
            background: !isVideoEnabled ? "#5f6368" : "#3c4043",
          }}
        >
          {isVideoEnabled ? "Cam Off" : "Cam On"}
        </button>
        <button
          onClick={handleHangUp}
          style={{ ...styles.controlButton, ...styles.hangUpButton }}
        >
          Hang Up
        </button>
      </div>
    </div>
  );
}

// --- Styles ---
const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "#202124",
    color: "#fff",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem",
  },
  statusBox: {
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    background: "rgba(255, 255, 255, 0.1)",
    fontSize: "0.9rem",
  },
  videoGrid: {
    flex: 1,
    display: "grid",
    gap: "1rem",
    padding: "1rem",
    overflow: "hidden",
  },
  videoCard: {
    position: "relative",
    background: "#3c4043",
    borderRadius: "12px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  video: { width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" },
  localVideo: { transform: "scaleX(-1)" },
  avatar: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: "50%",
    background: "#5f6368",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "2rem",
  },
  videoLabel: {
    position: "absolute",
    bottom: "0",
    left: "0",
    width: "100%",
    padding: "8px",
    boxSizing: "border-box",
    background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  micIcon: {
    background: "rgba(0,0,0,0.5)",
    padding: "4px",
    borderRadius: "50%",
  },
  controls: {
    padding: "1rem",
    textAlign: "center",
    background: "rgba(0,0,0,0.2)",
    display: "flex",
    justifyContent: "center",
    gap: "1rem",
  },
  controlButton: {
    padding: "0.75rem 1.5rem",
    color: "#fff",
    border: "none",
    borderRadius: "50px",
    fontSize: "1rem",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
  },
  hangUpButton: { background: "#ea4335" },
};
