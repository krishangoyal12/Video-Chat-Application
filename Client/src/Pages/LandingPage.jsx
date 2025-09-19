import React from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { Video, Users, Zap, Shield, ArrowRight, Sparkles, Menu, X } from 'lucide-react'

export default function LandingPage() {
    const [roomInput, setRoomInput] = useState('')
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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

    const features = [
        {
            icon: Video,
            title: "Crystal Clear Video",
            description: "High-definition video calls with adaptive quality"
        },
        {
            icon: Users,
            title: "Multi-participant",
            description: "Connect with multiple people simultaneously"
        },
        {
            icon: Zap,
            title: "Instant Connection",
            description: "No downloads, no waiting - join instantly"
        },
        {
            icon: Shield,
            title: "Secure & Private",
            description: "End-to-end encrypted conversations"
        }
    ]

    return (
        <div className="min-h-screen flex flex-col">
            {/* Background Pattern */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float"></div>
                <div className="absolute top-40 right-10 w-96 h-96 bg-accent-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse" style={{animationDelay: '2s'}}></div>
                <div className="absolute -bottom-32 left-20 w-80 h-80 bg-primary-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float" style={{animationDelay: '4s'}}></div>
            </div>

            {/* Header */}
            <header className="relative z-10 py-6">
                <div className="container">
                    <nav className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary-gradient rounded-lg flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-display font-bold text-gradient">Nexus</span>
                        </div>
                        <div className="hidden md:flex items-center gap-6">
                            <a href="#features" className="text-gray-600 hover:text-primary-600 transition-colors">Features</a>
                            <a href="#about" className="text-gray-600 hover:text-primary-600 transition-colors">About</a>
                            <button className="btn btn-glass">
                                Sign In
                            </button>
                        </div>
                        
                        {/* Mobile menu button */}
                        <button 
                            className="md:hidden p-2 text-gray-600 hover:text-primary-600 transition-colors"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                        
                        {/* Mobile menu */}
                        {mobileMenuOpen && (
                            <div className="absolute top-full left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 p-4 md:hidden">
                                <div className="flex flex-col gap-4">
                                    <a href="#features" className="text-gray-600 hover:text-primary-600 transition-colors">Features</a>
                                    <a href="#about" className="text-gray-600 hover:text-primary-600 transition-colors">About</a>
                                    <button className="btn btn-glass w-full">
                                        Sign In
                                    </button>
                                </div>
                            </div>
                        )}
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <main className="flex-1 flex items-center">
                <div className="container">
                    <div className="max-w-4xl mx-auto text-center">
                        {/* Hero Content */}
                        <div className="animate-fade-in-up">
                            <h1 className="text-6xl md:text-7xl font-display font-bold text-gradient mb-6 leading-tight">
                                Connect Beyond
                                <br />
                                <span className="text-accent-gradient">Boundaries</span>
                            </h1>
                            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
                                Experience seamless video conversations with cutting-edge technology. 
                                No downloads, no limits, just pure connection.
                            </p>
                        </div>

                        {/* Action Cards */}
                        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-16 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
                            {/* Create Room Card */}
                            <div className="card p-8 text-left group hover:scale-105 transition-transform">
                                <div className="w-12 h-12 bg-primary-gradient rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Video className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-xl font-display font-semibold mb-2">Start New Room</h3>
                                <p className="text-gray-600 mb-6">Create an instant room and invite others to join your conversation.</p>
                                <button 
                                    className="btn btn-primary w-full group"
                                    onClick={handleCreateRoom}
                                >
                                    Create Room
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>

                            {/* Join Room Card */}
                            <div className="card p-8 text-left group hover:scale-105 transition-transform">
                                <div className="w-12 h-12 bg-accent-gradient rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Users className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-xl font-display font-semibold mb-2">Join Room</h3>
                                <p className="text-gray-600 mb-4">Enter a room ID or paste a room link to join an existing conversation.</p>
                                <div className="space-y-3">
                                    <input 
                                        className="input"
                                        type="text" 
                                        value={roomInput} 
                                        onChange={(e)=>setRoomInput(e.target.value)} 
                                        placeholder='Enter Room ID or Room Link'
                                        onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                                    />
                                    <button 
                                        className="btn btn-accent w-full group"
                                        onClick={handleJoinRoom}
                                    >
                                        Join Room
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Features Grid */}
                        <div id="features" className="grid md:grid-cols-4 gap-6 mb-16 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
                            {features.map((feature, index) => (
                                <div key={index} className="text-center group">
                                    <div className="w-16 h-16 bg-glass-bg border border-glass-border rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform backdrop-filter backdrop-blur-16">
                                        <feature.icon className="w-8 h-8 text-primary-600" />
                                    </div>
                                    <h4 className="font-display font-semibold mb-2">{feature.title}</h4>
                                    <p className="text-sm text-gray-600">{feature.description}</p>
                                </div>
                            ))}
                        </div>

                        {/* CTA Section */}
                        <div className="animate-fade-in-up" style={{animationDelay: '0.6s'}}>
                            <p className="text-gray-500 mb-4">
                                Trusted by thousands of users worldwide
                            </p>
                            <div className="flex justify-center items-center gap-4 text-sm text-gray-400">
                                <span>✓ No registration required</span>
                                <span>✓ Free to use</span>
                                <span>✓ Secure & private</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 py-8">
                <div className="container">
                    <div className="text-center text-gray-500">
                        <p>&copy; 2025 Nexus. Crafted with care for seamless connections.</p>
                    </div>
                </div>
            </footer>
        </div>
    )
}