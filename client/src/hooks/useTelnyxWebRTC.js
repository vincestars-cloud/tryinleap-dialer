import { useState, useEffect, useRef, useCallback } from 'react';
import { TelnyxRTC } from '@telnyx/webrtc';

export function useTelnyxWebRTC({ login, password, onIncomingCall, onCallEnded }) {
  const clientRef = useRef(null);
  const [status, setStatus] = useState('disconnected'); // disconnected, connecting, ready, on_call
  const [activeCall, setActiveCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    if (!login || !password) return;

    const client = new TelnyxRTC({
      login,
      password,
      ringtoneFile: undefined,
      ringbackFile: undefined
    });

    client.on('telnyx.ready', () => {
      console.log('WebRTC: Ready');
      setStatus('ready');
    });

    client.on('telnyx.error', (error) => {
      console.error('WebRTC error:', error);
      setStatus('disconnected');
    });

    client.on('telnyx.socket.close', () => {
      console.log('WebRTC: Disconnected');
      setStatus('disconnected');
    });

    client.on('telnyx.notification', (notification) => {
      const call = notification.call;
      if (!call) return;

      switch (notification.type) {
        case 'callUpdate':
          handleCallUpdate(call);
          break;
        case 'userMediaError':
          console.error('Microphone access denied');
          break;
      }
    });

    function handleCallUpdate(call) {
      const state = call.state;
      console.log('WebRTC call state:', state);

      switch (state) {
        case 'new':
        case 'trying':
        case 'requesting':
          setActiveCall(call);
          setStatus('on_call');
          break;
        case 'recovering':
        case 'ringing':
          setActiveCall(call);
          break;
        case 'answering':
        case 'early':
          setActiveCall(call);
          break;
        case 'active':
          setActiveCall(call);
          setStatus('on_call');
          setAudioEnabled(true);
          if (onIncomingCall) onIncomingCall(call);
          break;
        case 'hangup':
        case 'destroy':
          setActiveCall(null);
          setStatus('ready');
          setIsMuted(false);
          setAudioEnabled(false);
          if (onCallEnded) onCallEnded(call);
          break;
      }
    }

    setStatus('connecting');
    client.connect();
    clientRef.current = client;

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [login, password]);

  const makeCall = useCallback((destinationNumber, callerNumber, callerName) => {
    if (!clientRef.current || status !== 'ready') return null;

    const call = clientRef.current.newCall({
      destinationNumber,
      callerNumber,
      callerName,
      audio: true,
      video: false
    });

    setActiveCall(call);
    setStatus('on_call');
    return call;
  }, [status]);

  const answerCall = useCallback(() => {
    if (activeCall) {
      activeCall.answer({ audio: true, video: false });
    }
  }, [activeCall]);

  const hangup = useCallback(() => {
    if (activeCall) {
      activeCall.hangup();
    }
  }, [activeCall]);

  const toggleMute = useCallback(() => {
    if (activeCall) {
      if (isMuted) {
        activeCall.unmuteAudio();
      } else {
        activeCall.muteAudio();
      }
      setIsMuted(!isMuted);
    }
  }, [activeCall, isMuted]);

  const hold = useCallback(() => {
    if (activeCall) activeCall.hold();
  }, [activeCall]);

  const unhold = useCallback(() => {
    if (activeCall) activeCall.unhold();
  }, [activeCall]);

  const sendDTMF = useCallback((digit) => {
    if (activeCall) activeCall.dtmf(digit);
  }, [activeCall]);

  return {
    status,
    activeCall,
    isMuted,
    audioEnabled,
    makeCall,
    answerCall,
    hangup,
    toggleMute,
    hold,
    unhold,
    sendDTMF,
    client: clientRef.current
  };
}
