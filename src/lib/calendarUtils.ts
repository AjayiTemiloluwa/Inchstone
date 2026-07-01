/**
 * Calendar utilities
 * Weeks start on Sunday and end on Saturday
 * Weeks are strictly bound to their month (no cross-month bleeding)
 */

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Gets all weeks in a month, strictly bound to the month.
 * - Week 1 starts on the 1st of the month and ends on the first Saturday.
 * - Subsequent weeks run Sunday-Saturday.
 * - The final week ends on the last day of the month.
 *
 * @param year - Year number
 * @param month - Month number (1-12)
 * @returns Array of weeks, each containing array of days {date: Date, weekNumber: number}
 */
export function getWeeksInMonth(year: number, month: number): Array<Array<{ date: Date, weekNumber: number }>> {
    const weeks: Array<Array<{ date: Date, weekNumber: number }>> = [];
    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();

    let currentWeek: Array<{ date: Date, weekNumber: number }> = [];
    let weekCount = 1;

    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay(); // 0=Sunday

        // If it's Sunday, push the current week (if it exists) and start a new week
        if (dayOfWeek === 0) {
            if (currentWeek.length > 0) {
                weeks.push(currentWeek);
                weekCount++;
            }
            currentWeek = [];
        }

        currentWeek.push({ date, weekNumber: weekCount });
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
 * Note: This returns a full Sunday-Saturday week (7 days) based on ISO week logic.
 * For month-bound weeks, use getWeeksInMonth instead.
 * @param year - Year number
 * @param week - Week number (1-53)
 * @returns Array of 7 days for the week
 */
export function getDaysInWeek(year: number, week: number): Date[] {
    // Find the first Sunday of week 1.
    const jan4 = new Date(year, 0, 4);
    const jan4DayOfWeek = jan4.getDay(); // 0=Sunday
    const week1Sunday = new Date(jan4);
    week1Sunday.setDate(jan4.getDate() - jan4DayOfWeek);

    // Calculate the Sunday of the target week
    const sunday = new Date(week1Sunday);
    sunday.setDate(week1Sunday.getDate() + (week - 1) * 7);

    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(sunday);
        date.setDate(sunday.getDate() + i);
        result.push(date);
    }

    return result;
}
