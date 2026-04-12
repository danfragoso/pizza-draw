import './style.css';
import { initTheme } from './theme.js';
import { state, createNode, createEdge, createGroup } from './state.js';
import { initRenderer, render } from './render.js';
import { initInput, fitToScreen } from './input.js';
import { initUI } from './ui.js';
import { loadFromURL } from './share.js';

function seedDemo() {
  const cx = window.innerWidth  / 2;
  const cy = window.innerHeight / 2;

  // ── Nodes ──
  const internet = createNode('cloud',       cx,       cy - 210);
  const fw       = createNode('firewall',    cx,       cy - 110);
  const router   = createNode('router',      cx,       cy -  10);
  const sw1      = createNode('switch',      cx - 170, cy + 100);
  const sw2      = createNode('switch',      cx + 170, cy + 100);
  const srv1     = createNode('server',      cx - 280, cy + 220);
  const srv2     = createNode('server',      cx -  80, cy + 220);
  const db       = createNode('database',    cx +  80, cy + 220);
  const ws       = createNode('workstation', cx + 280, cy + 220);

  internet.label = 'Internet';
  fw.label       = 'Firewall';
  router.label   = 'Core Router';
  sw1.label      = 'SW-01';
  sw2.label      = 'SW-02';
  srv1.label     = 'Web Server';
  srv2.label     = 'App Server';
  db.label       = 'Database';
  ws.label       = 'Workstation';

  state.nodes.push(internet, fw, router, sw1, sw2, srv1, srv2, db, ws);

  // ── Edges ──
  const e0 = createEdge(internet.id, fw.id);
  const e1 = createEdge(fw.id,       router.id);
  const e2 = createEdge(router.id,   sw1.id);
  const e3 = createEdge(router.id,   sw2.id);
  const e4 = createEdge(sw1.id,      srv1.id);
  const e5 = createEdge(sw1.id,      srv2.id);
  const e6 = createEdge(sw2.id,      db.id);
  const e7 = createEdge(sw2.id,      ws.id);

  e0.speed = 2.5; e0.bidirectional = true; e0.label = 'WAN';
  e1.speed = 2.0; e1.label = '10 Gbps';
  e2.speed = 1.5; e3.speed = 1.5;
  e4.speed = 1.0; e5.speed = 1.2;
  e6.speed = 0.8; e7.speed = 0.6;

  state.edges.push(e0, e1, e2, e3, e4, e5, e6, e7);

  // ── Groups / subnets ──
  const dmzGroup = createGroup(cx, cy - 60, 200, 200, 2); // pink
  dmzGroup.label = 'DMZ  10.0.0.0/24';

  const appGroup = createGroup(cx - 170, cy + 170, 320, 200, 1); // blue
  appGroup.label = 'App Subnet  192.168.1.0/24';

  const dbGroup = createGroup(cx + 170, cy + 170, 320, 200, 0); // green
  dbGroup.label = 'Data Subnet  192.168.2.0/24';

  state.groups.push(dmzGroup, appGroup, dbGroup);
}

async function main() {
  const canvas = document.getElementById('canvas');

  initTheme();
  initRenderer(canvas);
  initInput(canvas);
  initUI();

  // Restore from shared URL if a hash is present
  await loadFromURL();
  fitToScreen();

  function loop(timestamp) {
    render(timestamp);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

main();
