-- TryInLeap Dialer Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AGENTS (users who make/receive calls)
-- ============================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'available', 'on_call', 'wrap_up', 'paused')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CAMPAIGNS
-- ============================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  dial_mode TEXT NOT NULL DEFAULT 'predictive' CHECK (dial_mode IN ('predictive', 'progressive')),
  dial_ratio NUMERIC(3,1) NOT NULL DEFAULT 2.0,
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('active', 'paused', 'completed')),
  caller_id TEXT NOT NULL,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  retry_delay_minutes INTEGER NOT NULL DEFAULT 60,
  voicemail_drop_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DISPOSITION CODES
-- ============================================
CREATE TABLE dispositions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  is_final BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default dispositions
INSERT INTO dispositions (name, code, is_final, sort_order) VALUES
  ('Sale', 'SALE', true, 1),
  ('Appointment Set', 'APPT', true, 2),
  ('Callback', 'CB', false, 3),
  ('Not Interested', 'NI', true, 4),
  ('Do Not Call', 'DNC', true, 5),
  ('No Answer', 'NA', false, 6),
  ('Voicemail', 'VM', false, 7),
  ('Busy', 'BUSY', false, 8),
  ('Wrong Number', 'WN', true, 9),
  ('Disconnected', 'DISC', true, 10),
  ('Transfer', 'XFER', true, 11),
  ('Follow Up', 'FU', false, 12);

-- ============================================
-- LEADS
-- ============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  company TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  timezone TEXT,
  custom_fields JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'dnc', 'dead')),
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  last_disposition TEXT,
  assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  is_dnc BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_campaign ON leads(campaign_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_priority_attempts ON leads(campaign_id, status, priority DESC, attempts ASC);

-- ============================================
-- CALL LOG
-- ============================================
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telnyx_call_control_id TEXT,
  telnyx_call_leg_id TEXT,
  telnyx_conference_id TEXT,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
    'initiated', 'ringing', 'answered', 'bridged', 'completed', 'failed', 'busy', 'no_answer', 'machine'
  )),
  amd_result TEXT,
  disposition_code TEXT,
  duration_seconds INTEGER DEFAULT 0,
  talk_time_seconds INTEGER DEFAULT 0,
  recording_url TEXT,
  recording_duration_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calls_lead ON calls(lead_id);
CREATE INDEX idx_calls_agent ON calls(agent_id);
CREATE INDEX idx_calls_campaign ON calls(campaign_id);
CREATE INDEX idx_calls_telnyx ON calls(telnyx_call_control_id);

-- ============================================
-- CALL NOTES
-- ============================================
CREATE TABLE call_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_lead ON call_notes(lead_id);
CREATE INDEX idx_notes_call ON call_notes(call_id);

-- ============================================
-- SMS MESSAGES
-- ============================================
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telnyx_message_id TEXT,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'received')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_lead ON sms_messages(lead_id);

-- ============================================
-- CALLBACK SCHEDULE
-- ============================================
CREATE TABLE callbacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'missed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_callbacks_scheduled ON callbacks(scheduled_at, status);
CREATE INDEX idx_callbacks_agent ON callbacks(agent_id, status);

-- ============================================
-- DNC LIST
-- ============================================
CREATE TABLE dnc_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT UNIQUE NOT NULL,
  reason TEXT,
  added_by UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dnc_phone ON dnc_list(phone);

-- ============================================
-- AGENT CAMPAIGN ASSIGNMENTS
-- ============================================
CREATE TABLE agent_campaigns (
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, campaign_id)
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
