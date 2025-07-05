import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

// Use environment variable with fallback for local development
const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
console.log("Using backend URL:", baseUrl);

// Create socket but don't connect immediately
const socket = io(baseUrl, {
  transports: ["polling", "websocket"],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  autoConnect: false,
  // Remove withCredentials for local testing - can cause CORS issues
});

export default function Room() {
  const { roomId } = useParams();
  const localVideoRef = useRef();
  const localStream = useRef(null);
  const peerConnections = useRef({});
  const remoteStreams = useRef({});
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [peerConnectionStatus, setPeerConnectionStatus] = useState("waiting");
  const navigate = useNavigate();

  // Keep track of whether socket event listeners have been set up
  const socketSetupDone = useRef(false);

  const iceConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.l.google.com:5349" },
      { urls: "stun:stun1.l.google.com:3478" },
      { urls: "stun:stun1.l.google.com:5349" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:5349" },
      { urls: "stun:stun3.l.google.com:3478" },
      { urls: "stun:stun3.l.google.com:5349" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:5349" },
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
    iceCandidatePoolSize: 10,
  };

  // Debug socket connection
  useEffect(() => {
    console.log("Room component initialized. Room ID:", roomId);

    // Add connection logging
    const handleConnect = () => {
      console.log("Socket connected successfully. ID:", socket.id);
      setConnectionStatus("connected");
    };

    const handleConnectError = (err) => {
      console.error("Socket connection error:", err);
      setConnectionStatus("error");
    };

    const handleDisconnect = (reason) => {
      console.log("Socket disconnected:", reason);
      setConnectionStatus("disconnected");
    };

    // Connect socket
    socket.connect();

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  // Handle page unload/navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log("Page unloading, cleaning up connection");
      socket.emit("leave-room");
      socket.disconnect();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Setup socket events and media
  useEffect(() => {
    // Make sure we don't set up socket events multiple times
    if (!socketSetupDone.current) {
      setupSocket();
      socketSetupDone.current = true;
    }

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStream.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Only join room after media is ready and socket is connected
        if (socket.connected) {
          console.log("Joining room:", roomId);
          socket.emit("join-room", roomId);
        } else {
          console.log("Socket not connected, waiting to join room");
          const checkConnInterval = setInterval(() => {
            if (socket.connected) {
              console.log("Socket now connected, joining room:", roomId);
              socket.emit("join-room", roomId);
              clearInterval(checkConnInterval);
            }
          }, 1000);

          // Clear interval after 10 seconds if no connection
          setTimeout(() => clearInterval(checkConnInterval), 10000);
        }
      } catch (err) {
        console.error("Media error:", err);
        alert("Camera/Microphone access is required for video calling.");
      }
    };

    initMedia();

    return () => {
      console.log("Cleaning up room effect");
      socket.emit("leave-room");

      // Don't disconnect socket here - we'll handle that on actual component unmount
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => track.stop());
      }
      Object.values(peerConnections.current).forEach((pc) => pc.close());
    };
  }, [roomId]);

  // Debug active connections
  useEffect(() => {
    const debugInterval = setInterval(() => {
      console.log(
        "Active peer connections:",
        Object.keys(peerConnections.current)
      );
      console.log("Remote users:", remoteUsers);
    }, 10000);

    return () => clearInterval(debugInterval);
  }, [remoteUsers]);

  const setupSocket = () => {
    console.log("Setting up socket event listeners");

    // Remove any existing listeners to prevent duplicates
    socket.off("all-users");
    socket.off("user-joined");
    socket.off("signal");
    socket.off("user-disconnected");

    socket.on("all-users", async (users) => {
      console.log(
        `Received existing users: ${users.length ? users.join(", ") : "none"}`
      );

      // Update remote users list (filter out any users that don't exist)
      const validUsers = users.filter((id) => id && id !== socket.id);
      setRemoteUsers(validUsers);

      // Create connections for new users
      for (const userId of validUsers) {
        // Skip if connection already exists
        if (peerConnections.current[userId]) {
          console.log(`Connection to ${userId} already exists, skipping`);
          continue;
        }

        console.log(`Creating connection for user ${userId}`);
        const pc = await createPeerConnection(userId);

        try {
          // Only create offer if we have local stream
          if (!localStream.current) {
            console.warn("No local stream available for creating offer");
            continue;
          }

          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);

          console.log(`Sending offer to ${userId}`);
          socket.emit("signal", {
            to: userId,
            data: { type: "offer", sdp: offer },
          });
        } catch (err) {
          console.error(`Error creating offer for ${userId}:`, err);
        }
      }
    });

    socket.on("user-joined", async (userId) => {
      console.log(`User ${userId} joined the room`);

      // Don't add ourselves or duplicate users
      if (userId === socket.id || remoteUsers.includes(userId)) {
        return;
      }

      // Update remote users list
      setRemoteUsers((prev) => [...prev, userId]);

      // Create peer connection if it doesn't exist
      if (!peerConnections.current[userId]) {
        await createPeerConnection(userId);
      }
    });

    socket.on("signal", async ({ from, data }) => {
      // Don't process signals from ourselves
      if (from === socket.id) return;

      try {
        let pc = peerConnections.current[from];
        if (!pc) {
          console.log(`Creating new peer connection for ${from}`);
          pc = await createPeerConnection(from);
        }

        if (data.type === "offer") {
          console.log(`Processing offer from ${from}`);
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

          if (!localStream.current) {
            console.warn("No local stream available for creating answer");
            return;
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          console.log(`Sending answer to ${from}`);
          socket.emit("signal", {
            to: from,
            data: { type: "answer", sdp: answer },
          });
        } else if (data.type === "answer") {
          console.log(`Processing answer from ${from}`);
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } else if (data.type === "candidate") {
          console.log(`Processing ICE candidate from ${from}`);
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            // Only ignore if we're not connected yet
            if (pc.signalingState !== "closed") {
              console.warn(`Error adding ICE candidate:`, err);
            }
          }
        }
      } catch (err) {
        console.error(`Error handling signal from ${from}:`, err);
      }
    });

    socket.on("user-disconnected", (userId) => {
      console.log(`User ${userId} disconnected`);

      // Clean up peer connection
      if (peerConnections.current[userId]) {
        peerConnections.current[userId].close();
        delete peerConnections.current[userId];
      }

      // Clean up remote stream
      if (remoteStreams.current[userId]) {
        delete remoteStreams.current[userId];
      }

      // Update UI
      setRemoteUsers((prev) => prev.filter((id) => id !== userId));
    });
  };

  const createPeerConnection = async (remoteUserId) => {
    console.log(`Creating peer connection for ${remoteUserId}`);

    // Check if connection already exists
    if (peerConnections.current[remoteUserId]) {
      peerConnections.current[remoteUserId].close();
    }

    const pc = new RTCPeerConnection(iceConfig);
    peerConnections.current[remoteUserId] = pc;

    // Add tracks from local stream
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });
    }

    pc.ontrack = (event) => {
      console.log(`Received track from ${remoteUserId}`);
      if (event.streams && event.streams[0]) {
        remoteStreams.current[remoteUserId] = event.streams[0];
        // Force UI update
        setRemoteUsers((prev) => [...prev]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", {
          to: remoteUserId,
          data: {
            type: "candidate",
            candidate: event.candidate,
          },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(
        `ICE connection state with ${remoteUserId}: ${pc.iceConnectionState}`
      );
      if (pc.iceConnectionState === "failed") {
        console.log(`ICE connection failed with ${remoteUserId}, restarting`);
        pc.restartIce();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(
        `Connection state with ${remoteUserId}: ${pc.connectionState}`
      );

      // Update UI connection status based on peer connections
      const allPeerConnections = Object.values(peerConnections.current);
      if (
        allPeerConnections.some((conn) => conn.connectionState === "connected")
      ) {
        setPeerConnectionStatus("connected");
      } else if (
        allPeerConnections.some((conn) => conn.connectionState === "connecting")
      ) {
        setPeerConnectionStatus("connecting");
      } else if (
        allPeerConnections.some((conn) => conn.connectionState === "failed")
      ) {
        setPeerConnectionStatus("failed");
      } else {
        setPeerConnectionStatus("waiting");
      }

      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        console.log(
          `Connection to ${remoteUserId} ${pc.connectionState}, attempting reconnect`
        );
        setTimeout(() => {
          if (peerConnections.current[remoteUserId] === pc) {
            pc.close();
            delete peerConnections.current[remoteUserId];
            createPeerConnection(remoteUserId);
          }
        }, 2000);
      }
    };

    return pc;
  };

  const handleHangUp = () => {
    socket.emit("leave-room");
    navigate("/");

    // Clean up resources
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};
    remoteStreams.current = {};

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setRemoteUsers([]);
    setPeerConnectionStatus("waiting");
  };

  const getGridLayout = () => {
    const totalParticipants = remoteUsers.length + 1;

    if (totalParticipants <= 1) {
      return {
        gridTemplateColumns: "1fr",
        gridTemplateRows: "1fr",
      };
    } else if (totalParticipants <= 2) {
      return {
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr",
      };
    } else if (totalParticipants <= 4) {
      return {
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
      };
    } else if (totalParticipants <= 9) {
      return {
        gridTemplateColumns: "1fr 1fr 1fr",
        gridTemplateRows: "repeat(auto-fit, 1fr)",
      };
    } else if (totalParticipants <= 16) {
      return {
        gridTemplateColumns: "1fr 1fr 1fr 1fr",
        gridTemplateRows: "repeat(auto-fit, 1fr)",
      };
    } else {
      return {
        gridTemplateColumns: "repeat(5, 1fr)",
        gridTemplateRows: "repeat(auto-fit, 1fr)",
      };
    }
  };

  const getVideoSize = () => {
    const totalParticipants = remoteUsers.length + 1;
    if (totalParticipants <= 1) {
      return { width: "100%", height: "auto", maxHeight: "70vh" };
    } else if (totalParticipants <= 4) {
      return { width: "100%", height: "auto", maxHeight: "40vh" };
    } else if (totalParticipants <= 9) {
      return { width: "100%", height: "auto", maxHeight: "30vh" };
    } else {
      return { width: "100%", height: "auto", maxHeight: "25vh" };
    }
  };

  return (
    <div style={styles.container}>
      <h2>Room: {roomId}</h2>

      {connectionStatus !== "connected" && (
        <div
          style={{
            padding: "10px",
            backgroundColor:
              connectionStatus === "error" ? "#ffcccc" : "#ffffcc",
            borderRadius: "5px",
            marginBottom: "10px",
          }}
        >
          {connectionStatus === "connecting" && "⏳ Connecting to server..."}
          {connectionStatus === "error" &&
            `❌ Connection error! Make sure server is running at ${baseUrl}`}
          {connectionStatus === "disconnected" &&
            "🔌 Disconnected from server. Trying to reconnect..."}
        </div>
      )}

      <div
        style={{
          padding: "10px",
          backgroundColor:
            peerConnectionStatus === "connected"
              ? "#d4edda"
              : peerConnectionStatus === "connecting"
              ? "#fff3cd"
              : peerConnectionStatus === "failed"
              ? "#f8d7da"
              : "#f8f9fa",
          borderRadius: "5px",
          marginBottom: "10px",
        }}
      >
        {peerConnectionStatus === "connected"
          ? `🟢 Connected to ${remoteUsers.length} peer(s)`
          : peerConnectionStatus === "connecting"
          ? "🟡 Connecting to peer(s)..."
          : peerConnectionStatus === "failed"
          ? "🔴 Connection failed"
          : "⚪ Waiting for other participants..."}
      </div>

      <div
        style={{
          display: "grid",
          ...getGridLayout(),
          gap: "10px",
          marginTop: "1rem",
          minHeight: "50vh",
          maxHeight: "75vh",
          overflow: "hidden",
        }}
      >
        {/* Local user video */}
        <div style={styles.videoCard}>
          <div style={styles.videoLabelContainer}>
            <span style={styles.videoLabel}>You</span>
          </div>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              ...styles.localVideo,
              ...getVideoSize(),
            }}
          />
        </div>

        {/* Remote users videos */}
        {remoteUsers.map((userId) => (
          <div key={userId} style={styles.videoCard}>
            <div style={styles.videoLabelContainer}>
              <span style={styles.videoLabel}>
                User {userId.substring(0, 8)}...
              </span>
            </div>
            <video
              ref={(el) => {
                if (el && remoteStreams.current[userId]) {
                  el.srcObject = remoteStreams.current[userId];
                }
              }}
              autoPlay
              playsInline
              style={{
                ...styles.remoteVideo,
                ...getVideoSize(),
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <button
          onClick={handleHangUp}
          style={{
            padding: "0.75rem 2rem",
            background: "#e74c3c",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Hang Up
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "1rem",
    fontFamily: "sans-serif",
    height: "100vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  videoCard: {
    position: "relative",
    backgroundColor: "#1a1a1a",
    borderRadius: "8px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  video: {
    objectFit: "contain",
    borderRadius: "4px",
    backgroundColor: "#000",
  },
  videoLabelContainer: {
    position: "absolute",
    bottom: "10px",
    left: "10px",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: "4px 8px",
    borderRadius: "4px",
    zIndex: 1,
  },
  videoLabel: {
    color: "white",
    fontSize: "0.8rem",
  },
  localVideo: {
    objectFit: "contain",
    borderRadius: "4px",
    backgroundColor: "#000",
    transform: "scaleX(-1)",
  },

  remoteVideo: {
    objectFit: "contain",
    borderRadius: "4px",
    backgroundColor: "#000",
    transform: "scaleX(-1)",
  },
};
