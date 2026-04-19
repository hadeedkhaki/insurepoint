import { useState, useEffect } from 'react';

const categoryLabels = {
  employer: 'Employer',
  marketplace: 'Marketplace',
  medicare: 'Medicare',
  medicaid: 'Medicaid',
  government: 'Government',
};

function ActivityItem({ scan }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`activity-item-wrap ${expanded ? 'expanded' : ''}`}>
      <div className="activity-item" onClick={() => setExpanded(!expanded)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}>
        <div className={`activity-dot activity-dot-${scan.profitability || 'medium'}`} />
        <div className="activity-content">
          <span className="activity-name">{scan.patientName}</span>
          <span className="activity-detail">{scan.planType || scan.insuranceProvider}</span>
        </div>
        <div className="activity-meta">
          <span className="activity-reimb">${scan.expectedReimbursement || 0}</span>
          <span className="activity-time">
            {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className={`activity-chevron ${expanded ? 'chevron-open' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="activity-expanded">
          <div className="activity-detail-grid">
            <div className="activity-field">
              <span className="activity-field-label">Insurance Provider</span>
              <span className="activity-field-value">{scan.insuranceProvider}</span>
            </div>
            <div className="activity-field">
              <span className="activity-field-label">Member ID</span>
              <span className="activity-field-value mono">{scan.memberId}</span>
            </div>
            <div className="activity-field">
              <span className="activity-field-label">Group Number</span>
              <span className="activity-field-value mono">{scan.groupNumber || 'N/A'}</span>
            </div>
            <div className="activity-field">
              <span className="activity-field-label">Plan Category</span>
              <span className="activity-field-value">
                <span className={`category-badge cat-${scan.planCategory}`}>
                  {categoryLabels[scan.planCategory] || scan.planCategory}
                </span>
              </span>
            </div>
            <div className="activity-field">
              <span className="activity-field-label">Plan Type</span>
              <span className="activity-field-value">{scan.planType || 'Unknown'}</span>
            </div>
            <div className="activity-field">
              <span className="activity-field-label">ER Copay</span>
              <span className={`activity-field-value ${scan.erCopay > 250 ? 'text-red' : ''}`}>${scan.erCopay || 0}</span>
            </div>
            <div className="activity-field">
              <span className="activity-field-label">Coinsurance</span>
              <span className="activity-field-value">{scan.erCoinsurance || 0}%</span>
            </div>
            <div className="activity-field">
              <span className="activity-field-label">Deductible</span>
              <span className="activity-field-value">${(scan.deductible || 0).toLocaleString()}</span>
            </div>
            <div className="activity-field">
              <span className="activity-field-label">Expected Reimbursement</span>
              <span className="activity-field-value">${(scan.expectedReimbursement || 0).toLocaleString()}</span>
            </div>
            <div className="activity-field">
              <span className="activity-field-label">Profitability</span>
              <span className={`activity-field-value profit-${scan.profitability || 'medium'}`}>
                {(scan.profitability || 'unknown').charAt(0).toUpperCase() + (scan.profitability || 'unknown').slice(1)}
              </span>
            </div>
            <div className="activity-field">
              <span className="activity-field-label">Billable</span>
              <span className="activity-field-value">{scan.billable ? 'Yes' : 'No'}</span>
            </div>
            <div className="activity-field">
              <span className="activity-field-label">Status</span>
              <span className={`activity-field-value status-${scan.status}`}>
                {scan.status?.charAt(0).toUpperCase() + scan.status?.slice(1)}
              </span>
            </div>
            <div className="activity-field">
              <span className="activity-field-label">Method</span>
              <span className="activity-field-value">{scan.method === 'scan' ? 'Card Scan' : 'Manual Entry'}</span>
            </div>
            <div className="activity-field">
              <span className="activity-field-label">Scanned By</span>
              <span className="activity-field-value">{scan.scannedBy}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /><p>Loading dashboard...</p></div>;
  if (!stats) return <div className="error-banner">Failed to load dashboard data.</div>;

  const cc = stats.categoryCount || {};

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-sub">Financial overview &amp; patient flow</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-number">{stats.todayScans}</span>
            <span className="stat-label">Scans Today</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-number">${(stats.totalExpectedReimbursement / 1000).toFixed(1)}k</span>
            <span className="stat-label">Expected Revenue</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-indigo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-number">${stats.avgReimbursement}</span>
            <span className="stat-label">Avg Reimbursement</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-red">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-number">{stats.lowReimbursementCount}</span>
            <span className="stat-label">Low Profit Flags</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-number">{stats.queueSize}</span>
            <span className="stat-label">Waiting</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-teal">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a4 4 0 00-8 0v2" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-number">{stats.highCopayCount}</span>
            <span className="stat-label">High Copay</span>
          </div>
        </div>
      </div>

      {/* Plan Category Breakdown */}
      <div className="category-bar-section">
        <h3 className="card-title" style={{ marginTop: 24, marginBottom: 12 }}>Plan Mix</h3>
        <div className="category-bar">
          {Object.entries(cc).filter(([, v]) => v > 0).map(([key, val]) => (
            <div
              key={key}
              className={`cat-segment cat-seg-${key}`}
              style={{ flex: val }}
              title={`${key}: ${val}`}
            >
              {val}
            </div>
          ))}
        </div>
        <div className="category-legend">
          {Object.entries(cc).filter(([, v]) => v > 0).map(([key, val]) => (
            <span key={key} className="legend-item">
              <span className={`legend-dot cat-dot-${key}`} />
              {key.charAt(0).toUpperCase() + key.slice(1)} ({val})
            </span>
          ))}
        </div>
      </div>

      <div className="dash-grid">
        {stats.providerBreakdown.length > 0 && (
          <div className="card">
            <h3 className="card-title">Provider Revenue</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Scans</th>
                  <th>Avg Reimb.</th>
                </tr>
              </thead>
              <tbody>
                {stats.providerBreakdown.map((p) => (
                  <tr key={p.provider}>
                    <td className="td-bold">{p.provider}</td>
                    <td>{p.count}</td>
                    <td>${p.avgReimbursement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {stats.recentScans.length > 0 && (
          <div className="card">
            <h3 className="card-title">Recent Activity</h3>
            <div className="activity-list">
              {stats.recentScans.slice(0, 8).map((s) => (
                <ActivityItem key={s.id} scan={s} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
