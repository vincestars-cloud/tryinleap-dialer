-- Migration v3: Agent scripts, transfer logs, reporting views

-- Campaign scripts (shown to agents during calls)
CREATE TABLE IF NOT EXISTS campaign_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scripts_campaign ON campaign_scripts(campaign_id);

-- Call transfers log
CREATE TABLE IF NOT EXISTS call_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES agents(id),
  to_agent_id UUID REFERENCES agents(id),
  to_number TEXT,
  transfer_type TEXT NOT NULL CHECK (transfer_type IN ('warm', 'cold', 'external')),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'connected', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supervisor monitor sessions
CREATE TABLE IF NOT EXISTS monitor_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supervisor_id UUID REFERENCES agents(id),
  agent_id UUID REFERENCES agents(id),
  call_id UUID REFERENCES calls(id),
  mode TEXT NOT NULL CHECK (mode IN ('listen', 'whisper', 'barge')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Add script_id to campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS script_id UUID;

-- Reporting: hourly call stats (materialized for fast queries)
CREATE TABLE IF NOT EXISTS call_stats_hourly (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  hour TIMESTAMPTZ NOT NULL,
  calls_made INTEGER DEFAULT 0,
  calls_answered INTEGER DEFAULT 0,
  calls_connected INTEGER DEFAULT 0,
  calls_abandoned INTEGER DEFAULT 0,
  calls_machine INTEGER DEFAULT 0,
  avg_talk_time_seconds INTEGER DEFAULT 0,
  avg_wait_time_seconds INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stats_campaign_hour ON call_stats_hourly(campaign_id, hour);
