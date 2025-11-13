export const SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL ?? 'ws://localhost:4000';

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  {
    urls: ['turn:global.relay.metered.ca:80', 'turn:global.relay.metered.ca:443'],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: ['turns:global.relay.metered.ca:80', 'turns:global.relay.metered.ca:443'],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export const MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'environment',
  },
};
