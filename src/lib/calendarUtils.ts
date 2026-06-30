/**
 * Calendar utilities implementing ISO 8601 standard
 * Weeks start on Monday (day 1) and end on Sunday (day 7)
 * Week numbering follows ISO 8601 (first week contains the first Thursday of year)
 */

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Gets all weeks in a month with proper mapping to days
 * @param year - Year number
 * @param month - Month number (1-12)
 * @returns Array of weeks, each containing array of days {date: Date, weekNumber: number}
 */
export function getWeeksInMonth(year: number, month: number): Array<Array<{ date: Date, weekNumber: number }>> {
    const weeks: Array<Array<{ date: Date, weekNumber: number }>> = [];
    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();

    let currentWeek: Array<{ date: Date, weekNumber: number }> = [];

    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month - 1, day);
        const weekNumber = getISOWeekNumber(date);
        
        // If it's Sunday (getDay() === 0) and we already have days in the current week,
        // we push the week and start a new one.
        if (date.getDay() === 0 && currentWeek.length > 0) {
            weeks.push(currentWeek);
            currentWeek = [];
        }

        currentWeek.push({ date, weekNumber });
    }

    if (currentWeek.length > 0) {
        weeks.push(currentWeek);
    }

    return weeks;
}

/**
 * Get ISO week number for a date
 * @param date - Date object
 * @returns ISO week number (1-53)
 */
export function getISOWeekNumber(date: Date): number {
    const tempDate = new Date(date);
    tempDate.setHours(0, 0, 0, 0);
    tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);

    const firstThursday = new Date(tempDate.getFullYear(), 0, 4);
    firstThursday.setHours(0, 0, 0, 0);
    firstThursday.setDate(firstThursday.getDate() + 3 - (firstThursday.getDay() + 6) % 7);

    const diff = tempDate.getTime() - firstThursday.getTime();
    return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Get days in a specific week by year and week number
 * @param year - Year number
 * @param week - Week number (1-53)
 * @returns Array of 7 days for the week
 */
export function getDaysInWeek(year: number, week: number): Date[] {
    // ISO weeks start on Monday.
    // Jan 4th is always in ISO week 1. Find the Monday of week 1.
    const jan4 = new Date(year, 0, 4);
    const jan4DayOfWeek = (jan4.getDay() + 6) % 7; // 0=Monday, 6=Sunday
    const week1Monday = new Date(jan4);
    week1Monday.setDate(jan4.getDate() - jan4DayOfWeek);

    // Calculate the Monday of the target week
    const monday = new Date(week1Monday);
    monday.setDate(week1Monday.getDate() + (week - 1) * 7);

    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        result.push(date);
    }

    return result;
}
