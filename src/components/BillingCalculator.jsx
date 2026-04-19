import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const categoryIcons = {
  evaluation_and_management: '🏥',
  labs: '🧪',
  imaging_xray: '📷',
  imaging_ct: '🔬',
  imaging_mri: '🧲',
  imaging_ultrasound: '📡',
  cardiac: '❤️',
  procedures: '🔧',
  medications: '💊',
  supplies: '📦',
};

export default function BillingCalculator() {
  const { isAdmin } = useAuth();
  const [catalog, setCatalog] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTests, setSelectedTests] = useState([]);
  const [memberId, setMemberId] = useState('');
  const [patientInfo, setPatientInfo] = useState(null);
  const [billResult, setBillResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [showPatientSearch, setShowPatientSearch] = useState(false);

  useEffect(() => {
    fetch('/api/er-tests')
      .then(r => r.json())
      .then(data => {
        setCatalog(data);
        const firstKey = Object.keys(data)[0];
        if (firstKey) setActiveCategory(firstKey);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const searchPatients = async (q) => {
    setPatientSearch(q);
    if (q.length < 2) { setPatientResults([]); return; }
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(q)}&limit=8`);
      const data = await res.json();
      setPatientResults(data.patients || []);
    } catch { setPatientResults([]); }
  };

  const selectPatient = (p) => {
    setMemberId(p.memberId);
    setPatientInfo(p);
    setPatientSearch('');
    setPatientResults([]);
    setShowPatientSearch(false);
    setBillResult(null);
  };

  const clearPatient = () => {
    setMemberId('');
    setPatientInfo(null);
    setBillResult(null);
  };

  const addTest = (test) => {
    const existing = selectedTests.find(t => t.code === test.code);
    if (existing) {
      setSelectedTests(selectedTests.map(t =>
        t.code === test.code ? { ...t, quantity: t.quantity + 1 } : t
      ));
    } else {
      setSelectedTests([...selectedTests, { ...test, quantity: 1 }]);
    }
    setBillResult(null);
  };

  const removeTest = (code) => {
    setSelectedTests(selectedTests.filter(t => t.code !== code));
    setBillResult(null);
  };

  const updateQuantity = (code, qty) => {
    if (qty < 1) return removeTest(code);
    setSelectedTests(selectedTests.map(t =>
      t.code === code ? { ...t, quantity: qty } : t
    ));
    setBillResult(null);
  };

  const calculateBill = async () => {
    if (selectedTests.length === 0) return;
    setCalculating(true);
    try {
      const res = await fetch('/api/calculate-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codes: selectedTests.map(t => ({ code: t.code, quantity: t.quantity })),
          memberId: memberId || undefined,
        }),
      });
      const data = await res.json();
      setBillResult(data);
    } catch { /* silent */ }
    finally { setCalculating(false); }
  };

  const filteredTests = activeCategory && catalog[activeCategory]
    ? catalog[activeCategory].tests.filter(t =>
        !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  if (loading) return <div className="loading"><div className="spinner" /><p>Loading test catalog...</p></div>;

  return (
    <div className="billing-calculator">
      <div className="page-header">
        <div>
          <h2 className="page-title">ER Billing Calculator</h2>
          <p className="page-sub">Select tests, procedures, and medications to estimate the bill</p>
        </div>
      </div>

      {/* Patient Selection */}
      <div className="bill-patient-section card">
        <h3 className="bill-section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          Patient
        </h3>
        {patientInfo ? (
          <div className="bill-patient-selected">
            <div className="bill-patient-info">
              <span className="bill-patient-name">{patientInfo.name}</span>
              <span className="bill-patient-detail">{patientInfo.provider} &middot; {patientInfo.planType} &middot; <span className={`category-badge cat-${patientInfo.category}`}>{patientInfo.category}</span></span>
              <span className="bill-patient-detail">Member ID: {patientInfo.memberId}</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={clearPatient}>Change</button>
          </div>
        ) : (
          <div className="bill-patient-search">
            <div className="bill-search-input-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b92a5" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search patient by name or member ID..."
                value={patientSearch}
                onChange={(e) => searchPatients(e.target.value)}
                onFocus={() => setShowPatientSearch(true)}
              />
            </div>
            {showPatientSearch && patientResults.length > 0 && (
              <div className="bill-patient-dropdown">
                {patientResults.map(p => (
                  <div key={p.memberId} className="bill-patient-option" onClick={() => selectPatient(p)}>
                    <span className="bill-opt-name">{p.name}</span>
                    <span className="bill-opt-detail">{p.provider} &middot; {p.memberId}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="bill-patient-hint">Or calculate without a patient for generic pricing</p>
          </div>
        )}
      </div>

      <div className="bill-layout">
        {/* Test Catalog */}
        <div className="bill-catalog card">
          <h3 className="bill-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Test &amp; Procedure Catalog
          </h3>

          <div className="bill-catalog-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b92a5" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search tests by name or CPT code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="bill-category-tabs">
            {Object.entries(catalog).map(([key, cat]) => (
              <button
                key={key}
                className={`bill-cat-tab ${activeCategory === key ? 'active' : ''}`}
                onClick={() => { setActiveCategory(key); setSearch(''); }}
              >
                <span className="bill-cat-icon">{categoryIcons[key] || '📋'}</span>
                <span className="bill-cat-label">{cat.name}</span>
              </button>
            ))}
          </div>

          {activeCategory && catalog[activeCategory] && (
            <p className="bill-cat-desc">{catalog[activeCategory].description}</p>
          )}

          <div className="bill-test-list">
            {filteredTests.map(test => {
              const isAdded = selectedTests.some(t => t.code === test.code);
              return (
                <div key={test.code} className={`bill-test-item ${isAdded ? 'bill-test-added' : ''}`}>
                  <div className="bill-test-info">
                    <div className="bill-test-header">
                      <span className="bill-test-code">{test.code}</span>
                      <span className="bill-test-name">{test.name}</span>
                    </div>
                    <p className="bill-test-desc">{test.description}</p>
                    <div className="bill-test-prices">
                      <span className="bill-price-tag">List: ${test.chargemaster_price.toLocaleString()}</span>
                      <span className="bill-price-tag bill-price-ins">Ins: ${test.insurance_negotiated_rate.toLocaleString()}</span>
                      <span className="bill-price-tag bill-price-mcare">MCare: ${test.medicare_rate.toLocaleString()}</span>
                      <span className="bill-price-tag bill-price-mcaid">MCaid: ${test.medicaid_rate.toLocaleString()}</span>
                    </div>
                  </div>
                  <button
                    className={`btn btn-sm ${isAdded ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => addTest(test)}
                  >
                    {isAdded ? '+ More' : 'Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Tests & Bill */}
        <div className="bill-sidebar">
          <div className="bill-selected card">
            <h3 className="bill-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
              </svg>
              Order Summary ({selectedTests.length} item{selectedTests.length !== 1 ? 's' : ''})
            </h3>

            {selectedTests.length === 0 ? (
              <p className="bill-empty">Add tests from the catalog to build the bill.</p>
            ) : (
              <>
                <div className="bill-order-list">
                  {selectedTests.map(t => (
                    <div key={t.code} className="bill-order-item">
                      <div className="bill-order-info">
                        <span className="bill-order-name">{t.name}</span>
                        <span className="bill-order-code">{t.code}</span>
                      </div>
                      <div className="bill-order-controls">
                        <button className="bill-qty-btn" onClick={() => updateQuantity(t.code, t.quantity - 1)}>-</button>
                        <span className="bill-qty">{t.quantity}</span>
                        <button className="bill-qty-btn" onClick={() => updateQuantity(t.code, t.quantity + 1)}>+</button>
                      </div>
                      <button className="bill-remove-btn" onClick={() => removeTest(t.code)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  className="btn btn-primary bill-calculate-btn"
                  onClick={calculateBill}
                  disabled={calculating}
                >
                  {calculating ? 'Calculating...' : 'Calculate Bill'}
                </button>
              </>
            )}
          </div>

          {billResult && (
            <div className="bill-result card">
              <h3 className="bill-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
                Bill Estimate
              </h3>

              {billResult.patient && (
                <div className="bill-result-patient">
                  <span>{billResult.patient.name}</span>
                  <span>{billResult.patient.provider} &middot; {billResult.patient.planType}</span>
                </div>
              )}

              <div className="bill-result-rate">{billResult.rateName}</div>

              <div className="bill-result-lines">
                {billResult.lineItems.map((item, i) => (
                  <div key={i} className="bill-result-line">
                    <div className="bill-line-left">
                      <span className="bill-line-name">{item.name}</span>
                      {item.quantity > 1 && <span className="bill-line-qty">x{item.quantity}</span>}
                    </div>
                    <div className="bill-line-right">
                      {item.lineTotal !== item.chargemasterPrice * item.quantity && (
                        <span className="bill-line-struck">${(item.chargemasterPrice * item.quantity).toLocaleString()}</span>
                      )}
                      <span className="bill-line-price">${item.lineTotal.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bill-result-totals">
                {billResult.savings > 0 && (
                  <div className="bill-total-row bill-savings">
                    <span>Chargemaster Total</span>
                    <span className="bill-line-struck">${billResult.chargemasterTotal.toLocaleString()}</span>
                  </div>
                )}
                <div className="bill-total-row">
                  <span>Facility Subtotal</span>
                  <span>${billResult.subtotal.toLocaleString()}</span>
                </div>
                {billResult.savings > 0 && (
                  <div className="bill-total-row bill-savings-amount">
                    <span>Insurance Savings</span>
                    <span>-${billResult.savings.toLocaleString()}</span>
                  </div>
                )}

                {billResult.costSharing && (
                  <>
                    <div className="bill-divider" />
                    <div className="bill-total-row">
                      <span>ER Copay</span>
                      <span>${billResult.costSharing.copay.toLocaleString()}</span>
                    </div>
                    <div className="bill-total-row">
                      <span>Deductible Applied</span>
                      <span>${Math.round(billResult.costSharing.deductible).toLocaleString()}</span>
                    </div>
                    <div className="bill-total-row">
                      <span>Coinsurance ({patientInfo?.erCoinsurance || 0}%)</span>
                      <span>${billResult.costSharing.coinsurance.toLocaleString()}</span>
                    </div>
                    <div className="bill-divider" />
                    {isAdmin && (
                      <div className="bill-total-row bill-total-insurance">
                        <span>Insurance Pays</span>
                        <span>${billResult.insurancePays.toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )}

                <div className="bill-total-row bill-total-final">
                  <span>Patient Owes</span>
                  <span>${billResult.patientOwes.toLocaleString()}</span>
                </div>
              </div>

              <button className="btn btn-secondary bill-print-btn" onClick={() => window.print()}>
                Print Estimate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
