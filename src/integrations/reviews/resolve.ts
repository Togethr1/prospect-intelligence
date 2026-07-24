import { getCredential } from '../credential-broker'
import type { ReviewInsightsResult, ReviewItem } from '../types'
import { httpUrl, number, object, providerJson, text } from '../intelligence/provider-http'

const THEMES = [
    ['service', /\b(service|support|customer care|helpful)\b/i],
    ['staff', /\b(staff|team|employee|technician|representative)\b/i],
    ['quality', /\b(quality|workmanship|excellent|poor|broken|defect)\b/i],
    ['communication', /\b(communicat|responsive|response|call back|follow.?up)\b/i],
    ['speed and scheduling', /\b(fast|quick|slow|wait|schedule|appointment|on time|late)\b/i],
    ['price and value', /\b(price|pricing|cost|expensive|affordable|value|quote|estimate)\b/i],
    ['reliability', /\b(reliable|professional|trust|recommend|no.?show)\b/i],
] as const

function reviewTrends(reviews: ReviewItem[], overallRating?: number, total?: number) {
    const trends: string[] = []
    const rated = reviews.filter((review) => review.rating !== undefined)
    const positive = rated.filter((review) => (review.rating || 0) >= 4).length
    const negative = rated.filter((review) => (review.rating || 0) <= 2).length
    if (overallRating !== undefined) {
        trends.push(`Overall rating is ${overallRating.toFixed(1)}/5 across ${total ?? 'an undisclosed number of'} reviews.`)
    }
    if (rated.length) {
        trends.push(`In the ${rated.length}-review sample, ${positive} are positive (4–5★) and ${negative} are negative (1–2★).`)
    }

    const themeCounts = THEMES.map(([name, pattern]) => {
        const matches = reviews.filter((review) => pattern.test(review.text))
        return {
            name,
            total: matches.length,
            positive: matches.filter((review) => (review.rating || 0) >= 4).length,
            negative: matches.filter((review) => review.rating !== undefined && (review.rating || 0) <= 2).length,
        }
    }).filter((theme) => theme.total > 0).sort((a, b) => b.total - a.total).slice(0, 4)

    for (const theme of themeCounts) {
        const tone = theme.negative > theme.positive ? 'leans negative' : theme.positive > theme.negative ? 'leans positive' : 'is mixed'
        trends.push(`${theme.name[0].toUpperCase()}${theme.name.slice(1)} appears in ${theme.total} sampled review${theme.total === 1 ? '' : 's'} and ${tone}.`)
    }

    const dated = reviews
        .filter((review) => review.publishedAt && review.rating !== undefined)
        .sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''))
    if (dated.length >= 6) {
        const split = Math.floor(dated.length / 2)
        const average = (items: ReviewItem[]) => items.reduce((sum, item) => sum + (item.rating || 0), 0) / items.length
        const recent = average(dated.slice(0, split))
        const older = average(dated.slice(split))
        const delta = recent - older
        if (Math.abs(delta) >= 0.25) {
            trends.push(`Recent sampled ratings are ${delta > 0 ? 'higher' : 'lower'} than the older half by ${Math.abs(delta).toFixed(1)} stars; this is a sample comparison, not the full review history.`)
        }
    }
    return trends.slice(0, 7)
}

async function googlePlaces(query: string, key: string): Promise<Omit<ReviewInsightsResult, 'provider' | 'providerName' | 'observedAt' | 'costNotice' | 'coverageNotice'>> {
    const data = await providerJson('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-goog-api-key': key,
            'x-goog-fieldmask': 'places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.rating,places.userRatingCount,places.reviews',
        },
        body: JSON.stringify({ textQuery: query, pageSize: 1 }),
    }, 'Google Places')
    const places = Array.isArray(data.places) ? data.places : []
    const place = object(places[0])
    if (!text(place.id, 300)) throw new Error('Google Places could not match a place for this prospect.')
    const displayName = object(place.displayName)
    const rawReviews = Array.isArray(place.reviews) ? place.reviews : []
    const reviews = rawReviews.map((raw, index): ReviewItem => {
        const review = object(raw)
        const body = object(review.text)
        const author = object(review.authorAttribution)
        return {
            id: text(review.name, 300) || `google-${index}`,
            rating: number(review.rating),
            text: text(body.text, 5_000),
            publishedAt: text(review.publishTime, 100) || undefined,
            author: text(author.displayName, 200) || undefined,
            authorUrl: httpUrl(author.uri) || undefined,
            sourceUrl: httpUrl(place.googleMapsUri) || undefined,
        }
    }).filter((review) => review.text)
    const rating = number(place.rating)
    const reviewCount = number(place.userRatingCount)
    return {
        placeName: text(displayName.text, 300) || query,
        placeUrl: httpUrl(place.googleMapsUri) || undefined,
        rating,
        reviewCount,
        reviews,
        trends: reviewTrends(reviews, rating, reviewCount),
    }
}

function flattenPlaces(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => Array.isArray(item) ? item : [item]).map(object)
}

async function outscraper(query: string, key: string): Promise<Omit<ReviewInsightsResult, 'provider' | 'providerName' | 'observedAt' | 'costNotice' | 'coverageNotice'>> {
    const url = new URL('https://api.outscraper.com/google-maps-reviews')
    url.searchParams.set('query', query)
    url.searchParams.set('reviewsLimit', '20')
    url.searchParams.set('limit', '1')
    url.searchParams.set('sort', 'newest')
    url.searchParams.set('ignoreEmpty', 'true')
    url.searchParams.set('source', 'google')
    url.searchParams.set('async', 'false')
    const data = await providerJson(url.toString(), {
        headers: { 'x-api-key': key },
    }, 'Outscraper', 30_000)
    const place = flattenPlaces(data.data)[0] || {}
    if (!text(place.name, 300)) throw new Error('Outscraper could not match a place for this prospect.')
    const rawReviews = Array.isArray(place.reviews_data) ? place.reviews_data : []
    const reviews = rawReviews.map((raw, index): ReviewItem => {
        const review = object(raw)
        return {
            id: text(review.review_id, 300) || text(review.google_id, 300) || `outscraper-${index}`,
            rating: number(review.review_rating),
            text: text(review.review_text, 5_000),
            publishedAt: text(review.review_datetime_utc, 100) || text(review.review_timestamp, 100) || undefined,
            author: text(review.author_title, 200) || undefined,
            authorUrl: httpUrl(review.author_link) || undefined,
            sourceUrl: httpUrl(review.review_link) || httpUrl(place.place_link) || undefined,
        }
    }).filter((review) => review.text)
    const rating = number(place.rating)
    const reviewCount = number(place.reviews)
    return {
        placeName: text(place.name, 300) || query,
        placeUrl: httpUrl(place.place_link) || undefined,
        rating,
        reviewCount,
        reviews,
        trends: reviewTrends(reviews, rating, reviewCount),
    }
}

const providers = {
    'google-places': {
        name: 'Google Places',
        run: googlePlaces,
        costNotice: 'This explicit request uses your Google Maps Platform project and may incur Places API charges.',
        coverageNotice: 'Google Places returns a relevance-selected sample of up to five reviews, not a complete history.',
    },
    outscraper: {
        name: 'Outscraper',
        run: outscraper,
        costNotice: 'This explicit request may consume Outscraper credits, including when no matching reviews are returned.',
        coverageNotice: 'Trend statements describe at most 20 recent reviews returned by this request, not the complete review history.',
    },
} as const

export async function resolveReviews(providerId: string, query: string): Promise<ReviewInsightsResult> {
    const provider = providers[providerId as keyof typeof providers]
    if (!provider) throw new Error('This review provider is not supported.')
    const credential = getCredential(providerId)
    if (!credential) throw new Error('Connect this review provider in dashboard Settings first.')
    const result = await provider.run(query, credential)
    return {
        provider: providerId,
        providerName: provider.name,
        ...result,
        observedAt: new Date().toISOString(),
        costNotice: provider.costNotice,
        coverageNotice: provider.coverageNotice,
    }
}
