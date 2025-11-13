import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ICE_SERVERS, MEDIA_CONSTRAINTS, SIGNALING_URL } from '../config';
import type { SignalPayload } from '../types';

type BroadcasterPanelProps = {
  room: string;
  onLeave: () => void;
};

type PeerMap = Record<string, RTCPeerConnection>;

const BroadcasterPanel = ({ room, onLeave }: BroadcasterPanelProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<PeerMap>({});

  const [status, setStatus] = useState<'idle' | 'online' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const appendLog = useCallback((entry: string) => {
    setLog((prev) => [...prev.slice(-9), `${new Date().toLocaleTimeString()} ${entry}`]);
  }, []);

  const cleanupPeers = useCallback(() => {
    Object.values(peerConnections.current).forEach((pc) => {
      pc.close();
    });
    peerConnections.current = {};
  }, []);

  const stopMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const sendSignal = useCallback(
    (viewerId: string, payload: SignalPayload) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'signal',
            room,
            to: viewerId,
            payload,
          }),
        );
      }
    },
    [room],
  );

  const createPeerConnection = useCallback(
    (viewerId: string) => {
      let pc = peerConnections.current[viewerId];
      if (pc) {
        return pc;
      }

      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnections.current[viewerId] = pc;

      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(viewerId, { candidate: event.candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          appendLog(`Viewer ${viewerId} disconnected`);
          pc.close();
          delete peerConnections.current[viewerId];
        }
      };

      return pc;
    },
    [appendLog, sendSignal],
  );

  const handleSignal = useCallback(
    async (viewerId: string, payload: SignalPayload) => {
      try {
        const pc = createPeerConnection(viewerId);

        if (payload.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

          if (payload.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal(viewerId, { sdp: pc.localDescription ?? undefined });
            appendLog(`Ответ для зрителя ${viewerId} отправлен`);
          }
        } else if (payload.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch (err) {
        console.error('Broadcaster signal error', err);
        setError('Ошибка WebRTC, проверьте консоль');
      }
    },
    [appendLog, createPeerConnection, sendSignal],
  );

  useEffect(() => {
    let mounted = true;

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error(err);
        setError('Нет доступа к камере/микрофону');
      }
    };

    initMedia();

    return () => {
      mounted = false;
      stopMedia();
    };
  }, [stopMedia]);

  useEffect(() => {
    const socket = new WebSocket(SIGNALING_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      appendLog('Подключились к сигналинг-серверу');
      setStatus('online');
      socket.send(
        JSON.stringify({
          type: 'join',
          role: 'broadcaster',
          room,
        }),
      );
    };

    socket.onerror = () => {
      setStatus('error');
      setError('Ошибка подключения к сигналинг-серверу');
    };

    socket.onclose = () => {
      appendLog('Сигналинг-сервер отключен');
      setStatus('idle');
      cleanupPeers();
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'viewer-joined':
          setViewerCount((prev) => prev + 1);
          appendLog(`Зритель ${message.viewerId} подключился`);
          break;
        case 'viewer-left':
          setViewerCount((prev) => Math.max(0, prev - 1));
          appendLog(`Зритель ${message.viewerId} отключился`);
          delete peerConnections.current[message.viewerId];
          break;
        case 'signal':
          handleSignal(message.viewerId, message.payload);
          break;
        default:
          break;
      }
    };

    return () => {
      socket.close();
      cleanupPeers();
      stopMedia();
    };
  }, [appendLog, cleanupPeers, handleSignal, room, stopMedia]);

  const statusLabel = useMemo(() => {
    if (status === 'online') return 'В эфире';
    if (status === 'error') return 'Ошибка';
    return 'Отключено';
  }, [status]);

  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <p className="eyebrow">Комната</p>
          <h2>{room}</h2>
        </div>
        <div className={`status status--${status}`}>{statusLabel}</div>
      </header>

      <div className="video-wrapper">
        <video ref={videoRef} autoPlay playsInline muted className="video-preview" />
      </div>

      <div className="panel__stats">
        <div>
          <span className="eyebrow">Зрителей</span>
          <p className="stat-value">{viewerCount}</p>
        </div>
        <div>
          <span className="eyebrow">Сервер</span>
          <p className="stat-value">{SIGNALING_URL.replace('ws://', '')}</p>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <section className="notes">
        <h3>Что дальше</h3>
        <ol>
          <li>Открой на OBS браузерный источник с URL вида <code>?role=viewer&room={room}</code>.</li>
          <li>Убедись, что OBS запущен с поддержкой аппаратного ускорения.</li>
          <li>При проблемах с WebRTC проверь порт сигналинга (по умолчанию 4000).</li>
        </ol>
      </section>

      <section className="log">
        <h4>Лог</h4>
        <div className="log__scroller">
          {log.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>

      <button className="secondary" onClick={onLeave}>
        Выйти
      </button>
    </div>
  );
};

export default BroadcasterPanel;
