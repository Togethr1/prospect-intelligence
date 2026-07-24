import { PersonaForm } from "@/components/personas/persona-form";

export default function NewPersonaPage() {
    return (
        <div className="container mx-auto px-6 py-10 max-w-2xl">
            <div className="mb-8">
                <h1 className="text-xl font-semibold tracking-tight">Design a Prospect</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Define the personality, role, and objections of the person you want to practice calling.
                </p>
            </div>
            <PersonaForm />
        </div>
    );
}
