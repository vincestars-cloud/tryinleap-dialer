import { Router } from 'express';

const router = Router();

// Telnyx sends webhooks as POST with JSON body
// express.json() is already applied globally in index.js
router.post('/', async (req, res) => {
  const event = req.body?.data;
  if (!event) return res.status(200).send('ok');

  const eventType = event.event_type;
  const callControlId = event.payload?.call_control_id;

  console.log(`Telnyx webhook: ${eventType} (${callControlId || 'no-call-id'})`);

  try {
    const dialerEngine = req.app.get('dialerEngine');

    switch (eventType) {
      case 'call.initiated':
        break;

      case 'call.answered':
        await dialerEngine.handleCallAnswered(callControlId, event);
        break;

      case 'call.machine.premium.detection.ended':
        await dialerEngine.handleAMDResult(callControlId, event);
        break;

      case 'call.machine.premium.greeting.ended':
        await dialerEngine.handleGreetingEnded(callControlId);
        break;

      case 'call.hangup':
        await dialerEngine.handleCallEnded(callControlId, event);
        break;

      case 'call.recording.saved':
        await dialerEngine.handleRecordingReady(event);
        break;

      case 'call.bridged':
        console.log(`Call bridged: ${callControlId}`);
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
