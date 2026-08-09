interface Language {
    id: string
    name: string
    version: string
    aliases: string[]
    file_extension?: string
    // Keep legacy fields for compatibility
    language?: string
}

interface RunContext {
    setInput: (input: string) => void
    output: string
    isRunning: boolean
    selectedLanguage: Language
    runCode: () => void
}

export { Language, RunContext }
