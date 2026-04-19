import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const categoryLabels = {
  employer: 'Employer',
  marketplace: 'Marketplace',
  medicare: 'Medicare',
  medicaid: 'Medicaid',
  government: 'Government',
};

function formatName(name) {
  if (!name) return 'Unknown';
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return `${last}, ${first}`;
}

export default function PatientDirectory() {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const fetchPatients = (p, s, c) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, limit: 25 });
    if (s) params.set('search', s);
    if (c) params.set('category', c);

    fetch(`/api/patients?${params}`)
      .then(r => r.json())
      .then(data => {
        setPatients(data.patients);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPatients(page, search, category);
  }, [page, search, category]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
    setExpandedId(null);
  };

  const handleCategory = (e) => {
    setCategory(e.target.value);
    setPage(1);
    setExpandedId(null);
  };

  const isExpanded = (id) => expandedId === id;
  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="patient-directory">
      <div className="page-header">
        <div>
          <h2 className="page-title">Patient Directory</h2>
          <p className="page-sub">{total.toLocaleString()} patients in database</p>
        </div>
      </div>

      <div className="directory-filters">
        <div className="directory-search">
          <svg className="directory-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, provider, or member ID..."
            value={search}
            onChange={handleSearch}
          />
        </div>
        <select className="directory-category-filter" value={category} onChange={handleCategory}>
          <option value="">All Categories</option>
          <option value="employer">Employer</option>
          <option value="marketplace">Marketplace</option>
          <option value="medicare">Medicare</option>
          <option value="medicaid">Medicaid</option>
        </select>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><p>Loading patients...</p></div>
      ) : patients.length === 0 ? (
        <div className="empty-state">
          <p>No patients found.</p>
          <p className="empty-sub">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <div className="directory-list">
            {patients.map((p) => (
              <div key={p.memberId} className={`directory-item ${isExpanded(p.memberId) ? 'expanded' : ''}`}>
                <div className="directory-item-row" onClick={() => toggleExpand(p.memberId)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && toggleExpand(p.memberId)}>
                  <div className="directory-patient">
                    <span className="directory-name">
                      {formatName(p.name)}
                      {(p.category === 'medicare' || p.category === 'medicaid') && (
                        <svg className="directory-gov-warn" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      )}
                    </span>
                    <span className="directory-provider">{p.provider}</span>
                  </div>
                  <div className="directory-info">
                    <span className={`category-badge cat-${p.category}`}>
                      {categoryLabels[p.category] || p.category}
                    </span>
                    <span className={`directory-status-badge ${p.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                      {p.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                    <span className="directory-plan-type">{p.planType}</span>
                    {(p.category === 'medicare' || p.category === 'medicaid') && (
                      <span className="directory-gov-flag">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        Gov. Insurance
                      </span>
                    )}
                  </div>
                  <div className="directory-member-id">{p.memberId}</div>
                  <div className={`directory-chevron ${isExpanded(p.memberId) ? 'chevron-open' : ''}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {isExpanded(p.memberId) && (
                  <div className="directory-expanded">
                    <div className="directory-detail-grid">
                      <div className="directory-field">
                        <span className="directory-field-label">Full Name</span>
                        <span className="directory-field-value">{p.name}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Date of Birth</span>
                        <span className="directory-field-value">{p.dob}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Member ID</span>
                        <span className="directory-field-value mono">{p.memberId}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Group Number</span>
                        <span className="directory-field-value mono">{p.groupNumber}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Insurance Provider</span>
                        <span className="directory-field-value">{p.provider}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Plan Name</span>
                        <span className="directory-field-value">{p.planName}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Plan Type</span>
                        <span className="directory-field-value">{p.planType}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Category</span>
                        <span className="directory-field-value">
                          <span className={`category-badge cat-${p.category}`}>
                            {categoryLabels[p.category] || p.category}
                          </span>
                        </span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Effective Date</span>
                        <span className="directory-field-value">{p.effectiveDate}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Status</span>
                        <span className={`directory-field-value ${p.status === 'active' ? 'text-accent' : 'text-red'}`}>
                          {p.status?.charAt(0).toUpperCase() + p.status?.slice(1)}
                        </span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">ER Copay</span>
                        <span className={`directory-field-value ${p.erCopay > 250 ? 'text-red' : ''}`}>${p.erCopay}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Coinsurance</span>
                        <span className="directory-field-value">{p.erCoinsurance}%</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Deductible</span>
                        <span className="directory-field-value">${p.deductible.toLocaleString()}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Deductible Remaining</span>
                        <span className="directory-field-value">${Math.round(p.deductibleRemaining).toLocaleString()}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Out-of-Pocket Max</span>
                        <span className="directory-field-value">{p.outOfPocketMax > 0 ? `$${p.outOfPocketMax.toLocaleString()}` : 'N/A'}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">In-Network</span>
                        <span className="directory-field-value">{p.inNetwork ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Billable</span>
                        <span className="directory-field-value">{p.billable ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="directory-field">
                        <span className="directory-field-label">Pre-Auth Required</span>
                        <span className="directory-field-value">{p.preAuthRequired ? 'Yes' : 'No'}</span>
                      </div>
                    </div>

                    {isAdmin && p.pcp && (
                      <div className="directory-pcp-section">
                        <h4 className="directory-section-title">Primary Care Physician</h4>
                        <div className="directory-detail-grid">
                          <div className="directory-field">
                            <span className="directory-field-label">Physician Name</span>
                            <span className="directory-field-value">{p.pcp.name}</span>
                          </div>
                          <div className="directory-field">
                            <span className="directory-field-label">Credentials</span>
                            <span className="directory-field-value">{p.pcp.credentials}</span>
                          </div>
                          <div className="directory-field">
                            <span className="directory-field-label">Specialty</span>
                            <span className="directory-field-value">{p.pcp.specialty}</span>
                          </div>
                          <div className="directory-field">
                            <span className="directory-field-label">Phone</span>
                            <span className="directory-field-value">{p.pcp.phone}</span>
                          </div>
                          <div className="directory-field">
                            <span className="directory-field-label">Medical Group</span>
                            <span className="directory-field-value">{p.pcp.medical_group}</span>
                          </div>
                          <div className="directory-field">
                            <span className="directory-field-label">Provider ID / NPI</span>
                            <span className="directory-field-value mono">{p.pcp.provider_id}{p.pcp.npi ? ` / ${p.pcp.npi}` : ''}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="directory-pagination">
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => { setPage(page - 1); setExpandedId(null); }}
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => { setPage(page + 1); setExpandedId(null); }}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
