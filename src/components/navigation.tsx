'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Hexagon, BookOpen, UserCircle2, Settings } from 'lucide-react'

export function Navigation() {
    const pathname = usePathname()

    const navItems = [
        {
            name: 'Intelligence',
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
        <div className="flex items-center justify-center w-full my-6">
            <div className="flex items-center p-1 bg-card border border-border/50 rounded-xl max-w-3xl w-full">
                {navItems.map((item) => {
                    const isActive = item.match
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg text-sm font-medium transition-all duration-300",
                                isActive 
                                    ? "bg-primary/10 text-primary border border-primary/20 glow-primary-subtle" 
                                    : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.name}
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
