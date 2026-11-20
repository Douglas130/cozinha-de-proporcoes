# Relatório final — Cozinha de Proporções

**Entregável:** `C:\Projetos\index.html` — arquivo único, autocontido, 100% offline.
**Tamanho final:** 68.248 bytes (66,6 KiB) · 1.365 linhas.
**Data:** 2026-11-20

---

## 1. Auditoria matemática (6.000 pedidos)

Script: `trabalho/auditoria.mjs` · dados: `trabalho/auditoria.json`.
O script extrai o núcleo procedural diretamente do `index.html` (marcadores `==GEN_START==` / `==GEN_END==`) e executa exatamente o código que roda no navegador — sem duplicação de fonte.

| Verificação | Instâncias | Resultado |
|---|---:|---|
| Pedidos gerados (3 níveis × 4 tipos × 500) | 6.000 / 6.000 | OK |
| Respostas/soluções inteiras, exatas e positivas | 4.500 | OK |
| Escolha com exatamente uma alternativa satisfazente | 1.500 | OK |
| Reprodutibilidade da semente | 6.000 | OK |
| Limites estritos de cada nível (`validateChallenge`) | 6.000 | OK |
| Proporção consistente entre todos os pares de ingredientes | todas | OK |
| Conversões exatas (kg↔g, L↔mL, xícara↔mL, escala+conversão) | todas | OK |
| Escalas ½ exibidas com aviso explícito | 79 | OK |
| **Falhas** | **0** | **APROVADO** |

Observação: a auditoria cobre conversão também no nível Aprendiz (equivalências simples e explícitas na comanda), conforme a exigência de 500 pedidos de cada tipo nos 3 níveis.

## 2. Teste funcional automatizado (Playwright + Chrome local, offline)

Script: `trabalho/teste-funcional.mjs` · log: `trabalho/teste-funcional.log`.

- Contexto `offline: true` + bloqueio de requisições http(s); abertura de `file:///.../index.html`: OK.
- Turno cronometrado (Aprendiz, semente 424242): 8 pedidos resolvidos pela UI real, cobrindo os 4 tipos; entregues e pontuação aumentaram a cada pedido: OK.
- Transição para a tela de fechamento ao bater a meta: OK.
- Estado crítico de tempo (selo de alerta acionável + cronômetro vermelho): OK.
- Serviço contínuo (Chef, semente 909090): 3 erros consecutivos reduziram vidas 3→2→1→0, zeraram o combo e fecharam o turno: OK.
- "Repetir mesma semente" preservou 909090: OK.
- Nenhum erro de console ou exceção de página: OK.
- **Resultado: APROVADO.**

Correções encontradas e aplicadas durante os testes: estado da tela (`telaJogo` vs `jogo`) que impedia o cronômetro de avançar; argumentos trocados em `bowlCard` (exibia `undefined`); unidade "3.000 kg" no painel lateral de conversão.

## 3. Revisão do crítico visual

Crítico independente, novo a cada rodada, com acesso **exclusivo** às capturas PNG (1440×900) em `trabalho/capturas/`, sem ler código nem explicações.

| Rodada | Grave | Médio | Menor | Veredito |
|---|---:|---:|---:|---|
| 1 | 0 | 0 | 6 | APROVADO — polimento: contraste, singular de unidades, rótulo de tempo, affordance |
| 2 | 2 | 3 | 3 | REPROVADO — "Razão atual preencha tudo", tempo final incoerente, "sabor" vs "proporção", alerta genérico |
| 3 | 0 | 0 | 2 | **APROVADO** — apenas "Vingrete" (leitura incorreta do crítico; a fonte diz "Vinagrete") e alerta parcial (corrigido para listar todos os faltantes) |

Correções aplicadas entre rodadas: painel "Na bancada ? : ?" com razão simplificada; tempo final renomeado para "Tempo restante" em mm:ss; instrução e dica trocando "sabor" por "proporção"; alerta acionável listando todos os ingredientes faltantes; botão "Servir" com estado "incompleto" discretamente atenuado; rótulo de "Limpar" adaptado ao tipo de desafio; borda de foco neutra no campo numérico; descrição do Sous-Chef reescrita; panela decorativa com vapor na bancada.

**Revisão final:** identidade de cozinha/confeitaria consistente (azulejo, madeira, tigelas, jarros, balança, panela, troféu); comanda e unidades legíveis em todos os estados; bancada sempre indica claramente o que foi ajustado; nenhuma sobreposição, corte, `undefined` ou botão inacessível. **Grave: 0. Médio: 0. APROVADO.**

---

## Pronto quando

- [x] Auditoria dos 6.000 pedidos sem falhas
- [x] Teste funcional de vitória e derrota aprovado
- [x] Crítico visual sem defeitos graves ou médios
- [x] `index.html` único, autocontido e offline

A pasta `trabalho/` contém scripts, logs, JSON e capturas. O diretório `4-operacoes-basicas/` já existia no repositório antes deste trabalho e foi preservado.
