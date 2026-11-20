// Teste funcional + capturas (Playwright + Chrome local, sem rede).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
const CAP = path.resolve('trabalho/capturas');
fs.mkdirSync(CAP, { recursive: true });

const logs = [];
const problemas = [];
function log(s) { logs.push(s); console.log(s); }
function check(cond, msg) {
  if (!cond) { problemas.push(msg); log('  ✗ ' + msg); }
  else log('  ✓ ' + msg);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await context.setOffline(true);
await context.route(/^https?:\/\//, r => r.abort());
const page = await context.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'load' });
log('Abertura offline de index.html: OK');
check(await page.locator('#telaInicial.ativa').isVisible(), 'tela inicial visível');
await page.screenshot({ path: path.join(CAP, '01-inicial.png') });

async function iniciar(nivel, modo, seed) {
  await page.evaluate(o => window.__GAME__.start(o), { nivel, modo, seed });
  await page.waitForTimeout(120);
  check(await page.locator('#telaJogo.ativa').isVisible(), `turno iniciado (${nivel}/${modo})`);
}
async function desafio() {
  return await page.evaluate(() => JSON.parse(JSON.stringify(window.__GAME__.challenge)));
}
async function resolverCerto() {
  const c = await desafio();
  if (c.type === 'escala') {
    for (let i = 0; i < c.ing.length; i++) {
      await page.evaluate(([i, v]) => window.__GAME__.setIngredient(i, v), [i, c.ing[i].meta]);
    }
  } else if (c.type === 'comparacao') {
    await page.evaluate(i => window.__GAME__.selectOption(i), c.correta);
  } else {
    await page.evaluate(v => window.__GAME__.setAnswer(v), c.answer);
  }
  await page.click('#btnServir');
  await page.waitForTimeout(1050);
  return c;
}
async function resolverErrado() {
  const c = await desafio();
  if (c.type === 'escala') {
    await page.evaluate(([i, v]) => window.__GAME__.setIngredient(i, v), [0, c.ing[0].meta + 1]);
  } else if (c.type === 'comparacao') {
    await page.evaluate(i => window.__GAME__.selectOption(i), (c.correta + 1) % c.opcoes.length);
  } else {
    await page.evaluate(v => window.__GAME__.setAnswer(v), c.answer + 1);
  }
  await page.click('#btnServir');
  await page.waitForTimeout(1050);
  return c;
}

// ---------- execução 1: vitória no turno cronometrado ----------
log('\n--- Execução 1: turno cronometrado, todos os tipos ---');
await iniciar('aprendiz', 'cronometrado', 424242);
const vistos = new Set();
let anteriorEntregues = 0;
for (let n = 0; n < 8; n++) {
  const c = await desafio();
  vistos.add(c.type);
  if (n === 0) {
    // bancada com níveis visíveis para a captura
    await page.evaluate(() => {
      const c = window.__GAME__.challenge;
      window.__GAME__.setIngredient(0, Math.max(1, Math.floor(c.ing[0].meta / 2)));
    });
    await page.waitForTimeout(180);
    await page.screenshot({ path: path.join(CAP, '02-jogo-andamento.png') });
  }
  if (c.type === 'comparacao' && !vistos.has('_cap_comp')) {
    vistos.add('_cap_comp');
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(CAP, '05-comparacao.png') });
  }
  if (c.type === 'conversao' && !vistos.has('_cap_conv')) {
    vistos.add('_cap_conv');
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(CAP, '06-conversao.png') });
  }
  await resolverCerto();
  const st = await page.evaluate(() => window.__GAME__.state);
  check(st.entregues === anteriorEntregues + 1, `pedido ${n + 1} (${c.type}) aumentou entregues para ${st.entregues}`);
  check(st.score > 0, `pontuação positiva após pedido ${n + 1}: ${st.score}`);
  anteriorEntregues = st.entregues;
}
check(['escala', 'faltante', 'comparacao', 'conversao'].every(t => vistos.has(t)), 'os 4 tipos de desafio apareceram');
check(await page.locator('#telaFim.ativa').isVisible(), 'tela de fechamento exibida após a meta');
await page.screenshot({ path: path.join(CAP, '04-fechamento.png') });

// estado de alerta (em nova partida)
await iniciar('sous', 'cronometrado', 777001);
await page.evaluate(() => window.__GAME__.forceAlert());
await page.waitForTimeout(160);
check(await page.locator('#seloAlerta.visivel').isVisible(), 'selo de alerta visível no tempo crítico');
check(await page.locator('#hudTempo.critical').count() > 0, 'cronômetro em estado crítico');
await page.screenshot({ path: path.join(CAP, '03-alerta.png') });

// ---------- execução 2: falhas consecutivas em serviço contínuo ----------
log('\n--- Execução 2: serviço contínuo, erros consecutivos ---');
await iniciar('chef', 'continuo', 909090);
for (let n = 0; n < 3; n++) {
  const c = await resolverErrado();
  const st = await page.evaluate(() => window.__GAME__.state);
  check(st.vidas === 2 - n, `erro ${n + 1} (${c.type}) reduziu vidas para ${st.vidas}`);
  check(st.combo === 0, 'combo zerado após erro');
}
check(await page.locator('#telaFim.ativa').isVisible(), 'tela de fechamento exibida após perder as vidas');
check((await page.locator('#fimTitulo').textContent()).length > 0, 'título da tela final preenchido');

// repetir mesma semente
await page.click('#btnRepetir');
await page.waitForTimeout(120);
check(await page.evaluate(() => String(window.__GAME__.seed)) === '909090', 'repetir mesma semente preservou 909090');

check(consoleErrors.length === 0, 'nenhum erro de console: ' + consoleErrors.join(' | '));

const resultado = {
  data: new Date().toISOString(),
  screenshots: fs.readdirSync(CAP),
  problemas, consoleErrors,
  resultado: problemas.length === 0 ? 'APROVADO' : 'REPROVADO'
};
fs.writeFileSync(path.resolve('trabalho/teste-funcional.json'), JSON.stringify(resultado, null, 2));
fs.writeFileSync(path.resolve('trabalho/teste-funcional.log'), logs.join('\n') + '\n\nRESULTADO: ' + resultado.resultado + '\n');
log('\nRESULTADO: ' + resultado.resultado);
await browser.close();
if (problemas.length) process.exit(1);
