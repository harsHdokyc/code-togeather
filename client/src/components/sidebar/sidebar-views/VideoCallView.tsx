import { useVideoCall } from "@/context/VideoCallContext"
import { useState, useRef, useEffect } from "react"
import { LuMic, LuMicOff, LuVideo, LuVideoOff, LuPhoneOff } from "react-icons/lu"

function VideoCallView() {
    const { localStream, remoteStreams, isCallActive, isMuted, isCameraOff, incomingCall, startCall, endCall, toggleMute, toggleCamera, acceptCall, rejectCall } = useVideoCall()
    const [position, setPosition] = useState({ x: 20, y: 20 })
    const [isDragging, setIsDragging] = useState(false)
    const dragRef = useRef<HTMLDivElement>(null)
    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map())

    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream
        }
    }, [localStream])

    useEffect(() => {
        remoteStreams.forEach((stream, socketId) => {
            const videoEl = remoteVideosRef.current.get(socketId)
            if (videoEl) {
                videoEl.srcObject = stream
            }
        })
    }, [remoteStreams])

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true)
        const startX = e.clientX - position.x
        const startY = e.clientY - position.y

        const handleMouseMove = (e: MouseEvent) => {
            setPosition({
                x: e.clientX - startX,
                y: e.clientY - startY,
            })
        }

        const handleMouseUp = () => {
            setIsDragging(false)
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    const handleStartCall = () => {
        startCall()
    }

    // Incoming call UI
    if (incomingCall) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-white">
                <h2 className="text-xl font-bold">Incoming Call</h2>
                <p className="text-gray-400">{incomingCall.caller.username} is calling...</p>
                <div className="flex gap-4">
                    <button
                        onClick={acceptCall}
                        className="rounded-lg bg-green-500 px-6 py-3 font-bold text-white hover:bg-green-600"
                    >
                        Accept
                    </button>
                    <button
                        onClick={rejectCall}
                        className="rounded-lg bg-red-500 px-6 py-3 font-bold text-white hover:bg-red-600"
                    >
                        Reject
                    </button>
                </div>
            </div>
        )
    }

    if (!isCallActive) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-white">
                <h2 className="text-xl font-bold">Video Call</h2>
                <p className="text-gray-400">Start a video call with room participants</p>
                <button
                    onClick={handleStartCall}
                    className="rounded-lg bg-primary px-6 py-3 font-bold text-black hover:bg-primary/90"
                >
                    Start Call
                </button>
            </div>
        )
    }

    const remoteStreamArray = Array.from(remoteStreams.values())

    return (
        <div className="relative h-full w-full">
            {/* Draggable video call window */}
            <div
                ref={dragRef}
                className="absolute right-4 top-4 flex w-80 flex-col rounded-lg bg-darkHover shadow-2xl"
                style={{
                    left: position.x,
                    top: position.y,
                    cursor: isDragging ? 'grabbing' : 'grab',
                }}
                onMouseDown={handleMouseDown}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-darkHover px-4 py-2">
                    <span className="text-sm font-semibold text-white">Video Call ({remoteStreamArray.length + 1})</span>
                    <button
                        onClick={endCall}
                        className="text-red-500 hover:text-red-400"
                    >
                        <LuPhoneOff size={20} />
                    </button>
                </div>

                {/* Video area */}
                <div className="relative aspect-video bg-black">
                    {remoteStreamArray.length > 0 ? (
                        <video
                            ref={el => {
                                if (el) remoteVideosRef.current.set('main', el)
                            }}
                            autoPlay
                            playsInline
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center text-white">
                            Waiting for participants...
                        </div>
                    )}
                    {/* Local video picture-in-picture */}
                    {localStream && (
                        <div className="absolute bottom-2 right-2 h-24 w-32 overflow-hidden rounded-lg border-2 border-white">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="h-full w-full object-cover"
                            />
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-around border-t border-darkHover px-4 py-3">
                    <button
                        onClick={toggleMute}
                        className={`rounded-full p-3 ${isMuted ? 'bg-red-500' : 'bg-gray-600'} hover:opacity-80`}
                    >
                        {isMuted ? <LuMicOff size={20} color="white" /> : <LuMic size={20} color="white" />}
                    </button>
                    <button
                        onClick={toggleCamera}
                        className={`rounded-full p-3 ${isCameraOff ? 'bg-red-500' : 'bg-gray-600'} hover:opacity-80`}
                    >
                        {isCameraOff ? <LuVideoOff size={20} color="white" /> : <LuVideo size={20} color="white" />}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default VideoCallView
