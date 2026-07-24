import { cleanText } from './security'

const SENTENCE = /[^.!?\n]+[.!?]?/g
const SIGNAL_WORDS = /\b(service|services|product|products|solution|repair|install|maintenance|commercial|residential|software|platform|team|location|offer|discount|partner|certified|family|founded)\b/i

function unique(items: string[], max = 8) {
    return [...new Set(items.map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, max)
}

function sentences(text: string) {
    return (text.match(SENTENCE) || [])
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length >= 20 && sentence.length <= 240)
}

export function analyzeLocally(pageTextValue: unknown, titleValue: unknown, urlValue: unknown) {
    const pageText = cleanText(pageTextValue, 40_000)
    const title = cleanText(titleValue, 300)
    const url = cleanText(urlValue, 2_048)
    const useful = unique(sentences(pageText).filter((line) => SIGNAL_WORDS.test(line)), 14)
    const services = unique(useful.filter((line) => /\b(service|product|repair|install|maintenance|solution)\b/i.test(line)), 7)
    const company = title.split(/[|\-–—]/)[0].trim() || (() => {
        try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'the company' }
    })()

    return {
        service_offerings: services,
        key_suppliers: [],
        news_and_announcements: unique(useful.filter((line) => /\b(new|announc|launch|award|recent)\b/i.test(line)), 5),
        locations: unique(useful.filter((line) => /\b(location|located|serving|area|county|city)\b/i.test(line)), 5),
        key_staff: [],
        employees: [],
        company_history: unique(useful.filter((line) => /\b(founded|since|family|years)\b/i.test(line)), 4),
        social_media_followings: [],
        google_reviews: {},
        google_reviews_analysis: [],
        software_stack: [],
        active_deals: unique(useful.filter((line) => /\b(offer|discount|save|deal|financ)\b/i.test(line)), 5),
        positioning: {
            opening_hook: `${company} appears focused on ${services[0] || 'serving its customers'}. I’m calling to understand where the team is seeing the most operational friction today.`,
            pitch_angles: services.slice(0, 4).map((item) => `Ask how the team currently supports: ${item}`),
            discovery_questions: [
                `Which part of ${services[0] || 'your current workflow'} creates the most avoidable follow-up?`,
                'What does the team handle manually today that you would most like to standardize?',
                'How do you measure whether a new process is actually helping the front line?',
                'What would need to be true for a change to be worth evaluating?',
            ],
            objection_prep: [
                '“We already have a process.” — Ask what they would keep and what still causes friction.',
                '“Not a priority.” — Ask what is taking priority and when this area is reviewed.',
                '“Send information.” — Confirm the one problem the information should address.',
            ],
            review_trends: [],
        },
    }
}

export function localProspectReply(lastMessage: string, objections: string[] = []) {
    const text = lastMessage.toLowerCase()
    if (/\b(price|cost|budget)\b/.test(text)) return 'Budget is tight. What would this replace, and how would I justify the cost?'
    if (/\b(meeting|calendar|schedule|demo)\b/.test(text)) return 'I’m not ready to schedule something yet. Give me the clearest reason this is relevant to my team.'
    if (/\b(save|benefit|improve|help)\b/.test(text)) return 'That sounds broad. What specifically changes for someone in my role?'
    return objections[0] || 'I only have a minute. What is the specific reason for your call?'
}

export function localResearchReply(question: string, context: string) {
    const terms = unique(question.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 4), 8)
    const matches = sentences(context).filter((line) => terms.some((term) => line.toLowerCase().includes(term))).slice(0, 4)
    if (!matches.length) return 'I cannot verify that from the locally available research. Check the source page or ask a narrower question.'
    return matches.join(' ')
}
