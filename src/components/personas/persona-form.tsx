'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
    Form,
    FormControl,
    FormDescription,
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
import { PlusCircle, Trash2 } from 'lucide-react'
import { createPersona } from '@/actions/personas'
import { useTransition } from 'react'

const personaFormSchema = z.object({
    name: z.string().min(2, {
        message: 'Persona name must be at least 2 characters.',
    }),
    jobTitle: z.string().min(2, {
        message: 'Job title is required.',
    }),
    industry: z.string().min(2, {
        message: 'Industry is required.',
    }),
    personalityType: z.string().min(1, 'Please select a personality type.'),
    keyObjections: z.array(z.object({ value: z.string().min(1, 'Cannot be empty') })),
    buyingCriteria: z.array(z.object({ value: z.string().min(1, 'Cannot be empty') })),
})

type PersonaFormValues = z.infer<typeof personaFormSchema>

// Default values
const defaultValues: PersonaFormValues = {
    name: '',
    jobTitle: '',
    industry: '',
    personalityType: '',
    keyObjections: [{ value: 'It is too expensive.' }, { value: 'We are happy with our current solution.' }],
    buyingCriteria: [{ value: 'Must integrate with Salesforce.' }],
}

export function PersonaForm() {
    const [isPending, startTransition] = useTransition()

    const form = useForm<PersonaFormValues>({
        resolver: zodResolver(personaFormSchema),
        defaultValues,
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
                await createPersona({
                    name: data.name,
                    jobTitle: data.jobTitle,
                    industry: data.industry,
                    personalityType: data.personalityType,
                    keyObjections: data.keyObjections.map((o) => o.value),
                    buyingCriteria: data.buyingCriteria.map((c) => c.value),
                })
            } catch (error) {
                console.error("Error creating persona:", error)
                // Ideally show a toast here
            }
        })
    }

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardContent className="pt-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Persona Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Grumpy CTO" {...field} />
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
                                                <SelectTrigger>
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="jobTitle"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Job Title</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. VP of Engineering" {...field} />
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
                                            <Input placeholder="e.g. SaaS / FinTech" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Key Objections */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <FormLabel>Key Objections</FormLabel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => appendObjection({ value: '' })}
                                >
                                    <PlusCircle className="w-4 h-4 mr-2" />
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
                                                        <Input {...field} />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeObjection(index)}
                                                            disabled={objectionFields.length === 1}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
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
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <FormLabel>Buying Criteria</FormLabel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => appendCriteria({ value: '' })}
                                >
                                    <PlusCircle className="w-4 h-4 mr-2" />
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
                                                        <Input {...field} />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeCriteria(index)}
                                                            disabled={criteriaFields.length === 1}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
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

                        <Button type="submit" disabled={isPending} className="w-full">
                            {isPending ? 'Creating...' : 'Create Persona'}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
