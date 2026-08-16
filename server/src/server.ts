import express, { Response, Request } from "express"
import dotenv from "dotenv"
import http from "http"
import cors from "cors"
import { SocketEvent, SocketId } from "./types/socket"
import { USER_CONNECTION_STATUS, User } from "./types/user"
import { Server } from "socket.io"
import path from "path"

// Resolve from server root so the key loads even if cwd isn't server/
dotenv.config({ path: path.join(__dirname, "..", ".env") })

const app = express()

app.use(express.json())

app.use(cors())

app.use(express.static(path.join(__dirname, "public"))) // Serve static files

const server = http.createServer(app)
const io = new Server(server, {
	cors: {
		origin: "*",
	},
	maxHttpBufferSize: 1e8,
	pingTimeout: 60000,
})

let userSocketMap: User[] = []

// Function to get all users in a room
function getUsersInRoom(roomId: string): User[] {
	return userSocketMap.filter((user) => user.roomId == roomId)
}

// Function to get room id by socket id
function getRoomId(socketId: SocketId): string | null {
	const roomId = userSocketMap.find(
		(user) => user.socketId === socketId
	)?.roomId

	if (!roomId) {
		console.error("Room ID is undefined for socket ID:", socketId)
		return null
	}
	return roomId
}

function getUserBySocketId(socketId: SocketId): User | null {
	const user = userSocketMap.find((user) => user.socketId === socketId)
	if (!user) {
		console.error("User not found for socket ID:", socketId)
		return null
	}
	return user
}

io.on("connection", (socket) => {
	// Handle user actions
	socket.on(SocketEvent.JOIN_REQUEST, ({ roomId, username }) => {
		// Check is username exist in the room
		const isUsernameExist = getUsersInRoom(roomId).filter(
			(u) => u.username === username
		)
		if (isUsernameExist.length > 0) {
			io.to(socket.id).emit(SocketEvent.USERNAME_EXISTS)
			return
		}

		const user = {
			username,
			roomId,
			status: USER_CONNECTION_STATUS.ONLINE,
			cursorPosition: 0,
			typing: false,
			socketId: socket.id,
			currentFile: null,
		}
		userSocketMap.push(user)
		socket.join(roomId)
		socket.broadcast.to(roomId).emit(SocketEvent.USER_JOINED, { user })
		const users = getUsersInRoom(roomId)
		io.to(socket.id).emit(SocketEvent.JOIN_ACCEPTED, { user, users })
	})

	socket.on("disconnecting", () => {
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.USER_DISCONNECTED, { user })
		userSocketMap = userSocketMap.filter((u) => u.socketId !== socket.id)
		socket.leave(roomId)
	})

	// Handle file actions
	socket.on(
		SocketEvent.SYNC_FILE_STRUCTURE,
		({ fileStructure, openFiles, activeFile, socketId }) => {
			io.to(socketId).emit(SocketEvent.SYNC_FILE_STRUCTURE, {
				fileStructure,
				openFiles,
				activeFile,
			})
		}
	)

	socket.on(
		SocketEvent.DIRECTORY_CREATED,
		({ parentDirId, newDirectory }) => {
			const roomId = getRoomId(socket.id)
			if (!roomId) return
			socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_CREATED, {
				parentDirId,
				newDirectory,
			})
		}
	)

	socket.on(SocketEvent.DIRECTORY_UPDATED, ({ dirId, children }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_UPDATED, {
			dirId,
			children,
		})
	})

	socket.on(SocketEvent.DIRECTORY_RENAMED, ({ dirId, newName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_RENAMED, {
			dirId,
			newName,
		})
	})

	socket.on(SocketEvent.DIRECTORY_DELETED, ({ dirId }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.DIRECTORY_DELETED, { dirId })
	})

	socket.on(SocketEvent.FILE_CREATED, ({ parentDirId, newFile }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.FILE_CREATED, { parentDirId, newFile })
	})

	socket.on(SocketEvent.FILE_UPDATED, ({ fileId, newContent }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_UPDATED, {
			fileId,
			newContent,
		})
	})

	socket.on(SocketEvent.FILE_RENAMED, ({ fileId, newName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_RENAMED, {
			fileId,
			newName,
		})
	})

	socket.on(SocketEvent.FILE_DELETED, ({ fileId }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_DELETED, { fileId })
	})

	// Handle user status
	socket.on(SocketEvent.USER_OFFLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.OFFLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_OFFLINE, { socketId })
	})

	socket.on(SocketEvent.USER_ONLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.ONLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_ONLINE, { socketId })
	})

	// Handle chat actions
	socket.on(SocketEvent.SEND_MESSAGE, ({ message }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.RECEIVE_MESSAGE, { message })
	})

	// Handle cursor position and selection
	socket.on(SocketEvent.TYPING_START, ({ cursorPosition, selectionStart, selectionEnd }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return {
					...user,
					typing: true,
					cursorPosition,
					selectionStart,
					selectionEnd
				}
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_START, { user })
	})

	socket.on(SocketEvent.TYPING_PAUSE, () => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, typing: false }
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_PAUSE, { user })
	})

	// Handle cursor movement without typing
	socket.on(SocketEvent.CURSOR_MOVE, ({ cursorPosition, selectionStart, selectionEnd }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return {
					...user,
					cursorPosition,
					selectionStart,
					selectionEnd
				}
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.CURSOR_MOVE, { user })
	})

	socket.on(SocketEvent.REQUEST_DRAWING, () => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.REQUEST_DRAWING, { socketId: socket.id })
	})

	socket.on(SocketEvent.SYNC_DRAWING, ({ drawingData, socketId }) => {
		socket.broadcast
			.to(socketId)
			.emit(SocketEvent.SYNC_DRAWING, { drawingData })
	})

	socket.on(SocketEvent.DRAWING_UPDATE, ({ snapshot }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DRAWING_UPDATE, {
			snapshot,
		})
	})

	// WebRTC signaling for video calls
	socket.on(SocketEvent.VIDEO_CALL_OFFER, ({ offer, targetSocketId }) => {
		io.to(targetSocketId).emit(SocketEvent.VIDEO_CALL_OFFER, { offer, callerSocketId: socket.id })
	})

	socket.on(SocketEvent.VIDEO_CALL_ANSWER, ({ answer, targetSocketId }) => {
		io.to(targetSocketId).emit(SocketEvent.VIDEO_CALL_ANSWER, { answer })
	})

	socket.on(SocketEvent.VIDEO_CALL_ICE_CANDIDATE, ({ candidate, targetSocketId }) => {
		io.to(targetSocketId).emit(SocketEvent.VIDEO_CALL_ICE_CANDIDATE, { candidate })
	})

	socket.on(SocketEvent.VIDEO_CALL_END, ({ targetSocketId }) => {
		io.to(targetSocketId).emit(SocketEvent.VIDEO_CALL_END)
	})

	// Broadcast call to all room members
	socket.on(SocketEvent.VIDEO_CALL_BROADCAST, () => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		const users = getUsersInRoom(roomId)
		const caller = getUserBySocketId(socket.id)
		if (!caller) return
		
		// Send incoming call to all other users in room
		users.forEach(user => {
			if (user.socketId !== socket.id) {
				io.to(user.socketId).emit(SocketEvent.VIDEO_CALL_INCOMING, { caller })
			}
		})
	})

	// Handle call acceptance
	socket.on(SocketEvent.VIDEO_CALL_ACCEPT, ({ callerSocketId }) => {
		io.to(callerSocketId).emit(SocketEvent.VIDEO_CALL_ACCEPT, { acceptorSocketId: socket.id })
	})

	// Handle call rejection
	socket.on(SocketEvent.VIDEO_CALL_REJECT, ({ callerSocketId }) => {
		io.to(callerSocketId).emit(SocketEvent.VIDEO_CALL_REJECT, { rejectorSocketId: socket.id })
	})
})

const PORT = process.env.PORT || 3000
// Output is pasted/replaced into the active file after fence stripping — keep it paste-ready.
const COPILOT_SYSTEM_PROMPT = `You are Code Sync Copilot: a lazy senior engineer embedded in a collaborative code editor. Lazy means efficient, not careless. The best code is the code never written.

Before writing, climb this ladder and stop at the first rung that holds:
1. YAGNI — skip anything the prompt did not ask for.
2. Prefer stdlib / language builtins over inventing helpers.
3. Prefer one clear function or snippet over new abstractions, classes, or frameworks.
4. Prefer the shortest correct solution; if two approaches are the same size, pick the edge-case-correct one.
5. Only then write the minimum working code.

Output contract (strict):
- Reply with ONLY a single Markdown fenced code block. Language tag required (js, ts, py, java, cpp, go, rs, html, css, sql, bash, …).
- No prose before or after the fence. No "here's the code", no bullet lists, no step-by-step.
- Code must be paste-ready into a file as-is: no placeholders like TODO/FIXME unless the user asked for stubs; no fake imports the snippet does not use.
- Match the language, style, and APIs the user named. If they paste existing code, patch that — do not rewrite the whole file unless they asked to replace it.
- Validate inputs at trust boundaries; handle errors that would lose data or crash silently. Skip decorative try/catch and comments that restate the code.
- Non-trivial logic: leave ONE tiny runnable check (assert, self-check call, or equivalent) that fails if the logic breaks. Trivial one-liners need none.
- Deliberate shortcuts with a known ceiling (naive O(n²), global lock, etc.): mark with a short \`// ponytail: <ceiling>; upgrade: <path>\` comment.
- Never invent APIs, package versions, or env vars. Prefer boring, widely available patterns.
- If the request is impossible, unsafe (secrets, malware, credential theft), or too vague to write real code, reply with exactly: I don't know`

// Proxy OpenRouter so COPILOT_API_KEY never leaves the server
app.post("/api/copilot", async (req: Request, res: Response) => {
	const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : ""
	if (!prompt) {
		res.status(400).json({ error: "Prompt required" })
		return
	}

	const apiKey = process.env.COPILOT_API_KEY
	if (!apiKey) {
		res.status(500).json({ error: "Copilot not configured" })
		return
	}

	try {
		const response = await fetch(
			"https://openrouter.ai/api/v1/chat/completions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
					"HTTP-Referer": "https://github.com/harsHdokyc/code-togeather",
					"X-OpenRouter-Title": "Code Sync",
				},
				body: JSON.stringify({
					model: "openai/gpt-4o-mini",
					messages: [
						{ role: "system", content: COPILOT_SYSTEM_PROMPT },
						{ role: "user", content: prompt },
					],
				}),
			}
		)

		if (!response.ok) {
			console.error("OpenRouter error:", await response.text())
			res.status(502).json({ error: "OpenRouter request failed" })
			return
		}

		const data = (await response.json()) as {
			choices?: { message?: { content?: string } }[]
		}
		const content = data.choices?.[0]?.message?.content
		if (!content) {
			res.status(502).json({ error: "Empty response from model" })
			return
		}

		res.json({ content })
	} catch (error) {
		console.error(error)
		res.status(500).json({ error: "Failed to generate code" })
	}
})

app.get("/", (req: Request, res: Response) => {
	// Send the index.html file
	res.sendFile(path.join(__dirname, "..", "public", "index.html"))
})

server.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`)
})
