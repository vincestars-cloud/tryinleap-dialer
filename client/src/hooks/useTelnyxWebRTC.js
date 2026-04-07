import { useState, useEffect, useRef, useCallback } from 'react';

let TelnyxRTCModule = null;

export function useTelnyxWebRTC({ login, password, onCallUpdate }) {
  const clientRef = useRef(null);
  const [status, setStatus] = useState('disconnected');
  const [activeCall, setActiveCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!login || !password) return;

    async function init() {
      // Dynamic import to avoid SSR issues
      if (!TelnyxRTCModule) {
        TelnyxRTCModule = await import('@telnyx/webrtc');
      }
      const { TelnyxRTC } = TelnyxRTCModule;

      const client = new TelnyxRTC({
        login,
        password
      });

      client.on('telnyx.ready', () => {
        console.log('WebRTC: Ready');
        setStatus('ready');
      });

      client.on('telnyx.error', (error) => {
        console.error('WebRTC error:', error);
        setStatus('error');
      });

      client.on('telnyx.socket.close', () => {
        setStatus('disconnected');
      });

      client.on('telnyx.notification', (notification) => {
        const call = notification.call;
        if (!call) return;

        if (notification.type === 'callUpdate') {
          console.log('WebRTC call state:', call.state);
          setActiveCall(call);

          if (call.state === 'active') {
            setStatus('on_call');
            // Attach remote audio to the <audio> element
            const remoteAudio = document.getElementById('remote-audio');
            if (remoteAudio && call.remoteStream) {
              remoteAudio.srcObject = call.remoteStream;
            }
          }

          if (call.state === 'hangup' || call.state === 'destroy') {
            setActiveCall(null);
            setStatus('ready');
            setIsMuted(false);
            const remoteAudio = document.getElementById('remote-audio');
            if (remoteAudio) remoteAudio.srcObject = null;
          }

          if (onCallUpdate) onCallUpdate(call);
        }
      });

      setStatus('connecting');
      client.connect();
      clientRef.current = client;

      // Request microphone permission early
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone permission granted');
      } catch (e) {
        console.error('Microphone permission denied:', e);
      }
    }

    init();

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [login, password]);

  // Place an outbound call from the browser (WebRTC leg)
  // The server will handle dialing the PSTN leg and bridging
  const makeCall = useCallback((destinationNumber, callerNumber, callerName) => {
    if (!clientRef.current || status !== 'ready') {
      console.error('WebRTC not ready, status:', status);
      return null;
    }

    const call = clientRef.current.newCall({
      destinationNumber, // This triggers a webhook on our server
      callerNumber: callerNumber || '',
      callerName: callerName || 'TryInLeap',
      audio: true,
      video: false
    });

    setActiveCall(call);
    setStatus('on_call');
    return call;
  }, [status]);

  const hangup = useCallback(() => {
    if (activeCall) activeCall.hangup();
  }, [activeCall]);

  const toggleMute = useCallback(() => {
    if (activeCall) {
      if (isMuted) activeCall.unmuteAudio();
      else activeCall.muteAudio();
      setIsMuted(!isMuted);
    }
  }, [activeCall, isMuted]);

  const hold = useCallback(() => { if (activeCall) activeCall.hold(); }, [activeCall]);
  const unhold = useCallback(() => { if (activeCall) activeCall.unhold(); }, [activeCall]);
  const sendDTMF = useCallback((digit) => { if (activeCall) activeCall.dtmf(digit); }, [activeCall]);

  return {
    status,
    activeCall,
    isMuted,
    makeCall,
    hangup,
    toggleMute,
    hold,
    unhold,
    sendDTMF,
    isReady: status === 'ready'
  };
}
