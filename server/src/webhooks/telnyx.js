import { Router } from 'express';
import { makeOutboundCall, bridgeCall } from '../services/telnyx.js';
import { supabase } from '../services/supabase.js';

const router = Router();

// Track WebRTC leg → PSTN leg mapping for bridging
const webrtcToPstn = new Map(); // webrtcCallControlId -> { pstnCallControlId, leadPhone, callId, agentId }
const pstnToWebrtc = new Map(); // pstnCallControlId -> webrtcCallControlId

router.post('/', async (req, res) => {
  const event = req.body?.data;
  if (!event) return res.status(200).send('ok');

  const eventType = event.event_type;
  const callControlId = event.payload?.call_control_id;
  const direction = event.payload?.direction;
  const clientStateBase64 = event.payload?.client_state;

  let clientState = null;
  if (clientStateBase64) {
    try { clientState = JSON.parse(Buffer.from(clientStateBase64, 'base64').toString()); } catch {}
  }

  console.log(`Webhook: ${eventType} | ${callControlId} | dir=${direction} | state=${JSON.stringify(clientState)}`);

  try {
    const dialerEngine = req.app.get('dialerEngine');

    switch (eventType) {

      // ─── WebRTC leg initiated (agent's browser call) ───
      case 'call.initiated': {
        if (clientState?.type === 'webrtc_leg') {
          // This is the WebRTC agent leg — now dial the PSTN leg to the lead
          console.log(`WebRTC leg initiated: ${callControlId}, dialing PSTN to ${clientState.leadPhone}`);

          // Answer the WebRTC leg first
          await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TELNYX_API_KEY}` },
            body: JSON.stringify({})
          });

          // Dial the PSTN leg
          const pstnCall = await makeOutboundCall({
            to: clientState.leadPhone,
            from: clientState.callerId || process.env.TELNYX_PHONE_NUMBER,
            clientState: {
              type: 'pstn_leg',
              webrtcCallControlId: callControlId,
              callId: clientState.callId,
              leadId: clientState.leadId
            }
          });

          // Track the mapping
          webrtcToPstn.set(callControlId, {
            pstnCallControlId: pstnCall.call_control_id,
            leadPhone: clientState.leadPhone,
            callId: clientState.callId,
            agentId: clientState.agentId
          });
          pstnToWebrtc.set(pstnCall.call_control_id, callControlId);

          console.log(`PSTN leg dialed: ${pstnCall.call_control_id} → ${clientState.leadPhone}`);
        }
        break;
      }

      // ─── Call answered ───
      case 'call.answered': {
        if (clientState?.type === 'pstn_leg') {
          // The lead answered! Bridge the PSTN leg to the WebRTC leg
          const webrtcCallControlId = clientState.webrtcCallControlId;
          console.log(`PSTN answered! Bridging ${callControlId} ↔ ${webrtcCallControlId}`);

          try {
            await bridgeCall(callControlId, webrtcCallControlId);
            console.log('Bridge command sent!');

            // Update call record
            if (clientState.callId) {
              await supabase.from('calls').update({
                status: 'bridged',
                answered_at: new Date().toISOString(),
                telnyx_call_control_id: callControlId
              }).eq('id', clientState.callId);
            }
          } catch (bridgeErr) {
            console.error('Bridge failed:', bridgeErr.message);
          }
        } else {
          // Predictive dialer flow (non-WebRTC)
          await dialerEngine.handleCallAnswered(callControlId, event);
        }
        break;
      }

      case 'call.bridged':
        console.log(`Call bridged successfully: ${callControlId}`);
        break;

      case 'call.machine.premium.detection.ended':
        await dialerEngine.handleAMDResult(callControlId, event);
        break;

      case 'call.machine.premium.greeting.ended':
        await dialerEngine.handleGreetingEnded(callControlId);
        break;

      case 'call.hangup': {
        console.log(`Call hangup: ${callControlId}`);

        // If PSTN leg hangs up, also hang up WebRTC leg
        const webrtcId = pstnToWebrtc.get(callControlId);
        if (webrtcId) {
          try {
            await fetch(`https://api.telnyx.com/v2/calls/${webrtcId}/actions/hangup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TELNYX_API_KEY}` },
              body: JSON.stringify({})
            });
          } catch {}
          pstnToWebrtc.delete(callControlId);
          webrtcToPstn.delete(webrtcId);
        }

        // If WebRTC leg hangs up, also hang up PSTN leg
        const pstnInfo = webrtcToPstn.get(callControlId);
        if (pstnInfo) {
          try {
            await fetch(`https://api.telnyx.com/v2/calls/${pstnInfo.pstnCallControlId}/actions/hangup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TELNYX_API_KEY}` },
              body: JSON.stringify({})
            });
          } catch {}

          // Update call record
          if (pstnInfo.callId) {
            await supabase.from('calls').update({
              status: 'completed',
              ended_at: new Date().toISOString()
            }).eq('id', pstnInfo.callId);

            // Put agent in wrap-up
            const agentManager = req.app.get('agentManager');
            if (pstnInfo.agentId) {
              await agentManager.setAgentStatus(pstnInfo.agentId, 'wrap_up');
              const wsManager = req.app.get('wsManager');
              wsManager.sendToAgent(pstnInfo.agentId, {
                type: 'call_ended',
                callId: pstnInfo.callId
              });
            }
          }

          webrtcToPstn.delete(callControlId);
          pstnToWebrtc.delete(pstnInfo.pstnCallControlId);
        }

        // Also handle predictive dialer calls
        await dialerEngine.handleCallEnded(callControlId, event);
        break;
      }

      case 'call.recording.saved':
        await dialerEngine.handleRecordingReady(event);
        break;

      case 'call.speak.ended':
      case 'call.playback.ended':
        break;

      default:
        console.log(`Unhandled event: ${eventType}`);
    }
  } catch (err) {
    console.error(`Error handling ${eventType}:`, err);
  }

  res.status(200).send('ok');
});

export { router as telnyxWebhookRouter };
