export interface FieldConfig {
    id: string;
    label: string;
    enabled: boolean;
    order: number;
    isCustom?: boolean;
    prompt?: string;
    icon?: string;
    source?: 'website' | 'connected';
}

export const DEFAULT_FIELDS: FieldConfig[] = [
    { id: 'call_plan', label: 'Call Plan (Opener, Pitch, Questions)', enabled: true, order: 0, icon: 'Target', source: 'website' },
    { id: 'company_history', label: 'Company History', enabled: true, order: 1, icon: 'Newspaper', source: 'website' },
    { id: 'service_offerings', label: 'Services & Products', enabled: true, order: 2, icon: 'Briefcase', source: 'website' },
    { id: 'key_suppliers', label: 'Brand Suppliers', enabled: true, order: 3, icon: 'Briefcase', source: 'website' },
    { id: 'news_and_announcements', label: 'Recent News', enabled: true, order: 4, icon: 'Newspaper', source: 'website' },
    { id: 'active_deals', label: 'Active Promotions', enabled: true, order: 5, icon: 'Megaphone', source: 'website' },
    { id: 'locations', label: 'Locations', enabled: true, order: 6, icon: 'MapPin', source: 'website' },
    { id: 'software_stack', label: 'Software Stack', enabled: true, order: 7, icon: 'Briefcase', source: 'website' },
    { id: 'employees', label: 'Employees Mentioned', enabled: true, order: 8, icon: 'User', source: 'website' },
    { id: 'social_media', label: 'Social Media', enabled: true, order: 9, icon: 'Megaphone', source: 'website' },
    { id: 'google_reviews', label: 'Google Reviews', enabled: true, order: 10, icon: 'Star', source: 'website' },
    { id: 'review_trends', label: 'Review Trends', enabled: true, order: 11, icon: 'Lightbulb', source: 'website' },
    { id: 'crm_context', label: 'CRM Context', enabled: true, order: 12, icon: 'Database', source: 'connected' },
    { id: 'enrichment_results', label: 'Sales Intelligence Output', enabled: true, order: 13, icon: 'Search', source: 'connected' },
    { id: 'review_provider_output', label: 'Connected Review Output', enabled: true, order: 14, icon: 'Star', source: 'connected' },
    { id: 'ai_synthesis', label: 'AI Synthesis Output', enabled: true, order: 15, icon: 'Sparkles', source: 'connected' },
];
