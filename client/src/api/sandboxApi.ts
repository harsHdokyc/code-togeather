import axios, { AxiosInstance } from "axios"

const sandboxApiBaseUrl = import.meta.env.VITE_SANDBOX_API_URL || "https://sandboxapi.p.rapidapi.com/v1"
const sandboxApiKey = import.meta.env.VITE_SANDBOX_API_KEY || ""

const instance: AxiosInstance = axios.create({
    baseURL: sandboxApiBaseUrl,
    headers: {
        "Content-Type": "application/json",
        "x-rapidapi-key": sandboxApiKey,
        "x-rapidapi-host": "sandboxapi.p.rapidapi.com",
    },
})

export default instance
