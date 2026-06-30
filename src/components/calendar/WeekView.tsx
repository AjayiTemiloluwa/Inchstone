import { getDaysInWeek } from '../../lib/calendarUtils';
import { format } from 'date-fns';

type WeekViewProps = {
    year: number;
    week: number;
};

export function WeekView({ year, week }: WeekViewProps) {
    const days = getDaysInWeek(year, week);

    return (
        <div className="week-view">
            <div className="week-header">
                <h3>Week {week} - {year}</h3>
            </div>

            <div className="days-grid">
                {days.map((day, index) => (
                    <div key={index} className="day-cell">
                        <div className="day-header">
                            {format(day, 'EEEE')} - {format(day, 'MMM d')}
                        </div>
                        {/* Day content would go here */}
                    </div>
                ))}
            </div>
        </div>
    );
}