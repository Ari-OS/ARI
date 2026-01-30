#!/usr/bin/env npx tsx
/**
 * ARI Main Daemon
 *
 * Two-way communication:
 * - Web interface for commands (Tailscale accessible)
 * - Pushover for notifications
 * - Claude for intelligent action execution
 *
 * Access: https://aris-mac-mini.tail947c7e.ts.net:3142
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PushoverClient } from '../src/integrations/pushover/pushover-client.js';
import { NotionClient } from '../src/integrations/notion/notion-client.js';
import { smsExecutor } from '../src/integrations/sms/sms-executor.js';
import { ClaudeClient } from '../src/autonomous/claude-client.js';
import { dailyAudit } from '../src/autonomous/daily-audit.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = 3142;
const CONFIG_PATH = path.join(process.env.HOME || '~', '.ari', 'autonomous.json');

interface Config {
  pushover?: { userKey?: string; apiToken?: string };
  claude?: { apiKey?: string; model?: string };
  notion?: { apiKey?: string; dailyLogsPageId?: string; tasksDbId?: string };
}

interface ConversationContext {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  lastActivity: Date;
}

const context: ConversationContext = { messages: [], lastActivity: new Date() };

const SYSTEM_PROMPT = `You are ARI, Pryce's autonomous AI. You DECIDE and EXECUTE actions.

Return JSON:
{
  "thinking": "brief analysis",
  "actions": [{"type": "shell", "command": "git status"}],
  "response": "Concise response to user"
}

ACTION TYPES: shell, task, status, file, respond_only
Be proactive - run commands to answer questions.`;

async function loadConfig(): Promise<Config> {
  try {
    return JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      ARI Main Daemon                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\\n');

  const config = await loadConfig();

  if (!config.pushover?.userKey || !config.pushover?.apiToken) {
    console.error('✗ Pushover not configured'); process.exit(1);
  }
  if (!config.claude?.apiKey) {
    console.error('✗ Claude not configured'); process.exit(1);
  }

  const pushover = new PushoverClient({
    userKey: config.pushover.userKey,
    apiToken: config.pushover.apiToken,
  });

  const claude = new ClaudeClient({
    apiKey: config.claude.apiKey,
    model: config.claude.model || 'claude-sonnet-4-20250514',
    maxTokens: 1024,
  });

  // Initialize Notion (optional but recommended)
  let notion: NotionClient | null = null;
  if (config.notion?.apiKey && config.notion.dailyLogsPageId && config.notion.tasksDbId) {
    notion = new NotionClient({
      apiKey: config.notion.apiKey,
      dailyLogsPageId: config.notion.dailyLogsPageId,
      tasksDbId: config.notion.tasksDbId,
    });
    console.log('✓ Notion ready');
  } else {
    console.log('⚠ Notion not configured');
  }

  console.log('✓ Pushover ready');
  console.log('✓ Claude ready');

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok' }));

  // Simple mobile-friendly interface
  app.get('/', async (_, reply) => {
    reply.type('text/html');
    return getHtmlInterface();
  });

  app.get('/api/history', async () => ({ messages: context.messages.slice(-20) }));

  app.post('/api/message', async (request) => {
    const { message } = request.body as { message: string };
    if (!message?.trim()) return { error: 'Message required' };

    console.log(`📥 ${message}`);
    context.messages.push({ role: 'user', content: message });
    if (context.messages.length > 20) context.messages.shift();

    await dailyAudit.logActivity('api_call', 'Command', message.slice(0, 50), { outcome: 'success' });

    try {
      const claudeResponse = await claude.chat(context.messages, SYSTEM_PROMPT);

      let decision: { actions?: Array<{ type: string; command?: string; args?: string[] }>; response?: string };
      try {
        const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
        decision = jsonMatch ? JSON.parse(jsonMatch[0]) : { response: claudeResponse };
      } catch {
        decision = { response: claudeResponse };
      }

      const actionResults: Array<{ type: string; success: boolean; output: string }> = [];
      for (const action of decision.actions ?? []) {
        if (action.type === 'respond_only') continue;
        console.log(`⚡ ${action.type}: ${action.command || ''}`);
        const result = await smsExecutor.execute({
          type: action.type as 'shell' | 'status' | 'task' | 'file' | 'query' | 'unknown',
          command: action.command ?? '',
          args: action.args ?? [],
          requiresConfirmation: false,
        });
        actionResults.push({ type: action.type, ...result });
      }

      let response = decision.response ?? 'Done.';
      const outputs = actionResults.filter(r => r.output).map(r => r.output);
      if (outputs.length > 0) response += '\\n\\n' + outputs.join('\\n');

      context.messages.push({ role: 'assistant', content: response });
      console.log(`📤 ${response.slice(0, 80)}...`);

      // Determine priority based on results
      const hasErrors = actionResults.some(r => !r.success);
      const hasActions = actionResults.length > 0;

      // Only send Pushover for errors or important actions (P1-P2)
      // Regular conversation goes to Notion only (P3-P4)
      if (hasErrors) {
        await pushover.alert(response.slice(0, 500), 'ARI Error');
      }
      // Don't spam Pushover for every chat - just log to Notion

      // Log everything to Notion
      if (notion) {
        try {
          await notion.addLogEntry({
            title: `${hasActions ? 'Action' : 'Chat'}: ${message.slice(0, 50)}`,
            content: response.slice(0, 500),
            category: hasErrors ? 'error' : 'action',
            priority: hasErrors ? 'P1' : (hasActions ? 'P3' : 'P4'),
          });
        } catch (e) {
          console.log('⚠ Notion log failed:', e instanceof Error ? e.message : 'unknown');
        }
      }

      return { response, actions: actionResults };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Error';
      return { response: 'Error: ' + errMsg, actions: [] };
    }
  });

  app.get('/api/status', async () => {
    const result = await smsExecutor.execute({ type: 'status', command: '', args: [], requiresConfirmation: false });
    return { ari: 'online', system: result.output };
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });

  console.log(`\\n✓ Running on port ${PORT}`);
  console.log(`  Local: http://localhost:${PORT}`);
  console.log(`  Tailscale: https://aris-mac-mini.tail947c7e.ts.net:${PORT}\\n`);

  await pushover.notify('ARI online: https://aris-mac-mini.tail947c7e.ts.net:3142', 'ARI Started');

  process.on('SIGINT', async () => { await app.close(); process.exit(0); });
  process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
}

function getHtmlInterface(): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#000000">
<title>ARI Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%;overflow:hidden}
body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;background:#000;color:#fff}
.app{display:flex;flex-direction:column;height:100%;max-width:500px;margin:0 auto;background:linear-gradient(180deg,#0a0a0a 0%,#111 100%)}
.header{padding:16px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1)}
.logo{font-size:32px;font-weight:800;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.tagline{color:rgba(255,255,255,0.4);font-size:10px;text-transform:uppercase;letter-spacing:2px;margin-top:2px}
.tabs{display:flex;border-bottom:1px solid rgba(255,255,255,0.1)}
.tab{flex:1;padding:12px;text-align:center;font-size:13px;font-weight:600;color:rgba(255,255,255,0.5);cursor:pointer;border-bottom:2px solid transparent;transition:all 0.2s}
.tab.active{color:#fff;border-bottom-color:#667eea}
.panels{flex:1;overflow:hidden;position:relative}
.panel{position:absolute;inset:0;overflow-y:auto;padding:16px;display:none;-webkit-overflow-scrolling:touch}
.panel.active{display:block}
.card{background:rgba(255,255,255,0.05);border-radius:16px;padding:16px;margin-bottom:12px}
.card-title{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4);margin-bottom:10px}
.stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.stat{text-align:center;padding:12px;background:rgba(255,255,255,0.05);border-radius:12px}
.stat-value{font-size:24px;font-weight:700;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.stat-label{font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-top:4px}
.status-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
.status-row:last-child{border-bottom:none}
.status-label{color:rgba(255,255,255,0.6);font-size:13px}
.status-value{font-size:13px;font-weight:600}
.status-value.ok{color:#34c759}
.status-value.warn{color:#ff9f0a}
.status-value.err{color:#ff453a}
.messages{display:flex;flex-direction:column;gap:10px;padding-bottom:80px}
.msg{max-width:85%;padding:12px 16px;border-radius:18px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}
.msg.u{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);align-self:flex-end;border-bottom-right-radius:6px}
.msg.a{background:rgba(255,255,255,0.1);align-self:flex-start;border-bottom-left-radius:6px}
.typing{display:flex;gap:4px;padding:12px 16px;background:rgba(255,255,255,0.1);border-radius:18px;align-self:flex-start}
.typing span{width:6px;height:6px;background:rgba(255,255,255,0.5);border-radius:50%;animation:bounce 1.4s infinite}
.typing span:nth-child(2){animation-delay:0.2s}
.typing span:nth-child(3){animation-delay:0.4s}
@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}
.input-area{position:fixed;bottom:0;left:0;right:0;padding:12px 16px 24px;background:rgba(0,0,0,0.9);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid rgba(255,255,255,0.1);display:flex;gap:10px;max-width:500px;margin:0 auto}
input{flex:1;padding:14px 18px;border:none;border-radius:24px;background:rgba(255,255,255,0.1);color:#fff;font-size:16px;outline:none}
input:focus{background:rgba(255,255,255,0.15);box-shadow:0 0 0 2px rgba(102,126,234,0.5)}
input::placeholder{color:rgba(255,255,255,0.3)}
.send-btn{width:48px;height:48px;border:none;border-radius:50%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;font-size:18px;cursor:pointer}
.send-btn:disabled{opacity:0.5}
.quick-actions{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.quick-btn{padding:14px;border:none;border-radius:12px;background:rgba(255,255,255,0.05);color:#fff;font-size:13px;font-weight:500;cursor:pointer;text-align:left;transition:all 0.2s}
.quick-btn:active{background:rgba(255,255,255,0.1);transform:scale(0.98)}
.quick-btn span{display:block;font-size:18px;margin-bottom:4px}
.priority-list{display:flex;flex-direction:column;gap:8px}
.priority-item{display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.05);border-radius:12px}
.priority-badge{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px}
.priority-badge.p0{background:rgba(255,69,58,0.2);color:#ff453a}
.priority-badge.p1{background:rgba(255,159,10,0.2);color:#ff9f0a}
.priority-badge.p2{background:rgba(52,199,89,0.2);color:#34c759}
.priority-badge.p3{background:rgba(102,126,234,0.2);color:#667eea}
.priority-info{flex:1}
.priority-name{font-weight:600;font-size:14px}
.priority-desc{font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px}
.priority-channels{font-size:10px;color:rgba(255,255,255,0.3);margin-top:4px}
</style>
</head><body>
<div class="app">
<div class="header">
<div class="logo">ARI</div>
<div class="tagline">Your Life Operating System</div>
</div>
<div class="tabs">
<div class="tab active" onclick="showTab('chat')">Chat</div>
<div class="tab" onclick="showTab('status')">Status</div>
<div class="tab" onclick="showTab('actions')">Actions</div>
<div class="tab" onclick="showTab('config')">Config</div>
</div>
<div class="panels">
<div class="panel active" id="panel-chat">
<div class="messages" id="messages"></div>
</div>
<div class="panel" id="panel-status">
<div class="card">
<div class="card-title">System Status</div>
<div class="stat-grid">
<div class="stat"><div class="stat-value" id="s-uptime">--</div><div class="stat-label">Uptime</div></div>
<div class="stat"><div class="stat-value" id="s-tasks">--</div><div class="stat-label">Tasks</div></div>
<div class="stat"><div class="stat-value" id="s-msgs">--</div><div class="stat-label">Messages</div></div>
<div class="stat"><div class="stat-value" id="s-load">--</div><div class="stat-label">Load</div></div>
</div>
</div>
<div class="card">
<div class="card-title">Services</div>
<div class="status-row"><span class="status-label">ARI Daemon</span><span class="status-value ok" id="svc-ari">Online</span></div>
<div class="status-row"><span class="status-label">Pushover</span><span class="status-value ok" id="svc-push">Connected</span></div>
<div class="status-row"><span class="status-label">Claude API</span><span class="status-value ok" id="svc-claude">Ready</span></div>
<div class="status-row"><span class="status-label">Notion</span><span class="status-value ok" id="svc-notion">Connected</span></div>
</div>
</div>
<div class="panel" id="panel-actions">
<div class="card">
<div class="card-title">Quick Actions</div>
<div class="quick-actions">
<button class="quick-btn" onclick="q('git status')"><span>📁</span>Git Status</button>
<button class="quick-btn" onclick="q('npm test')"><span>🧪</span>Run Tests</button>
<button class="quick-btn" onclick="q('df -h')"><span>💾</span>Disk Space</button>
<button class="quick-btn" onclick="q('uptime')"><span>⏱️</span>Uptime</button>
<button class="quick-btn" onclick="q('ps aux | head -10')"><span>📊</span>Processes</button>
<button class="quick-btn" onclick="q('tail -20 ~/.ari/logs/ari-daemon.log')"><span>📜</span>View Logs</button>
</div>
</div>
<div class="card">
<div class="card-title">ARI Commands</div>
<div class="quick-actions">
<button class="quick-btn" onclick="q('add task ')"><span>➕</span>Add Task</button>
<button class="quick-btn" onclick="q('status')"><span>📡</span>Full Status</button>
</div>
</div>
</div>
<div class="panel" id="panel-config">
<div class="card">
<div class="card-title">Priority Levels</div>
<div class="priority-list">
<div class="priority-item"><div class="priority-badge p0">P0</div><div class="priority-info"><div class="priority-name">Critical</div><div class="priority-desc">Security, failures, data loss</div><div class="priority-channels">Pushover + SMS (always)</div></div></div>
<div class="priority-item"><div class="priority-badge p1">P1</div><div class="priority-info"><div class="priority-name">High</div><div class="priority-desc">Errors, needs attention</div><div class="priority-channels">Pushover + Notion</div></div></div>
<div class="priority-item"><div class="priority-badge p2">P2</div><div class="priority-info"><div class="priority-name">Normal</div><div class="priority-desc">Tasks, milestones</div><div class="priority-channels">Pushover + Notion</div></div></div>
<div class="priority-item"><div class="priority-badge p3">P3</div><div class="priority-info"><div class="priority-name">Low</div><div class="priority-desc">Insights, suggestions</div><div class="priority-channels">Notion only (batched)</div></div></div>
</div>
</div>
<div class="card">
<div class="card-title">Settings</div>
<div class="status-row"><span class="status-label">Quiet Hours</span><span class="status-value">10 PM - 7 AM</span></div>
<div class="status-row"><span class="status-label">Timezone</span><span class="status-value">Indiana</span></div>
<div class="status-row"><span class="status-label">Max SMS/Hour</span><span class="status-value">5</span></div>
</div>
</div>
</div>
</div>
<div class="input-area">
<input id="input" placeholder="Message ARI..." autocomplete="off">
<button class="send-btn" id="send">➤</button>
</div>
<script>
const msgEl=document.getElementById('messages'),inp=document.getElementById('input'),sendBtn=document.getElementById('send');
function showTab(name){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));document.querySelector('.tab:nth-child('+(name==='chat'?1:name==='status'?2:name==='actions'?3:4)+')').classList.add('active');document.getElementById('panel-'+name).classList.add('active');if(name==='status')loadStatus()}
function add(c,r){const d=document.createElement('div');d.className='msg '+(r==='user'?'u':'a');d.textContent=c;msgEl.appendChild(d);msgEl.scrollTop=msgEl.scrollHeight}
function showTyping(){const d=document.createElement('div');d.className='typing';d.id='typing';d.innerHTML='<span></span><span></span><span></span>';msgEl.appendChild(d);msgEl.scrollTop=msgEl.scrollHeight}
function hideTyping(){const el=document.getElementById('typing');if(el)el.remove()}
async function send(){const msg=inp.value.trim();if(!msg)return;inp.value='';sendBtn.disabled=true;add(msg,'user');showTyping();showTab('chat');
try{const r=await fetch('/api/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});const d=await r.json();hideTyping();add(d.response,'assistant')}catch(e){hideTyping();add('Error: '+e.message,'assistant')}
sendBtn.disabled=false;inp.focus()}
function q(cmd){inp.value=cmd;if(!cmd.endsWith(' '))send();else{inp.focus();showTab('chat')}}
async function loadStatus(){try{const r=await fetch('/api/status');const d=await r.json();document.getElementById('s-uptime').textContent=d.system?.match(/up\\s+([^,]+)/)?.[1]||'--';document.getElementById('s-load').textContent=d.system?.match(/load.*?([\\d.]+)/)?.[1]||'--';document.getElementById('s-tasks').textContent=d.system?.match(/Tasks:\\s+(\\d+)/)?.[1]||'0';document.getElementById('s-msgs').textContent=d.contextMessages||'0'}catch(e){}}
sendBtn.onclick=send;inp.onkeypress=e=>{if(e.key==='Enter'){e.preventDefault();send()}};
fetch('/api/history').then(r=>r.json()).then(d=>d.messages.forEach(x=>add(x.content,x.role)));
loadStatus();setInterval(loadStatus,30000);
</script>
</body></html>`;
}

main().catch(e=>{console.error(e);process.exit(1)});
