const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ margin: 60, size: 'A4' });
const stream = fs.createWriteStream(__dirname + '/google-ads-api-design-doc.pdf');
doc.pipe(stream);

const green = '#2FB963';
const dark = '#1a2332';
const gray = '#6b7280';

// Title
doc.fontSize(24).fillColor(green).text('Regen Agency', { align: 'center' });
doc.fontSize(14).fillColor(dark).text('Google Ads API Tool - Design Document', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(9).fillColor(gray).text('Version 1.0 - March 2026 | Confidential', { align: 'center' });
doc.moveDown(1);
doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#e5e7eb').stroke();
doc.moveDown(1);

// Section helper
function section(title) {
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor(green).text(title);
    doc.moveDown(0.3);
}

function body(text) {
    doc.fontSize(10).fillColor(dark).text(text, { lineGap: 3 });
}

function bullet(text) {
    doc.fontSize(10).fillColor(dark).text('  \u2022  ' + text, { lineGap: 2 });
}

// 1. Overview
section('1. Tool Overview');
body('Tool Name: Regen Agency Ads Reporter');
body('Company: Regen Agency (https://www.regen-agency.com)');
body('Location: France');
body('Type: Internal reporting dashboard for digital marketing agency');
doc.moveDown(0.3);
body('Regen Agency is a digital marketing agency specializing in e-commerce. We manage Google Ads campaigns for multiple clients across various industries. This tool is an internal dashboard that automatically retrieves campaign performance data to generate reports and track ROAS, CPA, and other KPIs for each client.');

// 2. Purpose
section('2. Purpose & Functionality');
body('The tool provides read-only access to the Google Ads API to extract advertising performance metrics for our managed client accounts. It serves as an internal reporting dashboard used exclusively by agency employees.');
doc.moveDown(0.3);
body('Key Features:');
bullet('Read-only access to Google Ads API (no campaign modifications)');
bullet('Retrieves campaign metrics: spend, clicks, impressions, CTR, CPC, conversions');
bullet('Daily automated sync via Supabase Edge Functions (serverless)');
bullet('Data stored in internal PostgreSQL database (Supabase hosted)');
bullet('Dashboard displays ROAS, CPA, AOV per client and per campaign');
bullet('Date range filtering for performance analysis');
bullet('Attribution table showing revenue per traffic source');

// 3. API Usage
section('3. Google Ads API Usage');
body('API Service: GoogleAdsService.Search (GAQL queries)');
body('API Version: v19');
doc.moveDown(0.3);
body('GAQL Query Used:');
doc.fontSize(9).fillColor('#4b5563').font('Courier').text(
    'SELECT campaign.id, campaign.name, campaign.status,\n' +
    '       segments.date, metrics.cost_micros, metrics.impressions,\n' +
    '       metrics.clicks, metrics.ctr, metrics.average_cpc,\n' +
    '       metrics.conversions\n' +
    'FROM campaign\n' +
    'WHERE segments.date DURING LAST_7_DAYS\n' +
    '  AND campaign.status != "REMOVED"',
    { lineGap: 2 }
);
doc.font('Helvetica');
doc.moveDown(0.3);
body('Operations:');
bullet('Read-only: NO campaign creation, modification, or budget changes');
bullet('Queries campaign performance data for last 7 days (to capture retroactive conversions)');
bullet('Pagination supported (10,000 rows per page)');
bullet('Runs daily at 7:00 AM UTC via scheduled cron job');
bullet('Can be triggered manually from admin dashboard (rate-limited)');

// 4. Authentication
section('4. Authentication & Access');
body('Authentication Method: OAuth 2.0 with offline refresh token');
body('MCC Account ID: 856-137-0062');
body('Access Type: MCC-level access to managed client accounts');
doc.moveDown(0.3);
body('The tool authenticates using a refresh token to obtain short-lived access tokens. All API calls are made through the MCC account, accessing individual client accounts via the login-customer-id header.');

// 5. Architecture
section('5. System Architecture & Data Flow');
doc.moveDown(0.3);
body('Data Flow:');
doc.moveDown(0.3);

// Simple flow diagram using text
doc.fontSize(9).fillColor(dark).font('Courier');
doc.text('  [Admin Dashboard]');
doc.text('        |');
doc.text('        v');
doc.text('  [Supabase Edge Function] ---> [Google Ads API v19]');
doc.text('        |                              |');
doc.text('        v                              |');
doc.text('  [PostgreSQL Database] <--------------+');
doc.text('        |');
doc.text('        v');
doc.text('  [Dashboard Display: Stats, Charts, Tables]');
doc.font('Helvetica');
doc.moveDown(0.5);

body('Components:');
bullet('Frontend: HTML/JS admin dashboard (Vercel hosted)');
bullet('Backend: Supabase Edge Functions (Deno runtime, serverless)');
bullet('Database: PostgreSQL (Supabase managed)');
bullet('Tables: ad_accounts, ad_campaigns, ad_daily_metrics, integrations');

// 6. Rate Limiting
section('6. Rate Limiting & Quotas');
bullet('Automated sync: maximum 1 sync per client per day');
bullet('Manual sync: limited to authenticated admin users only');
bullet('Total clients managed: ~10 accounts');
bullet('Estimated daily API calls: ~20 requests (2 per client: token refresh + GAQL query)');
bullet('Well within Google Ads API Basic Access quota limits');

// 7. Security
section('7. Security & Data Protection');
bullet('API credentials stored as encrypted Edge Function secrets in Supabase');
bullet('No client credentials exposed in frontend code');
bullet('Refresh token stored server-side only (never sent to browser)');
bullet('Database access protected by Row Level Security (RLS)');
bullet('Admin dashboard requires authentication (Supabase Auth)');
bullet('All data transmitted over HTTPS');
bullet('GDPR compliant: no personal user data collected, only aggregate campaign metrics');

// 8. Users
section('8. Users & Access Control');
body('The tool is used exclusively by internal employees of Regen Agency.');
bullet('Total users: 2 (agency co-founders)');
bullet('Access: Internal only, no external or client-facing access');
bullet('Authentication: Email/password via Supabase Auth');

// 9. Campaign Types
section('9. Supported Campaign Types');
bullet('Search campaigns');
bullet('Performance Max campaigns');
bullet('Display campaigns');
bullet('Shopping campaigns');
doc.moveDown(0.3);
body('The tool reads performance data from all active campaign types. No campaign creation or modification is performed via the API.');

// Footer
doc.moveDown(2);
doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#e5e7eb').stroke();
doc.moveDown(0.5);
doc.fontSize(8).fillColor(gray).text('Regen Agency - Google Ads API Design Document v1.0', { align: 'center' });
doc.text('Contact: contact.regenagency@gmail.com | https://www.regen-agency.com', { align: 'center' });

doc.end();

stream.on('finish', () => {
    console.log('PDF created: docs/google-ads-api-design-doc.pdf');
});
