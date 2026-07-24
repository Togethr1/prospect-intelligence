import { useState } from 'react';
import { X, GripVertical, Plus, Trash2, PlugZap } from 'lucide-react';
import type { FieldConfig } from '../lib/fields';

interface Props {
    fields: FieldConfig[];
    onChange: (fields: FieldConfig[]) => void;
    onClose: () => void;
}

export function CustomizeFieldsModal({ fields, onChange, onClose }: Props) {
    const [localFields, setLocalFields] = useState<FieldConfig[]>([...fields].sort((a, b) => a.order - b.order));
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newPrompt, setNewPrompt] = useState('');

    const handleDragStart = (idx: number) => {
        setDraggedIdx(idx);
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === idx) return;

        const updated = [...localFields];
        const draggedItem = updated[draggedIdx];
        updated.splice(draggedIdx, 1);
        updated.splice(idx, 0, draggedItem);

        // Update orders
        updated.forEach((f, i) => f.order = i);
        setLocalFields(updated);
        setDraggedIdx(idx);
    };

    const handleDrop = () => {
        setDraggedIdx(null);
    };

    const toggleField = (id: string) => {
        const updated = localFields.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f);
        setLocalFields(updated);
    };

    const removeCustomField = (id: string) => {
        const updated = localFields.filter(f => f.id !== id);
        updated.forEach((f, i) => f.order = i);
        setLocalFields(updated);
    };

    const handleSave = () => {
        onChange(localFields);
        onClose();
    };

    const handleAddCustom = () => {
        if (!newLabel.trim()) return;
        const id = 'custom_' + newLabel.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
        const newField: FieldConfig = {
            id,
            label: newLabel.trim(),
            enabled: true,
            order: localFields.length,
            isCustom: true,
            prompt: newPrompt.trim(),
            icon: 'FileText',
            source: 'website',
        };
        setLocalFields([...localFields, newField]);
        setNewLabel('');
        setNewPrompt('');
        setShowAdd(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4">
            <div className="bg-card w-full max-w-md rounded-xl border border-border flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Customize View</h2>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Toggle and reorder intelligence sections</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <div className="pb-1 text-[10px] font-semibold text-muted-foreground">Website research</div>
                    {localFields.map((field, idx) => (
                        field.source !== 'connected' ? (
                        <div
                            key={field.id}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={handleDrop}
                            onDragEnd={handleDrop}
                            className={`flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50 transition-colors ${draggedIdx === idx ? 'opacity-50' : ''}`}
                        >
                            <div className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground">
                                <GripVertical className="h-4 w-4" />
                            </div>
                            
                            <div className="flex-1 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium text-foreground">
                                        {field.label}
                                        {field.isCustom && <span className="ml-2 text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">Custom</span>}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    {field.isCustom && (
                                        <button onClick={() => removeCustomField(field.id)} className="text-destructive/70 hover:text-destructive">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={field.enabled} 
                                            onChange={() => toggleField(field.id)} 
                                        />
                                        <span className="toggle-track" />
                                    </label>
                                </div>
                            </div>
                        </div>
                        ) : null
                    ))}

                    <div className="flex items-center gap-2 pb-1 pt-4 text-[10px] font-semibold text-muted-foreground">
                        <PlugZap className="h-3.5 w-3.5 text-primary" />
                        Connected tools output
                    </div>
                    <p className="pb-1 text-[10px] leading-4 text-muted-foreground">
                        Choose which explicit-run CRM, enrichment, review, and AI results appear after analysis.
                    </p>
                    {localFields.map((field) => field.source === 'connected' ? (
                        <div key={field.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                            <div className="flex-1">
                                <span className="text-xs font-medium text-foreground">{field.label}</span>
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={field.enabled}
                                    onChange={() => toggleField(field.id)}
                                />
                                <span className="toggle-track" />
                            </label>
                        </div>
                    ) : null)}

                    {showAdd ? (
                        <div className="p-3 border border-primary/30 bg-primary/5 rounded-lg space-y-3 mt-4">
                            <h4 className="text-xs font-semibold text-primary">New Custom Signal</h4>
                            <div className="space-y-2">
                                <input 
                                    type="text" 
                                    placeholder="Signal Name (e.g. Target Audience)" 
                                    className="w-full text-xs bg-card border border-border/50 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                                    value={newLabel}
                                    onChange={e => setNewLabel(e.target.value)}
                                />
                                <textarea 
                                    placeholder="Extraction Instructions (e.g. Extract any mention of who their primary target audience is...)" 
                                    className="w-full text-xs bg-card border border-border/50 rounded px-2 py-1.5 h-16 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                    value={newPrompt}
                                    onChange={e => setNewPrompt(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowAdd(false)} className="text-[10px] px-3 py-1.5 rounded hover:bg-muted text-muted-foreground font-medium">Cancel</button>
                                <button onClick={handleAddCustom} disabled={!newLabel.trim()} className="text-[10px] px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium disabled:opacity-50">Add Signal</button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setShowAdd(true)} className="w-full flex items-center justify-center gap-1.5 p-2 mt-2 border border-dashed border-border/50 rounded-lg text-xs text-muted-foreground hover:bg-card/80 hover:text-foreground transition-colors">
                            <Plus className="h-3.5 w-3.5" />
                            Add Custom Signal
                        </button>
                    )}
                </div>

                <div className="p-4 border-t border-border/50 bg-card/80 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Save Changes</button>
                </div>
            </div>
        </div>
    );
}
