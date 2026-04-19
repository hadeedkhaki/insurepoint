import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const physicians = [
  'Dr. Sarah Chen',
  'Dr. Michael Smith',
  'Dr. James Lee',
  'Dr. Priya Patel',
  'Dr. Robert Kim',
];

function assignPhysician(patientId) {
  let hash = 0;
  for (let i = 0; i < patientId.length; i++) {
    hash = ((hash << 5) - hash) + patientId.charCodeAt(i);
    hash |= 0;
  }
  return physicians[Math.abs(hash) % physicians.length];
}

function formatName(name) {
  if (!name) return 'Unknown';
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return `${last}, ${first}`;
}

function getDayLabel(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function groupByDayLabel(items) {
  const groups = {};
  const order = [];
  for (const item of items) {
    const label = getDayLabel(item.timestamp);
    if (!groups[label]) {
      groups[label] = [];
      order.push(label);
    }
    groups[label].push(item);
  }
  order.sort((a, b) => {
    const rank = { Today: 0, Tomorrow: 1 };
    return (rank[a] ?? 2) - (rank[b] ?? 2);
  });
  return { groups, order };
}

function QueueCard({ patient, onUpdateStatus, onNavigate }) {
  const physician = assignPhysician(patient.id);
  return (
    <div className={`queue-item queue-status-${patient.status}`}>
      <div className="queue-item-main">
        <div className="queue-patient">
          <span
            className="queue-name queue-name-link"
            onClick={() => onNavigate(patient.patientName)}
          >
            {formatName(patient.patientName)}
          </span>
          <span className="queue-physician">{physician}</span>
        </div>
        <div className="queue-details">
          <span className="queue-provider">{patient.insuranceProvider}</span>
          <span className="queue-member">ID: {patient.memberId}</span>
          <span className="queue-time">
            {new Date(patient.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <div className="queue-badges">
        <span className={`badge ${patient.billable ? 'badge-yes' : 'badge-no'}`}>
          {patient.billable ? 'Billable' : 'Non-Billable'}
        </span>
        {patient.erCopay > 250 && (
          <span className="badge badge-warn">High Copay</span>
        )}
        {patient.visitNumber > 1 && (
          <span className="badge badge-visit">Visit #{patient.visitNumber}</span>
        )}
        {patient.insuranceUpdated && (
          <span className="badge badge-insurance-changed">Insurance Updated</span>
        )}
        {(patient.planCategory === 'medicare' || patient.planCategory === 'medicaid') && (
          <span className="badge badge-gov">Gov. Insurance</span>
        )}
      </div>

      <div className="queue-actions">
        {patient.status === 'waiting' && (
          <>
            <button className="btn btn-sm btn-primary" onClick={() => onUpdateStatus(patient.id, 'in-progress')}>
              Check In
            </button>
            <button className="btn btn-sm btn-secondary" onClick={() => onUpdateStatus(patient.id, 'cancelled')}>
              Cancel
            </button>
          </>
        )}
        {patient.status === 'in-progress' && (
          <button className="btn btn-sm btn-success" onClick={() => onUpdateStatus(patient.id, 'completed')}>
            Complete
          </button>
        )}
        {(patient.status === 'completed' || patient.status === 'cancelled') && (
          <>
            <span className={`status-label status-${patient.status}`}>
              {patient.status === 'completed' ? 'Completed' : 'Cancelled'}
            </span>
            <button className="btn btn-sm btn-secondary" onClick={() => onUpdateStatus(patient.id, 'waiting')}>
              Move Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PatientQueue() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkedOutOpen, setCheckedOutOpen] = useState(false);

  const fetchQueue = () => {
    fetch('/api/queue')
      .then((r) => r.json())
      .then(setQueue)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id, status) => {
    await fetch(`/api/queue/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchQueue();
  };

  const goToPatient = (name) => {
    navigate(`/patients?q=${encodeURIComponent(name)}`);
  };

  if (loading) return <div className="loading"><div className="spinner" /><p>Loading queue...</p></div>;

  const active = queue.filter(p => p.status === 'waiting' || p.status === 'in-progress');
  const checkedOut = queue.filter(p => p.status === 'completed' || p.status === 'cancelled');

  const { groups: activeGroups, order: activeOrder } = groupByDayLabel(active);
  const { groups: checkedOutGroups, order: checkedOutOrder } = groupByDayLabel(checkedOut);

  return (
    <div className="patient-queue">
      <div className="page-header">
        <h2 className="page-title">Patient Queue</h2>
        <span className="queue-count">{active.length} active patient{active.length !== 1 ? 's' : ''}</span>
      </div>

      {active.length === 0 ? (
        <div className="empty-state">
          <p>No active patients in queue.</p>
          <p className="empty-sub">Scanned patients will appear here automatically.</p>
        </div>
      ) : (
        <div className="queue-list">
          {activeOrder.map(label => (
            <div key={label} className="queue-date-group">
              <div className="queue-date-header">{label}</div>
              {activeGroups[label].map(patient => (
                <QueueCard key={patient.id} patient={patient} onUpdateStatus={updateStatus} onNavigate={goToPatient} />
              ))}
            </div>
          ))}
        </div>
      )}

      {checkedOut.length > 0 && (
        <div className="checked-out-section">
          <button
            className="checked-out-toggle"
            onClick={() => setCheckedOutOpen(!checkedOutOpen)}
          >
            <span className="checked-out-label">
              Checked Out Patients
              <span className="checked-out-count">{checkedOut.length}</span>
            </span>
            <svg
              className={`checked-out-chevron ${checkedOutOpen ? 'chevron-open' : ''}`}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {checkedOutOpen && (
            <div className="queue-list">
              {checkedOutOrder.map(label => (
                <div key={label} className="queue-date-group">
                  <div className="queue-date-header">{label}</div>
                  {checkedOutGroups[label].map(patient => (
                    <QueueCard key={patient.id} patient={patient} onUpdateStatus={updateStatus} onNavigate={goToPatient} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
