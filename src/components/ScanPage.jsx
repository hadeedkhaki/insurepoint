import { useState } from 'react';
import ImageCapture from './ImageCapture';
import ResultCard from './ResultCard';
import { useAuth } from '../context/AuthContext';

export default function ScanPage() {
  const { user, isAdmin } = useAuth();
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const handleImageReady = (front, back) => {
    setFrontImage(front);
    setBackImage(back);
    setResult(null);
    setSaved(false);
  };

  const handleScan = async () => {
    if (!frontImage) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);

    try {
      const images = [frontImage];
      if (backImage) images.push(backImage);

      // Step 1: Extract info from card via AI
      const scanRes = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });

      if (!scanRes.ok) {
        const err = await scanRes.json();
        throw new Error(err.error || 'Scan failed');
      }

      const extracted = await scanRes.json();

      // Step 2: Look up provider + plan details
      const lookupRes = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insuranceProvider: extracted.insuranceProvider,
          planCategory: extracted.planCategory,
          planType: extracted.planType,
          memberId: extracted.memberId,
        }),
      });

      const lookup = await lookupRes.json();

      setResult({
        patientName: extracted.patientName || 'Not Found',
        insuranceProvider: lookup.matched ? lookup.provider : (extracted.insuranceProvider || 'Not Found'),
        memberId: extracted.memberId || 'Not Found',
        groupNumber: extracted.groupNumber || 'Not Found',
        planCategory: extracted.planCategory || 'unknown',
        plan: lookup.plan || null,
        patientResponsibility: lookup.patientResponsibility || 0,
        erConfig: lookup.erConfig || null,
        matched: lookup.matched,
      });
    } catch (err) {
      setError(err.message);
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
          method: 'scan',
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

  return (
    <div>
      <h2 className="page-title">Scan Insurance Card</h2>
      <p className="page-sub">Upload or capture front &amp; back of the patient&apos;s insurance card</p>

      <section className="card upload-card">
        <ImageCapture onImageReady={handleImageReady} disabled={loading} />
        {frontImage && (
          <button className="btn btn-primary scan-btn" onClick={handleScan} disabled={loading}>
            {loading ? 'Analyzing...' : 'Verify Insurance'}
          </button>
        )}
      </section>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>Reading card &amp; matching plan...</p>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

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
