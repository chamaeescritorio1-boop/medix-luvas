# Fontes do Conversor CA Medix (Chamae)

App publicado em `/medix-luvas/` (oficial) e `/medix-luvas/teste/` (teste). Os arquivos de trabalho ficam em
`fontes/medix.tar.gz.enc`, criptografados com a **senha da equipe**.

Restaurar: `python3 fontes/backup_fontes.py restaurar fontes/medix.tar.gz.enc ./fontes-medix` (pip install cryptography)

## Estrutura
- `app/template_teste.html` — gerado por `mk_template.py` a partir do template da Marluvas + `early.js` / `late.js` (regras Medix)
- `app/catm.json` — catálogo (gerado por `parse.py` da planilha de preços + `mapca.py` que liga SKU → CA Medix pelo nome do modelo)
- `buildmedix.py` — monta e criptografa (localStorage `mdx_`, cache SW `mdx-`/`mdxt-`)

## Regras Medix
- 4 linhas: Safety (EPIs com CA), Profissional, Hospitalar, Vida Fácil.
- Preço por item conforme comissão 1%–5% (cada item só oferece as comissões existentes na planilha; padrão escolhido no topo).
- Venda em múltiplos (OBS da planilha) ou caixa fechada.
- Pedido mínimo CIF R$ 2.500; FOB a partir de R$ 1.000 (frete a cotar).
- Prazos: Antecipado Medix (2% desc.), 28, 28/35, 28/42, 14/21/28, 28/35/42, 30/45/60, 28/42/56/63, 30/45/60/75/90.
- Reprio: representada 0011 - Medix Brasil (IDs descobertos pela API com a chave do vendedor).
- Base de CAs de luvas: `/conversor-ca/caepi_luvas.json` (gerada semanalmente pelo workflow do repositório conversor-ca).
- Interpretação: aplicação (descartável/cirúrgica/segurança), material, banho, nível de corte, proteções (químico, calor, frio, solda…).
  Validada com os 35 CAs Medix da base: classe correta 35/35, modelo exato entre os 3 primeiros 33/35.
