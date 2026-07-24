'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteKnowledgeItem } from '@/actions/knowledge'
import { AddKnowledgeModal } from './add-knowledge-modal'

interface KnowledgeItem {
    id: string
    content: string
    metadata: {
        type: string
        title: string
    }
}

interface Props {
    initialItems: KnowledgeItem[]
}

const CATEGORIES = [
    { id: 'product', label: 'Product/Offerings', tag: 'PRODUCT', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { id: 'talk_track', label: 'Talk Tracks', tag: 'TRACK', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { id: 'icp', label: 'ICP/Qualification', tag: 'ICP', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    { id: 'persona_industry', label: 'Persona/Industry', tag: 'INDUSTRY', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
]

export function KnowledgeList({ initialItems }: Props) {
    const [items, setItems] = useState<KnowledgeItem[]>(initialItems)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [activeCategoryForAdd, setActiveCategoryForAdd] = useState(CATEGORIES[0].id)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this knowledge item?')) return
        setDeletingId(id)
        try {
            await deleteKnowledgeItem(id)
            setItems(items.filter(i => i.id !== id))
        } catch (caught) {
            alert(caught instanceof Error ? caught.message : 'Knowledge item could not be deleted.')
        } finally {
            setDeletingId(null)
        }
    }

    const handleItemAdded = (newItem: KnowledgeItem) => {
        setItems([newItem, ...items])
    }

    const openAddModal = (categoryId: string) => {
        setActiveCategoryForAdd(categoryId)
        setIsAddModalOpen(true)
    }

    return (
        <div className="space-y-10 pb-20">
            
            {/* Header */}
            <div>
                <h2 className="text-xl font-bold text-foreground">Knowledge Base</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Organize your product intel, competitor insights, and industry data
                </p>
            </div>

            {/* Sections */}
            <div className="space-y-12">
                {CATEGORIES.map(cat => {
                    const categoryItems = items.filter(i => i.metadata.type === cat.id)
                    return (
                        <div key={cat.id} className="space-y-4">
                            <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                <h3 className="text-base font-semibold text-foreground tracking-tight">{cat.label}</h3>
                                <Button 
                                    onClick={() => openAddModal(cat.id)}
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 rounded-full px-3 text-xs"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    Add Item
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {categoryItems.map((item) => (
                                    <div key={item.id} className="flex items-start gap-4 p-5 bg-card border border-border/50 rounded-xl group transition-colors hover:border-border">
                                        <div className={`mt-0.5 shrink-0 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-widest ${cat.color}`}>
                                            {cat.tag}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-semibold text-foreground mb-1.5">{item.metadata.title}</h3>
                                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.content}</p>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDelete(item.id)}
                                                disabled={deletingId === item.id}
                                            >
                                                {deletingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                ))}

                                {categoryItems.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-8 border border-dashed border-border/50 rounded-xl bg-card/30">
                                        <p className="text-xs text-muted-foreground">
                                            No {cat.label.toLowerCase()} added yet.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            <AddKnowledgeModal 
                isOpen={isAddModalOpen} 
                onClose={() => setIsAddModalOpen(false)} 
                onSuccess={handleItemAdded}
                category={activeCategoryForAdd}
            />
        </div>
    )
}
