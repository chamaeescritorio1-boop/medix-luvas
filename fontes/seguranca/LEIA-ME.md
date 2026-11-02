# Segurança (02/11/2026)

Revisão completa: https://claude.ai/artifact/Pb5t9SP5YVHejx121YLpUn

- `etapa1_banco.sql`: trava no perfil (só gestor muda aprovado/papel/e-mail de login; vendedor só usa o próprio
  e-mail de login como e-mail de envio) + tira de quem não está logado as funções atualizar_resumos/proximo_numero.
  Desfazer: `desfazer_etapa1_banco.sql`.
- Etapa 2: agentes-ia, enviar-email e analisar-ligacao exigem `eh_equipe()` (como sigma-estoque/sigma-orcamento).
  Desfazer: republicar a versão anterior de cada função a partir do histórico do git.
  Funções antigas smooth-action e teste-sigma: trocadas por um aviso "desativado" (410).
