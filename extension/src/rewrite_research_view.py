import sys

with open('/Users/cam/Desktop/code/ai-cold-calling-assistant/extension/src/views/ResearchView.tsx', 'r') as f:
    lines = f.readlines()

# 1. Add imports
for i, line in enumerate(lines):
    if line.startswith("import { useMemo, useRef, useState } from 'react'"):
        lines[i] = "import { useMemo, useRef, useState, useEffect } from 'react'\n"
    if line.startswith("import {"):
        lines.insert(i, "import { Settings, FileText as LucideFileText } from 'lucide-react'\nimport { FieldConfig, DEFAULT_FIELDS } from '../lib/fields'\nimport { CustomizeFieldsModal } from '../components/CustomizeFieldsModal'\n")
        break

# 2. Add state inside ResearchView
for i, line in enumerate(lines):
    if "const [contactsExpanded, setContactsExpanded] = useState(false)" in line:
        state_code = """    const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>(DEFAULT_FIELDS)
    const [showCustomizeModal, setShowCustomizeModal] = useState(false)

    useEffect(() => {
        chrome.storage?.local?.get('fieldConfigs', (res) => {
            if (res.fieldConfigs) {
                setFieldConfigs(res.fieldConfigs)
            }
        })
    }, [])

    const handleSaveFields = (newFields: FieldConfig[]) => {
        setFieldConfigs(newFields)
        chrome.storage?.local?.set({ fieldConfigs: newFields })
    }
"""
        lines.insert(i + 1, state_code)
        break

# 3. Add fieldConfigs to analysis params
for i, line in enumerate(lines):
    if "places: placesData," in line:
        lines.insert(i + 1, "                    fieldConfigs,\n")
        break

# 4. Update Header
header_start = -1
for i, line in enumerate(lines):
    if "            {/* Header */}" in line:
        header_start = i
        break

if header_start != -1:
    lines[header_start + 1] = '            <div className="px-4 py-3 border-b border-border/50 bg-card shrink-0 flex items-center justify-between">\n'
    lines[header_start + 2] = '                <div>\n'
    lines.insert(header_start + 3, '                    <h3 className="text-sm font-semibold text-foreground">Pre-Call Research</h3>\n')
    lines.insert(header_start + 4, '                    <p className="text-[10px] text-muted-foreground mt-0.5">Analyze any prospect website for call intelligence.</p>\n')
    lines.insert(header_start + 5, '                </div>\n')
    lines.insert(header_start + 6, '                <button onClick={() => setShowCustomizeModal(true)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" title="Customize Signals">\n')
    lines.insert(header_start + 7, '                    <Settings className="h-4 w-4" />\n')
    lines.insert(header_start + 8, '                </button>\n')
    # Delete the old h3 and p lines
    del lines[header_start + 9: header_start + 11]

# 5. Replace block
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if "                        {/* ── CALL PLAN ── */}" in line:
        start_idx = i
        break

for i, line in enumerate(lines):
    if "                {/* ── CONTACTS ── */}" in line:
        end_idx = i - 2
        break

render_blocks = """                        {fieldConfigs.filter(f => f.enabled).sort((a, b) => a.order - b.order).map(field => {
                            if (field.isCustom) {
                                const data = salesAssets.custom_fields?.[field.id] || [];
                                if (data.length === 0) return null;
                                return (
                                    <div key={field.id} className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                                        <p className="text-[10px] font-bold text-primary/90 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                            <LucideFileText className="h-3 w-3" /> {field.label}
                                        </p>
                                        <ul className="text-xs text-primary-foreground/80 space-y-1">
                                            {data.map((item: string, i: number) => (
                                                <li key={i}>• {item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            }

                            switch (field.id) {
                                case 'call_plan':
                                    if (!salesAssets.positioning.opening_hook && salesAssets.positioning.pitch_angles.length === 0 && salesAssets.positioning.discovery_questions.length === 0 && salesAssets.positioning.objection_prep.length === 0) return null;
                                    return (
                                        <div key={field.id} className="space-y-2">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                                <Target className="h-3 w-3 text-primary" /> Call Plan
                                            </p>

                                            {salesAssets.positioning.opening_hook && (
                                                <div className="bg-gradient-to-r from-amber-500 to-amber-400 p-4 rounded-lg">
                                                    <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5 text-primary-foreground/80 flex items-center gap-1">
                                                        <MessageCircle className="h-3 w-3" /> Suggested Opener
                                                    </div>
                                                    <p className="text-xs font-semibold text-primary-foreground leading-snug">"{salesAssets.positioning.opening_hook}"</p>
                                                </div>
                                            )}

                                            {salesAssets.positioning.pitch_angles.length > 0 && (
                                                <div className="bg-card p-3 rounded-lg border border-border/50">
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-2">
                                                        <Lightbulb className="h-3 w-3" /> Pitch Angles
                                                    </p>
                                                    <ul className="text-xs text-foreground/80 space-y-1.5">
                                                        {salesAssets.positioning.pitch_angles.map((angle, i) => (
                                                            <li key={i} className="flex gap-2">
                                                                <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                                                                {angle}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {salesAssets.positioning.discovery_questions.length > 0 && (
                                                <div className="bg-card p-3 rounded-lg border border-border/50">
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-2">
                                                        <HelpCircle className="h-3 w-3" /> Discovery Questions
                                                    </p>
                                                    <ul className="text-xs text-foreground/80 space-y-1.5">
                                                        {salesAssets.positioning.discovery_questions.map((q, i) => (
                                                            <li key={i} className="flex gap-2">
                                                                <span className="text-muted-foreground/80 shrink-0">Q{i + 1}.</span>
                                                                {q}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {salesAssets.positioning.objection_prep.length > 0 && (
                                                <div className="bg-primary/10 p-3 rounded-lg border border-primary/30">
                                                    <p className="text-[10px] font-bold text-primary/90 uppercase tracking-wide flex items-center gap-1 mb-2">
                                                        <Shield className="h-3 w-3" /> Objection Prep
                                                    </p>
                                                    <ul className="text-xs text-primary-foreground/80 space-y-2">
                                                        {salesAssets.positioning.objection_prep.map((obj, i) => (
                                                            <li key={i} className="flex gap-2">
                                                                <span className="text-primary/50 shrink-0">•</span>
                                                                {obj}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    );

                                case 'company_history':
                                    if (salesAssets.company_history.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Newspaper className="h-3 w-3" /> Company History
                                            </p>
                                            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                                                {salesAssets.company_history.slice(0, 5).map((item, i) => (
                                                    <li key={i}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );

                                case 'service_offerings':
                                    if (salesAssets.service_offerings.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Briefcase className="h-3 w-3" /> Services & Products
                                            </p>
                                            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                                                {salesAssets.service_offerings.map((s, i) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>
                                    );

                                case 'key_suppliers':
                                    if (salesAssets.key_suppliers.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Briefcase className="h-3 w-3" /> Brand Suppliers
                                            </p>
                                            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                                                {salesAssets.key_suppliers.map((s, i) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>
                                    );

                                case 'news_and_announcements':
                                    if (salesAssets.news_and_announcements.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-sky-950/30 p-3 rounded-lg border border-sky-800/30">
                                            <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Newspaper className="h-3 w-3" /> Recent News
                                            </p>
                                            <ul className="text-xs text-sky-300/80 space-y-1.5">
                                                {salesAssets.news_and_announcements.slice(0, 4).map((n, i) => (
                                                    <li key={i} className="flex gap-2"><span className="opacity-40">•</span>{n}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );

                                case 'active_deals':
                                    if (salesAssets.active_deals.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-emerald-950/30 p-3 rounded-lg border border-emerald-800/30">
                                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Megaphone className="h-3 w-3" /> Active Promotions
                                            </p>
                                            <ul className="text-xs text-emerald-300/80 space-y-1">
                                                {salesAssets.active_deals.slice(0, 4).map((d, i) => <li key={i}>• {d}</li>)}
                                            </ul>
                                        </div>
                                    );

                                case 'locations':
                                    if (salesAssets.locations.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <MapPin className="h-3 w-3" /> Locations
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {salesAssets.locations.slice(0, 6).map((loc, i) => (
                                                    <span key={i} className="text-[10px] px-2 py-0.5 bg-card/50 border border-border/30 rounded-full text-muted-foreground">{loc}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );

                                case 'software_stack':
                                    if (salesAssets.software_stack.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Briefcase className="h-3 w-3" /> Software Stack
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {salesAssets.software_stack.slice(0, 8).map((tool, i) => (
                                                    <span key={i} className="text-[10px] px-2 py-0.5 bg-card/50 border border-border/30 rounded-full text-muted-foreground">{tool}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );

                                case 'employees':
                                    if (salesAssets.employees.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <User className="h-3 w-3" /> Employees Mentioned
                                            </p>
                                            <ul className="text-xs text-muted-foreground space-y-1">
                                                {salesAssets.employees.slice(0, 6).map((e, i) => (
                                                    <li key={i}>{e.name}{e.role ? ` — ${e.role}` : ''}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );

                                case 'social_media':
                                    if (salesAssets.social_media_followings.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Megaphone className="h-3 w-3" /> Social Media
                                            </p>
                                            <ul className="text-xs text-muted-foreground space-y-1">
                                                {salesAssets.social_media_followings.slice(0, 5).map((item, i) => (
                                                    <li key={i}>{item.platform}{item.followers ? ` — ${item.followers}` : ''}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );

                                case 'google_reviews':
                                    if (!salesAssets.google_reviews?.rating && !salesAssets.google_reviews?.review_count && (salesAssets.google_reviews?.highlights?.length ?? 0) === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Star className="h-3 w-3" /> Google Reviews
                                            </p>
                                            <div className="text-xs text-muted-foreground space-y-1">
                                                {salesAssets.google_reviews?.rating && (
                                                    <div>Rating: <span className="text-primary/90 font-medium">{salesAssets.google_reviews.rating}</span></div>
                                                )}
                                                {salesAssets.google_reviews?.review_count && (
                                                    <div>{salesAssets.google_reviews.review_count} reviews</div>
                                                )}
                                                {salesAssets.google_reviews?.highlights && salesAssets.google_reviews.highlights.length > 0 && (
                                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                                        {salesAssets.google_reviews.highlights.slice(0, 3).map((h, i) => (
                                                            <li key={i} className="line-clamp-2">{h}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    );

                                case 'review_trends':
                                    if (salesAssets.google_reviews_analysis.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                                            <p className="text-[10px] font-bold text-primary/90 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Lightbulb className="h-3 w-3" /> Review Trends
                                            </p>
                                            <ul className="text-xs text-primary-foreground/70 space-y-1">
                                                {salesAssets.google_reviews_analysis.map((item, i) => (
                                                    <li key={i}>• {item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );

                                default:
                                    return null;
                            }
                        })}\n"""

lines = lines[:start_idx] + [render_blocks] + lines[end_idx:]

# 6. Add modal at the end before last closing div
for i in range(len(lines) - 1, -1, -1):
    if "        </div>" in lines[i]:
        lines.insert(i, """            {showCustomizeModal && (
                <CustomizeFieldsModal
                    fields={fieldConfigs}
                    onChange={handleSaveFields}
                    onClose={() => setShowCustomizeModal(false)}
                />
            )}\n""")
        break

with open('/Users/cam/Desktop/code/ai-cold-calling-assistant/extension/src/views/ResearchView.tsx', 'w') as f:
    f.writelines(lines)
