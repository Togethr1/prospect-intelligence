export const dynamic = 'force-dynamic'

import { getKnowledgeItems } from "@/actions/knowledge";
import { KnowledgeList } from "@/components/knowledge/knowledge-list";

export default async function KnowledgeBasePage() {
    let allItems: any[] = []
    let error = null

    try {
        allItems = await getKnowledgeItems()
    } catch (e: any) {
        console.error("Failed to fetch knowledge items:", e)
        error = e.message
    }

    return (
        <div className="w-full flex justify-center">
            <div className="w-full max-w-4xl px-2">
                
                {error && (
                    <div className="bg-destructive/15 text-destructive p-4 rounded-lg mb-6 border border-destructive/20">
                        <p className="font-semibold text-sm">Error loading knowledge base</p>
                        <p className="text-sm mt-1">{error}</p>
                    </div>
                )}

                <KnowledgeList initialItems={allItems} />
            </div>
        </div>
    );
}
