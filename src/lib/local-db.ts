import fs from 'fs'
import path from 'path'

export interface Persona {
    id: string
    name: string
    personality_config: {
        jobTitle: string
        industry: string
        personalityType: string
        keyObjections: string[]
        buyingCriteria: string[]
        tone?: string
    }
    created_at: string
}

export interface KnowledgeItem {
    id: string
    content: string
    embedding: number[] | null
    metadata: {
        type: string
        title: string
        createdAt: string
    }
    created_at: string
}

interface DB {
    personas: Persona[]
    knowledge_base: KnowledgeItem[]
}

const DB_FILE = path.join(process.cwd(), 'data', 'db.json')

function initDB() {
    const dataDir = path.dirname(DB_FILE)
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
    }
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ personas: [], knowledge_base: [] }, null, 2), { mode: 0o600 })
    }
}

function readDB(): DB {
    initDB()
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8')
        return JSON.parse(raw)
    } catch {
        return { personas: [], knowledge_base: [] }
    }
}

function writeDB(data: DB) {
    initDB()
    const temporaryFile = `${DB_FILE}.${process.pid}.tmp`
    fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2), { mode: 0o600 })
    fs.renameSync(temporaryFile, DB_FILE)
    fs.chmodSync(DB_FILE, 0o600)
}

// --- Math Utilities for Vector Search ---

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i]
        normA += vecA[i] * vecA[i]
        normB += vecB[i] * vecB[i]
    }
    if (normA === 0 || normB === 0) return 0
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// --- Exposed Methods ---

export const db = {
    // Personas
    getPersonas: (): Persona[] => {
        return readDB().personas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    },
    getPersonaById: (id: string): Persona | undefined => {
        return readDB().personas.find(p => p.id === id)
    },
    createPersona: (personaData: Omit<Persona, 'id' | 'created_at'>): Persona => {
        const data = readDB()
        const newPersona: Persona = {
            ...personaData,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString()
        }
        data.personas.push(newPersona)
        writeDB(data)
        return newPersona
    },
    deletePersona: (id: string) => {
        const data = readDB()
        data.personas = data.personas.filter(p => p.id !== id)
        writeDB(data)
    },

    // Knowledge Base
    getKnowledgeItems: (type?: string): KnowledgeItem[] => {
        const items = readDB().knowledge_base
        let filtered = items
        if (type) {
            filtered = items.filter(i => i.metadata.type === type)
        }
        return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    },
    createKnowledgeItem: (itemData: Omit<KnowledgeItem, 'id' | 'created_at'>): KnowledgeItem => {
        const data = readDB()
        const newItem: KnowledgeItem = {
            ...itemData,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString()
        }
        data.knowledge_base.push(newItem)
        writeDB(data)
        return newItem
    },
    deleteKnowledgeItem: (id: string) => {
        const data = readDB()
        data.knowledge_base = data.knowledge_base.filter(k => k.id !== id)
        writeDB(data)
    },
    matchKnowledgeBase: (queryEmbedding: number[], threshold: number = 0.5, count: number = 3): KnowledgeItem[] => {
        const items = readDB().knowledge_base
        
        const scoredItems = items
            .filter(item => item.embedding && item.embedding.length > 0)
            .map(item => ({
                item,
                score: cosineSimilarity(queryEmbedding, item.embedding!)
            }))
        
        return scoredItems
            .filter(si => si.score >= threshold)
            .sort((a, b) => b.score - a.score)
            .slice(0, count)
            .map(si => si.item)
    }
}
