import { getWeeksInMonth } from '../../lib/calendarUtils';
import { format } from 'date-fns';
import { WeekView } from './WeekView';

type MonthViewProps = {
    year: number;
    month: number;
};

export function MonthView({ year, month }: MonthViewProps) {
    const weeks = getWeeksInMonth(year, month);

    return (
        <div className="month-view">
            <div className="month-header">
                <h2>{format(new Date(year, month - 1, 1), 'MMMM yyyy')}</h2>
            </div>

            <div className="weeks-container">
                {weeks.map((week, index) => {
                    const firstDay = week[0].date;
                    const weekNumber = week[0].weekNumber;

                    return (
                        <div key={index} className="week-row">
                            <div className="week-label">Week {weekNumber}</div>
                            <div className="days-row">
                                {week.map((day, dayIndex) => (
                                    <div key={dayIndex} className="day-cell">
                                        <div className="day-header">
                                            {format(day.date, 'EEE d')}
                                        </div>
                                        {/* Day content would go here */}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
