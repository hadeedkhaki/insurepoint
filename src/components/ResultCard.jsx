const categoryLabels = {
  employer: 'Employer-Sponsored',
  marketplace: 'ACA Marketplace',
  medicare: 'Medicare',
  medicaid: 'Medicaid',
  government: 'Government',
};

const profitColors = {
  high: 'profit-high',
  medium: 'profit-medium',
  low: 'profit-low',
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
    plan, profitability, patientResponsibility, erConfig, matched, planCategory,
  } = result;

  const highCopay = plan && plan.erCopay > (erConfig?.highCopayWarning || 250);
  const isLowReimbursement = profitability === 'low';
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

      {isAdmin && isLowReimbursement && (
        <div className="warning-banner warning-orange">
          Low Reimbursement Plan — Expected ${plan?.expectedReimbursement} on ${erConfig?.avgERCost} avg ER cost
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

      {/* ER Billing Details */}
      {matched && plan && (
        <div className="result-section">
          <h3 className="result-section-title">ER Billing Details</h3>
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
              <span className="billing-label">Est. Patient Owes</span>
              <span className={`billing-value billing-big ${patientResponsibility > 400 ? 'text-red' : ''}`}>
                ${patientResponsibility}
              </span>
            </div>
            {isAdmin && (
              <div className="billing-item">
                <span className="billing-label">Expected Reimbursement</span>
                <span className="billing-value billing-big">${plan.expectedReimbursement.toLocaleString()}</span>
              </div>
            )}
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
            {isAdmin && (
              <div className="assessment-item">
                <span className="assessment-label">Profitability</span>
                <span className={`badge ${profitColors[profitability]}`}>
                  {profitability.charAt(0).toUpperCase() + profitability.slice(1)}
                </span>
              </div>
            )}
            {isAdmin && (
              <div className="assessment-item">
                <span className="assessment-label">Time to Pay</span>
                <span className="assessment-value">{plan.timeToPay}</span>
              </div>
            )}
            <div className="assessment-item">
              <span className="assessment-label">Collect Upfront</span>
              <span className="assessment-value">
                {erConfig?.collectUpfront && plan.erCopay > 0 ? `Yes — $${plan.erCopay}` : 'No'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recommended Service Level — admin only */}
      {isAdmin && matched && plan && (
        <div className="result-section">
          <h3 className="result-section-title">Recommended Service Level</h3>
          {profitability === 'high' && (
            <div className="service-tier tier-premium">
              <div className="tier-header">
                <div className="tier-icon tier-icon-green">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div>
                  <span className="tier-name">Tier 1 — Comprehensive</span>
                  <span className="tier-sub">High reimbursement, full service recommended</span>
                </div>
              </div>
              <div className="tier-services">
                <div className="tier-item tier-included">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Full diagnostic workup (CBC, CMP, UA)
                </div>
                <div className="tier-item tier-included">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Advanced imaging (CT, MRI if indicated)
                </div>
                <div className="tier-item tier-included">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Specialist consult (on-call available)
                </div>
                <div className="tier-item tier-included">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  IV medications &amp; fluids
                </div>
                <div className="tier-item tier-included">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Observation hold if needed (up to 23hrs)
                </div>
                <div className="tier-item tier-included">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Discharge with follow-up referrals
                </div>
              </div>
              <div className="tier-estimate">
                <span>Est. billable range</span>
                <strong>$2,800 — $5,500</strong>
              </div>
            </div>
          )}

          {profitability === 'medium' && (
            <div className="service-tier tier-standard">
              <div className="tier-header">
                <div className="tier-icon tier-icon-yellow">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div>
                  <span className="tier-name">Tier 2 — Standard</span>
                  <span className="tier-sub">Moderate reimbursement, standard ER protocol</span>
                </div>
              </div>
              <div className="tier-services">
                <div className="tier-item tier-included">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Standard labs (CBC, BMP)
                </div>
                <div className="tier-item tier-included">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Basic imaging (X-ray, ultrasound)
                </div>
                <div className="tier-item tier-included">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  ER physician evaluation
                </div>
                <div className="tier-item tier-included">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Oral or IM medications
                </div>
                <div className="tier-item tier-limited">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                  Advanced imaging only if clinically necessary
                </div>
                <div className="tier-item tier-limited">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                  Specialist consult — refer outpatient when possible
                </div>
              </div>
              <div className="tier-estimate">
                <span>Est. billable range</span>
                <strong>$1,500 — $2,800</strong>
              </div>
            </div>
          )}

          {profitability === 'low' && (
            <div className="service-tier tier-basic">
              <div className="tier-header">
                <div className="tier-icon tier-icon-red">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <span className="tier-name">Tier 3 — Essential</span>
                  <span className="tier-sub">Low reimbursement — cost-efficient approach recommended</span>
                </div>
              </div>
              <div className="tier-services">
                <div className="tier-item tier-included">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Focused physician evaluation
                </div>
                <div className="tier-item tier-included">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Point-of-care testing only
                </div>
                <div className="tier-item tier-included">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Basic treatment &amp; stabilization
                </div>
                <div className="tier-item tier-limited">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                  Labs only if emergent indication
                </div>
                <div className="tier-item tier-limited">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                  Imaging only if emergent indication
                </div>
                <div className="tier-item tier-flagged">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                  Consider urgent care referral if non-emergent
                </div>
              </div>
              <div className="tier-estimate">
                <span>Est. billable range</span>
                <strong>$650 — $1,500</strong>
              </div>
            </div>
          )}
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
          <strong>Billing Notes:</strong> {plan.notes}
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
