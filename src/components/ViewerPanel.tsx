import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ICE_SERVERS, SIGNALING_URL } from '../config';
import type { SignalPayload } from '../types';

type ViewerPanelProps = {
  room: string;
  autoStart?: boolean;
  onLeave: () => void;
};

const ViewerPanel = ({ room, autoStart = false, onLeave }: ViewerPanelProps) => {
  const socketRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [status, setStatus] = useState<
    'connecting' | 'waiting' | 'negotiating' | 'streaming' | 'error'
  >('connecting');
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [broadcasterOnline, setBroadcasterOnline] = useState(false);
  const [started, setStarted] = useState(autoStart);

  const sendSignal = useCallback(
    (payload: SignalPayload) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'signal',
            room,
            payload,
          }),
        );
      }
    },
    [room],
  );

  const setupPeerConnection = useCallback(() => {
    if (peerRef.current) {
      return peerRef.current;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerRef.current = pc;

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setStatus('streaming');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setStatus('error');
      }
    };

    return pc;
  }, [sendSignal]);

  const negotiate = useCallback(async () => {
    try {
      const pc = setupPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal({ sdp: pc.localDescription ?? undefined });
      setStatus('negotiating');
    } catch (err) {
      console.error(err);
      setError('Не удалось инициировать WebRTC.');
      setStatus('error');
    }
  }, [sendSignal, setupPeerConnection]);

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      try {
        const pc = setupPeerConnection();
        if (payload.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          if (payload.sdp.type === 'answer') {
            setStatus('streaming');
          }
        } else if (payload.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch (err) {
        console.error(err);
        setError('Ошибка обработки сигнала');
        setStatus('error');
      }
    },
    [setupPeerConnection],
  );

  useEffect(() => {
    const socket = new WebSocket(SIGNALING_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'join',
          role: 'viewer',
          room,
        }),
      );
      setStatus('connecting');
    };

    socket.onerror = () => {
      setError('Нет подключения к сигналинг-серверу.');
      setStatus('error');
    };

    socket.onclose = () => {
      setStatus('error');
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'registered':
          setClientId(message.clientId);
          break;
        case 'broadcaster-status':
          setBroadcasterOnline(Boolean(message.online));
          setStatus(message.online ? 'waiting' : 'connecting');
          break;
        case 'signal':
          handleSignal(message.payload);
          break;
        default:
          break;
      }
    };

    return () => {
      socket.close();
      peerRef.current?.close();
    };
  }, [handleSignal, room]);

  useEffect(() => {
    if (!broadcasterOnline) {
      setStarted(false);
      setStatus('waiting');
      return;
    }
    if (broadcasterOnline && clientId && !started) {
      setStarted(true);
    }
  }, [broadcasterOnline, clientId, started]);

  useEffect(() => {
    if (started && broadcasterOnline) {
      negotiate();
    }
  }, [broadcasterOnline, negotiate, started]);

  const instructions = useMemo(
    () => [
      'В OBS добавь Browser Source.',
      `URL: http://<твой-хост>:5173/?role=viewer&room=${room}`,
      'Установи ширину/высоту источника под нужное разрешение (720p/1080p).',
      'Если нет картинки, проверь, что трансляция запущена на телефоне.',
    ],
    [room],
  );

  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <p className="eyebrow">Комната</p>
          <h2>{room}</h2>
        </div>
        <div className={`status status--${status}`}>{status}</div>
      </header>

      <div className="video-wrapper">
        <video ref={videoRef} autoPlay playsInline className="video-preview" />
      </div>

      {error ? <p className="error">{error}</p> : null}

      <section className="notes">
        <h3>Подключение OBS</h3>
        <ol>
          {instructions.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ol>
      </section>

      <button className="secondary" onClick={onLeave}>
        Выйти
      </button>
    </div>
  );
};

export default ViewerPanel;
