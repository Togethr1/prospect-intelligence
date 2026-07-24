export interface FieldConfig {
    id: string;
    label: string;
    enabled: boolean;
    order: number;
    isCustom?: boolean;
    prompt?: string;
    icon?: string;
}

export const DEFAULT_FIELDS: FieldConfig[] = [
    { id: 'call_plan', label: 'Call Plan (Opener, Pitch, Questions)', enabled: true, order: 0, icon: 'Target' },
    { id: 'company_history', label: 'Company History', enabled: true, order: 1, icon: 'Newspaper' },
    { id: 'service_offerings', label: 'Services & Products', enabled: true, order: 2, icon: 'Briefcase' },
    { id: 'key_suppliers', label: 'Brand Suppliers', enabled: true, order: 3, icon: 'Briefcase' },
    { id: 'news_and_announcements', label: 'Recent News', enabled: true, order: 4, icon: 'Newspaper' },
    { id: 'active_deals', label: 'Active Promotions', enabled: true, order: 5, icon: 'Megaphone' },
    { id: 'locations', label: 'Locations', enabled: true, order: 6, icon: 'MapPin' },
    { id: 'software_stack', label: 'Software Stack', enabled: true, order: 7, icon: 'Briefcase' },
    { id: 'employees', label: 'Employees Mentioned', enabled: true, order: 8, icon: 'User' },
    { id: 'social_media', label: 'Social Media', enabled: true, order: 9, icon: 'Megaphone' },
    { id: 'google_reviews', label: 'Google Reviews', enabled: true, order: 10, icon: 'Star' },
    { id: 'review_trends', label: 'Review Trends', enabled: true, order: 11, icon: 'Lightbulb' },
];
