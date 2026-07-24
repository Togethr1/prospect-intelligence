'use client'

import { useState } from 'react'
import { X, FileText, Upload, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createKnowledgeItem, uploadDocument } from '@/actions/knowledge'
import type { KnowledgeItem } from '@/lib/local-db'

interface Props {
    isOpen: boolean
    onClose: () => void
    onSuccess: (item: KnowledgeItem) => void
    category: string
}

export function AddKnowledgeModal({ isOpen, onClose, onSuccess, category }: Props) {
    const [mode, setMode] = useState<'select' | 'type' | 'upload'>('select')
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    if (!isOpen) return null

    const handleSaveText = async () => {
        if (!title.trim() || !content.trim()) return
        setLoading(true)
        setError('')
        try {
            const item = await createKnowledgeItem(category, title, content)
            onSuccess(item)
            reset()
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Knowledge could not be saved.')
        } finally {
            setLoading(false)
        }
    }

    const handleUpload = async () => {
        if (!file) return
        setLoading(true)
        setError('')
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('type', category)
            const item = await uploadDocument(formData)
            onSuccess(item)
            reset()
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Document could not be uploaded.')
        } finally {
            setLoading(false)
        }
    }

    const reset = () => {
        setTitle('')
        setContent('')
        setFile(null)
        setError('')
        setMode('select')
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border/50">
                    <div className="flex items-center gap-2">
                        {mode !== 'select' && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground mr-1" onClick={() => setMode('select')}>
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        )}
                        <h2 className="text-base font-semibold text-foreground">Add Knowledge</h2>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground" onClick={reset}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <div className="p-5 overflow-y-auto">
                    
                    {mode === 'select' ? (
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setMode('type')}
                                className="flex flex-col items-center justify-center p-8 bg-muted/30 border border-border rounded-xl hover:bg-muted/50 hover:border-primary/50 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <FileText className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-sm font-semibold text-foreground">Type/Paste Text</h3>
                                <p className="text-xs text-muted-foreground mt-1 text-center">Manually enter your script or notes</p>
                            </button>

                            <button 
                                onClick={() => setMode('upload')}
                                className="flex flex-col items-center justify-center p-8 bg-muted/30 border border-border rounded-xl hover:bg-muted/50 hover:border-primary/50 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Upload className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-sm font-semibold text-foreground">Upload Document</h3>
                                <p className="text-xs text-muted-foreground mt-1 text-center">Upload PDF or text files</p>
                            </button>
                        </div>
                    ) : mode === 'type' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
                                <Input 
                                    value={title} 
                                    onChange={e => setTitle(e.target.value)} 
                                    placeholder="e.g. Core Pitch, Q3 Pricing..."
                                    className="bg-muted border-border"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Content</label>
                                <Textarea 
                                    value={content} 
                                    onChange={e => setContent(e.target.value)}
                                    placeholder="Paste your script, notes, or intel here..."
                                    className="min-h-[120px] bg-muted border-border resize-none"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center bg-muted/30">
                            <Upload className="w-8 h-8 text-muted-foreground mb-3" />
                            <p className="text-sm font-medium text-foreground mb-1">Select a PDF or text file</p>
                            <p className="text-xs text-muted-foreground mb-4">Max size 5MB. Text will be extracted for AI search.</p>
                            <input 
                                type="file" 
                                id="file-upload" 
                                className="hidden" 
                                accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                                onChange={e => setFile(e.target.files?.[0] || null)}
                            />
                            <label htmlFor="file-upload">
                                <span className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 cursor-pointer">
                                    {file ? file.name : 'Browse Files'}
                                </span>
                            </label>
                        </div>
                    )}

                </div>

                {error && (
                    <p role="alert" className="mx-5 mb-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {error}
                    </p>
                )}

                {/* Footer only shows if not in select mode */}
                {mode !== 'select' && (
                    <div className="p-5 border-t border-border/50 flex justify-end gap-2 bg-muted/10">
                        <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
                        <Button 
                            size="sm" 
                            onClick={mode === 'type' ? handleSaveText : handleUpload}
                            disabled={loading || (mode === 'type' ? (!title || !content) : !file)}
                        >
                            {loading && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                            Save Knowledge
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
