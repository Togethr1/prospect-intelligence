'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Mic, MicOff, Send, PlayCircle, StopCircle } from 'lucide-react'
import { MessageBubble } from './message-bubble'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import { useSpeechSynthesis } from '@/hooks/use-speech-synthesis'
import { Persona } from '@/types'

interface ChatInterfaceProps {
    persona: Persona
}

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
}

export function ChatInterface({ persona }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: `Hello? This is ${persona.name}. Who is this?`
        }
    ])
    const [inputValue, setInputValue] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)

    const {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        resetTranscript
    } = useSpeechRecognition()

    const { speak, cancel: stopSpeaking, isSpeaking } = useSpeechSynthesis()

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            const scrollArea = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
            if (scrollArea) {
                scrollArea.scrollTop = scrollArea.scrollHeight
            }
        }
    }, [messages, interimTranscript])

    // Update input text from speech
    useEffect(() => {
        if (transcript) {
            setInputValue(transcript)
        }
    }, [transcript])

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue
        }

        // Optimistic update
        const newMessages = [...messages, userMessage]
        setMessages(newMessages)
        setInputValue('')
        resetTranscript()

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages.map(m => ({ role: m.role, content: m.content })),
                    persona
                })
            })

            if (!response.ok) throw new Error('Failed to get response')

            const data = await response.json()

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.content
            }

            setMessages(prev => [...prev, aiMessage])
            speak(data.content)

        } catch (error) {
            console.error("Chat Error", error)
            // Ideally show error toast
        }
    }

    const toggleListening = () => {
        if (isListening) {
            stopListening()
        } else {
            startListening()
        }
    }

    return (
        <Card className="w-full h-[600px] flex flex-col">
            <CardHeader className="border-b">
                <CardTitle className="flex items-center justify-between">
                    <span>Call with {persona.name}</span>
                    <span className="text-xs font-normal text-muted-foreground px-2 py-1 bg-muted rounded border">
                        {persona.personality_config.jobTitle}
                    </span>
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden relative">
                <ScrollArea className="h-full p-4" ref={scrollRef}>
                    {messages.map((m) => (
                        <MessageBubble key={m.id} message={m} />
                    ))}
                    {/* Show interim speech result as a "ghost" bubble */}
                    {isListening && interimTranscript && (
                        <div className="flex w-full mb-4 justify-end opacity-50">
                            <div className="max-w-[80%] rounded-xl px-4 py-3 text-sm bg-primary text-primary-foreground rounded-br-none">
                                {interimTranscript}...
                            </div>
                        </div>
                    )}
                </ScrollArea>
            </CardContent>

            <CardFooter className="p-4 border-t bg-background">
                <div className="flex w-full gap-2 items-center">
                    <Button
                        variant={isListening ? "destructive" : "secondary"}
                        size="icon"
                        className="rounded-full h-12 w-12 shrink-0"
                        onClick={toggleListening}
                    >
                        {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </Button>

                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={isListening ? "Listening..." : "Type your response..."}
                        className="flex-1"
                    />

                    <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isListening}>
                        <Send className="h-4 w-4 mr-2" />
                        Send
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
}
