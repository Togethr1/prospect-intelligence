import { cn } from "@/lib/utils"

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
}

interface MessageBubbleProps {
    message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === 'user'

    return (
        <div
            className={cn(
                "flex w-full mb-4",
                isUser ? "justify-end" : "justify-start"
            )}
        >
            <div
                className={cn(
                    "max-w-[80%] rounded-xl px-4 py-3 text-sm",
                    isUser
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted text-foreground rounded-bl-none"
                )}
            >
                {message.content}
            </div>
        </div>
    )
}
