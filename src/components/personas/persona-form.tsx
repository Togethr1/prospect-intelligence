'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { createPersona, updatePersona } from '@/actions/personas'
import { useTransition } from 'react'
import Link from 'next/link'
import type { Persona } from '@/types'

const PERSONALITY_TYPES = ['Skeptical', 'Busy', 'Friendly', 'Analytical', 'Aggressive'] as const
const VOICE_TONES = [
    'warm', 'professional', 'friendly', 'confident', 'calm',
    'energetic', 'direct', 'empathetic', 'authoritative', 'conversational',
] as const

const personaFormSchema = z.object({
    name: z.string().trim().min(2, {
        message: 'Persona name must be at least 2 characters.',
    }).max(120),
    jobTitle: z.string().trim().min(2, {
        message: 'Job title is required.',
    }).max(200),
    industry: z.string().trim().min(2, {
        message: 'Industry is required.',
    }).max(200),
    scenario: z.string().trim().min(10, 'Describe the call scenario in at least 10 characters.').max(4_000),
    personalityType: z.enum(PERSONALITY_TYPES),
    voiceGender: z.enum(['man', 'woman']),
    voiceTone: z.enum(VOICE_TONES),
    keyObjections: z.array(z.object({ value: z.string().trim().min(1, 'Cannot be empty').max(500) })).min(1).max(20),
    buyingCriteria: z.array(z.object({ value: z.string().trim().min(1, 'Cannot be empty').max(500) })).min(1).max(20),
})

type PersonaFormValues = z.infer<typeof personaFormSchema>

// Default values
const defaultValues: PersonaFormValues = {
    name: '',
    jobTitle: '',
    industry: '',
    scenario: '',
    personalityType: 'Skeptical',
    voiceGender: 'woman',
    voiceTone: 'professional',
    keyObjections: [{ value: 'It is too expensive.' }, { value: 'We are happy with our current solution.' }],
    buyingCriteria: [{ value: 'Must integrate with Salesforce.' }],
}

export function PersonaForm({ persona }: { persona?: Persona }) {
    const [isPending, startTransition] = useTransition()
    const config = persona?.personality_config

    const form = useForm<PersonaFormValues>({
        resolver: zodResolver(personaFormSchema),
        defaultValues: persona ? {
            name: persona.name,
            jobTitle: config?.jobTitle || '',
            industry: config?.industry || '',
            scenario: config?.scenario || '',
            personalityType: PERSONALITY_TYPES.includes(config?.personalityType as typeof PERSONALITY_TYPES[number])
                ? config?.personalityType as typeof PERSONALITY_TYPES[number]
                : 'Skeptical',
            voiceGender: config?.voiceGender || 'woman',
            voiceTone: VOICE_TONES.includes(config?.voiceTone as typeof VOICE_TONES[number])
                ? config?.voiceTone as typeof VOICE_TONES[number]
                : 'professional',
            keyObjections: (config?.keyObjections || ['']).map((value) => ({ value })),
            buyingCriteria: (config?.buyingCriteria || ['']).map((value) => ({ value })),
        } : defaultValues,
        mode: 'onChange',
    })

    const { fields: objectionFields, append: appendObjection, remove: removeObjection } = useFieldArray({
        name: 'keyObjections',
        control: form.control,
    })

    const { fields: criteriaFields, append: appendCriteria, remove: removeCriteria } = useFieldArray({
        name: 'buyingCriteria',
        control: form.control,
    })

    function onSubmit(data: PersonaFormValues) {
        startTransition(async () => {
            try {
                const payload = {
                    name: data.name,
                    jobTitle: data.jobTitle,
                    industry: data.industry,
                    scenario: data.scenario,
                    personalityType: data.personalityType,
                    voiceGender: data.voiceGender,
                    voiceTone: data.voiceTone,
                    keyObjections: data.keyObjections.map((o) => o.value),
                    buyingCriteria: data.buyingCriteria.map((c) => c.value),
                }
                if (persona) await updatePersona(persona.id, payload)
                else await createPersona(payload)
            } catch (error) {
                form.setError('root', {
                    message: error instanceof Error ? error.message : 'Persona could not be saved.',
                })
            }
        })
    }

    return (
        <Card className="mx-auto w-full max-w-5xl border-border bg-[oklch(0.165_0.018_260)]">
            <CardContent className="p-5 sm:p-7">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-7">
                        {form.formState.errors.root?.message && (
                            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                {form.formState.errors.root.message}
                            </p>
                        )}
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Prospect Name</FormLabel>
                                        <FormControl>
                                            <Input className="h-11 bg-background/75" placeholder="e.g. Morgan Lee" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="personalityType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Personality Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-11 w-full bg-background/75">
                                                    <SelectValue placeholder="Select a type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Skeptical">Skeptical</SelectItem>
                                                <SelectItem value="Busy">Busy</SelectItem>
                                                <SelectItem value="Friendly">Friendly</SelectItem>
                                                <SelectItem value="Analytical">Analytical</SelectItem>
                                                <SelectItem value="Aggressive">Aggressive</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="voiceGender"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Voice</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-11 w-full bg-background/75">
                                                    <SelectValue placeholder="Choose a voice" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="man">Man</SelectItem>
                                                <SelectItem value="woman">Woman</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="voiceTone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tone</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-11 w-full bg-background/75">
                                                    <SelectValue placeholder="Choose a tone" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="warm">Warm</SelectItem>
                                                <SelectItem value="professional">Professional</SelectItem>
                                                <SelectItem value="friendly">Friendly</SelectItem>
                                                <SelectItem value="confident">Confident</SelectItem>
                                                <SelectItem value="calm">Calm</SelectItem>
                                                <SelectItem value="energetic">Energetic</SelectItem>
                                                <SelectItem value="direct">Direct</SelectItem>
                                                <SelectItem value="empathetic">Empathetic</SelectItem>
                                                <SelectItem value="authoritative">Authoritative</SelectItem>
                                                <SelectItem value="conversational">Conversational</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="jobTitle"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Job Title</FormLabel>
                                        <FormControl>
                                            <Input className="h-11 bg-background/75" placeholder="e.g. VP of Engineering" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="industry"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Industry</FormLabel>
                                        <FormControl>
                                            <Input className="h-11 bg-background/75" placeholder="e.g. SaaS / FinTech" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="scenario"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Call Scenario</FormLabel>
                                    <FormControl>
                                        <textarea
                                            {...field}
                                            rows={4}
                                            maxLength={2_000}
                                            placeholder="e.g. This is a first cold call. I sell workflow automation software and my goal is to earn a 20-minute discovery meeting."
                                            className="flex min-h-32 w-full resize-y rounded-md border border-input bg-background/75 px-3 py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Key Objections */}
                        <div className="rounded-xl border border-border bg-background/30 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <FormLabel>Key Objections</FormLabel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => appendObjection({ value: '' })}
                                >
                                    <Plus className="h-4 w-4" />
                                    Add
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {objectionFields.map((field, index) => (
                                    <FormField
                                        key={field.id}
                                        control={form.control}
                                        name={`keyObjections.${index}.value`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="flex gap-2">
                                                        <Input className="h-11 bg-background/75" {...field} />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeObjection(index)}
                                                            disabled={objectionFields.length === 1}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Buying Criteria */}
                        <div className="rounded-xl border border-border bg-background/30 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <FormLabel>Buying Criteria</FormLabel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => appendCriteria({ value: '' })}
                                >
                                    <Plus className="h-4 w-4" />
                                    Add
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {criteriaFields.map((field, index) => (
                                    <FormField
                                        key={field.id}
                                        control={form.control}
                                        name={`buyingCriteria.${index}.value`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="flex gap-2">
                                                        <Input className="h-11 bg-background/75" {...field} />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeCriteria(index)}
                                                            disabled={criteriaFields.length === 1}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                            <Button asChild type="button" variant="ghost">
                                <Link href="/roleplay"><ArrowLeft className="h-4 w-4" /> Cancel</Link>
                            </Button>
                            <Button type="submit" disabled={isPending} className="sm:min-w-44">
                                {isPending ? 'Saving…' : persona ? 'Save changes' : 'Create persona'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
