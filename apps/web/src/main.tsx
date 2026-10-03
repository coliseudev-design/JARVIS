import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SystemStatusSchema, type SystemStatus } from '@jarvis/contracts';
import './style.css';
import {AuthPanel} from './AuthPanel.js';

const labels = { foundation: 'Fundação do ambiente', authentication: 'Identidade e acesso', chat: 'Conversa com JARVIS', memory: 'Memória pessoal', integrations: 'Conexões' };
const states = { available: 'Disponível', development_only: 'Disponível no piloto', unavailable: 'Indisponível', not_configured: 'Não configurado' };
function App() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setState('loading');
    const timer = setTimeout(() => controller.abort(), 5000);
    fetch('/api/v1/system/status', { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error('API unavailable');
      return SystemStatusSchema.parse(await r.json());
    }).then(data => { if (active) { setStatus(data); setState('success'); } }).catch(() => { if (active) { setStatus(null); setState('error'); } }).finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [attempt]);
  return <main>
    <header><a className="brand" href="#main">J<span>Λ</span>RVIS</a><span className="badge">AMBIENTE DE DESENVOLVIMENTO</span></header>
    <section id="main" className="hero"><div className="orb" aria-hidden="true"><div/><span/></div><p className="eyebrow">PROJETO IRONMAN · F02</p><h1>A base de um assistente<br/><em>que conhece o seu mundo.</em></h1><p className="intro">Estamos construindo um espaço pessoal para conversar, lembrar e agir com controle. Esta etapa prepara seu acesso e perfil privados.</p></section>
    <section className="panel" aria-labelledby="status-title"><div className="panel-heading"><div><p className="eyebrow">CONEXÃO COM A APLICAÇÃO</p><h2 id="status-title">Estado do ambiente</h2></div><button onClick={() => setAttempt(x => x + 1)} disabled={state === 'loading'}>Verificar novamente</button></div>
      <div role="status" aria-live="polite">{state === 'loading' && <p>Consultando a aplicação…</p>}{state === 'error' && <p className="notice">Não foi possível consultar a aplicação. Verifique se os serviços de desenvolvimento estão ativos e tente novamente.</p>}</div>
      {state === 'success' && status && <ul>{Object.entries(status.capabilities).map(([key, value]) => <li key={key}><span>{labels[key as keyof typeof labels]}</span><strong className={value === 'development_only' ? 'ready' : ''}>{states[value]}</strong></li>)}</ul>}
    </section>
    {status?.capabilities.authentication==='development_only'&&<AuthPanel/>}
    <aside><span className="step">PRIVACIDADE DESDE A BASE</span><h2>Um espaço próprio para cada pessoa.</h2><p>Seu perfil pertence a você, mesmo dentro de uma organização. Conversas, modelos e memória serão integrados nas próximas fases.</p></aside>
    <footer>IronMan / JARVIS<span>Fundação local · sem integração de IA ativa</span></footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
