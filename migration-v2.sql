-- Migration v2: Add WebRTC SIP credentials and local presence

-- Add SIP credential columns to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS sip_username TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS sip_password TEXT;

-- Local presence number pool (for matching caller ID to lead area code)
CREATE TABLE IF NOT EXISTS local_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT UNIQUE NOT NULL,
  area_code TEXT NOT NULL,
  state TEXT,
  region TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  telnyx_number_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_local_numbers_area_code ON local_numbers(area_code);
CREATE INDEX IF NOT EXISTS idx_local_numbers_state ON local_numbers(state);
