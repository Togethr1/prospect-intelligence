import type { FieldConfig } from '../lib/fields'

export interface SalesAssets {
    service_offerings: string[]
    key_suppliers: string[]
    news_and_announcements: string[]
    locations: string[]
    key_staff: Array<{ name: string; role: string; contact: string }>
    employees: Array<{ name: string; role: string; contact: string }>
    company_history: string[]
    social_media_followings: Array<{ platform: string; followers: string }>
    google_reviews: { rating?: string; review_count?: string; highlights?: string[] }
    google_reviews_analysis: string[]
    software_stack: string[]
    active_deals: string[]
    custom_fields?: Record<string, string[]>
    positioning: {
        opening_hook: string
        pitch_angles: string[]
        discovery_questions: string[]
        objection_prep: string[]
        review_trends: string[]
    }
}

interface AnalyzeResearchInput {
    websiteText: string
    websiteTitle?: string
    websiteUrl?: string
    knowledgeBaseItems?: string[]
    fieldConfigs?: FieldConfig[]
}

const sentencePattern = /[^.!?\n]+[.!?]?/g
const unique = (items: string[], max: number) =>
    [...new Set(items.map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, max)

export class AnalysisService {
    async analyzeResearch(input: AnalyzeResearchInput): Promise<SalesAssets> {
        const sentences = (input.websiteText.match(sentencePattern) || [])
            .map((line) => line.trim())
            .filter((line) => line.length >= 20 && line.length <= 240)
        const signals = unique(sentences.filter((line) =>
            /\b(service|product|repair|install|maintenance|commercial|residential|location|offer|discount|partner|founded)\b/i.test(line)
        ), 18)
        const services = unique(signals.filter((line) =>
            /\b(service|product|repair|install|maintenance)\b/i.test(line)
        ), 7)
        const company = (input.websiteTitle || '').split(/[|\-–—]/)[0].trim() || 'The company'

        return {
            service_offerings: services,
            key_suppliers: [],
            news_and_announcements: unique(signals.filter((line) => /\b(new|announc|launch|award)\b/i.test(line)), 5),
            locations: unique(signals.filter((line) => /\b(location|located|serving|area)\b/i.test(line)), 5),
            key_staff: [],
            employees: [],
            company_history: unique(signals.filter((line) => /\b(founded|since|family|years)\b/i.test(line)), 4),
            social_media_followings: [],
            google_reviews: {},
            google_reviews_analysis: [],
            software_stack: [],
            active_deals: unique(signals.filter((line) => /\b(offer|discount|save|deal|financ)\b/i.test(line)), 5),
            custom_fields: {},
            positioning: {
                opening_hook: `${company} appears focused on ${services[0] || 'serving customers'}. I’m calling to understand where the team sees the most operational friction.`,
                pitch_angles: services.slice(0, 4).map((item) => `Ask how the team currently supports: ${item}`),
                discovery_questions: [
                    `Which part of ${services[0] || 'your workflow'} creates the most avoidable follow-up?`,
                    'What does the team still handle manually?',
                    'How do you measure whether a new process helps the front line?',
                    'What would make a change worth evaluating?',
                ],
                objection_prep: [
                    '“We have a process.” — Ask what they would keep and what still causes friction.',
                    '“Not a priority.” — Ask what is taking priority and when this area is reviewed.',
                    '“Send information.” — Confirm the one problem the information should address.',
                ],
                review_trends: [],
            },
        }
    }
}

export const analysisService = new AnalysisService()
