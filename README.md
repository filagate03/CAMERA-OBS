# WebRTC → OBS Camera (Expo-free)

Минимальный стек: Vite + React (frontend) и Node/Express + ws (сигналинг). Работает на любом устройстве с браузером (айфон/андроид) + OBS Browser Source.

## Быстрый старт локально

```bash
git clone <repo>
cd web-streamer
npm install

# окно 1 — сигналинг
npm run server

# окно 2 — фронт
npm run dev -- --host 0.0.0.0 --https
```

1. На телефоне открой `https://<IP-компа>:5173`, выбери роль **Стример**, комнату (например `obs-room`) и дай доступ к камере.  
2. В OBS добавь Browser Source → URL `https://<IP-компа>:5173/?role=viewer&room=obs-room`.  
3. Видео появится сразу после установки WebRTC соединения.

> HTTPS обязателен для доступа к камере в Safari/Chrome на телефонах. Vite сам выдаёт dev-сертификат, его нужно «доверить» в настройках iOS после первого открытия.

## Подготовка к продакшн-деплою

### 1. Сигналинг на Render.com

1. Создай новый GitHub‑репозиторий, залей туда проект.  
2. На render.com → New → Web Service → подключи репо.  
3. Build Command: `npm install`, Start Command: `node server/index.mjs`.  
4. Env vars: можно оставить пустыми (по умолчанию `PORT` задаёт Render, CORS открыт).  
5. После деплоя получишь URL вида `https://web-streamer-signal.onrender.com` и WS `wss://web-streamer-signal.onrender.com`.

### 2. Frontend на Netlify (или Vercel)

Файл `netlify.toml` уже настроен. На netlify.com:

1. New site → Import from Git → выбери тот же репозиторий.  
2. Build command: `npm run build`, Publish dir: `dist`.  
3. Добавь переменную окружения `VITE_SIGNALING_URL=wss://web-streamer-signal.onrender.com`.  
4. Запусти деплой — получишь URL вида `https://obs-camera.netlify.app`.

### 3. Как пользоваться после деплоя

1. На телефоне открыть `https://obs-camera.netlify.app`, выбрать роль **Стример**, комнату (напр. `main-stage`), нажать «Подключиться».  
2. В OBS добавить Browser Source с URL `https://obs-camera.netlify.app/?role=viewer&room=main-stage`, выставить размер 1280×720 или 1920×1080.  
3. Готово: браузерный источник в OBS получит WebRTC поток от телефона через Render‑сигналинг.

## Полезные команды

| Команда             | Описание                                   |
|--------------------|--------------------------------------------|
| `npm run dev -- --host 0.0.0.0 --https` | Локальный фронт с доступом по сети |
| `npm run server`   | Запуск сигналинг-сервера (порт 4000)       |
| `npm run build`    | Сборка фронтенда для Netlify/Vercel        |
| `npm run preview`  | Локальный предпросмотр собранного фронта   |

## OBS подсказки

- Если только аудио/нет видео — проверь, что Browser Source не заблокирован Windows firewall.  
- При «Connecting…» убедись, что `VITE_SIGNALING_URL` указывает на доступный `wss://` и порт открыт.  
- Можно открыть ссылку зрителя просто в Chrome/Firefox, чтобы проверить поток до OBS.
