import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, AlertCircle, Lightbulb, FileText, Copy } from 'lucide-react'

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

export function LiveView() {
    const [isListening, setIsListening] = useState(false)
    const [transcript, setTranscript] = useState<string[]>([])
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [error, setError] = useState<string | null>(null)
    const [kbContext, setKbContext] = useState<string>('')

    const recognitionRef = useRef<any>(null)

    useEffect(() => {
        // Fetch local context on mount
        const fetchContext = async () => {
            try {
                const contextRes = await fetch('http://localhost:3000/api/context')
                if (contextRes.ok) {
                    const data = await contextRes.json()
                    const kbItems = (data.knowledgeItems || []).map((item: any) => {
                        const type = item.metadata?.type || 'note'
                        const cap = type === 'document' ? 500 : Infinity
                        return `[${type}] ${item.content.slice(0, cap)}`
                    })
                    setKbContext(kbItems.slice(0, 10).join('\n'))
                }
            } catch (err) {
                console.log("Local dashboard not reachable. Skipping context.")
            }
        }
        fetchContext()
    }, [])

    const generateSuggestion = async (query: string) => {
        try {
            const response = await fetch('http://localhost:3000/api/research/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemPrompt: kbContext,
                    messages: [{ role: 'user', content: query }],
                }),
            })
            if (!response.ok) throw new Error('Local dashboard is unavailable.')
            const suggestion = (await response.json()).content
            if (suggestion) {
                setSuggestions(prev => [{ id: Date.now(), content: suggestion, metadata: { type: 'AI Suggestion' } }, ...prev].slice(0, 5))
            }
        } catch (err) {
            console.error("AI Suggestion Error", err)
        }
    }

    const copyTranscript = () => {
        if (transcript.length === 0) return
        navigator.clipboard.writeText(transcript.join('\n'))
        alert("Transcript copied to clipboard!")
        setTranscript([])
        setSuggestions([])
        setIsListening(false)
    }

    useEffect(() => {
        if (!SpeechRecognition) {
            setError("Browser does not support Speech Recognition.")
            return
        }

        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcriptSegment = event.results[i][0].transcript
                if (event.results[i].isFinal) {
                    setTranscript(prev => [...prev, transcriptSegment])
                    generateSuggestion(transcriptSegment)
                }
            }
        }

        recognition.onerror = (event: any) => {
            if (event.error !== 'no-speech') {
                console.error("Speech Error", event.error)
                setError(event.error)
                setIsListening(false)
            }
        }

        recognition.onend = () => {
            if (isListening) {
                setIsListening(false)
            }
        }

        recognitionRef.current = recognition

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort()
            }
        }
    }, [])

    const toggleListening = () => {
        if (!SpeechRecognition) {
            setError("Browser does not support Speech Recognition.")
            return
        }
        if (!recognitionRef.current) return

        if (isListening) {
            recognitionRef.current.stop()
            setIsListening(false)
        } else {
            setError(null)
            try {
                recognitionRef.current.start()
                recognitionRef.current._startTime = Date.now()
                setIsListening(true)
            } catch (err) {
                console.error(err)
            }
        }
    }

    return (
        <div className="flex flex-col h-full bg-background text-foreground">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/50 bg-card flex justify-between items-center shrink-0">
                <div>
                    <h3 className="text-sm font-semibold text-foreground">Live Assistant</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Real-time objection handling.</p>
                </div>
                {transcript.length > 0 && !isListening && (
                    <button
                        onClick={copyTranscript}
                        className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 hover:bg-emerald-500/20 font-medium flex items-center gap-1.5 transition"
                    >
                        <Copy className="h-3 w-3" /> Copy Log
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
                {error && (
                    <div className="p-3 bg-destructive/15 text-destructive text-xs rounded-xl border border-destructive/20 flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {error}
                    </div>
                )}

                {transcript.length === 0 && !isListening && (
                    <div className="text-center text-muted-foreground text-xs mt-12">
                        Press the mic to start listening...
                    </div>
                )}

                <div className="space-y-2">
                    {transcript.map((text, idx) => (
                        <div key={idx} className="bg-card px-3 py-2.5 rounded-xl text-xs text-foreground border-l-2 border-primary/50 shadow-sm">
                            {text}
                        </div>
                    ))}
                    {isListening && (
                        <div className="animate-pulse text-primary/80 text-[10px] text-center font-medium uppercase tracking-widest">
                            Listening...
                        </div>
                    )}
                </div>

                {suggestions.length > 0 && (
                    <div className="mt-3 border-t border-border/50 pt-3">
                        <h4 className="text-[10px] font-bold text-primary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <Lightbulb className="h-3 w-3" /> Real-time Suggestions
                        </h4>
                        <div className="space-y-2">
                            {suggestions.map((item, idx) => (
                                <div key={`${item.id}-${idx}`} className="bg-primary/5 p-3 rounded-xl border border-primary/20">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold text-primary uppercase tracking-wide">
                                        <FileText className="h-3 w-3" /> {item.metadata?.type || 'Match'}
                                    </div>
                                    <p className="text-xs text-foreground">
                                        {item.content}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Mic button */}
            <div className="p-4 border-t border-border/50 bg-card shrink-0">
                <button
                    onClick={toggleListening}
                    className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition ${
                        isListening
                            ? 'bg-destructive/15 text-destructive border border-destructive/20 hover:bg-destructive/20'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 glow-primary-subtle'
                    }`}
                >
                    {isListening ? (
                        <><MicOff className="h-4 w-4" /> Stop Listening</>
                    ) : (
                        <><Mic className="h-4 w-4" /> Start Listening</>
                    )}
                </button>
            </div>
        </div>
    )
}
