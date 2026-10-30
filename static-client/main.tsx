/// <reference types="vite/client" />
import { createRoot } from 'react-dom/client';
import GameClient from '../components/game-client';
import '../app/globals.css';
import '../app/solo.css';

// Static frontend for GitHub Pages; the deployed Worker owns rooms, bots and scores.
const apiBase = (import.meta.env.VITE_GAME_API_URL || 'https://split-decision-party-7k4m.fizzyflint15.chatgpt.site').replace(/\/$/, '');
const homePath = new URL('.', window.location.href).pathname;
createRoot(document.getElementById('root')!).render(
  <GameClient apiBase={apiBase} homePath={homePath} downloadPath={`${apiBase}/split-decision-godot.zip`} />,
);
