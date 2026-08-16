import { ICopilotContext } from "@/types/copilot"
import axios from "axios"
import { createContext, ReactNode, useContext, useState } from "react"
import toast from "react-hot-toast"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

const CopilotContext = createContext<ICopilotContext | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useCopilot = () => {
    const context = useContext(CopilotContext)
    if (context === null) {
        throw new Error(
            "useCopilot must be used within a CopilotContextProvider",
        )
    }
    return context
}

const CopilotContextProvider = ({ children }: { children: ReactNode }) => {
    const [input, setInput] = useState<string>("")
    const [output, setOutput] = useState<string>("")
    const [isRunning, setIsRunning] = useState<boolean>(false)

    const generateCode = async () => {
        try {
            if (input.length === 0) {
                toast.error("Please write a prompt")
                return
            }

            toast.loading("Generating code...")
            setIsRunning(true)
            const response = await axios.post(`${BACKEND_URL}/api/copilot`, {
                prompt: input,
            })
            if (response.data?.content) {
                toast.success("Code generated successfully")
                setOutput(response.data.content)
            }
            setIsRunning(false)
            toast.dismiss()
        } catch (error) {
            console.error(error)
            setIsRunning(false)
            toast.dismiss()
            toast.error("Failed to generate the code")
        }
    }

    return (
        <CopilotContext.Provider
            value={{
                setInput,
                output,
                isRunning,
                generateCode,
            }}
        >
            {children}
        </CopilotContext.Provider>
    )
}

export { CopilotContextProvider }
export default CopilotContext
