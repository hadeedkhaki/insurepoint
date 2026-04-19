import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const emptyForm = {
  // Patient Information
  firstName: '', middleName: '', lastName: '',
  dob: '', ssn: '', gender: '',
  address: '', apt: '', city: '', state: '', zipCode: '',
  phone: '', email: '',
  employer: '',
  employment: '',
  maritalStatus: '',
  ethnicity: '',
  race: '',
  language: '',
  reasonForVisit: '',

  // Emergency Contact
  emergencyName: '', emergencyPhone: '', emergencyRelationship: '',

  // Insurance Information
  insuranceName: '', policyNumber: '', groupNumber: '',

  // Primary Care Physician
  pcp: '',

  // Insured Information
  insuredSameAsPatient: false,
  insuredFirstName: '', insuredMiddleName: '', insuredLastName: '',
  insuredDob: '', insuredGender: '',
  insuredRelationship: '',
  insuredApt: '',
};

const STORAGE_KEY = 'insured_reg_draft';

function loadDraft() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return null;
}

function saveDraft(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — ignore */ }
}

function clearDraft() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export default function Registration() {
  const navigate = useNavigate();
  const location = useLocation();
  const draft = useRef(loadDraft()).current;
  const [form, setForm] = useState(draft?.form || { ...emptyForm });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [licensePreview, setLicensePreview] = useState(draft?.licensePreview || null);
  const [licenseScanning, setLicenseScanning] = useState(false);
  const [licenseScanned, setLicenseScanned] = useState(draft?.licenseScanned || false);

  const [licenseError, setLicenseError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const licenseInputRef = useRef(null);

  const handleLicenseFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLicensePreview(ev.target.result);
      setLicenseScanned(false);
      setLicenseError(null);
    };
    reader.readAsDataURL(file);
  };

  const startLicenseCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      alert('Could not access camera. Please check permissions.');
    }
  };

  const stopLicenseCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureLicensePhoto = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setLicensePreview(dataUrl);
    setLicenseScanned(false);
    setLicenseError(null);
    stopLicenseCamera();
  };

  const scanLicense = async () => {
    if (!licensePreview) return;
    setLicenseScanning(true);
    setLicenseError(null);
    try {
      const res = await fetch('/api/scan-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: licensePreview }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Scan failed');
      }
      const data = await res.json();
      // Auto-fill form with extracted data
      setForm(prev => ({
        ...prev,
        firstName: data.firstName || prev.firstName,
        middleName: data.middleName || prev.middleName,
        lastName: data.lastName || prev.lastName,
        dob: data.dob || prev.dob,
        gender: data.gender || prev.gender,
        address: data.address || prev.address,
        apt: data.apt || prev.apt,
        city: data.city || prev.city,
        state: data.state || prev.state,
        zipCode: data.zipCode || prev.zipCode,
      }));
      setLicenseScanned(true);
    } catch (err) {
      setLicenseError(err.message);
    } finally {
      setLicenseScanning(false);
    }
  };

  const clearLicense = () => {
    setLicensePreview(null);
    setLicenseScanned(false);
    setLicenseError(null);
    stopLicenseCamera();
    if (licenseInputRef.current) licenseInputRef.current.value = '';
  };

  // === Insurance Card Scan ===
  const [insCardPreview, setInsCardPreview] = useState(draft?.insCardPreview || null);
  const [insCardBack, setInsCardBack] = useState(draft?.insCardBack || null);
  const [insCardScanning, setInsCardScanning] = useState(false);
  const [insCardScanned, setInsCardScanned] = useState(draft?.insCardScanned || false);
  const [insCardError, setInsCardError] = useState(null);
  const [insCardCameraActive, setInsCardCameraActive] = useState(false);
  const [insCardSide, setInsCardSide] = useState('front');
  const insCardVideoRef = useRef(null);
  const insCardStreamRef = useRef(null);
  const insCardInputRef = useRef(null);

  // Reset form to clean state when navigating back after a submission
  useEffect(() => {
    const saved = loadDraft();
    if (!saved) {
      setForm({ ...emptyForm });
      setSubmitted(false);
      setLicensePreview(null);
      setLicenseScanned(false);
      setLicenseError(null);
      setInsCardPreview(null);
      setInsCardBack(null);
      setInsCardScanned(false);
      setInsCardError(null);
      setInsCardSide('front');
    }
  }, [location.key]);

  // Auto-save draft to localStorage on changes
  useEffect(() => {
    if (submitted) return; // don't save after submission
    const timer = setTimeout(() => {
      saveDraft({
        form,
        licensePreview,
        licenseScanned,
        insCardPreview,
        insCardBack,
        insCardScanned,
      });
    }, 400); // debounce 400ms
    return () => clearTimeout(timer);
  }, [form, licensePreview, licenseScanned, insCardPreview, insCardBack, insCardScanned, submitted]);

  const handleInsCardFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (insCardSide === 'front') {
        setInsCardPreview(ev.target.result);
      } else {
        setInsCardBack(ev.target.result);
      }
      setInsCardScanned(false);
      setInsCardError(null);
    };
    reader.readAsDataURL(file);
  };

  const startInsCardCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      insCardStreamRef.current = stream;
      if (insCardVideoRef.current) insCardVideoRef.current.srcObject = stream;
      setInsCardCameraActive(true);
    } catch {
      alert('Could not access camera. Please check permissions.');
    }
  };

  const stopInsCardCamera = () => {
    if (insCardStreamRef.current) {
      insCardStreamRef.current.getTracks().forEach((t) => t.stop());
      insCardStreamRef.current = null;
    }
    setInsCardCameraActive(false);
  };

  const captureInsCardPhoto = () => {
    const video = insCardVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    if (insCardSide === 'front') {
      setInsCardPreview(dataUrl);
    } else {
      setInsCardBack(dataUrl);
    }
    setInsCardScanned(false);
    setInsCardError(null);
    stopInsCardCamera();
  };

  const scanInsCard = async () => {
    if (!insCardPreview) return;
    setInsCardScanning(true);
    setInsCardError(null);
    try {
      const images = [insCardPreview];
      if (insCardBack) images.push(insCardBack);

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Scan failed');
      }
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        insuranceName: data.insuranceProvider || prev.insuranceName,
        policyNumber: data.memberId || prev.policyNumber,
        groupNumber: data.groupNumber || prev.groupNumber,
      }));
      setInsCardScanned(true);
    } catch (err) {
      setInsCardError(err.message);
    } finally {
      setInsCardScanning(false);
    }
  };

  const clearInsCard = () => {
    setInsCardPreview(null);
    setInsCardBack(null);
    setInsCardScanned(false);
    setInsCardError(null);
    setInsCardSide('front');
    stopInsCardCamera();
    if (insCardInputRef.current) insCardInputRef.current.value = '';
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: type === 'checkbox' ? checked : value };
      // If "same as patient" is checked, copy patient info to insured
      if (name === 'insuredSameAsPatient' && checked) {
        updated.insuredFirstName = prev.firstName;
        updated.insuredMiddleName = prev.middleName;
        updated.insuredLastName = prev.lastName;
        updated.insuredDob = prev.dob;
        updated.insuredGender = prev.gender;
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSubmitted(true); // stops auto-save from re-saving
    try {
      await fetch('/api/registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    } catch {
      // still proceed even if request fails
    }
    clearDraft();
    setSaving(false);
    navigate('/queue');
  };

  const handleReset = () => {
    setForm({ ...emptyForm });
    setSubmitted(false);
    setLicensePreview(null);
    setLicenseScanned(false);
    clearInsCard();
    clearDraft();
  };

  const handlePrintForm = () => {
    const genderLabel = { male: 'Male', female: 'Female' }[form.gender] || '';
    const employmentLabel = { employed: 'Employed', unemployed: 'Unemployed', 'self-employed': 'Self Employed', retired: 'Retired', disabled: 'Disabled' }[form.employment] || '';
    const maritalLabel = { married: 'Married', single: 'Single', divorced: 'Divorced', widowed: 'Widowed', other: 'Other' }[form.maritalStatus] || '';
    const ethnicityLabel = { hispanic: 'Hispanic/Latino', 'non-hispanic': 'Non-Hispanic/Latino' }[form.ethnicity] || '';
    const raceLabel = { 'american-indian': 'American Indian/Alaska Native', 'asian-pacific': 'Asian/Pacific Islander', black: 'Black/African American', white: 'White', other: 'Other' }[form.race] || '';
    const langLabel = { english: 'English', spanish: 'Spanish', other: 'Other' }[form.language] || '';
    const relLabel = { self: 'Self', spouse: 'Spouse', child: 'Child', other: 'Other' }[form.insuredRelationship] || '';
    const insGenderLabel = { male: 'Male', female: 'Female' }[form.insuredGender] || '';
    const now = new Date().toLocaleString();

    const html = `<!DOCTYPE html><html><head><title>Patient Registration — ${form.lastName}, ${form.firstName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; padding: 24px; }
  h1 { font-size: 18px; text-align: center; margin-bottom: 2px; }
  .subtitle { text-align: center; font-size: 10px; color: #666; margin-bottom: 16px; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #111; padding-bottom: 3px; margin-bottom: 8px; }
  .row { display: flex; gap: 12px; margin-bottom: 6px; }
  .field { flex: 1; }
  .field-label { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #555; letter-spacing: 0.3px; }
  .field-value { font-size: 11px; padding: 3px 0; border-bottom: 1px solid #ccc; min-height: 18px; }
  .field-full { flex: 3; }
  .footer { margin-top: 24px; border-top: 1px solid #ccc; padding-top: 12px; }
  .sig-row { display: flex; gap: 40px; margin-top: 30px; }
  .sig-line { flex: 1; border-bottom: 1px solid #111; padding-top: 40px; text-align: center; font-size: 9px; color: #555; }
  @media print { body { padding: 12px; } }
</style></head><body>
<h1>inSUREd — Patient Registration Form</h1>
<p class="subtitle">Printed ${now}</p>

<div class="section">
  <div class="section-title">Patient Information</div>
  <div class="row">
    <div class="field"><div class="field-label">Last Name</div><div class="field-value">${form.lastName}</div></div>
    <div class="field"><div class="field-label">First Name</div><div class="field-value">${form.firstName}</div></div>
    <div class="field"><div class="field-label">Middle Name</div><div class="field-value">${form.middleName}</div></div>
  </div>
  <div class="row">
    <div class="field"><div class="field-label">Date of Birth</div><div class="field-value">${form.dob}</div></div>
    <div class="field"><div class="field-label">SSN</div><div class="field-value">${form.ssn}</div></div>
    <div class="field"><div class="field-label">Gender</div><div class="field-value">${genderLabel}</div></div>
  </div>
  <div class="row">
    <div class="field field-full"><div class="field-label">Address</div><div class="field-value">${form.address}${form.apt ? ', Apt ' + form.apt : ''}</div></div>
  </div>
  <div class="row">
    <div class="field"><div class="field-label">City</div><div class="field-value">${form.city}</div></div>
    <div class="field"><div class="field-label">State</div><div class="field-value">${form.state}</div></div>
    <div class="field"><div class="field-label">Zip Code</div><div class="field-value">${form.zipCode}</div></div>
  </div>
  <div class="row">
    <div class="field"><div class="field-label">Phone</div><div class="field-value">${form.phone}</div></div>
    <div class="field"><div class="field-label">Email</div><div class="field-value">${form.email}</div></div>
  </div>
  <div class="row">
    <div class="field"><div class="field-label">Employer</div><div class="field-value">${form.employer}</div></div>
    <div class="field"><div class="field-label">Employment Status</div><div class="field-value">${employmentLabel}</div></div>
  </div>
  <div class="row">
    <div class="field"><div class="field-label">Marital Status</div><div class="field-value">${maritalLabel}</div></div>
    <div class="field"><div class="field-label">Ethnicity</div><div class="field-value">${ethnicityLabel}</div></div>
    <div class="field"><div class="field-label">Race</div><div class="field-value">${raceLabel}</div></div>
    <div class="field"><div class="field-label">Language</div><div class="field-value">${langLabel}</div></div>
  </div>
  <div class="row">
    <div class="field field-full"><div class="field-label">Reason for Visit</div><div class="field-value">${form.reasonForVisit}</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Emergency Contact</div>
  <div class="row">
    <div class="field"><div class="field-label">Name</div><div class="field-value">${form.emergencyName}</div></div>
    <div class="field"><div class="field-label">Phone</div><div class="field-value">${form.emergencyPhone}</div></div>
    <div class="field"><div class="field-label">Relationship</div><div class="field-value">${form.emergencyRelationship}</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Insurance Information</div>
  <div class="row">
    <div class="field"><div class="field-label">Insurance Name</div><div class="field-value">${form.insuranceName}</div></div>
    <div class="field"><div class="field-label">Policy/ID Number</div><div class="field-value">${form.policyNumber}</div></div>
    <div class="field"><div class="field-label">Group Number</div><div class="field-value">${form.groupNumber}</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Primary Care Physician</div>
  <div class="row">
    <div class="field field-full"><div class="field-label">Physician Name</div><div class="field-value">${form.pcp}</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Insured Information</div>
  ${form.insuredSameAsPatient ? '<p style="font-size:10px;color:#555;">Same as Patient</p>' : `
  <div class="row">
    <div class="field"><div class="field-label">Last Name</div><div class="field-value">${form.insuredLastName}</div></div>
    <div class="field"><div class="field-label">First Name</div><div class="field-value">${form.insuredFirstName}</div></div>
    <div class="field"><div class="field-label">Middle Name</div><div class="field-value">${form.insuredMiddleName}</div></div>
  </div>
  <div class="row">
    <div class="field"><div class="field-label">Date of Birth</div><div class="field-value">${form.insuredDob}</div></div>
    <div class="field"><div class="field-label">Gender</div><div class="field-value">${insGenderLabel}</div></div>
    <div class="field"><div class="field-label">Relationship</div><div class="field-value">${relLabel}</div></div>
  </div>`}
</div>

<div class="footer">
  <div class="sig-row">
    <div class="sig-line">Patient / Guardian Signature</div>
    <div class="sig-line">Date</div>
  </div>
</div>

</body></html>`;

    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (submitted) {
    return (
      <div className="registration">
        <div className="reg-success">
          <div className="reg-success-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2>Registration Complete</h2>
          <p>Patient <strong>{form.lastName}, {form.firstName}</strong> has been registered successfully.</p>
          <div className="reg-success-actions">
            <button className="btn btn-primary" onClick={handleReset}>Register Another Patient</button>
            <button className="btn btn-secondary" onClick={handlePrintForm}>Print Form</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="registration">
      <div className="page-header">
        <div>
          <h2 className="page-title">Patient Registration</h2>
          <p className="page-sub">Complete all required fields for patient intake</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="reg-form">
        {/* License Scan */}
        <div className="reg-section license-scan-section">
          <h3 className="reg-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="6" y1="8" x2="10" y2="8" />
              <line x1="6" y1="12" x2="18" y2="12" />
              <line x1="6" y1="16" x2="14" y2="16" />
              <circle cx="16" cy="8" r="2" />
            </svg>
            Scan Driver&apos;s License
          </h3>
          <p className="license-scan-hint">Upload or take a photo of the patient&apos;s driver&apos;s license to auto-fill their information</p>

          {!licensePreview && !cameraActive && (
            <div className="license-scan-buttons">
              <label className="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload License
                <input
                  ref={licenseInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLicenseFile}
                  hidden
                />
              </label>
              <button type="button" className="btn btn-secondary" onClick={startLicenseCamera}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Use Camera
              </button>
            </div>
          )}

          {cameraActive && (
            <div className="license-camera-container">
              <video ref={videoRef} autoPlay playsInline className="license-camera-video" />
              <div className="license-camera-actions">
                <button type="button" className="btn btn-primary" onClick={captureLicensePhoto}>Capture</button>
                <button type="button" className="btn btn-secondary" onClick={stopLicenseCamera}>Cancel</button>
              </div>
            </div>
          )}

          {licensePreview && !cameraActive && (
            <div className="license-preview-area">
              <img src={licensePreview} alt="Driver's license" className="license-preview-img" />
              <div className="license-preview-actions">
                {!licenseScanned && !licenseScanning && (
                  <button type="button" className="btn btn-primary" onClick={scanLicense}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    Extract Info
                  </button>
                )}
                {licenseScanning && (
                  <button type="button" className="btn btn-primary" disabled>
                    <div className="spinner-sm" /> Reading license...
                  </button>
                )}
                {licenseScanned && (
                  <span className="license-success">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Fields auto-filled from license
                  </span>
                )}
                <button type="button" className="btn btn-secondary btn-sm" onClick={clearLicense}>Clear</button>
              </div>
            </div>
          )}

          {licenseError && <div className="license-error">{licenseError}</div>}
        </div>

        {/* Patient Information */}
        <div className="reg-section">
          <h3 className="reg-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            Patient Information
          </h3>

          <div className="reg-row reg-row-3">
            <div className="reg-field">
              <label htmlFor="firstName">First Name <span className="req">*</span></label>
              <input id="firstName" name="firstName" value={form.firstName} onChange={handleChange} required />
            </div>
            <div className="reg-field">
              <label htmlFor="middleName">Middle Name</label>
              <input id="middleName" name="middleName" value={form.middleName} onChange={handleChange} />
            </div>
            <div className="reg-field">
              <label htmlFor="lastName">Last Name <span className="req">*</span></label>
              <input id="lastName" name="lastName" value={form.lastName} onChange={handleChange} required />
            </div>
          </div>

          <div className="reg-row reg-row-3">
            <div className="reg-field">
              <label htmlFor="dob">Date of Birth <span className="req">*</span></label>
              <input id="dob" name="dob" type="date" value={form.dob} onChange={handleChange} required />
            </div>
            <div className="reg-field">
              <label htmlFor="ssn">Social Security Number</label>
              <input id="ssn" name="ssn" value={form.ssn} onChange={handleChange} placeholder="XXX-XX-XXXX" />
            </div>
            <div className="reg-field">
              <label htmlFor="gender">Gender <span className="req">*</span></label>
              <select id="gender" name="gender" value={form.gender} onChange={handleChange} required>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div className="reg-row reg-row-4">
            <div className="reg-field reg-field-wide">
              <label htmlFor="address">Address <span className="req">*</span></label>
              <input id="address" name="address" value={form.address} onChange={handleChange} required />
            </div>
            <div className="reg-field">
              <label htmlFor="apt">Apt #/Suite</label>
              <input id="apt" name="apt" value={form.apt} onChange={handleChange} />
            </div>
          </div>

          <div className="reg-row reg-row-3">
            <div className="reg-field">
              <label htmlFor="city">City <span className="req">*</span></label>
              <input id="city" name="city" value={form.city} onChange={handleChange} required />
            </div>
            <div className="reg-field">
              <label htmlFor="state">State <span className="req">*</span></label>
              <input id="state" name="state" value={form.state} onChange={handleChange} required placeholder="TX" />
            </div>
            <div className="reg-field">
              <label htmlFor="zipCode">Zip Code <span className="req">*</span></label>
              <input id="zipCode" name="zipCode" value={form.zipCode} onChange={handleChange} required placeholder="75024" />
            </div>
          </div>

          <div className="reg-row reg-row-2">
            <div className="reg-field">
              <label htmlFor="phone">Phone <span className="req">*</span></label>
              <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} required placeholder="(214) 555-0100" />
            </div>
            <div className="reg-field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="patient@email.com" />
            </div>
          </div>

          <div className="reg-row reg-row-2">
            <div className="reg-field">
              <label htmlFor="employer">Employer</label>
              <input id="employer" name="employer" value={form.employer} onChange={handleChange} />
            </div>
            <div className="reg-field">
              <label htmlFor="employment">Employment Status</label>
              <select id="employment" name="employment" value={form.employment} onChange={handleChange}>
                <option value="">Select</option>
                <option value="employed">Employed</option>
                <option value="unemployed">Unemployed</option>
                <option value="self-employed">Self Employed</option>
                <option value="retired">Retired</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>

          <div className="reg-row reg-row-3">
            <div className="reg-field">
              <label htmlFor="maritalStatus">Marital Status</label>
              <select id="maritalStatus" name="maritalStatus" value={form.maritalStatus} onChange={handleChange}>
                <option value="">Select</option>
                <option value="married">Married</option>
                <option value="single">Single</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="reg-field">
              <label htmlFor="ethnicity">Ethnicity</label>
              <select id="ethnicity" name="ethnicity" value={form.ethnicity} onChange={handleChange}>
                <option value="">Select</option>
                <option value="hispanic">Hispanic/Latino</option>
                <option value="non-hispanic">Non-Hispanic/Latino</option>
              </select>
            </div>
            <div className="reg-field">
              <label htmlFor="race">Race</label>
              <select id="race" name="race" value={form.race} onChange={handleChange}>
                <option value="">Select</option>
                <option value="american-indian">American Indian/Alaska Native</option>
                <option value="asian-pacific">Asian/Native Hawaiian/Pacific Islander</option>
                <option value="black">Black/African American</option>
                <option value="white">White</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="reg-row reg-row-2">
            <div className="reg-field">
              <label htmlFor="language">Language</label>
              <select id="language" name="language" value={form.language} onChange={handleChange}>
                <option value="">Select</option>
                <option value="english">English</option>
                <option value="spanish">Spanish</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="reg-row">
            <div className="reg-field reg-field-full">
              <label htmlFor="reasonForVisit">Reason for Today&apos;s Visit <span className="req">*</span></label>
              <textarea id="reasonForVisit" name="reasonForVisit" value={form.reasonForVisit} onChange={handleChange} required rows="3" placeholder="Describe the reason for the ER visit..." />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="reg-section">
          <h3 className="reg-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.11 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
            </svg>
            Emergency Contact Information
          </h3>

          <div className="reg-row reg-row-3">
            <div className="reg-field">
              <label htmlFor="emergencyName">Name <span className="req">*</span></label>
              <input id="emergencyName" name="emergencyName" value={form.emergencyName} onChange={handleChange} required />
            </div>
            <div className="reg-field">
              <label htmlFor="emergencyPhone">Phone Number <span className="req">*</span></label>
              <input id="emergencyPhone" name="emergencyPhone" type="tel" value={form.emergencyPhone} onChange={handleChange} required />
            </div>
            <div className="reg-field">
              <label htmlFor="emergencyRelationship">Relationship <span className="req">*</span></label>
              <input id="emergencyRelationship" name="emergencyRelationship" value={form.emergencyRelationship} onChange={handleChange} required placeholder="Spouse, Parent, etc." />
            </div>
          </div>
        </div>

        {/* Insurance Information */}
        <div className="reg-section">
          <h3 className="reg-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 10h20" />
            </svg>
            Insurance Information
          </h3>

          {/* Insurance Card Scan */}
          <div className="ins-card-scan-area">
            <p className="license-scan-hint">Upload or take a photo of the insurance card to auto-fill</p>

            {/* Side tabs */}
            {(insCardPreview || insCardBack) && !insCardCameraActive && (
              <div className="ins-card-side-tabs">
                <button type="button" className={`side-tab ${insCardSide === 'front' ? 'active' : ''}`} onClick={() => { stopInsCardCamera(); setInsCardSide('front'); }}>
                  Front {insCardPreview && '\u2713'}
                </button>
                <button type="button" className={`side-tab ${insCardSide === 'back' ? 'active' : ''}`} onClick={() => { stopInsCardCamera(); setInsCardSide('back'); }}>
                  Back {insCardBack && '\u2713'}
                </button>
              </div>
            )}

            {!(insCardSide === 'front' ? insCardPreview : insCardBack) && !insCardCameraActive && (
              <div className="license-scan-buttons">
                <label className="btn btn-primary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload {insCardSide === 'front' ? 'Front' : 'Back'}
                  <input
                    ref={insCardInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleInsCardFile}
                    hidden
                  />
                </label>
                <button type="button" className="btn btn-secondary" onClick={startInsCardCamera}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Use Camera
                </button>
              </div>
            )}

            {insCardCameraActive && (
              <div className="license-camera-container">
                <video ref={insCardVideoRef} autoPlay playsInline className="license-camera-video" />
                <div className="license-camera-actions">
                  <button type="button" className="btn btn-primary" onClick={captureInsCardPhoto}>Capture</button>
                  <button type="button" className="btn btn-secondary" onClick={stopInsCardCamera}>Cancel</button>
                </div>
              </div>
            )}

            {(insCardSide === 'front' ? insCardPreview : insCardBack) && !insCardCameraActive && (
              <div className="license-preview-area">
                <img src={insCardSide === 'front' ? insCardPreview : insCardBack} alt={`${insCardSide} of insurance card`} className="license-preview-img" />
                <div className="license-preview-actions">
                  {!insCardBack && insCardSide === 'front' && insCardPreview && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setInsCardSide('back'); if (insCardInputRef.current) insCardInputRef.current.value = ''; }}>
                      + Add Back of Card
                    </button>
                  )}
                  {!insCardScanned && !insCardScanning && insCardPreview && (
                    <button type="button" className="btn btn-primary" onClick={scanInsCard}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                      Extract Info
                    </button>
                  )}
                  {insCardScanning && (
                    <button type="button" className="btn btn-primary" disabled>
                      <div className="spinner-sm" /> Reading card...
                    </button>
                  )}
                  {insCardScanned && (
                    <span className="license-success">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Insurance fields auto-filled
                    </span>
                  )}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={clearInsCard}>Clear</button>
                </div>
              </div>
            )}

            {insCardError && <div className="license-error">{insCardError}</div>}
          </div>

          <div className="reg-row reg-row-3">
            <div className="reg-field">
              <label htmlFor="insuranceName">Insurance Name <span className="req">*</span></label>
              <input id="insuranceName" name="insuranceName" value={form.insuranceName} onChange={handleChange} required placeholder="e.g. Blue Cross Blue Shield" />
            </div>
            <div className="reg-field">
              <label htmlFor="policyNumber">Policy/ID Number <span className="req">*</span></label>
              <input id="policyNumber" name="policyNumber" value={form.policyNumber} onChange={handleChange} required placeholder="Member ID" />
            </div>
            <div className="reg-field">
              <label htmlFor="groupNumber">Group Number</label>
              <input id="groupNumber" name="groupNumber" value={form.groupNumber} onChange={handleChange} placeholder="Group # or N/A" />
            </div>
          </div>
        </div>

        {/* Primary Care Physician */}
        <div className="reg-section">
          <h3 className="reg-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h18v18H3zM12 8v8M8 12h8" />
            </svg>
            Primary Care Physician
          </h3>

          <div className="reg-row">
            <div className="reg-field reg-field-full">
              <label htmlFor="pcp">Physician Name</label>
              <input id="pcp" name="pcp" value={form.pcp} onChange={handleChange} placeholder="Dr. John Smith" />
            </div>
          </div>
        </div>

        {/* Insured Information */}
        <div className="reg-section">
          <h3 className="reg-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L4 6v5c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" />
            </svg>
            Insured Information
          </h3>

          <div className="reg-row">
            <label className="reg-checkbox">
              <input type="checkbox" name="insuredSameAsPatient" checked={form.insuredSameAsPatient} onChange={handleChange} />
              <span>Same as Patient</span>
            </label>
          </div>

          {!form.insuredSameAsPatient && (
            <>
              <div className="reg-row reg-row-3">
                <div className="reg-field">
                  <label htmlFor="insuredFirstName">First Name</label>
                  <input id="insuredFirstName" name="insuredFirstName" value={form.insuredFirstName} onChange={handleChange} />
                </div>
                <div className="reg-field">
                  <label htmlFor="insuredMiddleName">Middle Name</label>
                  <input id="insuredMiddleName" name="insuredMiddleName" value={form.insuredMiddleName} onChange={handleChange} />
                </div>
                <div className="reg-field">
                  <label htmlFor="insuredLastName">Last Name</label>
                  <input id="insuredLastName" name="insuredLastName" value={form.insuredLastName} onChange={handleChange} />
                </div>
              </div>

              <div className="reg-row reg-row-3">
                <div className="reg-field">
                  <label htmlFor="insuredDob">Date of Birth</label>
                  <input id="insuredDob" name="insuredDob" type="date" value={form.insuredDob} onChange={handleChange} />
                </div>
                <div className="reg-field">
                  <label htmlFor="insuredGender">Gender</label>
                  <select id="insuredGender" name="insuredGender" value={form.insuredGender} onChange={handleChange}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div className="reg-field">
                  <label htmlFor="insuredRelationship">Relationship to Patient</label>
                  <select id="insuredRelationship" name="insuredRelationship" value={form.insuredRelationship} onChange={handleChange}>
                    <option value="">Select</option>
                    <option value="self">Self</option>
                    <option value="spouse">Spouse</option>
                    <option value="child">Child</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="reg-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Submit Registration'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>Clear Form</button>
        </div>
      </form>
    </div>
  );
}
