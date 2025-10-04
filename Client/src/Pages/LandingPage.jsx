import React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";
import "./LandingPage.css";

export default function LandingPage() {
  const [roomInput, setRoomInput] = useState("");
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    const newRoomId = nanoid(6);
    navigate(`/room/${newRoomId}`);
  };

  const handleJoinRoom = () => {
    let roomId = roomInput.trim();

    if (roomId.includes("/room/")) {
      const parts = roomId.split("/room/");
      roomId = parts[1];
    }

    if (roomId) {
      navigate(`/room/${roomId}`);
    } else {
      alert("Please enter a valid Room ID or link");
    }
  };

  const onInputKeyDown = (e) => {
    if (e.key === "Enter") {
      handleJoinRoom();
    }
  };

  return (
    <div className="landing">
      <main className="card" role="main">
        <h1 className="title">WebRTC Video Chat</h1>
        <p className="subtitle">Start a secure video call in seconds.</p>

        <div className="actions">
          <input
            className="input"
            type="text"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Enter Room ID or Room Link"
            aria-label="Room ID or Room Link"
          />
          <button
            className="btn btn-secondary"
            onClick={handleJoinRoom}
            aria-label="Join Room"
          >
            Join Room
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreateRoom}
            aria-label="Create New Room"
          >
            Create New Room
          </button>
        </div>
      </main>
    </div>
  );
}
