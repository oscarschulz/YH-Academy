export const CONTACTS_ENDPOINT = '/api/contacts'

export const EMPTY_EXTERNAL = {
  fullName: '',
  companyName: '',
  contactRole: '',
  email: '',
  phone: '',
  city: '',
  country: '',
  notes: '',
}

export const LEAD_SELECT_FIELDS = {
  tier: [
    ['', 'Select tier'],
    ['T1', 'T1 - High Value'],
    ['T2', 'T2 - Mid Value'],
    ['T3', 'T3 - Low Value'],
  ],

  contactType: [
    ['', 'Select type'],
    ['employee', 'Employee'],
    ['manager', 'Manager'],
    ['founder', 'Founder'],
    ['owner', 'Owner'],
    ['unknown', 'Unknown'],
  ],

  sourceMethod: [
    ['', 'Select source'],
    ['Google Maps', 'Google Maps'],
    ['Search Engine', 'Search Engine'],
    ['AI Research', 'AI Research'],
    ['Referral', 'Referral'],
    ['Website Form', 'Website Form'],
    ['Social Media', 'Social Media'],
    ['Other', 'Other'],
  ],

  callOutcome: [
    ['', 'Select outcome'],
    ['No answer', 'No answer'],
    ['Gatekeeper only', 'Gatekeeper only'],
    ['Useful conversation', 'Useful conversation'],
    ['Direct contact obtained', 'Direct contact obtained'],
    ['Follow-up opened', 'Follow-up opened'],
    ['Dead lead', 'Dead lead'],
    ['Warm lead', 'Warm lead'],
  ],

  interestLevel: [
    ['', 'Select level'],
    ['Cold', 'Cold'],
    ['Warm', 'Warm'],
    ['Hot', 'Hot'],
  ],

  rapportLevel: [
    ['', 'Select level'],
    ['1', '1'],
    ['2', '2'],
    ['3', '3'],
    ['4', '4'],
    ['5', '5'],
  ],

  pipelineStage: [
    ['', 'Select stage'],
    ['Prospected', 'Prospected'],
    ['Called', 'Called'],
    ['Contact Identified', 'Contact Identified'],
    ['Direct Channel Opened', 'Direct Channel Opened'],
    ['Rapport Building', 'Rapport Building'],
    ['Applied', 'Applied'],
    ['Accepted', 'Accepted'],
    ['Archived', 'Archived'],
  ],

  priority: [
    ['', 'Select priority'],
    ['High', 'High'],
    ['Medium', 'Medium'],
    ['Low', 'Low'],
  ],

  nextAction: [
    ['', 'Select next action'],
    ['Call', 'Call'],
    ['Text', 'Text'],
    ['Email', 'Email'],
    ['Voice Note', 'Voice Note'],
    ['Send Form', 'Send Form'],
    ['Archive', 'Archive'],
    ['Nurture', 'Nurture'],
  ],

  channel: [
    ['', 'Select channel'],
    ['WhatsApp', 'WhatsApp'],
    ['Email', 'Email'],
    ['Phone', 'Phone'],
    ['Telegram', 'Telegram'],
    ['Other', 'Other'],
  ],

  taskStatus: [
    ['', 'Select status'],
    ['Due', 'Due'],
    ['Waiting', 'Waiting'],
    ['Done', 'Done'],
    ['Stalled', 'Stalled'],
    ['Archived', 'Archived'],
  ],

  callType: [
    ['', 'Select call type'],
    ['Initial Call', 'Initial Call'],
    ['Follow-Up Call', 'Follow-Up Call'],
    ['Gatekeeper Call', 'Gatekeeper Call'],
    ['Owner Call', 'Owner Call'],
  ],

  objection: [
    ['', 'Select objection'],
    ['No objection', 'No objection'],
    ['Busy', 'Busy'],
    ['Email me', 'Email me'],
    ['Not interested', 'Not interested'],
    ['Gatekeeper block', 'Gatekeeper block'],
    ['Price objection', 'Price objection'],
    ['Timing objection', 'Timing objection'],
    ['Other', 'Other'],
  ],

  currency: [
    ['USD', 'USD'],
    ['EUR', 'EUR'],
    ['GBP', 'GBP'],
    ['NGN', 'NGN'],
    ['PHP', 'PHP'],
    ['INR', 'INR'],
  ],

  saleEnabled: [
    ['true', 'Submit for Federation marketplace review'],
    ['false', 'Private lead only'],
  ],
}

export const LEAD_FIELDS = [
  ['tier', 'Tier', 'select'],
  ['companyName', 'Company Name', 'text'],
  ['companyWebsite', 'Company Website', 'text'],
  ['contactName', 'Contact Name', 'text'],
  ['contactRole', 'Contact Role', 'text'],
  ['contactType', 'Contact Type', 'select'],
  ['email', 'Email', 'email'],
  ['phone', 'Phone', 'text'],
  ['city', 'City', 'text'],
  ['country', 'Country', 'text'],
  ['sourceMethod', 'Source Method', 'select'],
  ['callOutcome', 'Call Outcome', 'select'],
  ['interestLevel', 'Interest Level', 'select'],
  ['rapportLevel', 'Rapport Level', 'select'],
  ['pipelineStage', 'Pipeline Stage', 'select'],
  ['priority', 'Priority', 'select'],
  ['nextAction', 'Next Action', 'select'],
  ['channel', 'Channel', 'select'],
  ['taskStatus', 'Task Status', 'select'],
  ['callType', 'Call Type', 'select'],
  ['objection', 'Objection', 'select'],
  ['followUpDueDate', 'Follow-up Due Date', 'date'],
  ['sellerPriceAmount', 'Operator Selling Price', 'number'],
  ['currency', 'Currency', 'select'],
  ['saleEnabled', 'Marketplace Listing', 'select'],
]

export function normalizeContact(item = {}, type = '') {
  const cleanType = String(
    type ||
      item.contactType ||
      item.type ||
      '',
  )
    .trim()
    .toLowerCase()

  return {
    id: String(
      item.id ||
        item.contactId ||
        item.leadId ||
        '',
    ).trim(),

    contactType:
      cleanType === 'external'
        ? 'external'
        : 'internal',

    fullName: String(
      item.fullName ||
        item.contactName ||
        item.name ||
        '',
    ).trim(),

    companyName: String(
      item.companyName ||
        item.company ||
        '',
    ).trim(),

    contactRole: String(
      item.contactRole ||
        item.role ||
        '',
    ).trim(),

    email: String(
      item.email || '',
    )
      .trim()
      .toLowerCase(),

    phone: String(
      item.phone || '',
    ).trim(),

    city: String(
      item.city || '',
    ).trim(),

    country: String(
      item.country || '',
    ).trim(),

    notes: String(
      item.notes || '',
    ).trim(),

    sourceMissionId: String(
      item.sourceMissionId ||
        item.leadId ||
        '',
    ).trim(),

    sourceMissionTitle: String(
      item.sourceMissionTitle ||
        item.missionTitle ||
        item.title ||
        '',
    ).trim(),

    status: String(
      item.status || 'active',
    )
      .trim()
      .toLowerCase(),

    createdAt: String(
      item.createdAt || '',
    ).trim(),

    updatedAt: String(
      item.updatedAt || '',
    ).trim(),
  }
}

export function matchesSearch(contact, query) {
  const clean =
    String(query || '')
      .trim()
      .toLowerCase()

  if (!clean) return true

  return [
    contact.fullName,
    contact.companyName,
    contact.contactRole,
    contact.email,
    contact.phone,
    contact.city,
    contact.country,
    contact.notes,
    contact.sourceMissionTitle,
  ].some((value) =>
    String(value || '')
      .toLowerCase()
      .includes(clean),
  )
}
