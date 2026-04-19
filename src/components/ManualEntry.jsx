import { useState } from 'react';
import ResultCard from './ResultCard';
import { useAuth } from '../context/AuthContext';

const categories = [
  { value: 'employer', label: 'Employer-Sponsored' },
  { value: 'marketplace', label: 'ACA Marketplace' },
  { value: 'medicare', label: 'Medicare' },
  { value: 'medicaid', label: 'Medicaid' },
  { value: 'government', label: 'Government (Tricare, VA)' },
];

export default function ManualEntry() {
  const { user, isAdmin } = useAuth();
  const [form, setForm] = useState({
    patientName: '',
    insuranceProvider: '',
    memberId: '',
    groupNumber: '',
    planCategory: 'employer',
    planType: '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setSaved(false);

    try {
      const lookupRes = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insuranceProvider: form.insuranceProvider,
          planCategory: form.planCategory,
          planType: form.planType,
          memberId: form.memberId,
        }),
      });

      const lookup = await lookupRes.json();

      setResult({
        patientName: form.patientName || 'Not Provided',
        insuranceProvider: lookup.matched ? lookup.provider : (form.insuranceProvider || 'Not Provided'),
        memberId: form.memberId || 'Not Provided',
        groupNumber: form.groupNumber || 'N/A',
        planCategory: form.planCategory,
        plan: lookup.plan || null,
        patientResponsibility: lookup.patientResponsibility || 0,
        erConfig: lookup.erConfig || null,
        matched: lookup.matched,
      });
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      const saveRes = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: result.patientName,
          insuranceProvider: result.insuranceProvider,
          memberId: result.memberId,
          groupNumber: result.groupNumber,
          planCategory: result.planCategory,
          planType: result.plan?.planType || 'Unknown',
          erCopay: result.plan?.erCopay || 0,
          erCoinsurance: result.plan?.erCoinsurance || 0,
          deductible: result.plan?.deductible || 0,
          billable: result.plan?.billable ?? false,
          planRating: result.plan?.planRating || 'standard',
          isBadPlan: result.plan?.isBadPlan || false,
          scannedBy: user.name,
          method: 'manual',
        }),
      });
      const saved = await saveRes.json();
      if (saved.insuranceUpdated) {
        setResult(prev => ({ ...prev, insuranceUpdated: true, previousInsurance: saved.previousInsurance }));
      }
      setSaved(true);
    } catch {
      // silently fail
    }
  };

  const handleReset = () => {
    setForm({ patientName: '', insuranceProvider: '', memberId: '', groupNumber: '', planCategory: 'employer', planType: '' });
    setResult(null);
    setSaved(false);
  };

  return (
    <div className="manual-entry">
      <h2 className="page-title">Manual Entry</h2>
      <p className="page-sub">Enter insurance info manually when the card can&apos;t be scanned</p>

      <form onSubmit={handleSubmit} className="card manual-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="patientName">Patient Name</label>
            <input id="patientName" name="patientName" value={form.patientName} onChange={handleChange} placeholder="John Doe" required />
          </div>
          <div className="form-group">
            <label htmlFor="insuranceProvider">Insurance Provider</label>
            <input id="insuranceProvider" name="insuranceProvider" value={form.insuranceProvider} onChange={handleChange} placeholder="e.g. Blue Cross Blue Shield" required />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="memberId">Member ID</label>
            <input id="memberId" name="memberId" value={form.memberId} onChange={handleChange} placeholder="XYZ123456789" required />
          </div>
          <div className="form-group">
            <label htmlFor="groupNumber">Group Number</label>
            <input id="groupNumber" name="groupNumber" value={form.groupNumber} onChange={handleChange} placeholder="GRP-001 or N/A" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="planCategory">Plan Category</label>
            <select id="planCategory" name="planCategory" value={form.planCategory} onChange={handleChange} className="form-select">
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="planType">Plan Type (optional)</label>
            <input id="planType" name="planType" value={form.planType} onChange={handleChange} placeholder="PPO, HMO, HDHP, etc." />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Looking up...' : 'Verify Insurance'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>Clear</button>
        </div>
      </form>

      {result && (
        <>
          <ResultCard result={result} isAdmin={isAdmin} />
          <div className="save-actions">
            {!saved ? (
              <button className="btn btn-primary" onClick={handleSave}>
                Save to Patient Queue
              </button>
            ) : (
              <span className="save-success">Saved to queue and history</span>
            )}
            <button className="btn btn-secondary" onClick={() => window.print()}>
              Print Result
            </button>
          </div>
        </>
      )}
    </div>
  );
}
