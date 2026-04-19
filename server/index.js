import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Load mock users and insurance cards
const users = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'mockUsers.json'), 'utf-8'));
const cardsDB = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'cards_by_member_id.json'), 'utf-8'));
const allCards = Object.values(cardsDB);

// ER facility config (hospital-level settings, not per-card)
const erConfig = {
  facilityName: 'inSUREd Medical Center',
  highCopayWarning: 250,
  collectUpfront: true,
  notes: 'Collect copay at time of service when possible',
};

// Helper: convert card to plan object (compatible with ResultCard)
function cardToPlan(card) {
  const cov = card.coverage;
  const hasPreAuth = cov.prior_auth_required_services && cov.prior_auth_required_services.length > 0;

  // Determine plan quality for ER
  const planType = (card.plan_type || '').toUpperCase();
  const planName = (card.plan_name || '').toUpperCase();
  const badPlanTypes = ['EPO', 'HMO', 'LIMITED BENEFIT', 'LIMITED'];
  const goodPlanTypes = ['PPO', 'POS', 'HDHP'];

  const isBadPlan = badPlanTypes.some(t => planType.includes(t) || planName.includes(t));
  const isGoodPlan = goodPlanTypes.some(t => planType.includes(t) || planName.includes(t));

  // Plan rating: good, caution, bad
  let planRating = 'standard';
  if (isBadPlan) planRating = 'bad';
  else if (isGoodPlan) planRating = 'good';
  else if (card.category === 'medicare') planRating = 'good';
  else if (card.category === 'medicaid') planRating = 'caution';

  const copay = cov.copay_er || 0;
  const discountCopay = Math.round(copay * 0.5);

  return {
    planType: card.plan_type || 'Unknown',
    planName: card.plan_name || card.plan_type || 'Unknown',
    category: card.category,
    erCopay: copay,
    erCoinsurance: Math.round((cov.coinsurance_after_deductible || 0) * 100),
    deductible: cov.deductible?.individual || 0,
    deductibleRemaining: cov.deductible?.remaining ?? cov.deductible?.individual ?? 0,
    deductibleMet: cov.deductible?.met_to_date || 0,
    outOfPocketMax: cov.out_of_pocket_max?.individual || 0,
    outOfPocketRemaining: cov.out_of_pocket_max?.remaining ?? 0,
    billable: card.category !== 'medicaid',
    inNetwork: cov.coverage_percent_in_network > 0,
    preAuthRequired: hasPreAuth,
    preAuthServices: cov.prior_auth_required_services || [],
    notes: generateNotes(card),
    planRating,
    isBadPlan,
    discountCopay,
    copayScript: copay > 0
      ? `I see that your emergency visit has a $${copay} copay. If you're able to take care of it today, we can offer you a discount of $${discountCopay}.`
      : null,
    pcp: card.pcp || null,
  };
}

// Helper: generate billing notes based on card
function generateNotes(card) {
  const notes = [];
  const cov = card.coverage;
  const pt = (card.plan_type || '').toUpperCase();
  const pn = (card.plan_name || '').toUpperCase();

  // Bad plan type warnings
  if (pt.includes('EPO') || pn.includes('EPO')) {
    notes.push('⚠ EPO PLAN — Exclusive Provider Organization. Likely out-of-network. Verify network status before proceeding.');
  }
  if (pt.includes('HMO') || pn.includes('HMO')) {
    notes.push('⚠ HMO PLAN — Requires referral/authorization. May deny without PCP referral. Verify network status.');
  }
  if (pt.includes('LIMITED') || pn.includes('LIMITED')) {
    notes.push('⚠ LIMITED BENEFIT PLAN — Restricted coverage. May not cover full ER services.');
  }

  if (card.category === 'medicare') {
    const parts = card.parts_covered || [];
    notes.push(`Medicare ${parts.join(' + ')} coverage.`);
    if (!parts.includes('B')) notes.push('No Part B — outpatient not covered.');
  }
  if (card.category === 'medicaid') {
    notes.push('Medicaid managed care. Verify eligibility monthly.');
    if (cov.copay_er === 0) notes.push('No patient copay required.');
  }
  if (cov.copay_er > 0) {
    const discount = Math.round(cov.copay_er * 0.5);
    notes.push(`Copay: $${cov.copay_er}. Collect at end of visit. Same-day discount: $${discount}.`);
  } else if (cov.copay_er > erConfig.highCopayWarning) {
    notes.push(`High ER copay ($${cov.copay_er}) — collect at end of visit.`);
  }
  if (cov.deductible?.remaining > 2000) {
    notes.push(`High deductible remaining ($${Math.round(cov.deductible.remaining)}) — patient may owe significant amount.`);
  }
  if (cov.coverage_percent_out_of_network === 0) {
    notes.push('No out-of-network coverage.');
  }
  if (card.pharmacy) {
    notes.push(`Rx: BIN ${card.pharmacy.rx_bin}, PCN ${card.pharmacy.rx_pcn}`);
  }
  if (card.termination_date) {
    notes.push(`Coverage terminates ${card.termination_date}.`);
  }

  return notes.join(' ') || 'Standard coverage — bill per protocol.';
}

// ===== AUDIT LOG =====
const auditLog = [];

function logAudit(entry) {
  const record = {
    id: `audit-${auditLog.length + 1}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  auditLog.push(record);
  // Keep last 1000 entries in memory
  if (auditLog.length > 1000) auditLog.shift();
  console.log(`[AUDIT] ${record.timestamp} | ${record.userName || 'system'} (${record.role || '-'}) | ${record.action} | ${record.details || ''}`);
}

// Pre-seeded scan history from real data — spread across last 7 days
const staffNames = ['Sarah Johnson', 'James Rivera', 'Emily Kim', 'Hadeed Khaki'];
const statusOptions = ['completed', 'completed', 'completed', 'completed', 'waiting', 'in-progress', 'cancelled'];
const methodOptions = ['scan', 'scan', 'scan', 'manual'];

// Pick 50 diverse records for history (spread over 7 days)
const allMemberIds = Object.keys(cardsDB);
const seedCount = 50;
const seedMemberIds = [];
const step = Math.floor(allMemberIds.length / seedCount);
for (let i = 0; i < seedCount; i++) {
  seedMemberIds.push(allMemberIds[i * step]);
}

const scanHistory = seedMemberIds.map((mid, i) => {
  const card = cardsDB[mid];
  const plan = cardToPlan(card);

  // Spread across last 7 days, with more recent days having more entries
  const daysAgo = Math.floor((i / seedCount) * 7);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const hour = 7 + (i % 12);
  const minute = (i * 13) % 60;
  date.setHours(hour, minute, 0, 0);

  // Today's entries get active statuses, older ones are completed
  const status = daysAgo === 0
    ? statusOptions[i % statusOptions.length]
    : (daysAgo <= 1 ? 'completed' : 'completed');

  return {
    id: `scan-${i + 1}`,
    timestamp: date.toISOString(),
    status,
    patientName: `${card.subscriber.first_name} ${card.subscriber.last_name}`,
    insuranceProvider: card.payer_name,
    memberId: card.member_id,
    groupNumber: card.group_number || 'N/A',
    planCategory: card.category,
    planType: card.plan_type,
    erCopay: plan.erCopay,
    erCoinsurance: plan.erCoinsurance,
    deductible: plan.deductible,
    billable: plan.billable,
    planRating: plan.planRating,
    isBadPlan: plan.isBadPlan,
    scannedBy: staffNames[i % staffNames.length],
    method: methodOptions[i % methodOptions.length],
    visitNumber: 1,
  };
});

let scanIdCounter = seedCount + 1;

// ===== AUTH =====
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) {
    logAudit({ action: 'login_failed', details: `Failed login attempt for ${email}`, userName: email, role: 'unknown' });
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const { password: _, ...safeUser } = user;
  logAudit({ userId: user.id, userName: user.name, role: user.role, action: 'login', details: `Logged in from ${req.ip}` });
  res.json({ user: safeUser });
});

// ===== AUDIT =====
app.post('/api/audit', (req, res) => {
  logAudit(req.body);
  res.json({ ok: true });
});

app.get('/api/audit', (_req, res) => {
  res.json([...auditLog].reverse().slice(0, 200));
});

// ===== ER CONFIG =====
app.get('/api/er-config', (_req, res) => {
  res.json(erConfig);
});

// ===== SCAN (multi-image) =====
app.post('/api/scan', async (req, res) => {
  const { image, images } = req.body;
  const imageList = images || (image ? [image] : []);

  if (imageList.length === 0) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    const contentParts = [];

    for (const img of imageList) {
      const base64Match = img.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!base64Match) {
        return res.status(400).json({ error: 'Invalid image format' });
      }
      contentParts.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: base64Match[1],
          data: base64Match[2],
        },
      });
    }

    contentParts.push({
      type: 'text',
      text: `Analyze this health insurance card image(s). Extract the following and return as JSON:

- "patientName": Full name of the insured member
- "insuranceProvider": Name of the insurance company (e.g. "Blue Cross Blue Shield", "Aetna", "UnitedHealthcare", "Medicare", "Medicaid")
- "memberId": The member/subscriber ID number
- "groupNumber": The group number (use "N/A" if not found — Medicare/Medicaid often don't have one)
- "planCategory": One of: "employer", "marketplace", "medicare", "medicaid", "government". Determine this by:
  - If the card says "Medicare" or has a Medicare ID (format like 1EG4-TE5-7891): "medicare"
  - If the card says "Medicaid", "CHIP", or state Medicaid program name: "medicaid"
  - If the card mentions "Marketplace", "Healthcare.gov", metal tier (Bronze/Silver/Gold/Platinum): "marketplace"
  - If the card says "TRICARE" or military: "government"
  - If it has a group number and employer info: "employer"
  - If unclear, default to "employer"
- "planType": Specific plan name if visible (e.g. "PPO", "HMO", "EPO", "HDHP", "Medicare Advantage", "Original Medicare")

If you cannot find a field, use "Not Found". Return ONLY the JSON object.`,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: contentParts }],
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Could not parse response from AI' });
    }

    const extracted = JSON.parse(jsonMatch[0]);
    logAudit({ action: 'scan_card', details: `Scanned card for ${extracted.patientName || 'unknown'}, provider: ${extracted.insuranceProvider || 'unknown'}` });
    res.json(extracted);
  } catch (err) {
    console.error('Claude API error:', err.message);
    logAudit({ action: 'scan_error', details: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ===== SCAN LICENSE (driver's license OCR via Tesseract.js) =====
function parseLicenseText(rawText) {
  const text = rawText.replace(/\r/g, '');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const all = lines.join(' ');

  const result = {
    firstName: '', middleName: '', lastName: '',
    dob: '', gender: '', address: '', apt: '',
    city: '', state: '', zipCode: '',
    licenseNumber: '', expirationDate: '', eyeColor: '', height: '', issueDate: '',
  };

  // DL/ID number — look for "DL" or "4d DL" followed by digits
  const dlMatch = all.match(/(?:DL|D\.?L\.?|4d\s*DL)[:\s#]*([A-Z0-9]{6,12})/i) || all.match(/\b(\d{8})\b/);
  if (dlMatch) result.licenseNumber = dlMatch[1].trim();

  // DOB — look for "DOB" label or date pattern after it
  const dobMatch = all.match(/(?:DOB|D\.?O\.?B\.?|3\s*DOB)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
  if (dobMatch) {
    const parts = dobMatch[1].split(/[\/-]/);
    if (parts.length === 3) {
      let [m, d, y] = parts;
      if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y;
      result.dob = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // Expiration
  const expMatch = all.match(/(?:EXP|4b\s*EXP)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
  if (expMatch) {
    const parts = expMatch[1].split(/[\/-]/);
    if (parts.length === 3) {
      let [m, d, y] = parts;
      if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y;
      result.expirationDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // Issue date
  const issMatch = all.match(/(?:ISS|4d\s*ISS)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
  if (issMatch) {
    const parts = issMatch[1].split(/[\/-]/);
    if (parts.length === 3) {
      let [m, d, y] = parts;
      if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y;
      result.issueDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // Sex
  const sexMatch = all.match(/(?:SEX|15\s*Sex)[:\s]*([MF])\b/i);
  if (sexMatch) result.gender = sexMatch[1].toUpperCase() === 'M' ? 'male' : 'female';

  // Eyes
  const eyeMatch = all.match(/(?:EYES|Eye)[:\s]*([A-Z]{2,5})/i);
  if (eyeMatch) result.eyeColor = eyeMatch[1];

  // Height
  const htMatch = all.match(/(?:HGT|Hgt|HT)[:\s]*([\d]'[\s-]?\d{1,2}"?|\d{1}[\-']\d{2})/i);
  if (htMatch) result.height = htMatch[1];

  // Last name — typically labeled "LN" or "1" or after a keyword
  const lnMatch = all.match(/(?:LN|1\s*)[:\s]*([A-Z][A-Z]+)\b/i) || all.match(/\b([A-Z]{2,})\s*\n?\s*[2FN]/);
  // First + Middle — labeled "FN" or "2"
  const fnMatch = all.match(/(?:FN|2\s*)[:\s]*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)/i);

  // Try to find name from common Texas DL patterns
  // Texas format: last name on one line, first middle on next
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for lines that are all caps and look like names
    if (/^[A-Z]{2,}$/.test(line) && !/(DRIVER|LICENSE|TEXAS|CLASS|NONE|DONOR)/.test(line)) {
      if (!result.lastName) {
        result.lastName = line.charAt(0) + line.slice(1).toLowerCase();
        continue;
      }
    }
    // Line with first + middle name
    if (result.lastName && !result.firstName && /^[A-Z]{2,}(\s+[A-Z]{2,})?$/.test(line) && !/(DRIVER|LICENSE|TEXAS|CLASS|NONE|DONOR)/.test(line)) {
      const nameParts = line.split(/\s+/);
      result.firstName = nameParts[0].charAt(0) + nameParts[0].slice(1).toLowerCase();
      if (nameParts[1]) result.middleName = nameParts[1].charAt(0).toUpperCase();
    }
  }

  // Fallback: try labeled patterns
  if (!result.lastName && lnMatch) result.lastName = lnMatch[1].charAt(0) + lnMatch[1].slice(1).toLowerCase();
  if (!result.firstName && fnMatch) {
    const parts = fnMatch[1].trim().split(/\s+/);
    result.firstName = parts[0].charAt(0) + parts[0].slice(1).toLowerCase();
    if (parts[1]) result.middleName = parts[1].charAt(0).toUpperCase();
  }

  // Address — look for street number pattern
  const addrMatch = all.match(/(\d{1,6}\s+[A-Z][A-Za-z\s]+(?:DR|DRIVE|ST|STREET|AVE|AVENUE|BLVD|LN|LANE|CT|COURT|RD|ROAD|WAY|PL|PLACE|CIR|PKWY)[A-Za-z]*)/i);
  if (addrMatch) result.address = addrMatch[1].trim();

  // City, State, Zip — look for pattern like "MURPHY, TX 75094" or "CITY STATE ZIP"
  const cszMatch = all.match(/([A-Z][A-Za-z\s]+),?\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
  if (cszMatch) {
    result.city = cszMatch[1].trim();
    result.state = cszMatch[2];
    result.zipCode = cszMatch[3];
  }

  return result;
}

const LICENSE_PROMPT = `You are extracting structured data from a US driver's license image.

Each field on the license has a small AAMVA field-number printed next to it (1, 2, 3, 4a, 4b, 4d, 5, 8, 9, 12, 15, 16, 18). These numbers are field labels — they are NEVER part of the value. Example: "8 470 LAKEDALE DR" means field 8 (address) is "470 LAKEDALE DR".

Field 1 = family name / last name.
Field 2 = given name(s). The FIRST word on this line is the first name. If there is a SECOND word, it is the middle name.
Field 3 or 4a = date of birth.
Field 4d or "DL" label = driver's license / ID number.
Field 8 = street address.
Field 15 = sex/gender.

IMPORTANT:
- Read names CHARACTER BY CHARACTER. Do not guess. If a letter is ambiguous, pick the most likely real-name letter but do not substitute a more common spelling.
- If field 2 contains a second word (middle name), middleName MUST be set to its first letter (uppercase). Only return middleName = "" if field 2 has a SINGLE word.
- Strip any AAMVA field-number prefix from the address value.

Return exactly one JSON object, no prose, no code fences, no trailing text:
{
  "firstName": "Title Case first name",
  "middleName": "single uppercase letter, or empty string",
  "lastName": "Title Case last name",
  "dob": "YYYY-MM-DD",
  "licenseNumber": "driver's license or ID number as printed, no field-number prefix",
  "gender": "male" or "female",
  "address": "street address, no field-number prefix",
  "apt": "apt/suite number or empty string",
  "city": "Title Case city",
  "state": "2-letter state code",
  "zipCode": "5-digit ZIP"
}`;

app.post('/api/scan-license', async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    const base64Match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!base64Match) {
      return res.status(400).json({ error: 'Invalid image format (expected data URL)' });
    }

    // Debug: persist most recent license image so it can be replayed without re-uploading
    try {
      const ext = base64Match[1].split('/')[1] || 'bin';
      writeFileSync(`/tmp/last-license.${ext}`, base64Match[2], 'base64');
      writeFileSync('/tmp/last-license.mediatype', base64Match[1]);
    } catch (e) {
      console.warn('Could not persist last license image:', e.message);
    }

    // Normalize: honor EXIF orientation, auto-rotate to landscape (licenses are
    // wider than tall), downscale to keep payload small, re-encode as JPEG.
    let normalizedBuf;
    let normalizedMime = 'image/jpeg';
    try {
      const rawBuf = Buffer.from(base64Match[2], 'base64');
      // Bake EXIF orientation into pixels first.
      const oriented = await sharp(rawBuf, { failOn: 'none' }).rotate().jpeg({ quality: 95 }).toBuffer();
      const orientedMeta = await sharp(oriented).metadata();
      let pipeline = sharp(oriented);
      if (orientedMeta.width && orientedMeta.height && orientedMeta.height > orientedMeta.width) {
        // Portrait orientation — rotate 270° (counter-clockwise) to landscape.
        pipeline = pipeline.rotate(270);
      }
      normalizedBuf = await pipeline
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      writeFileSync('/tmp/last-license-normalized.jpeg', normalizedBuf);
    } catch (e) {
      console.warn('[scan-license] sharp normalize failed, using original:', e.message);
      normalizedBuf = Buffer.from(base64Match[2], 'base64');
      normalizedMime = base64Match[1];
    }

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: normalizedMime,
              data: normalizedBuf.toString('base64'),
            },
          },
          { type: 'text', text: LICENSE_PROMPT },
        ],
      }],
    });

    const aiText = response.content[0]?.text?.trim() || '';
    console.log('[scan-license] Claude response:', aiText.substring(0, 800));

    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Could not extract license data' });
    }

    const extracted = JSON.parse(jsonMatch[0]);
    if (extracted.middleName && extracted.middleName.length > 1) {
      extracted.middleName = extracted.middleName.charAt(0).toUpperCase();
    }
    logAudit({ action: 'scan_license', details: `Scanned license for ${extracted.firstName || ''} ${extracted.lastName || ''}`.trim() });
    res.json(extracted);
  } catch (err) {
    console.error('License scan error:', err.message);
    logAudit({ action: 'scan_license_error', details: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ===== LOOKUP — match by provider name, member ID, or plan details =====
app.post('/api/lookup', (req, res) => {
  const { insuranceProvider, planCategory, planType, memberId } = req.body;

  // Try direct member ID lookup first
  if (memberId && cardsDB[memberId]) {
    const card = cardsDB[memberId];
    const plan = cardToPlan(card);

    return res.json({
      matched: true,
      provider: card.payer_name,
      plan,
      patientResponsibility: plan.erCopay,
      erConfig,
      subscriber: card.subscriber,
      memberId: card.member_id,
      groupNumber: card.group_number,
      effectiveDate: card.effective_date,
      status: card.status,
    });
  }

  // Fuzzy match by provider name + category + plan type
  const name = (insuranceProvider || '').toLowerCase();
  const cat = (planCategory || '').toLowerCase();
  const type = (planType || '').toLowerCase();

  // Build issuer name mapping for fuzzy matching
  const issuerAliases = {
    'blue cross': ['BCBSTX', 'BCBS_other'],
    'bcbs': ['BCBSTX', 'BCBS_other'],
    'blue cross blue shield': ['BCBSTX', 'BCBS_other'],
    'blue shield': ['BCBSTX', 'BCBS_other'],
    'anthem': ['BCBSTX', 'BCBS_other'],
    'aetna': ['Aetna', 'MA_Aetna'],
    'unitedhealth': ['UnitedHealthcare', 'MA_UnitedHealthcare'],
    'united healthcare': ['UnitedHealthcare', 'MA_UnitedHealthcare'],
    'uhc': ['UnitedHealthcare', 'MA_UnitedHealthcare'],
    'cigna': ['Cigna'],
    'kaiser': ['Kaiser'],
    'humana': ['Humana', 'MA_Humana'],
    'molina': ['MolinaTX'],
    'superior': ['Superior'],
    'community health': ['CommunityHealthChoice'],
    'oscar': ['Oscar'],
    'ambetter': ['Ambetter'],
    'baylor scott': ['BSW'],
    'bsw': ['BSW'],
    'health partners': ['HealthPartners'],
    'healthpartners': ['HealthPartners'],
    'medicare': ['OriginalMedicare', 'MA_UnitedHealthcare', 'MA_Humana', 'MA_BCBSTX', 'MA_Aetna'],
    'medicaid': ['MolinaTX', 'Superior', 'TexasMedicaid_FFS', 'CommunityHealthChoice', 'UnitedHealthcare'],
    'tricare': [],
  };

  // Find matching issuer keys
  let matchingKeys = [];
  for (const [alias, keys] of Object.entries(issuerAliases)) {
    if (name.includes(alias) || alias.includes(name)) {
      matchingKeys.push(...keys);
    }
  }

  // Also try matching against payer_name directly
  if (matchingKeys.length === 0) {
    const directMatch = allCards.find(c => c.payer_name.toLowerCase().includes(name) || name.includes(c.payer_name.toLowerCase()));
    if (directMatch) {
      matchingKeys = [directMatch.issuer_key];
    }
  }

  if (matchingKeys.length === 0) {
    return res.json({ matched: false, erConfig });
  }

  // Filter cards by matching issuer keys
  let candidates = allCards.filter(c => matchingKeys.includes(c.issuer_key));

  // Narrow by category if provided
  if (cat && candidates.some(c => c.category === cat)) {
    candidates = candidates.filter(c => c.category === cat);
  }

  // Narrow by plan type if provided
  if (type && candidates.some(c => c.plan_type.toLowerCase().includes(type))) {
    candidates = candidates.filter(c => c.plan_type.toLowerCase().includes(type));
  }

  // Pick the best match (first one)
  const card = candidates[0];
  if (!card) {
    return res.json({ matched: false, erConfig });
  }

  const plan = cardToPlan(card);

  res.json({
    matched: true,
    provider: card.payer_name,
    plan,
    patientResponsibility: plan.erCopay,
    erConfig,
  });
});

// ===== MEMBER LOOKUP (direct by ID) =====
app.get('/api/member/:memberId', (req, res) => {
  const card = cardsDB[req.params.memberId];
  if (!card) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const plan = cardToPlan(card);

  res.json({
    matched: true,
    provider: card.payer_name,
    subscriber: card.subscriber,
    memberId: card.member_id,
    groupNumber: card.group_number,
    effectiveDate: card.effective_date,
    status: card.status,
    category: card.category,
    plan,
    patientResponsibility: plan.erCopay,
    erConfig,
    pharmacy: card.pharmacy,
  });
});

// ===== PATIENTS (paginated directory of all cards) =====
app.get('/api/patients', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
  const search = (req.query.search || '').toLowerCase();
  const category = (req.query.category || '').toLowerCase();

  let filtered = allCards;

  if (search) {
    filtered = filtered.filter(c =>
      `${c.subscriber.first_name} ${c.subscriber.last_name}`.toLowerCase().includes(search) ||
      c.payer_name.toLowerCase().includes(search) ||
      c.member_id.toLowerCase().includes(search) ||
      (c.plan_name || '').toLowerCase().includes(search)
    );
  }

  if (category) {
    filtered = filtered.filter(c => c.category === category);
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const pageItems = filtered.slice(start, start + limit);

  const patients = pageItems.map(c => {
    const plan = cardToPlan(c);
    return {
      memberId: c.member_id,
      name: `${c.subscriber.first_name} ${c.subscriber.last_name}`,
      dob: c.subscriber.dob,
      provider: c.payer_name,
      planName: c.plan_name,
      planType: c.plan_type,
      category: c.category,
      groupNumber: c.group_number || 'N/A',
      status: c.status,
      effectiveDate: c.effective_date,
      erCopay: plan.erCopay,
      erCoinsurance: plan.erCoinsurance,
      deductible: plan.deductible,
      deductibleRemaining: plan.deductibleRemaining,
      outOfPocketMax: plan.outOfPocketMax,
      billable: plan.billable,
      inNetwork: plan.inNetwork,
      preAuthRequired: plan.preAuthRequired,
      planRating: plan.planRating,
      isBadPlan: plan.isBadPlan,
      discountCopay: plan.discountCopay,
      copayScript: plan.copayScript,
      pcp: plan.pcp,
    };
  });

  res.json({ patients, page, totalPages, total });
});

// ===== REGISTRATION =====
const registrations = [];
let regIdCounter = 1;

app.post('/api/registration', (req, res) => {
  const reg = {
    id: `reg-${regIdCounter++}`,
    timestamp: new Date().toISOString(),
    ...req.body,
  };
  registrations.push(reg);

  const b = req.body;
  const fullName = `${b.firstName} ${b.lastName}`;
  const memberId = b.policyNumber || `REG-${Date.now()}`;
  const groupNumber = b.groupNumber || 'N/A';
  const insuranceName = b.insuranceName || 'Unknown';

  // Determine category from insurance name
  let category = 'employer';
  const insLower = insuranceName.toLowerCase();
  if (insLower.includes('medicare')) category = 'medicare';
  else if (insLower.includes('medicaid')) category = 'medicaid';
  else if (insLower.includes('marketplace') || insLower.includes('exchange')) category = 'marketplace';

  // Add to cardsDB and allCards so patient appears in Patient Directory
  const newCard = {
    member_id: memberId,
    payer_name: insuranceName,
    group_number: groupNumber,
    plan_name: `${insuranceName} Plan`,
    plan_type: 'PPO',
    category,
    status: 'active',
    effective_date: new Date().toISOString().split('T')[0],
    subscriber: {
      first_name: b.firstName,
      last_name: b.lastName,
      dob: b.dob || '',
    },
    issuer_key: insuranceName.toLowerCase().replace(/\s+/g, '_'),
    coverage: {
      copay_er: 150,
      copay_urgent_care: 50,
      copay_specialist: 40,
      copay_primary: 25,
      coinsurance_after_deductible: 0.20,
      deductible: { individual: 2000, family: 4000, remaining: 2000, met_to_date: 0 },
      out_of_pocket_max: { individual: 8000, family: 16000 },
      coverage_percent_in_network: 80,
      coverage_percent_out_of_network: 50,
      in_network: true,
      prior_auth_required_services: [],
    },
    pcp: null,
  };
  cardsDB[memberId] = newCard;
  allCards.push(newCard);

  // Add to scanHistory (queue) as waiting
  const queueEntry = {
    id: `scan-${scanIdCounter++}`,
    timestamp: new Date().toISOString(),
    status: 'waiting',
    patientName: fullName,
    insuranceProvider: insuranceName,
    memberId,
    groupNumber,
    planCategory: category,
    planType: 'PPO',
    erCopay: 150,
    erCoinsurance: 20,
    deductible: 2000,
    billable: true,
    planRating: 'standard',
    isBadPlan: false,
    scannedBy: 'Registration',
    method: 'registration',
    visitNumber: 1,
    insuranceUpdated: false,
  };
  scanHistory.push(queueEntry);

  logAudit({ action: 'patient_registered', details: `Registered ${b.lastName}, ${b.firstName}` });
  res.json(reg);
});

app.get('/api/registrations', (_req, res) => {
  res.json([...registrations].reverse());
});

// ===== HISTORY =====
app.get('/api/history', (_req, res) => {
  res.json([...scanHistory].reverse());
});

app.post('/api/history', (req, res) => {
  const entry = {
    id: `scan-${scanIdCounter++}`,
    timestamp: new Date().toISOString(),
    status: 'waiting',
    ...req.body,
  };

  // Auto-detect insurance change: same patient (name match), different provider or member ID
  const patientNameLower = (entry.patientName || '').toLowerCase().trim();
  if (patientNameLower) {
    const previousVisits = scanHistory.filter(s =>
      (s.patientName || '').toLowerCase().trim() === patientNameLower
    );

    if (previousVisits.length > 0) {
      const lastVisit = previousVisits[previousVisits.length - 1];
      const providerChanged = lastVisit.insuranceProvider !== entry.insuranceProvider;
      const memberIdChanged = lastVisit.memberId !== entry.memberId;

      if (providerChanged || memberIdChanged) {
        entry.previousInsurance = {
          provider: lastVisit.insuranceProvider,
          memberId: lastVisit.memberId,
          planType: lastVisit.planType,
          changedFrom: lastVisit.timestamp,
        };
        entry.insuranceUpdated = true;
        logAudit({
          userName: req.body.scannedBy,
          action: 'insurance_updated',
          details: `${entry.patientName} insurance changed: ${lastVisit.insuranceProvider} (${lastVisit.memberId}) → ${entry.insuranceProvider} (${entry.memberId})`,
        });
      }

      // Track visit count
      entry.visitNumber = previousVisits.length + 1;
    } else {
      entry.visitNumber = 1;
    }
  }

  scanHistory.push(entry);
  logAudit({ userName: req.body.scannedBy, action: 'save_record', details: `Saved ${entry.patientName} (${entry.insuranceProvider}) via ${entry.method}` });
  res.json(entry);
});

// ===== QUEUE =====
app.get('/api/queue', (_req, res) => {
  const today = new Date();
  const todayStr = today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toDateString();
  const queue = scanHistory
    .filter((s) => {
      const d = new Date(s.timestamp).toDateString();
      return d === todayStr || d === tomorrowStr;
    })
    .reverse();
  res.json(queue);
});

app.patch('/api/queue/:id', (req, res) => {
  const entry = scanHistory.find((s) => s.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  const oldStatus = entry.status;
  entry.status = req.body.status;
  logAudit({ action: 'queue_update', details: `Patient ${entry.patientName} status: ${oldStatus} → ${entry.status}` });
  res.json(entry);
});

// ===== STATS =====
app.get('/api/stats', (_req, res) => {
  const todayStr = new Date().toDateString();
  const todayScans = scanHistory.filter((s) => new Date(s.timestamp).toDateString() === todayStr);

  const providerMap = {};
  const categoryCount = { employer: 0, marketplace: 0, medicare: 0, medicaid: 0, government: 0 };

  for (const s of scanHistory) {
    const key = s.insuranceProvider || 'Unknown';
    if (!providerMap[key]) {
      providerMap[key] = { provider: key, count: 0, billable: s.billable };
    }
    providerMap[key].count++;

    if (s.planCategory && categoryCount[s.planCategory] !== undefined) {
      categoryCount[s.planCategory]++;
    }
  }

  res.json({
    todayScans: todayScans.length,
    totalScans: scanHistory.length,
    billableCount: scanHistory.filter((s) => s.billable).length,
    highCopayCount: scanHistory.filter((s) => s.erCopay > 250).length,
    queueSize: todayScans.filter((s) => s.status === 'waiting').length,
    categoryCount,
    providerBreakdown: Object.values(providerMap),
    recentScans: [...scanHistory].reverse().slice(0, 10),
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Loaded ${allCards.length} insurance cards from database`);
});
