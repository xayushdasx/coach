import type { CompanyInput } from './types'

// A fictional B2B SaaS company, for trying the pipeline end to end.
export const SAMPLE_COMPANY: CompanyInput = {
  companyName: 'Ledgerline',
  overview:
    'Ledgerline is accounts-payable automation software for mid-market companies (200–2,000 employees). It captures invoices from email and PDFs, matches them to purchase orders, routes approvals, and pays vendors. Founded 2019, ~180 employees, 900 customers in India, the Middle East and the UK.',
  product:
    'Ledgerline AP: AI invoice capture (98.5% field accuracy on the standard benchmark), 2- and 3-way PO matching, configurable approval workflows with mobile approvals, vendor portal, scheduled payments via bank integrations, audit trail. Integrations: SAP Business One, Oracle NetSuite, Tally Prime, Microsoft Dynamics 365 Business Central, Zoho Books. Typical result: invoice processing time from ~9 days to ~2 days; cost per invoice down about 60%. Implementation takes 4–6 weeks with a dedicated onboarding manager.',
  pricing:
    'Growth plan: ₹1,80,000 per year up to 6,000 invoices/year. Scale plan: ₹4,20,000 per year up to 20,000 invoices/year, includes 3-way match and vendor portal. Enterprise: custom. One-time implementation fee ₹60,000 (waived on 2-year contracts). Annual contracts, paid annually in advance. 30-day pilot available for Scale and above, on a single entity.',
  salesMotion:
    'B2B, inbound and outbound. First call is a 30-minute discovery + light demo over Google Meet with a finance leader (CFO, Financial Controller, AP Manager). Sales cycle 6–10 weeks, 3–5 people involved: CFO signs, IT reviews security, AP team are daily users.',
  callObjective: 'Qualify the account and book a tailored demo with the AP team and the CFO within the next 2 weeks.',
  buyers:
    'Financial Controller at a 500-person manufacturer drowning in paper invoices; AP Manager at a retail chain with 40 stores and messy approvals; CFO of a fast-growing D2C brand preparing for audit/IPO; IT head who worries about ERP integration and security.',
  methodology:
    'MEDDIC-lite: Metrics (quantify the pain: invoices/month, days to process, late-payment penalties, headcount), Economic buyer, Decision criteria, Decision process, Identify pain, Champion. Discovery before demo — never demo the full product on the first call.',
  script:
    'Open: thank them, confirm time, set agenda ("I\'d like to understand how AP works for you today, share where we\'ve helped similar teams, and agree if a deeper look makes sense"). Discovery: volume, current process, ERP, approval chain, pain and its cost, who else is involved, timeline, what they\'ve tried. Then a 5-minute targeted walkthrough. Close for a tailored demo with named people and a date.',
  objections:
    '"We already use our ERP for this" → ERPs record invoices but don\'t capture or route them; ask how invoices get into the ERP today.\n"Too expensive" → anchor on cost per invoice and late-payment penalties; never discount on call 1.\n"We\'re in the middle of an ERP migration" → we integrate with both; pilot after go-live; book a planning call.\n"IT/security will block it" → ISO 27001, SOC 2 Type II, data hosted in India (Mumbai region); offer a security call.\n"Send me a deck" → offer a 1-page summary tied to their numbers, plus book the demo.\n"Our team will resist change" → onboarding manager, mobile approvals, 4–6 week rollout.',
  competitors:
    'Generic OCR tools (cheap, no matching or approvals). Big suites like Coupa/SAP Concur (expensive, 6+ month rollouts, built for enterprises). Spreadsheets + email (status quo). We win on mid-market fit, Indian ERP integrations (Tally) and 4–6 week go-live.',
  proofPoints:
    'Kesar Foods (manufacturer, 650 employees): processing time 11 days → 2 days. Urbanloom (D2C retailer): 40% fewer late-payment penalties in 6 months. G2 rating 4.7/5.',
  neverSay:
    'Never promise 100% invoice accuracy. Never promise a go-live date under 4 weeks. Never offer a discount on the first call. Never claim an integration we do not have (no QuickBooks, no Xero yet). Never disparage competitors by name.',
  mustSay: 'Mention the pilot is on a single entity. Mention contracts are annual, paid in advance, when pricing comes up.',
  discountRules: 'Only the sales manager can approve discounts, max 10% on Growth and 15% on Scale, only against a 2-year contract or signing by quarter end. Reps can waive the implementation fee only on 2-year contracts.',
  languages: 'English (Indian English, some Hinglish is fine)',
  priorities: 'Discovery depth and quantifying pain matter most. Second: getting a specific next step with the economic buyer. Third: not demoing too early.',
}
