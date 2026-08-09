import axiosInstance from "@/api/sandboxApi"
import { Language, RunContext as RunContextType } from "@/types/run"
import langMap from "lang-map"
import {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react"
import toast from "react-hot-toast"
import { useFileSystem } from "./FileContext"

const RunCodeContext = createContext<RunContextType | null>(null)

export const useRunCode = () => {
    const context = useContext(RunCodeContext)
    if (context === null) {
        throw new Error(
            "useRunCode must be used within a RunCodeContextProvider",
        )
    }
    return context
}

const RunCodeContextProvider = ({ children }: { children: ReactNode }) => {
    const { activeFile } = useFileSystem()
    const [input, setInput] = useState<string>("")
    const [output, setOutput] = useState<string>("")
    const [isRunning, setIsRunning] = useState<boolean>(false)
    const [supportedLanguages, setSupportedLanguages] = useState<Language[]>([])
    const [selectedLanguage, setSelectedLanguage] = useState<Language>({
        id: "",
        name: "",
        version: "",
        aliases: [],
        language: "",
    })

    useEffect(() => {
        const fetchSupportedLanguages = async () => {
            try {
                const response = await axiosInstance.get("/languages")
                const languages = response.data?.languages && Array.isArray(response.data.languages) ? response.data.languages : []
                setSupportedLanguages(languages)
            } catch (error: any) {
                toast.error("Failed to fetch supported languages")
                if (error?.response?.data) console.error(error?.response?.data)
            }
        }

        fetchSupportedLanguages()
    }, [])

    // Set the selected language based on the file extension
    useEffect(() => {
        if (!Array.isArray(supportedLanguages) || supportedLanguages.length === 0 || !activeFile?.name) return

        const extension = activeFile.name.split(".").pop()
        if (!extension) {
            setSelectedLanguage({ id: "", name: "", version: "", aliases: [], language: "" })
            return
        }

        // Direct extension to language mapping for SandboxAPI (using id field)
        const extensionToLanguage: Record<string, string> = {
            'js': 'javascript',
            'ts': 'typescript',
            'py': 'python3',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'cs': 'csharp',
            'go': 'go',
            'rs': 'rust',
            'rb': 'ruby',
            'php': 'php',
            'swift': 'swift',
            'kt': 'kotlin',
            'sh': 'bash',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'xml': 'xml',
            'sql': 'sql',
            'r': 'r',
            'scala': 'scala',
            'lua': 'lua',
            'dart': 'dart',
            'elixir': 'elixir',
            'haskell': 'haskell',
        }

        const targetLanguage = extensionToLanguage[extension.toLowerCase()]
        
        if (targetLanguage) {
            const language = supportedLanguages.find(
                (lang) => lang.id?.toLowerCase() === targetLanguage.toLowerCase()
            )
            if (language) setSelectedLanguage(language)
        } else {
            // Fallback to langMap
            const languageName = langMap.languages(extension)
            const language = supportedLanguages.find(
                (lang) => languageName?.includes(lang.name?.toLowerCase())
            )
            if (language) setSelectedLanguage(language)
        }
    }, [activeFile?.name, supportedLanguages])

    const runCode = async () => {
        try {
            if (!selectedLanguage || !selectedLanguage.id) {
                return toast.error("Please select a valid language to run the code")
            } else if (!activeFile) {
                return toast.error("Please open a file to run the code")
            } else {
                toast.loading("Running code...")
            }

            setIsRunning(true)
            const { id, version } = selectedLanguage

            const response = await axiosInstance.post("/execute", {
                language: id,
                version,
                code: activeFile.content,
                stdin: input,
            })
            // SandboxAPI response format: { stdout: string, stderr: string, exitCode: number }
            if (response.data.stderr) {
                setOutput(response.data.stderr)
            } else {
                setOutput(response.data.stdout)
            }
            setIsRunning(false)
            toast.dismiss()
        } catch (error: any) {
            console.error("API Error:", error.response?.data)
            setIsRunning(false)
            toast.dismiss()
            toast.error("Failed to run the code")
        }
    }

    return (
        <RunCodeContext.Provider
            value={{
                setInput,
                output,
                isRunning,
                selectedLanguage,
                runCode,
            }}
        >
            {children}
        </RunCodeContext.Provider>
    )
}

export { RunCodeContextProvider }
export default RunCodeContext
