import { useMemo, useState } from 'react';
import BroadcasterPanel from './components/BroadcasterPanel';
import ViewerPanel from './components/ViewerPanel';
import type { Role } from './types';
import './App.css';

const App = () => {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialRole = (searchParams.get('role') as Role) ?? null;
  const initialRoom = searchParams.get('room') ?? '';

  const [role, setRole] = useState<Role | null>(initialRole);
  const [room, setRoom] = useState(initialRoom);
  const [connected, setConnected] = useState(Boolean(initialRole && initialRoom));

  const canJoin = role && room.trim().length >= 3;

  const handleJoin = () => {
    if (!canJoin) return;
    setConnected(true);
  };

  const handleLeave = () => {
    setConnected(false);
  };

  if (connected && role === 'broadcaster') {
    return <BroadcasterPanel room={room} onLeave={handleLeave} />;
  }

  if (connected && role === 'viewer') {
    return <ViewerPanel room={room} onLeave={handleLeave} autoStart />;
  }

  return (
    <main className="landing">
      <section className="card">
        <h1>WebRTC камера → OBS</h1>
        <p className="subtitle">
          Открой эту страницу на айфоне в роли стримера, а в OBS добавь Browser Source в роли зрителя.
        </p>

        <div className="form-group">
          <label>1. Выбери роль</label>
          <div className="role-toggle">
            <button
              type="button"
              className={role === 'broadcaster' ? 'active' : ''}
              onClick={() => setRole('broadcaster')}
            >
              Стример (iPhone)
            </button>
            <button
              type="button"
              className={role === 'viewer' ? 'active' : ''}
              onClick={() => setRole('viewer')}
            >
              OBS Viewer
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>2. Назови комнату</label>
          <input
            type="text"
            placeholder="Например: obs-room"
            value={room}
            onChange={(event) => setRoom(event.target.value)}
          />
          <small>Одинаковое имя комнаты нужно указать и у стримера, и в OBS.</small>
        </div>

        <button className="primary" disabled={!canJoin} onClick={handleJoin}>
          Подключиться
        </button>

        <section className="notes landing__notes">
          <h3>Как использовать</h3>
          <ol>
            <li>На айфоне выбери «Стример», введи комнату, нажми «Подключиться» и дай доступ к камере.</li>
            <li>
              В OBS добавь Browser Source с URL вида{' '}
              <code>http://localhost:5173/?role=viewer&room=my-room</code> (подставь свою комнату).
            </li>
            <li>Убедись, что сервер сигналинга (`npm run server`) запущен и порт 4000 виден обеим сторонам.</li>
          </ol>
        </section>
      </section>
    </main>
  );
};

export default App;
