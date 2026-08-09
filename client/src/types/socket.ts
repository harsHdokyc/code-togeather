import { Socket } from "socket.io-client"

type SocketId = string

enum SocketEvent {
    JOIN_REQUEST = "join-request",
    JOIN_ACCEPTED = "join-accepted",
    USER_JOINED = "user-joined",
    USER_DISCONNECTED = "user-disconnected",
    SYNC_FILE_STRUCTURE = "sync-file-structure",
    DIRECTORY_CREATED = "directory-created",
    DIRECTORY_UPDATED = "directory-updated",
    DIRECTORY_RENAMED = "directory-renamed",
    DIRECTORY_DELETED = "directory-deleted",
    FILE_CREATED = "file-created",
    FILE_UPDATED = "file-updated",
    FILE_RENAMED = "file-renamed",
    FILE_DELETED = "file-deleted",
    USER_OFFLINE = "offline",
    USER_ONLINE = "online",
    SEND_MESSAGE = "send-message",
    RECEIVE_MESSAGE = "receive-message",
    TYPING_START = "typing-start",
    TYPING_PAUSE = "typing-pause",
    CURSOR_MOVE = "cursor-move",
    USERNAME_EXISTS = "username-exists",
    REQUEST_DRAWING = "request-drawing",
    SYNC_DRAWING = "sync-drawing",
    DRAWING_UPDATE = "drawing-update",
    // WebRTC signaling events for video calls
    VIDEO_CALL_OFFER = "video-call-offer",
    VIDEO_CALL_ANSWER = "video-call-answer",
    VIDEO_CALL_ICE_CANDIDATE = "video-call-ice-candidate",
    VIDEO_CALL_END = "video-call-end",
    // Broadcast call events
    VIDEO_CALL_BROADCAST = "video-call-broadcast",
    VIDEO_CALL_ACCEPT = "video-call-accept",
    VIDEO_CALL_REJECT = "video-call-reject",
    VIDEO_CALL_INCOMING = "video-call-incoming",
}

interface SocketContext {
    socket: Socket
}

export { SocketEvent, SocketContext, SocketId }
