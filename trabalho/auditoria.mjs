// Auditoria matemática: extrai o núcleo procedural do index.html e gera
// 500 pedidos de cada tipo (4) em cada nível (3) = 6.000 pedidos.
import fs from 'node:fs';
import path from 'node:path';

const HTML = fs.readFileSync(path.resolve('index.html'), 'utf8');
const m = HTML.match(/\/\/ ==GEN_START==[^\n]*\n([\s\S]*?)\n\/\/ ==GEN_END==/);
if (!m) throw new Error('Marcadores ==GEN_START== / ==GEN_END== não encontrados');
const factory = new Function(m[1] + '\nreturn {generateChallenge, validateChallenge, makeRng, ratioKey, CAPS};');
const { generateChallenge, validateChallenge, ratioKey, CAPS } = factory();

const NIVEIS = ['aprendiz', 'sous', 'chef'];
const TIPOS = ['escala', 'faltante', 'comparacao', 'conversao'];
const POR_TIPO = 500;
const erros = [];
const stats = { total: 0, porNivel: {}, porTipo: {}, inteiras: 0, comparacoes: 0, metade: 0, reprodutibilidade: 0 };
const detalhes = [];

function falha(id, msg) {
  erros.push(`${id}: ${msg}`);
  if (detalhes.length < 30) detalhes.push({ id, msg });
}

for (const nivel of NIVEIS) {
  stats.porNivel[nivel] = 0;
  for (const tipo of TIPOS) {
    stats.porTipo[`${nivel}/${tipo}`] = 0;
    for (let i = 0; i < POR_TIPO; i++) {
      const seed = 100000 + (i * 7919) % 900000;
      const id = `${nivel}/${tipo}/${i}`;
      let c;
      try {
        c = generateChallenge(seed, nivel, tipo, i);
      } catch (e) {
        falha(id, 'exceção ao gerar: ' + e.message);
        continue;
      }
      stats.total++;

      // 1. Validação estrutural e de limites do próprio núcleo
      for (const e of validateChallenge(c)) falha(id, e);

      // 2. Reprodutibilidade da semente
      const c2 = generateChallenge(seed, nivel, tipo, i);
      if (JSON.stringify(c2) !== JSON.stringify(c)) {
        falha(id, 'semente não reproduziu o mesmo pedido');
      } else {
        stats.reprodutibilidade++;
      }

      // 3. Textos e unidades sem valores proibidos
      const textos = [c.titulo, c.baseTxt, c.pedidoTxt, c.dica].join(' ');
      if (/NaN|undefined|Infinity|\b0 copos\b|\b0 g\b|\b0 mL\b/.test(textos)) {
        falha(id, 'texto com valor inválido: ' + textos);
      }
      if (/[1-9]\d*\s*(kg|g|L|mL)\s+de\s+\S+\s+para\s+0/.test(c.pedidoTxt)) {
        falha(id, 'porção zero no pedido');
      }

      // 4. Solução exata, positiva e única
      if (tipo === 'comparacao') {
        stats.comparacoes++;
        const chave = ratioKey(c.ing.map(x => x.base));
        const certas = c.opcoes.filter(o => {
          if (o.length !== c.ing.length) falha(id, 'opção com nº de ingredientes diferente');
          return ratioKey(o) === chave;
        });
        if (certas.length !== 1) falha(id, `${certas.length} opções satisfazem a proporção (esperado 1)`);
        if (c.opcoes[c.correta] !== certas[0]) falha(id, 'índice correto não aponta para a única opção válida');
        for (const o of c.opcoes) {
          o.forEach(v => {
            if (!Number.isInteger(v) || v <= 0) falha(id, 'valor de jarro não inteiro positivo: ' + v);
            if (v > CAPS[nivel].geral * 2) falha(id, 'valor de jarro acima do limite: ' + v);
          });
        }
      } else if (tipo === 'escala') {
        if (!Array.isArray(c.solucoes) || c.solucoes.length !== c.ing.length) {
          falha(id, 'solucoes não casa com ing');
        } else {
          c.solucoes.forEach((v, i) => {
            if (!Number.isInteger(v) || v <= 0) falha(id, `solução ${i} inválida: ${v}`);
            if (v > CAPS[nivel].geral) falha(id, `solução ${i} acima do limite: ${v}`);
            if (c.ing[i].meta !== v) falha(id, `meta ${i} ≠ solução ${i}`);
          });
          stats.inteiras++;
          // Unicidade: o fator é deduzido de qualquer ingrediente e deve
          // produzir o mesmo valor para todos os demais.
          for (let a = 0; a < c.ing.length; a++) {
            for (let b = 0; b < c.ing.length; b++) {
              if (a === b) continue;
              const lhs = c.solucoes[a] * c.ing[b].base;
              const rhs = c.solucoes[b] * c.ing[a].base;
              if (lhs !== rhs) falha(id, `razão inconsistente entre ${a} e ${b}`);
            }
          }
        }
        if (/½/.test(c.pedidoTxt)) stats.metade++;
      } else {
        stats.inteiras++;
        if (!Number.isInteger(c.answer) || c.answer <= 0) falha(id, 'resposta inválida: ' + c.answer);
        if (c.solucoes.length !== 1 || c.solucoes[0] !== c.answer) falha(id, 'solução duplicada/inconsistente');
        if (!Number.isFinite(c.answer)) falha(id, 'resposta não finita');
        if (tipo === 'conversao') {
          const cap = CAPS[nivel].conv;
          if (c.answer > cap) falha(id, 'conversão acima do limite: ' + c.answer);
          const f = c.conversao.factor;
          const dePequena = (c.conversao.from === 'g' || c.conversao.from === 'mL');
          if (dePequena) {
            if (c.answer * f !== c.fromVal) falha(id, 'conversão inversa não exata');
          } else if (c.answer !== c.fromVal) {
            // kg / L / xícara: fromVal e answer já estão na unidade pequena
            falha(id, 'conversão direta não exata');
          }
          if (!c.conversao.eq) falha(id, 'equivalência não exibida na comanda');
          if (c.escalaInfo && !Number.isInteger(c.escalaInfo.base * c.escalaInfo.k)) {
            falha(id, 'escala+conversão com fator quebrado');
          }
        } else {
          if (c.answer > CAPS[nivel].geral) falha(id, 'termo faltante acima do limite');
          // O termo falta nte deve manter a razão com todos os dados
          c.ing.forEach((ig, i) => {
            if (i === c.faltante) return;
            if (ig.meta * c.ing[c.faltante].base !== c.answer * ig.base) {
              falha(id, `proporção do termo faltante quebrada em ${i}`);
            }
          });
        }
      }

      // 5. Nenhuma quantidade obrigatória zerada/negativa
      c.ing.forEach((ig, i) => {
        if (!(ig.base > 0)) falha(id, `ingrediente ${i} com base ≤ 0`);
        if (tipo !== 'conversao' && !Number.isInteger(ig.base)) falha(id, `base não inteira: ${ig.base}`);
        if (ig.meta !== undefined && !(ig.meta > 0)) falha(id, `ingrediente ${i} com meta ≤ 0`);
        if (ig.atual !== undefined && !Number.isInteger(ig.atual)) falha(id, `ingrediente ${i} com atual não inteiro`);
      });

      stats.porNivel[nivel]++;
      stats.porTipo[`${nivel}/${tipo}`]++;
    }
  }
}

const relatorio = {
  data: new Date().toISOString(),
  arquivo: 'index.html',
  tamanhoBytes: fs.statSync('index.html').size,
  totalPedidos: stats.total,
  esperado: NIVEIS.length * TIPOS.length * POR_TIPO,
  porNivel: stats.porNivel,
  porTipo: stats.porTipo,
  verificacoes: {
    solucoesInteirasExatasPositivas: stats.inteiras,
    comparacoesUnicaAlternativa: stats.comparacoes,
    reprodutibilidadeSemente: stats.reprodutibilidade,
    escalasComMetadeExplicita: stats.metade,
    limitesPorNivel: stats.total
  },
  falhas: erros.length,
  detalhesFalhas: detalhes,
  resultado: erros.length === 0 && stats.total === 6000 ? 'APROVADO' : 'REPROVADO'
};

fs.writeFileSync(path.resolve('trabalho/auditoria.json'), JSON.stringify(relatorio, null, 2));
console.log(`Pedidos: ${stats.total}/6000`);
console.log(`Inteiras: ${stats.inteiras} · Comparações: ${stats.comparacoes} · Reprodutíveis: ${stats.reprodutibilidade}`);
console.log(`Escalas ½: ${stats.metade} · Falhas: ${erros.length}`);
if (erros.length) {
  console.log(erros.slice(0, 20).join('\n'));
  process.exit(1);
}
console.log('RESULTADO: APROVADO');
