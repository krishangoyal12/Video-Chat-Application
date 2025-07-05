import React from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'

export default function LandingPage() {
    const [roomInput, setRoomInput] = useState('')
    const navigate = useNavigate();

    const handleCreateRoom = () => {
        const newRoomId = nanoid(6)
        navigate(`/room/${newRoomId}`)
    }

    const handleJoinRoom = () => {
        let roomId = roomInput.trim()

        if(roomId.includes('/room/')){
            const parts = roomId.split('/room/')
            roomId = parts[1];
        }

        if(roomId){
            navigate(`/room/${roomId}`)
        }
        else{
            alert('Please enter a valid Room ID or link')
        }
    }

    return (
        <div style={styles.container}>
            <h1>WebRTC Video Chat</h1>
            <div style={styles.buttonContainer}>
                <button style={styles.button} onClick={handleCreateRoom}>Create New Room</button>
            </div>
            <div style={styles.joinContainer}>
                <input 
                    style={styles.input}
                    type="text" 
                    value={roomInput} 
                    onChange={(e)=>setRoomInput(e.target.value)} 
                    placeholder='Enter Room ID or Room Link'
                />
                <button style={styles.button} onClick={handleJoinRoom}>Join Room</button>
            </div>
        </div>
    )
}

const styles = {
    container: {
        textAlign: 'center',
        maxWidth: '500px',
        margin: '0 auto',
        padding: '2rem'
    },
    buttonContainer: {
        margin: '2rem 0'
    },
    joinContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
    },
    input: {
        padding: '0.5rem',
        borderRadius: '4px',
        border: '1px solid #ccc',
        fontSize: '1rem'
    },
    button: {
        padding: '0.5rem 1rem',
        cursor: 'pointer',
        borderRadius: '4px'
    }
}