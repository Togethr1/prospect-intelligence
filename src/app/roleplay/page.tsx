import { getPersonas } from "@/actions/personas";
import Link from "next/link";
import { Plus, User, Briefcase, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Persona } from "@/types";

export default async function RoleplayPage() {
    let personas: Persona[] = [];
    try {
        personas = await getPersonas();
    } catch (e) {
        console.error("Failed to load personas:", e);
    }

    return (
        <div className="w-full flex justify-center">
            <div className="w-full max-w-4xl px-2">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Role Play</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Simulate cold calls against AI personas designed to push back and challenge your pitch.
                        </p>
                    </div>
                    <Link href="/roleplay/new">
                        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-5 h-10 glow-primary-subtle">
                            <Plus className="w-4 h-4 mr-2" />
                            New Persona
                        </Button>
                    </Link>
                </div>

                {/* Persona List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {personas.map((persona) => (
                        <div key={persona.id} className="p-5 bg-card border border-border/50 rounded-xl hover:border-primary/50 transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                                        <User className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">{persona.name}</h3>
                                        <div className="flex items-center text-xs text-muted-foreground gap-1.5 mt-0.5">
                                            <Briefcase className="w-3 h-3" />
                                            {persona.personality_config?.jobTitle} • {persona.personality_config?.industry}
                                        </div>
                                    </div>
                                </div>
                                <div className="mb-4 text-xs text-muted-foreground line-clamp-2">
                                    <span className="font-medium">Objections:</span> {persona.personality_config?.keyObjections?.join(", ")}
                                </div>
                            </div>
                            <Link href={`/practice/${persona.id}`} className="w-full">
                                <Button variant="outline" className="w-full bg-background border-border/50 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all">
                                    <PhoneCall className="w-4 h-4 mr-2" /> Start Call
                                </Button>
                            </Link>
                        </div>
                    ))}

                    {personas.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center p-12 bg-card border border-border/50 rounded-2xl">
                            <User className="w-10 h-10 text-muted-foreground/50 mb-4" />
                            <p className="text-sm font-medium text-foreground mb-1">No Personas Found</p>
                            <p className="text-xs text-muted-foreground text-center max-w-sm mb-4">
                                Create your first buyer persona to start practicing your cold call pitches against realistic AI responses.
                            </p>
                            <Link href="/roleplay/new">
                                <Button variant="outline" size="sm">Create Persona</Button>
                            </Link>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
