import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function toDateKey(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function Calendar() {
  const navigate = useNavigate();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const goToPreviousMonth = () => {
    if (viewMonth === 0) {
      setViewYear((year) => year - 1);
      setViewMonth(11);
    } else {
      setViewMonth((month) => month - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((year) => year + 1);
      setViewMonth(0);
    } else {
      setViewMonth((month) => month + 1);
    }
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button
          type="button"
          className="calendar-nav-button"
          onClick={goToPreviousMonth}
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="calendar-header-center">
          <span className="calendar-title">
            {MONTH_LABELS[viewMonth]} {viewYear}
          </span>
          {!isCurrentMonth && (
            <button type="button" className="calendar-today-button" onClick={goToToday}>
              Today
            </button>
          )}
        </div>
        <button type="button" className="calendar-nav-button" onClick={goToNextMonth} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span className="calendar-weekday" key={label}>
            {label}
          </span>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((day, index) =>
          day === null ? (
            <div className="calendar-cell calendar-cell-empty" key={`empty-${index}`} />
          ) : (
            <button
              type="button"
              key={day}
              className={
                toDateKey(viewYear, viewMonth, day) === todayKey
                  ? 'calendar-cell calendar-cell-day calendar-cell-today'
                  : 'calendar-cell calendar-cell-day'
              }
              onClick={() => navigate(`/plan?date=${toDateKey(viewYear, viewMonth, day)}`)}
            >
              {day}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
