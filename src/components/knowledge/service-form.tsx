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
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PlusCircle, Trash2 } from 'lucide-react'
import { createServiceOffering } from '@/actions/knowledge'
import { useTransition } from 'react'

const serviceFormSchema = z.object({
    name: z.string().min(2, { message: 'Service name is required.' }),
    valueProposition: z.string().min(10, { message: 'Value prop must be at least 10 chars.' }),
    targetAudience: z.string().min(2, { message: 'Target audience is required.' }),
    painPoints: z.array(z.object({ value: z.string().min(1, 'Cannot be empty') })),
})

type ServiceFormValues = z.infer<typeof serviceFormSchema>

const defaultValues: ServiceFormValues = {
    name: '',
    valueProposition: '',
    targetAudience: '',
    painPoints: [{ value: '' }],
}

export function ServiceForm() {
    const [isPending, startTransition] = useTransition()

    const form = useForm<ServiceFormValues>({
        resolver: zodResolver(serviceFormSchema),
        defaultValues,
        mode: 'onChange',
    })

    const { fields, append, remove } = useFieldArray({
        name: 'painPoints',
        control: form.control,
    })

    function onSubmit(data: ServiceFormValues) {
        startTransition(async () => {
            try {
                await createServiceOffering({
                    name: data.name,
                    valueProposition: data.valueProposition,
                    targetAudience: data.targetAudience,
                    painPoints: data.painPoints.map(p => p.value)
                })
            } catch (error) {
                console.error("Error creating service:", error)
            }
        })
    }

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Define Your Service Offering</CardTitle>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Service/Product Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Velox Premium" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="targetAudience"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Target Audience</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. VP of Sales at Series B Startups" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="valueProposition"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Value Proposition (The Pitch)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="We help teams increase close rates by practicing with AI..."
                                            className="min-h-[100px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Pain Points */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <FormLabel>Pain Points Solved</FormLabel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ value: '' })}
                                >
                                    <PlusCircle className="w-4 h-4 mr-2" />
                                    Add
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {fields.map((field, index) => (
                                    <FormField
                                        key={field.id}
                                        control={form.control}
                                        name={`painPoints.${index}.value`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="flex gap-2">
                                                        <Input {...field} />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => remove(index)}
                                                            disabled={fields.length === 1}
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
                            {isPending ? 'Saving...' : 'Save Offering'}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
