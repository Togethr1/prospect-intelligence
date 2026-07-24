export function BrandMark({ className = '' }: { className?: string }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            viewBox="0 0 24 24"
            fill="currentColor"
        >
            <path d="M10 20h4V4h-4v16ZM4 20h4v-8H4v8Zm12 0h4V8h-4v12Z" />
        </svg>
    )
}
