import fs from 'fs'
import path from 'path'

export interface Persona {
    id: string
    name: string
    personality_config: {
        jobTitle: string
        industry: string
        scenario?: string
        personalityType: string
        keyObjections: string[]
        buyingCriteria: string[]
        tone?: string
        voiceGender?: 'man' | 'woman'
        voiceTone?: string
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
        storedFile?: string
    }
    created_at: string
}

export interface RoleplaySession {
    id: string
    persona_id: string
    persona_name: string
    transcript: Array<{
        id: string
        role: 'user' | 'assistant'
        content: string
        timestamp: string
    }>
    created_at: string
    updated_at: string
}

export interface ResearchRecord {
    id: string
    url: string
    title: string
    sales_assets: unknown
    crm_context?: unknown
    source: 'dashboard' | 'extension'
    created_at: string
    updated_at: string
}

export interface PairedExtension {
    id: string
    extension_id: string
    token_hash: string
    created_at: string
}

interface DB {
    schema_version: number
    personas: Persona[]
    knowledge_base: KnowledgeItem[]
    roleplay_sessions: RoleplaySession[]
    research_history: ResearchRecord[]
    paired_extensions: PairedExtension[]
}

const DB_FILE = path.join(process.cwd(), 'data', 'db.json')
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads')
const MAX_DB_BYTES = 50 * 1024 * 1024

function initDB() {
    const dataDir = path.dirname(DB_FILE)
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 })
    }
    fs.chmodSync(dataDir, 0o700)
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(emptyDB(), null, 2), { mode: 0o600 })
    }
    fs.chmodSync(DB_FILE, 0o600)
}

function emptyDB(): DB {
    return {
        schema_version: 3,
        personas: [],
        knowledge_base: [],
        roleplay_sessions: [],
        research_history: [],
        paired_extensions: [],
    }
}

function readDB(): DB {
    initDB()
    try {
        if (fs.statSync(DB_FILE).size > MAX_DB_BYTES) {
            throw new Error('Local database exceeds the 50 MB safety limit.')
        }
        const raw = fs.readFileSync(DB_FILE, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<DB>
        return {
            schema_version: 3,
            personas: Array.isArray(parsed.personas) ? parsed.personas : [],
            knowledge_base: Array.isArray(parsed.knowledge_base) ? parsed.knowledge_base : [],
            roleplay_sessions: Array.isArray(parsed.roleplay_sessions) ? parsed.roleplay_sessions : [],
            research_history: Array.isArray(parsed.research_history) ? parsed.research_history : [],
            paired_extensions: Array.isArray(parsed.paired_extensions) ? parsed.paired_extensions : [],
        }
    } catch (error) {
        throw new Error(`Local database could not be read. Repair or restore ${DB_FILE} before continuing.`, { cause: error })
    }
}

function writeDB(data: DB) {
    initDB()
    const serialized = JSON.stringify(data, null, 2)
    if (Buffer.byteLength(serialized, 'utf8') > MAX_DB_BYTES) {
        throw new Error('Local database exceeds the 50 MB safety limit.')
    }
    const temporaryFile = `${DB_FILE}.${crypto.randomUUID()}.tmp`
    try {
        fs.writeFileSync(temporaryFile, serialized, { mode: 0o600, flag: 'wx' })
        fs.renameSync(temporaryFile, DB_FILE)
        fs.chmodSync(DB_FILE, 0o600)
    } finally {
        try {
            fs.unlinkSync(temporaryFile)
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
    }
}

// --- Math Utilities for Vector Search ---

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length === 0 || vecA.length !== vecB.length) return 0
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
    // Approved Chrome extensions
    getPairedExtensions: (): PairedExtension[] => {
        return readDB().paired_extensions
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    },
    getPairedExtensionByTokenHash: (tokenHash: string): PairedExtension | undefined => {
        return readDB().paired_extensions.find((item) => item.token_hash === tokenHash)
    },
    savePairedExtension: (extensionId: string, tokenHash: string): PairedExtension => {
        const data = readDB()
        data.paired_extensions = data.paired_extensions.filter((item) => item.extension_id !== extensionId)
        const record: PairedExtension = {
            id: crypto.randomUUID(),
            extension_id: extensionId,
            token_hash: tokenHash,
            created_at: new Date().toISOString(),
        }
        data.paired_extensions.unshift(record)
        data.paired_extensions = data.paired_extensions.slice(0, 20)
        writeDB(data)
        return record
    },
    deletePairedExtension: (id: string) => {
        const data = readDB()
        data.paired_extensions = data.paired_extensions.filter((item) => item.id !== id)
        writeDB(data)
    },

    // Personas
    getPersonas: (): Persona[] => {
        return readDB().personas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    },
    getPersonaById: (id: string): Persona | undefined => {
        return readDB().personas.find(p => p.id === id)
    },
    createPersona: (personaData: Omit<Persona, 'id' | 'created_at'>): Persona => {
        const data = readDB()
        if (data.personas.length >= 100) throw new Error('Persona limit reached (100).')
        const newPersona: Persona = {
            ...personaData,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString()
        }
        data.personas.push(newPersona)
        writeDB(data)
        return newPersona
    },
    updatePersona: (id: string, personaData: Omit<Persona, 'id' | 'created_at'>): Persona => {
        const data = readDB()
        const index = data.personas.findIndex(p => p.id === id)
        if (index === -1) throw new Error('Persona not found.')
        const updatedPersona: Persona = {
            ...personaData,
            id,
            created_at: data.personas[index].created_at,
        }
        data.personas[index] = updatedPersona
        writeDB(data)
        return updatedPersona
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
        if (data.knowledge_base.length >= 500) throw new Error('Knowledge item limit reached (500).')
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
        const item = data.knowledge_base.find(k => k.id === id)
        data.knowledge_base = data.knowledge_base.filter(k => k.id !== id)
        writeDB(data)
        if (item?.metadata.storedFile) {
            const target = path.join(UPLOAD_DIR, path.basename(item.metadata.storedFile))
            try { fs.unlinkSync(target) } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
            }
        }
    },
    saveKnowledgeUpload: (extension: '.pdf' | '.txt' | '.md', bytes: Buffer) => {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 })
        fs.chmodSync(UPLOAD_DIR, 0o700)
        const filename = `${crypto.randomUUID()}${extension}`
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), bytes, { mode: 0o600, flag: 'wx' })
        return filename
    },
    deleteKnowledgeUpload: (storedFile: string) => {
        const target = path.join(UPLOAD_DIR, path.basename(storedFile))
        try {
            fs.unlinkSync(target)
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
    },
    getRoleplaySessions: (personaId?: string): RoleplaySession[] => {
        const sessions = readDB().roleplay_sessions
        return sessions
            .filter((session) => !personaId || session.persona_id === personaId)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    },
    saveRoleplaySession: (
        sessionId: string | undefined,
        persona: Pick<Persona, 'id' | 'name'>,
        transcript: RoleplaySession['transcript'],
    ): RoleplaySession => {
        const data = readDB()
        if (transcript.length > 500 || transcript.some((message) => message.content.length > 20_000)) {
            throw new Error('Roleplay transcript exceeds the local safety limit.')
        }
        const now = new Date().toISOString()
        const existing = sessionId ? data.roleplay_sessions.find((session) => session.id === sessionId) : undefined
        if (existing) {
            existing.transcript = transcript
            existing.updated_at = now
            writeDB(data)
            return existing
        }
        const session: RoleplaySession = {
            id: crypto.randomUUID(),
            persona_id: persona.id,
            persona_name: persona.name,
            transcript,
            created_at: now,
            updated_at: now,
        }
        data.roleplay_sessions.unshift(session)
        data.roleplay_sessions = data.roleplay_sessions.slice(0, 100)
        writeDB(data)
        return session
    },
    deleteRoleplaySession: (id: string) => {
        const data = readDB()
        data.roleplay_sessions = data.roleplay_sessions.filter((session) => session.id !== id)
        writeDB(data)
    },
    getResearchHistory: (): ResearchRecord[] => {
        return readDB().research_history
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    },
    saveResearchRecord: (record: Omit<ResearchRecord, 'id' | 'created_at' | 'updated_at'>): ResearchRecord => {
        if (Buffer.byteLength(JSON.stringify(record), 'utf8') > 2_000_000) {
            throw new Error('Research record exceeds the 2 MB local safety limit.')
        }
        const data = readDB()
        const now = new Date().toISOString()
        const existing = data.research_history.find((item) => item.url === record.url && item.source === record.source)
        if (existing) {
            Object.assign(existing, record, { updated_at: now })
            writeDB(data)
            return existing
        }
        const created: ResearchRecord = {
            ...record,
            id: crypto.randomUUID(),
            created_at: now,
            updated_at: now,
        }
        data.research_history.unshift(created)
        data.research_history = data.research_history.slice(0, 50)
        writeDB(data)
        return created
    },
    deleteResearchRecord: (id: string) => {
        const data = readDB()
        data.research_history = data.research_history.filter((record) => record.id !== id)
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
