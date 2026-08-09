import { ReactNode, createContext, useContext, useState, useRef, useEffect } from "react"
import { useSocket } from "./SocketContext"
import { SocketEvent } from "@/types/socket"

interface VideoCallContextType {
    localStream: MediaStream | null
    remoteStreams: Map<string, MediaStream>
    isCallActive: boolean
    isMuted: boolean
    isCameraOff: boolean
    incomingCall: { caller: any } | null
    startCall: () => Promise<void>
    endCall: () => void
    toggleMute: () => void
    toggleCamera: () => void
    acceptCall: () => void
    rejectCall: () => void
}

const VideoCallContext = createContext<VideoCallContextType | null>(null)

export const useVideoCall = () => {
    const context = useContext(VideoCallContext)
    if (!context) {
        throw new Error("useVideoCall must be used within VideoCallProvider")
    }
    return context
}

const VideoCallProvider = ({ children }: { children: ReactNode }) => {
    const { socket } = useSocket()
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
    const [isCallActive, setIsCallActive] = useState(false)
    const [isMuted, setIsMuted] = useState(false)
    const [isCameraOff, setIsCameraOff] = useState(false)
    const [incomingCall, setIncomingCall] = useState<{ caller: any } | null>(null)
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())

    // ponytail: Basic WebRTC setup with STUN servers
    const createPeerConnection = (targetSocketId: string) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
            ],
        })

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit(SocketEvent.VIDEO_CALL_ICE_CANDIDATE, {
                    candidate: event.candidate,
                    targetSocketId,
                })
            }
        }

        pc.ontrack = (event) => {
            setRemoteStreams(prev => new Map(prev).set(targetSocketId, event.streams[0]))
        }

        peerConnectionsRef.current.set(targetSocketId, pc)
        return pc
    }

    const startCall = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            })
            setLocalStream(stream)
            setIsCallActive(true)

            // ponytail: Broadcast call to room
            if (socket) {
                socket.emit(SocketEvent.VIDEO_CALL_BROADCAST)
            }
        } catch (error) {
            console.error("Failed to start call:", error)
        }
    }

    const acceptCall = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            })
            setLocalStream(stream)
            setIsCallActive(true)
            setIncomingCall(null)

            // ponytail: Accept call and establish peer connection with caller
            if (socket && incomingCall) {
                const callerSocketId = incomingCall.caller.socketId
                socket.emit(SocketEvent.VIDEO_CALL_ACCEPT, { callerSocketId })
                
                // Create peer connection and send offer to caller
                const pc = createPeerConnection(callerSocketId)
                stream.getTracks().forEach((track) => pc.addTrack(track, stream))
                
                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                
                socket.emit(SocketEvent.VIDEO_CALL_OFFER, { offer, targetSocketId: callerSocketId })
            }
        } catch (error) {
            console.error("Failed to accept call:", error)
        }
    }

    const rejectCall = () => {
        if (socket && incomingCall) {
            socket.emit(SocketEvent.VIDEO_CALL_REJECT, { callerSocketId: incomingCall.caller.socketId })
        }
        setIncomingCall(null)
    }

    const endCall = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop())
        }
        peerConnectionsRef.current.forEach(pc => pc.close())
        peerConnectionsRef.current.clear()
        setLocalStream(null)
        setRemoteStreams(new Map())
        setIsCallActive(false)
        setIncomingCall(null)
    }

    const toggleMute = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0]
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled
                setIsMuted(!audioTrack.enabled)
            }
        }
    }

    const toggleCamera = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0]
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled
                setIsCameraOff(!videoTrack.enabled)
            }
        }
    }

    // Socket.IO event listeners for WebRTC signaling
    useEffect(() => {
        if (!socket) return

        const handleIncomingCall = ({ caller }: { caller: any }) => {
            setIncomingCall({ caller })
        }

        const handleCallAccept = (_acceptorSocketId: string) => {
            // ponytail: Caller waits for offer from acceptor
        }

        const handleCallOffer = async ({ offer, callerSocketId }: { offer: RTCSessionDescriptionInit, callerSocketId: string }) => {
            // ponytail: This is the caller receiving offer from acceptor
            // Create peer connection for this acceptor
            if (localStream) {
                const pc = createPeerConnection(callerSocketId)
                localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))
                
                await pc.setRemoteDescription(new RTCSessionDescription(offer))
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                socket.emit(SocketEvent.VIDEO_CALL_ANSWER, { answer, targetSocketId: callerSocketId })
            }
        }

        const handleCallAnswer = async ({ answer, targetSocketId }: { answer: RTCSessionDescriptionInit, targetSocketId: string }) => {
            const pc = peerConnectionsRef.current.get(targetSocketId)
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer))
            }
        }

        const handleIceCandidate = async ({ candidate, targetSocketId }: { candidate: RTCIceCandidateInit, targetSocketId: string }) => {
            const pc = peerConnectionsRef.current.get(targetSocketId)
            if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate))
            }
        }

        socket.on(SocketEvent.VIDEO_CALL_INCOMING, handleIncomingCall)
        socket.on(SocketEvent.VIDEO_CALL_ACCEPT, handleCallAccept)
        socket.on(SocketEvent.VIDEO_CALL_OFFER, handleCallOffer)
        socket.on(SocketEvent.VIDEO_CALL_ANSWER, handleCallAnswer)
        socket.on(SocketEvent.VIDEO_CALL_ICE_CANDIDATE, handleIceCandidate)

        return () => {
            socket.off(SocketEvent.VIDEO_CALL_INCOMING, handleIncomingCall)
            socket.off(SocketEvent.VIDEO_CALL_ACCEPT, handleCallAccept)
            socket.off(SocketEvent.VIDEO_CALL_OFFER, handleCallOffer)
            socket.off(SocketEvent.VIDEO_CALL_ANSWER, handleCallAnswer)
            socket.off(SocketEvent.VIDEO_CALL_ICE_CANDIDATE, handleIceCandidate)
        }
    }, [socket, localStream])

    return (
        <VideoCallContext.Provider
            value={{
                localStream,
                remoteStreams,
                isCallActive,
                isMuted,
                isCameraOff,
                incomingCall,
                startCall,
                endCall,
                toggleMute,
                toggleCamera,
                acceptCall,
                rejectCall,
            }}
        >
            {children}
        </VideoCallContext.Provider>
    )
}

export { VideoCallProvider }
export default VideoCallContext
