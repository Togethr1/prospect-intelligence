'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Augment window to include webkitSpeechRecognition
interface IWindow extends Window {
    webkitSpeechRecognition: new () => any
    SpeechRecognition: new () => any
}

export function useSpeechRecognition() {
    const [isListening, setIsListening] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [interimTranscript, setInterimTranscript] = useState('')
    const [supported, setSupported] = useState(false)

    const recognitionRef = useRef<any>(null)

    useEffect(() => {
        const windowObj = window as unknown as IWindow
        const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition

        if (SpeechRecognition) {
            setSupported(true)
            const recognition = new SpeechRecognition()
            recognition.continuous = true // Keep listening even if user pauses
            recognition.interimResults = true // Show results while speaking
            recognition.lang = 'en-US'

            recognition.onstart = () => setIsListening(true)
            recognition.onend = () => setIsListening(false)

            recognition.onresult = (event: any) => {
                let final = ''
                let interim = ''

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final += event.results[i][0].transcript
                    } else {
                        interim += event.results[i][0].transcript
                    }
                }

                if (final) {
                    setTranscript((prev) => prev + final + ' ')
                }
                setInterimTranscript(interim)
            }

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error', event.error)
                setIsListening(false)
            }

            recognitionRef.current = recognition
        }
    }, [])

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            try {
                setTranscript('') // Clear previous
                setInterimTranscript('')
                recognitionRef.current.start()
            } catch (e) {
                console.error("Start failed", e)
            }
        }
    }, [isListening])

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop()
        }
    }, [isListening])

    const resetTranscript = useCallback(() => {
        setTranscript('')
        setInterimTranscript('')
    }, [])

    return {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        resetTranscript,
        supported
    }
}
