import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const socket = io("http://localhost:8000", {
  transports: ["polling"],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  forceNew: true,
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

  const iceConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
    iceCandidatePoolSize: 10,
  };

  // Socket and WebRTC setup (existing code unchanged)
  useEffect(() => {
    socket.on("connect", () => setConnectionStatus("connected"));
    socket.on("connect_error", () => setConnectionStatus("error"));
    socket.on("disconnect", () => setConnectionStatus("disconnected"));

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
    };
  }, []);

  useEffect(() => {
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
        setupSocket();
      } catch {
        alert("Camera/Microphone access is required for video calling.");
      }
    };

    initMedia();

    return () => {
      socket.disconnect();
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => track.stop());
      }
      Object.values(peerConnections.current).forEach((pc) => pc.close());
    };
    // eslint-disable-next-line
  }, []);

  const setupSocket = () => {
    // Existing socket setup code - unchanged
    socket.off("all-users");
    socket.off("user-joined");
    socket.off("signal");
    socket.off("user-disconnected");

    if (!socket.connected) {
      setTimeout(() => {
        if (!socket.connected) setConnectionStatus("error");
      }, 5000);

      socket.once("connect", () => {
        socket.emit("join-room", roomId);
      });
    } else {
      socket.emit("join-room", roomId);
    }

    socket.on("all-users", async (users) => {
      setRemoteUsers(users);
      for (const userId of users) {
        if (!peerConnections.current[userId]) {
          await createPeerConnection(userId);
          const offer = await peerConnections.current[userId].createOffer();
          await peerConnections.current[userId].setLocalDescription(offer);
          socket.emit("signal", {
            to: userId,
            data: { type: "offer", sdp: offer },
          });
        }
      }
    });

    socket.on("user-joined", async (userId) => {
      setRemoteUsers((prev) => [...prev, userId]);
      if (!peerConnections.current[userId]) {
        await createPeerConnection(userId);
      }
    });

    socket.on("signal", async ({ from, data }) => {
      let pc = peerConnections.current[from];
      if (!pc) {
        await createPeerConnection(from);
        pc = peerConnections.current[from];
      }

      if (data.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("signal", {
          to: from,
          data: { type: "answer", sdp: answer },
        });
      }

      if (data.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }

      if (data.type === "candidate") {
        try {
          const candidate = new RTCIceCandidate(data.candidate);
          await pc.addIceCandidate(candidate);
        } catch {}
      }
    });

    socket.on("user-disconnected", (userId) => {
      if (peerConnections.current[userId]) {
        peerConnections.current[userId].close();
        delete peerConnections.current[userId];
      }
      if (remoteStreams.current[userId]) {
        delete remoteStreams.current[userId];
      }
      setRemoteUsers((prev) => prev.filter((id) => id !== userId));
    });
  };

  const createPeerConnection = async (remoteUserId) => {
    const pc = new RTCPeerConnection(iceConfig);
    peerConnections.current[remoteUserId] = pc;

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStreams.current[remoteUserId] = event.streams[0];
        setRemoteUsers((prev) => [...prev]); // trigger re-render
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

    pc.onconnectionstatechange = () => {
      setPeerConnectionStatus(pc.connectionState);
    };
  };

  const handleHangUp = () => {
    navigate("/");
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};
    remoteStreams.current = {};
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setRemoteUsers([]);
    setPeerConnectionStatus("waiting");
  };

  // Helper function to determine grid layout based on participant count
  const getGridLayout = () => {
    const totalParticipants = remoteUsers.length + 1; // +1 for local user
    
    // Determine optimal grid dimensions
    if (totalParticipants <= 1) {
      return {
        gridTemplateColumns: "1fr",
        gridTemplateRows: "1fr"
      };
    } else if (totalParticipants <= 2) {
      return {
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr"
      };
    } else if (totalParticipants <= 4) {
      return {
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr"
      };
    } else if (totalParticipants <= 9) {
      return {
        gridTemplateColumns: "1fr 1fr 1fr",
        gridTemplateRows: "repeat(auto-fit, 1fr)"
      };
    } else if (totalParticipants <= 16) {
      return {
        gridTemplateColumns: "1fr 1fr 1fr 1fr",
        gridTemplateRows: "repeat(auto-fit, 1fr)"
      };
    } else {
      return {
        gridTemplateColumns: "repeat(5, 1fr)",
        gridTemplateRows: "repeat(auto-fit, 1fr)"
      };
    }
  };

  // Helper function to calculate video size based on participant count
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
            "❌ Connection error! Make sure server is running on port 8000."}
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

      {/* Grid video container */}
      <div style={{
        display: "grid",
        ...getGridLayout(),
        gap: "10px",
        marginTop: "1rem",
        minHeight: "50vh",
        maxHeight: "75vh",
        overflow: "hidden"
      }}>
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
              ...styles.video,
              ...getVideoSize()
            }}
          />
        </div>

        {/* Remote users videos */}
        {remoteUsers.map((userId) => (
          <div key={userId} style={styles.videoCard}>
            <div style={styles.videoLabelContainer}>
              <span style={styles.videoLabel}>User {userId.substring(0, 8)}...</span>
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
                ...styles.video,
                ...getVideoSize()
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
  }
};