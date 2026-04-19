import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ratingLabels = {
  good: { text: 'Good', className: 'plan-rating-good' },
  standard: { text: 'Standard', className: 'plan-rating-standard' },
  caution: { text: 'Caution', className: 'plan-rating-caution' },
  bad: { text: 'Bad', className: 'plan-rating-bad' },
};

function formatName(name) {
  if (!name) return 'Unknown';
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return `${last}, ${first}`;
}

function MiniCalendar({ dateCounts, selectedDate, onSelectDate }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const monthName = new Date(viewYear, viewMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const days = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="cal-day cal-empty" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const count = dateCounts[dateStr] || 0;
    const isToday = d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
    const isSelected = dateStr === selectedDate;

    days.push(
      <button
        key={d}
        className={`cal-day ${isToday ? 'cal-today' : ''} ${isSelected ? 'cal-selected' : ''} ${count > 0 ? 'cal-has-data' : ''}`}
        onClick={() => onSelectDate(isSelected ? null : dateStr)}
        title={count > 0 ? `${count} patient${count > 1 ? 's' : ''}` : ''}
      >
        <span className="cal-day-num">{d}</span>
        {count > 0 && <span className="cal-dot-count">{count}</span>}
      </button>
    );
  }

  return (
    <div className="mini-calendar">
      <div className="cal-header">
        <button className="cal-nav" onClick={prevMonth}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="cal-month">{monthName}</span>
        <button className="cal-nav" onClick={nextMonth}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18" /></svg>
        </button>
      </div>
      <div className="cal-weekdays">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <span key={d} className="cal-weekday">{d}</span>
        ))}
      </div>
      <div className="cal-grid">
        {days}
      </div>
      {selectedDate && (
        <button className="cal-clear" onClick={() => onSelectDate(null)}>
          Show all dates
        </button>
      )}
    </div>
  );
}

export default function ScanHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    fetch('/api/history')
      .then((r) => r.json())
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Count patients per date for calendar
  const dateCounts = {};
  for (const h of history) {
    const d = h.timestamp.split('T')[0];
    dateCounts[d] = (dateCounts[d] || 0) + 1;
  }

  // Filter
  let filtered = history;

  if (selectedDate) {
    filtered = filtered.filter(h => h.timestamp.startsWith(selectedDate));
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(h =>
      h.patientName.toLowerCase().includes(q) ||
      h.insuranceProvider.toLowerCase().includes(q) ||
      h.memberId.toLowerCase().includes(q)
    );
  }

  if (loading) return <div className="loading"><div className="spinner" /><p>Loading history...</p></div>;

  return (
    <div className="scan-history">
      <div className="page-header">
        <h2 className="page-title">Scan History</h2>
        <span className="queue-count">
          {selectedDate
            ? `${filtered.length} record${filtered.length !== 1 ? 's' : ''} on ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : `${history.length} total record${history.length !== 1 ? 's' : ''}`
          }
        </span>
      </div>

      <div className="history-layout">
        <div className="history-main">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search by patient name, provider, or member ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <p>{search || selectedDate ? 'No matching records found.' : 'No scan history yet.'}</p>
            </div>
          ) : (
            <div className="history-list">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date/Time</th>
                    <th>Patient</th>
                    <th>Provider</th>
                    <th>Member ID</th>
                    <th>Category</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h) => (
                    <tr key={h.id}>
                      <td className="td-nowrap">{new Date(h.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="td-bold td-link" onClick={() => navigate(`/patients?q=${encodeURIComponent(h.patientName)}`)}>{formatName(h.patientName)}</td>
                      <td>{h.insuranceProvider}</td>
                      <td><code>{h.memberId}</code></td>
                      <td>
                        <span className={`category-badge cat-${h.planCategory}`}>
                          {h.planCategory?.charAt(0).toUpperCase() + h.planCategory?.slice(1)}
                        </span>
                        {(h.planCategory === 'medicare' || h.planCategory === 'medicaid') && (
                          <span className="gov-flag-inline">GOV</span>
                        )}
                      </td>
                      <td>{h.scannedBy?.split(' ')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="history-sidebar">
          <MiniCalendar
            dateCounts={dateCounts}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          {selectedDate && filtered.length > 0 && (
            <div className="sidebar-patients">
              <h4 className="sidebar-title">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </h4>
              {filtered.map(h => (
                <div key={h.id} className="sidebar-patient" onClick={() => navigate(`/patients?q=${encodeURIComponent(h.patientName)}`)} style={{ cursor: 'pointer' }}>
                  <span className="sidebar-patient-name">{formatName(h.patientName)}</span>
                  <span className="sidebar-patient-time">
                    {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
