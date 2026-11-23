# Motor de semelhança do Converter CA (Sistema teste, 23/11/2026)

Pedido do Victor: o conversor "traz alguns, mas nunca O MAIS PRÓXIMO".

- Código: `chamae/app.js`, bloco `/*EQV-INICIO*/ … /*EQV-FIM*/` (o motor puro fica entre `/*EQV-MOTOR-INICIO*/` e `/*EQV-MOTOR-FIM*/`).
  `EQV_ON=false` volta a abrir o conversor antigo. Botão "Abrir o conversor antigo" no fim da tela também.
- Como compara: lê o texto oficial do CA do concorrente (`/conversor-ca/caepi*.json`) e o que o cliente escreveu; monta a ficha do nosso produto
  (catálogo `produtos.attrs` > descrição > CA do nosso produto; `attrs.eqf` = correção do gestor pelo botão ✎ Corrigir ficha).
- Regras importantes: biqueira plástica da Marluvas = conformação (calçado ocupacional, sem proteção); "calçado ocupacional" no CA = sem biqueira de proteção;
  o CA quase nunca diz nobuck/cor real → o motor pergunta ou usa o texto/foto do cliente.
- Travas (selo "Não atende"): biqueira de proteção, isolante, antiperfurante, metatarso, corte, impacto, uso em saúde, riscos químico/biológico/calor/frio/elétrico.
- Indicações dos vendedores: tabela `equivalencias` (ca, rep, cod, tipo igual|semelhante|nao, motivo, por). Entram em 1º para todos; `nao` tira o produto da lista.
- Gabarito: `node fontes/equivalencia/teste_equivalencia.js produtos.json ../conversor-ca` — rode antes de publicar mudanças no motor; acrescente em `gabarito.json` cada erro corrigido.
