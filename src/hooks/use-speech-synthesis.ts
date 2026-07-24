'use client'

import { useState, useEffect, useCallback } from 'react'

export function useSpeechSynthesis() {
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [supported, setSupported] = useState(false)

    useEffect(() => {
        setSupported('speechSynthesis' in window)
    }, [])

    const speak = useCallback((text: string) => {
        if (!('speechSynthesis' in window)) return

        // Cancel any current speaking
        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(text)

        // Optional: Select a voice (can be enhanced later to pick a specific "persona" voice)
        const voices = window.speechSynthesis.getVoices()
        if (voices.length > 0) {
            // Prefer a natural sounding voice if available, or just the first one
            utterance.voice = voices[0]
        }

        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => setIsSpeaking(false)
        utterance.onerror = () => setIsSpeaking(false)

        window.speechSynthesis.speak(utterance)
    }, [])

    const cancel = useCallback(() => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel()
            setIsSpeaking(false)
        }
    }, [])

    return {
        speak,
        cancel,
        isSpeaking,
        supported
    }
}
