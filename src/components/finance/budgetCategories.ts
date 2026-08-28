// Predefined budget categories grouped by section
// Users can also add custom categories beyond these suggestions

export interface BudgetCategoryOption {
    label: string
    icon: string
}

export const SECTION_CATEGORIES: Record<string, BudgetCategoryOption[]> = {
    Need: [
        { label: 'Food / Groceries', icon: '🍲' },
        { label: 'Transport / Gas', icon: '🚗' },
        { label: 'Rent / Mortgage', icon: '🏠' },
        { label: 'Utilities (Electric, Water, Internet)', icon: '💡' },
        { label: 'Healthcare / Insurance', icon: '🏥' },
        { label: 'Clothing / Apparel', icon: '👕' },
        { label: 'Debt Payments', icon: '📉' },
        { label: 'Education / Tuition', icon: '📚' },
    ],
    Want: [
        { label: 'Entertainment (Movies, Games)', icon: '🎬' },
        { label: 'Dining Out / Restaurants', icon: '🍽️' },
        { label: 'Travel / Vacation', icon: '✈️' },
        { label: 'Shopping / Hobbies', icon: '🛍️' },
        { label: 'Subscriptions (Spotify, Netflix)', icon: '🎵' },
        { label: 'Gym / Fitness', icon: '💪' },
        { label: 'Gadgets / Electronics', icon: '📱' },
        { label: 'Gifts / Celebrations', icon: '🎁' },
    ],
    Offerings: [
        { label: 'Tithe (10%)', icon: '✝️' },
        { label: 'Church Offerings', icon: '⛪' },
        { label: 'Charity / Giving', icon: '🤝' },
        { label: 'Missions / Outreach', icon: '🌍' },
        { label: 'Support Family', icon: '👨‍👩‍👧‍👦' },
        { label: 'Ministry / Fellowship', icon: '🙌' },
    ],
    Savings: [
        { label: 'Emergency Fund', icon: '🆘' },
        { label: 'Retirement / 401k', icon: '🏦' },
        { label: 'Investment Portfolio', icon: '📈' },
        { label: 'Education Fund', icon: '🎓' },
        { label: 'Travel Fund', icon: '✈️' },
        { label: 'Home Down Payment', icon: '🏠' },
        { label: 'Vehicle Fund', icon: '🚗' },
        { label: 'Rainy Day Fund', icon: '☂️' },
    ],
}

/** Built-in suggestions for the income side of a transaction. */
export const INCOME_CATEGORIES: BudgetCategoryOption[] = [
    { label: 'Salary / Wages', icon: '💰' },
    { label: 'Freelance / Side Hustle', icon: '💼' },
    { label: 'Business Income', icon: '🏪' },
    { label: 'Investment Returns', icon: '📈' },
    { label: 'Gifts Received', icon: '🎁' },
    { label: 'Refunds / Rebates', icon: '🔄' },
    { label: 'Other Income', icon: '📥' },
]

export function getSectionIcon(section: string): string {
    const icons: Record<string, string> = {
        Need: '💪',
        Want: '🌟',
        Offerings: '🙏',
        Savings: '🏦',
    }
    return icons[section] || '📋'
}