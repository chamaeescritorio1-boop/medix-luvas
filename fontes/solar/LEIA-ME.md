# Chama Solar — código protegido

A pasta `solar-teste/` é o site **já montado**. Não edite os arquivos dela na mão: eles são gerados.

- **Central do vendedor** (`index.html`): o código fica em `central.bin`, embaralhado (AES-GCM). O arquivo `js/entrada.js`
  confere o login do Chamae, pede a chave ao banco (função `sol_chave_app()`, que só responde para usuário do solar) e abre o código.
  Quem não está logado baixa só um arquivo ilegível.
- **Páginas do cliente** (proposta, app da usina, proposta de serviço): um arquivo compacto por página (`js/*.min.js`),
  só com o que a página usa. Custos, impostos e margens **não existem no código**: vêm do banco (tabela `sol_parametros`),
  e a proposta recebe tudo zerado.
- **Fontes legíveis**: `fontes/solar/fontes.enc`, embaralhadas com a mesma chave. A chave fica no cofre do Supabase
  (projeto chamae-apps, segredo `sol_cred_app`, campo `chave`). Nunca grave a chave no repositório.

## Como alterar o sistema

```
pip install cryptography            # e ter o esbuild (variável ESBUILD ou no PATH)
export SOL_CHAVE='<chave do cofre>'
python3 fontes/solar/montar.py restaurar fontes/solar/fontes.enc /tmp/solar-src
# ... editar em /tmp/solar-src (js/, css/, *.html) e testar ...
python3 fontes/solar/montar.py montar /tmp/solar-src solar-teste
git add solar-teste fontes/solar && git commit
```

`montar` gera a central, as páginas do cliente, troca a versão dos arquivos e guarda as fontes de novo em `fontes.enc`.

## Trava de segurança
Se os custos e margens não vierem do banco, a central não abre (mensagem na tela), para nunca calcular preço com margem zero.

## Banco
- Função `public.sol_chave_app()` e segredo `sol_cred_app` (10/11/2026).
  Desfazer: `drop function public.sol_chave_app(); delete from vault.secrets where name = 'sol_cred_app';`
- `sol_parametros` id 20: recebeu `engenharia`, `fretePadrao`, `margemAvulso`, `manutencaoPorPlaca` e `groner`, que antes ficavam no código.
  Desfazer: `update sol_parametros set vigente = (id = 19) where id in (19, 20);`

## O que mais vai dentro das fontes (desde 10/11/2026 à noite)
- `robo/`: robô de cotação Belenergy que roda no PC do escritório (antes em `VitimGm/chamasolar-sistema`, pasta `fontes/solar-belenergy`).
- `servidor/`: funções do servidor (Edge Functions `sol-*`). `sql/`: comandos do banco, cada um com o seu DESFAZER.
- `testes/`: `preco.js` (7 casos fixos de preço), `central.js` e `publica.js` (navegador automático). Rodar os três antes de publicar.

**Este é o único lugar de trabalho do solar.** O repositório `VitimGm/chamasolar-sistema` ficou para trás: não publicar a partir dele
(o `publicar-chamae.py` de lá apaga o código protegido e as melhorias feitas aqui).
