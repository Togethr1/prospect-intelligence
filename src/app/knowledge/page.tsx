export const dynamic = 'force-dynamic'

import { getKnowledgeItems } from "@/actions/knowledge";
import { KnowledgeList } from "@/components/knowledge/knowledge-list";

export default async function KnowledgeBasePage() {
    let allItems: Array<{
        id: string
        content: string
        metadata: { type: string; title: string }
    }> = []
    let hasError = false

    try {
        allItems = (await getKnowledgeItems()).map((item) => ({
            id: item.id,
            content: item.content.slice(0, 2_000),
            metadata: {
                type: item.metadata.type,
                title: item.metadata.title,
            },
        }))
    } catch (error) {
        console.error("Failed to load the local knowledge base:", error)
        hasError = true
    }

    return (
        <div className="w-full flex justify-center">
            <div className="w-full max-w-4xl px-2">
                
                {hasError && (
                    <div className="bg-destructive/15 text-destructive p-4 rounded-lg mb-6 border border-destructive/20">
                        <p className="font-semibold text-sm">Error loading knowledge base</p>
                        <p className="text-sm mt-1">Check the local terminal for repair guidance.</p>
                    </div>
                )}

                <KnowledgeList initialItems={allItems} />
            </div>
        </div>
    );
}
