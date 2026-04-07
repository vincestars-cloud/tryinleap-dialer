import { Telnyx } from 'telnyx';

const telnyx = new Telnyx(process.env.TELNYX_API_KEY);

// Base URL for Call Control REST API (for commands not in SDK)
const API_BASE = 'https://api.telnyx.com/v2';
const apiHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`
});

// ─── Call Control ─────────────────────────────────

export async function makeOutboundCall({ to, from, connectionId, clientState, webhookUrl }) {
  const response = await telnyx.calls.dial({
    connection_id: connectionId || process.env.TELNYX_CONNECTION_ID,
    to,
    from: from || process.env.TELNYX_PHONE_NUMBER,
    answering_machine_detection: 'premium',
    answering_machine_detection_config: {
      after_greeting_silence_millis: 800,
      between_words_silence_millis: 50,
      greeting_duration_millis: 3500,
      initial_silence_millis: 3500,
      maximum_number_of_words: 5,
      silence_threshold: 256,
      total_analysis_time_millis: 5000
    },
    webhook_url: webhookUrl || process.env.WEBHOOK_URL,
    client_state: clientState ? Buffer.from(JSON.stringify(clientState)).toString('base64') : undefined
  });
  return response.data;
}

// Call control commands via REST API
async function callCommand(callControlId, command, body = {}) {
  const res = await fetch(`${API_BASE}/calls/${callControlId}/actions/${command}`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail || `Call command ${command} failed: ${res.status}`);
  }
  return res.json();
}

export async function hangupCall(callControlId) {
  return callCommand(callControlId, 'hangup');
}

export async function bridgeCall(callControlId, targetCallControlId) {
  return callCommand(callControlId, 'bridge', {
    call_control_id: targetCallControlId
  });
}

export async function transferCall(callControlId, to) {
  return callCommand(callControlId, 'transfer', { to });
}

export async function playAudio(callControlId, audioUrl) {
  return callCommand(callControlId, 'playback-start', {
    audio_url: audioUrl
  });
}

export async function startRecording(callControlId) {
  return callCommand(callControlId, 'record-start', {
    format: 'mp3',
    channels: 'dual'
  });
}

export async function stopRecording(callControlId) {
  return callCommand(callControlId, 'record-stop');
}

// ─── Conferencing ─────────────────────────────────

export async function createConference({ name, callControlId }) {
  const response = await telnyx.conferences.create({
    name,
    call_control_id: callControlId,
    beep_enabled: 'never'
  });
  return response.data;
}

export async function joinConference(conferenceId, callControlId, options = {}) {
  return callCommand(callControlId, 'join', {
    conference_id: conferenceId,
    ...options
  });
}

// ─── SMS ──────────────────────────────────────────

export async function sendSMS({ to, from, body, messagingProfileId }) {
  const response = await telnyx.messages.send({
    from: from || process.env.TELNYX_PHONE_NUMBER,
    to,
    text: body,
    messaging_profile_id: messagingProfileId || process.env.TELNYX_MESSAGING_PROFILE_ID
  });
  return response.data;
}

export { telnyx };
