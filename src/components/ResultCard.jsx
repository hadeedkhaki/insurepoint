const categoryLabels = {
  employer: 'Employer-Sponsored',
  marketplace: 'ACA Marketplace',
  medicare: 'Medicare',
  medicaid: 'Medicaid',
  government: 'Government',
};

const planRatingLabels = {
  good: { text: 'Good Plan', className: 'plan-rating-good' },
  standard: { text: 'Standard', className: 'plan-rating-standard' },
  caution: { text: 'Caution', className: 'plan-rating-caution' },
  bad: { text: 'Bad Plan', className: 'plan-rating-bad' },
};

export default function ResultCard({ result, isAdmin = false }) {
  const {
    patientName, insuranceProvider, memberId, groupNumber,
    plan, patientResponsibility, erConfig, matched, planCategory,
  } = result;

  const highCopay = plan && plan.erCopay > (erConfig?.highCopayWarning || 250);
  const isBadPlan = plan?.isBadPlan;
  const planRating = plan?.planRating || 'standard';
  const ratingInfo = planRatingLabels[planRating] || planRatingLabels.standard;

  return (
    <div className="result-card" id="printable-result">
      {isBadPlan && (
        <div className="warning-banner warning-red">
          ⚠ {plan.planType} Plan — This plan type (EPO/HMO/Limited) typically does not reimburse well for ER visits. Verify network status before proceeding.
        </div>
      )}

      {highCopay && (
        <div className="warning-banner">
          High ER Copay: ${plan.erCopay} — Collect at end of visit. Same-day discount: ${plan.discountCopay}.
        </div>
      )}

      {/* Copay Collection Script */}
      {plan?.copayScript && (
        <div className="copay-script-box">
          <div className="copay-script-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span>Patient Script — Say at End of Visit</span>
          </div>
          <p className="copay-script-text">"{plan.copayScript}"</p>
        </div>
      )}

      {result.insuranceUpdated && result.previousInsurance && (
        <div className="insurance-updated-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
          </svg>
          <div>
            <strong>Insurance Updated</strong> — Previously: {result.previousInsurance.provider} (ID: {result.previousInsurance.memberId}, {result.previousInsurance.planType})
          </div>
        </div>
      )}

      <h2>Verification Result</h2>

      {/* Patient & Plan Info */}
      <div className="result-section">
        <h3 className="result-section-title">Patient & Plan</h3>
        <div className="result-grid">
          <div className="result-field">
            <span className="label">Patient Name</span>
            <span className="value">{patientName}</span>
          </div>
          <div className="result-field">
            <span className="label">Insurance Provider</span>
            <span className="value">{insuranceProvider}</span>
          </div>
          <div className="result-field">
            <span className="label">Member ID</span>
            <span className="value value-mono">{memberId}</span>
          </div>
          <div className="result-field">
            <span className="label">Group Number</span>
            <span className="value value-mono">{groupNumber}</span>
          </div>
          <div className="result-field">
            <span className="label">Plan Category</span>
            <span className="value">
              <span className={`category-badge cat-${planCategory}`}>
                {categoryLabels[planCategory] || planCategory || 'Unknown'}
              </span>
            </span>
          </div>
          <div className="result-field">
            <span className="label">Plan Type</span>
            <span className="value">
              {plan?.planType || 'Unknown'}
              {plan && <span className={`plan-rating-badge ${ratingInfo.className}`}>{ratingInfo.text}</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Patient Responsibility */}
      {matched && plan && (
        <div className="result-section">
          <h3 className="result-section-title">Patient Responsibility</h3>
          <div className="billing-grid">
            <div className="billing-item">
              <span className="billing-label">ER Copay</span>
              <span className={`billing-value ${plan.erCopay > 250 ? 'text-red' : ''}`}>
                ${plan.erCopay}
              </span>
            </div>
            <div className="billing-item">
              <span className="billing-label">Coinsurance</span>
              <span className="billing-value">{plan.erCoinsurance}%</span>
            </div>
            <div className="billing-item">
              <span className="billing-label">Deductible</span>
              <span className="billing-value">${plan.deductible.toLocaleString()}</span>
            </div>
            <div className="billing-item">
              <span className="billing-label">Out-of-Pocket Max</span>
              <span className="billing-value">
                {plan.outOfPocketMax > 0 ? `$${plan.outOfPocketMax.toLocaleString()}` : 'N/A'}
              </span>
            </div>
            <div className="billing-item">
              <span className="billing-label">Collect at Check-In</span>
              <span className={`billing-value billing-big ${patientResponsibility > 400 ? 'text-red' : ''}`}>
                ${patientResponsibility}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Profitability & Status */}
      {matched && plan && (
        <div className="result-section">
          <h3 className="result-section-title">Assessment</h3>
          <div className="assessment-grid">
            <div className="assessment-item">
              <span className="assessment-label">Billable</span>
              <span className={`badge ${plan.billable ? 'badge-yes' : 'badge-no'}`}>
                {plan.billable ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="assessment-item">
              <span className="assessment-label">In-Network</span>
              <span className={`badge ${plan.inNetwork ? 'badge-yes' : 'badge-no'}`}>
                {plan.inNetwork ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="assessment-item">
              <span className="assessment-label">Pre-Auth Required</span>
              <span className={`badge ${plan.preAuthRequired ? 'badge-warn' : 'badge-yes'}`}>
                {plan.preAuthRequired ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="assessment-item">
              <span className="assessment-label">Collect Upfront</span>
              <span className="assessment-value">
                {erConfig?.collectUpfront && plan.erCopay > 0 ? `Yes — $${plan.erCopay}` : 'No'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Primary Care Physician — admin only */}
      {isAdmin && plan?.pcp && (
        <div className="result-section">
          <h3 className="result-section-title">Primary Care Physician</h3>
          <div className="result-grid">
            <div className="result-field">
              <span className="label">Physician</span>
              <span className="value">{plan.pcp.name}</span>
            </div>
            <div className="result-field">
              <span className="label">Credentials</span>
              <span className="value">{plan.pcp.credentials}</span>
            </div>
            <div className="result-field">
              <span className="label">Specialty</span>
              <span className="value">{plan.pcp.specialty}</span>
            </div>
            <div className="result-field">
              <span className="label">Phone</span>
              <span className="value">{plan.pcp.phone}</span>
            </div>
            <div className="result-field">
              <span className="label">Medical Group</span>
              <span className="value">{plan.pcp.medical_group}</span>
            </div>
            <div className="result-field">
              <span className="label">Provider ID / NPI</span>
              <span className="value value-mono">{plan.pcp.provider_id}{plan.pcp.npi ? ` / ${plan.pcp.npi}` : ''}</span>
            </div>
          </div>
        </div>
      )}

      {/* Provider Notes */}
      {matched && plan?.notes && (
        <div className="result-notes">
          <strong>Notes:</strong> {plan.notes}
        </div>
      )}

      {!matched && (
        <div className="info-banner">
          Provider not found in network database. Displaying extracted info only — verify manually.
        </div>
      )}
    </div>
  );
}
