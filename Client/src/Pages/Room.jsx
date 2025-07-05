import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { Mic, MicOff, Video, VideoOff, Phone } from "lucide-react";
import "./Room.css";

const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [remoteVideoStatus, setRemoteVideoStatus] = useState({});

  // Refs
  const localVideoRef = useRef();
  const localStream = useRef(null);
  const peerConnections = useRef({});
  const remoteVideoRefs = useRef({});
  const audioContextRef = useRef(null);
  const analysersRef = useRef({});

  // Effect to handle window resizing
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Audio level detection setup
  const setupAudioAnalyser = (userId, stream) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }

    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 32;
    const source = audioContextRef.current.createMediaStreamSource(stream);
    source.connect(analyser);
    analysersRef.current[userId] = analyser;
  };

  // Detect active speaker
  useEffect(() => {
    if (Object.keys(analysersRef.current).length === 0) return;

    const interval = setInterval(() => {
      const dataArray = new Uint8Array(32);
      let maxVolume = 0;
      let loudestUserId = null;

      Object.entries(analysersRef.current).forEach(([userId, analyser]) => {
        analyser.getByteFrequencyData(dataArray);
        const volume = Math.max(...dataArray);

        if (volume > maxVolume && volume > 30) {
          // Threshold to avoid false positives
          maxVolume = volume;
          loudestUserId = userId;
        }
      });

      setActiveSpeaker(loudestUserId);
    }, 200);

    return () => clearInterval(interval);
  }, [remoteUsers]);

  const createPeerConnection = useCallback((remoteUserId) => {
    if (peerConnections.current[remoteUserId]) return;

    const pc = new RTCPeerConnection(iceConfig);
    peerConnections.current[remoteUserId] = pc;

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        if (remoteVideoRefs.current[remoteUserId]) {
          remoteVideoRefs.current[remoteUserId].srcObject = event.streams[0];
          setupAudioAnalyser(remoteUserId, event.streams[0]);
        }
        const videoTrack = event.streams[0].getVideoTracks()[0];
        if (videoTrack) {
          setRemoteVideoStatus((prev) => ({
            ...prev,
            [remoteUserId]: videoTrack.enabled,
          }));
          videoTrack.onmute = () => {
            setRemoteVideoStatus((prev) => ({
              ...prev,
              [remoteUserId]: false,
            }));
          };
          videoTrack.onunmute = () => {
            setRemoteVideoStatus((prev) => ({ ...prev, [remoteUserId]: true }));
          };
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
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        if (peerConnections.current[remoteUserId]) {
          peerConnections.current[remoteUserId].close();
          delete peerConnections.current[remoteUserId];
        }
        setRemoteUsers((prev) => prev.filter((id) => id !== remoteUserId));
        delete analysersRef.current[remoteUserId];
        setRemoteVideoStatus((prev) => {
          const newStatus = { ...prev };
          delete newStatus[remoteUserId];
          return newStatus;
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        if (socket.id > remoteUserId) {
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
        setupAudioAnalyser("local", stream);
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
      setConnectionStatus("connected");
      socket.emit("join-room", roomId);
    };

    const onDisconnect = () => {
      setConnectionStatus("disconnected");
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      peerConnections.current = {};
      setRemoteUsers([]);
      analysersRef.current = {};
    };

    const onAllUsers = (users) => {
      setRemoteUsers(users);
      users.forEach((userId) => createPeerConnection(userId));
    };

    const onUserJoined = (userId) => {
      setRemoteUsers((prev) => [...prev, userId]);
      createPeerConnection(userId);
    };

    const onUserDisconnected = (userId) => {
      if (peerConnections.current[userId]) {
        peerConnections.current[userId].close();
        delete peerConnections.current[userId];
      }
      setRemoteUsers((prev) => prev.filter((id) => id !== userId));
      delete analysersRef.current[userId];
      setRemoteVideoStatus((prev) => {
        const newStatus = { ...prev };
        delete newStatus[userId];
        return newStatus;
      });
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
      if (audioContextRef.current) {
        audioContextRef.current.close();
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

  const getGridClass = () => {
    const totalParticipants = remoteUsers.length + 1;
    if (totalParticipants <= 1) return "participants-1";
    if (totalParticipants === 2) return "participants-2";
    if (totalParticipants === 3) return "participants-3";
    if (totalParticipants === 4) return "participants-4";
    if (totalParticipants <= 6) return "participants-6";
    if (totalParticipants <= 9) return "participants-9";
    return "participants-many";
  };

  const getVideoTileClass = (userId) => {
    let classes = "video-tile";
    if (userId === "local") classes += " local";
    if (activeSpeaker === userId) classes += " active-speaker";
    return classes;
  };

  const getVideoClass = (userId) => {
    let classes = "video-element";
    if (userId === "local") classes += " local";
    if (activeSpeaker && activeSpeaker !== userId && userId !== "local")
      classes += " dimmed";
    return classes;
  };

  return (
    <div className="room-container">
      <div className="room-header">
        <h2 className="room-title">Room Id: {roomId}</h2>
        <div className={`status-indicator ${connectionStatus}`}>
          <div className={`status-dot ${connectionStatus}`} />
          {connectionStatus === "connected" ? "Connected" : "Connecting..."}
        </div>
      </div>

      <div className={`video-grid ${getGridClass()}`}>
        {/* Local video */}
        <div className={getVideoTileClass("local")}>
          {!isVideoEnabled && <div className="video-avatar">You</div>}
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={getVideoClass("local")}
            style={{ display: isVideoEnabled ? "block" : "none" }}
          />
          <div className="video-label">
            <span className="video-name">You</span>
            <span className={`video-status ${isMuted ? "muted" : "active"}`}>
              {isMuted ? (
                <>
                  <MicOff size={12} /> Muted
                </>
              ) : (
                <>
                  <Mic size={12} /> Active
                </>
              )}
            </span>
          </div>
        </div>

        {/* Remote videos */}
        {remoteUsers.map((userId) => (
          <div key={userId} className={getVideoTileClass(userId)}>
            {remoteVideoStatus[userId] === false && (
              <div className="video-avatar">
                <VideoOff size={isMobile ? 24 : 32} />
              </div>
            )}
            <video
              ref={(el) => (remoteVideoRefs.current[userId] = el)}
              autoPlay
              playsInline
              className={getVideoClass(userId)}
              style={{
                display: remoteVideoStatus[userId] !== false ? "block" : "none",
              }}
            />
            <div className="video-label">
              <span className="video-name">User {userId.substring(0, 6)}</span>
              {activeSpeaker === userId && (
                <span className="video-status speaking">
                  <Mic size={12} /> Speaking
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="controls-container">
        <button
          onClick={toggleAudio}
          className={`control-button mute ${isMuted ? "muted" : ""}`}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          {isMuted ? "Unmute" : "Mute"}
        </button>

        <button
          onClick={toggleVideo}
          className={`control-button video ${
            !isVideoEnabled ? "disabled" : ""
          }`}
          aria-label={isVideoEnabled ? "Stop Video" : "Start Video"}
        >
          {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          {isVideoEnabled ? "Stop Video" : "Start Video"}
        </button>

        <button
          onClick={handleHangUp}
          className="control-button hangup"
          aria-label="Hang Up"
        >
          <Phone size={20} />
          Hang Up
        </button>
      </div>
    </div>
  );
}
