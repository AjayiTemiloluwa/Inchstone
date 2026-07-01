import { getDaysInWeek } from '../../lib/calendarUtils';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

type WeekViewProps = {
    year: number;
    week: number;
};

export function WeekView({ year, week }: WeekViewProps) {
    const days = getDaysInWeek(year, week);
    const router = useRouter();

    return (
        <div className="week-view">
            <div className="week-header">
                <h3>Week {week} - {year}</h3>
            </div>

            <div className="days-grid">
                {days.map((day, index) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    return (
                        <div
                            key={index}
                            onClick={() => router.push(`/day/${dateStr}`)}
                            className="day-cell cursor-pointer hover:border-gold hover:shadow-md transition-all"
                        >
                            <div className="day-header">
                                {format(day, 'EEEE')} - {format(day, 'MMM d')}
                            </div>
                            <div className="text-xs text-ink/40 mt-1">Click to view details</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
