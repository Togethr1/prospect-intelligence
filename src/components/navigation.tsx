'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Hexagon, BookOpen, UserCircle2, Settings, Sparkles } from 'lucide-react'

export function Navigation() {
    const pathname = usePathname()

    const navItems = [
        {
            name: 'Assistant',
            href: '/assistant',
            icon: Sparkles,
            match: pathname.startsWith('/assistant')
        },
        {
            name: 'Research',
            href: '/research',
            icon: Hexagon,
            match: pathname === '/' || pathname.startsWith('/research')
        },
        {
            name: 'Knowledge',
            href: '/knowledge',
            icon: BookOpen,
            match: pathname.startsWith('/knowledge')
        },
        {
            name: 'Role Play',
            href: '/roleplay',
            icon: UserCircle2,
            match: pathname.startsWith('/roleplay') || pathname.startsWith('/practice') || pathname.startsWith('/personas')
        },
        {
            name: 'Settings',
            href: '/settings',
            icon: Settings,
            match: pathname.startsWith('/settings')
        }
    ]

    return (
        <nav aria-label="Primary" className="w-full lg:w-auto">
            <div className="grid grid-cols-5 items-center p-1 bg-card border border-border/50 rounded-xl w-full lg:w-auto">
                {navItems.map((item) => {
                    const isActive = item.match
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-300 lg:px-4",
                                isActive 
                                    ? "bg-primary/10 text-primary border border-primary/20 glow-primary-subtle" 
                                    : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                            )}
                        >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="hidden sm:inline">{item.name}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
