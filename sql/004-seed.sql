-- ============================================
-- REGEN AGENCY - Seed Data
-- Run AFTER 003-triggers.sql
-- Creates the agency and initial clients
-- ============================================

-- Create REGEN AGENCY
INSERT INTO agencies (id, name, logo_url)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'REGEN AGENCY',
    '/assets/images/logo-regen.png'
);

-- Create clients (based on actual data from Google Sheets)
INSERT INTO clients (agency_id, name, website, platform, color) VALUES
    ('00000000-0000-0000-0000-000000000001', 'OXO', 'https://www.oxo-shop.fr', 'prestashop', '#E30613'),
    ('00000000-0000-0000-0000-000000000001', 'Marcato', 'https://www.marcatopasta.fr', 'prestashop', '#1B3A5C'),
    ('00000000-0000-0000-0000-000000000001', 'Nordic Ware', 'https://www.nordicware.fr', 'prestashop', '#2C2C2C'),
    ('00000000-0000-0000-0000-000000000001', 'Bamix', 'https://www.bamix.fr', 'prestashop', '#C41230'),
    ('00000000-0000-0000-0000-000000000001', 'Vitamix', 'https://www.vitamix.fr', 'prestashop', '#6B8E23');

-- NOTE: After creating your first user account via the login page,
-- run this to make yourself admin (replace YOUR_USER_ID):
--
-- UPDATE profiles
-- SET role = 'admin', agency_id = '00000000-0000-0000-0000-000000000001'
-- WHERE id = 'YOUR_USER_ID';
--
-- Then assign yourself to all clients:
-- INSERT INTO client_users (client_id, user_id)
-- SELECT id, 'YOUR_USER_ID' FROM clients
-- WHERE agency_id = '00000000-0000-0000-0000-000000000001';
