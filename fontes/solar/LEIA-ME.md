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

## Google Drive (desde 16/11/2026)
- Os documentos dos clientes vão para o drive compartilhado **CHAMA SOLAR**, não mais para o Storage `sol-arquivos`.
  Cada orçamento ganha a pasta `ANO/MM - MÊS/NOME - CIDADE (CÓDIGO)/` com `1 PROPOSTAS`, `2 CONTA E DOCUMENTOS`,
  `3 VISITA TÉCNICA`, `4 PROJETO`, `5 CONTRATO E PAGAMENTO` (criada quando o orçamento é salvo com nome, ou no primeiro arquivo).
- Edge Functions: `sol-drive` (pastas, envio, lixeira, link temporário; só usuário do solar) e `sol-drive-arquivo`
  (entrega o arquivo para o cliente por link assinado com validade; `verify_jwt` desligado de propósito). Fontes em `servidor/`.
- Conta de serviço `sistema-solar@chama-solar-sistema.iam.gserviceaccount.com` (projeto Google Cloud `chama-solar-sistema`,
  organização chamae.com.br), membro "Administrador de conteúdo" do drive CHAMA SOLAR. Chave só no secret `GOOGLE_SA_JSON`.
- Na janela de proposta, contrato, procuração e laudo: botão **"📁 Guardar PDF na pasta do cliente"** (gera o PDF com
  `js/pdf-drive.js` e envia para o Drive). Ficha do cliente → Documentos: botão **"📂 Pasta no Drive"**.
- Apagar um arquivo pelo sistema manda para a lixeira do Drive (30 dias para recuperar).
- Arquivos antigos da Groner foram copiados para `SISTEMA - ARQUIVOS DO GRONER/ANO/MM - MÊS/CLIENTE (GRN-x)/` e cada linha de
  `sol_cliente_arquivos` guarda `drive_id`/`drive_link`. Banco: `sql/008_google_drive.sql` (desfazer junto).
