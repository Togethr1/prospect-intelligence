import { PersonaForm } from "@/components/personas/persona-form";

export default function NewPersonaPage() {
    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
            <div className="mb-6">
                <h1 className="text-xl font-semibold tracking-tight">Design a Prospect</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Define the personality, role, and objections of the person you want to practice calling.
                </p>
            </div>
            <PersonaForm />
        </div>
    );
}
