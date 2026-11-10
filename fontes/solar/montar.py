#!/usr/bin/env python3
"""Chama Solar — monta o site publicado (solar-teste/) a partir das fontes.

As fontes (código legível) NÃO ficam no repositório: ficam em fontes/solar/fontes.enc,
embaralhadas com a chave guardada no cofre do Supabase (segredo sol_cred_app).

  SOL_CHAVE=<chave base64> python3 fontes/solar/montar.py restaurar fontes/solar/fontes.enc /tmp/solar-src
  ... editar /tmp/solar-src ...
  SOL_CHAVE=<chave base64> python3 fontes/solar/montar.py montar /tmp/solar-src solar-teste

"montar" faz tudo: a central vira central.bin (só abre para quem está logado no solar),
as páginas do cliente viram um arquivo compacto cada, e as fontes são guardadas de novo.
Precisa de: pip install cryptography; esbuild (variável ESBUILD ou no PATH).
"""
import base64, gzip, io, os, re, shutil, subprocess, sys, tarfile, time
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

AQUI = os.path.dirname(os.path.abspath(__file__))
PUBLICAS = ['proposta.html', 'cliente.html', 'proposta-servico.html']   # páginas do cliente: código compacto, sem custos
CENTRAL = 'index.html'                                                 # central do vendedor: código embaralhado
SOLTAS = ['js/qrcode.js']                                              # bibliotecas carregadas sob demanda


def chave():
    k = os.environ.get('SOL_CHAVE', '').strip()
    if not k: sys.exit('Falta SOL_CHAVE (segredo sol_cred_app do cofre do Supabase).')
    k = base64.b64decode(k); assert len(k) == 32, 'chave inválida'
    return k


def embaralhar(dados, prefixo=b''):
    iv = os.urandom(12)
    return prefixo + iv + AESGCM(chave()).encrypt(iv, dados, None)


def compactar(js):
    exe = os.environ.get('ESBUILD') or shutil.which('esbuild') or sys.exit('Falta o esbuild.')
    r = subprocess.run([exe, '--minify', '--loader=js', '--charset=utf8', '--legal-comments=none', '--target=es2020'], input=js.encode(), capture_output=True)
    if r.returncode: sys.exit('esbuild: ' + r.stderr.decode()[:2000])
    return r.stdout.decode()


def partes(html):
    """scripts da página, em ordem, e o script final (o que roda depois de Banco.pronto)."""
    lista = re.findall(r'<script src="(js/[^"?]+)[^"]*"></script>', html)
    fim = re.search(r'<script>Banco\.pronto\.then\(function \(\) \{ var s = document\.createElement\("script"\); s\.src = "(js/[^"?]+)[^"]*";[^<]*</script>', html)
    assert lista and fim, 'página fora do padrão'
    return lista, fim.group(1)


def juntar(src, html):
    lista, fim = partes(html)
    ler = lambda f: open(os.path.join(src, f), encoding='utf-8').read()
    corpo = ''.join(compactar(ler(f)).rstrip().rstrip(';') + ';\n' for f in lista)
    return corpo + 'Banco.pronto.then(function(){' + compactar(ler(fim)).strip() + '},function(){});\n'


def trocar_scripts(html, tag):
    html = re.sub(r'[ \t]*<script src="js/[^"]+"></script>\n', '', html)
    return re.sub(r'[ \t]*<script>Banco\.pronto\.then\(.*?</script>\n', '  ' + tag + '\n', html, flags=re.S)


def guardar(src, saida):
    bio = io.BytesIO()
    with tarfile.open(fileobj=bio, mode='w:gz') as tf:
        for raiz, dirs, arqs in os.walk(src):
            dirs.sort()
            for f in sorted(arqs): p = os.path.join(raiz, f); tf.add(p, arcname=os.path.relpath(p, src))
    open(saida, 'wb').write(embaralhar(bio.getvalue(), b'SOLAR1'))
    print('fontes guardadas:', saida, os.path.getsize(saida) // 1024, 'KB')


def restaurar(arq, dest):
    raw = open(arq, 'rb').read(); assert raw[:6] == b'SOLAR1', 'arquivo de fontes inválido'
    dados = AESGCM(chave()).decrypt(raw[6:18], raw[18:], None)
    os.makedirs(dest, exist_ok=True); tarfile.open(fileobj=io.BytesIO(dados)).extractall(dest, filter='data')
    print('fontes restauradas em', dest)


def montar(src, out):
    v = time.strftime('%Y%m%d%H%M')
    versao = lambda t: re.sub(r'\?v=\d{12}', '?v=' + v, t)
    if os.path.isdir(out): shutil.rmtree(out)
    os.makedirs(os.path.join(out, 'js'))
    for d in ('css', 'marca'): shutil.copytree(os.path.join(src, d), os.path.join(out, d))
    for f in SOLTAS: shutil.copy(os.path.join(src, f), os.path.join(out, f))
    for f in sorted(os.listdir(src)):
        if not f.endswith('.html'): continue
        html = open(os.path.join(src, f), encoding='utf-8').read()
        if f == CENTRAL:
            open(os.path.join(out, 'central.bin'), 'wb').write(embaralhar(gzip.compress(juntar(src, html).encode(), 9, mtime=0)))  # compacta antes: embaralhado não comprime
            entrada = open(os.path.join(src, 'js/entrada.js'), encoding='utf-8').read().replace('__VERSAO__', v)
            open(os.path.join(out, 'js/entrada.js'), 'w', encoding='utf-8').write(compactar(entrada))
            html = trocar_scripts(html, '<script src="js/entrada.js?v=%s"></script>' % v)
        elif f in PUBLICAS:
            nome = 'js/' + f[:-5] + '.min.js'
            open(os.path.join(out, nome), 'w', encoding='utf-8').write(juntar(src, html))
            html = trocar_scripts(html, '<script src="%s?v=%s"></script>' % (nome, v))
        open(os.path.join(out, f), 'w', encoding='utf-8').write(versao(html))
    for raiz, _, arqs in os.walk(out):      # confere: nada sensível em texto aberto
        for f in arqs:
            if f.endswith(('.js', '.html')):
                t = open(os.path.join(raiz, f), encoding='utf-8').read()
                for proibido in ('custoFixoMes:6e3', 'margem:.18', 'Abra pela conta'):
                    assert proibido not in t, 'texto sensível em ' + f
    guardar(src, os.path.join(AQUI, 'fontes.enc'))
    print('montado em', out, 'versão', v)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'montar': montar(sys.argv[2], sys.argv[3])
    elif cmd == 'restaurar': restaurar(sys.argv[2], sys.argv[3])
    elif cmd == 'guardar': guardar(sys.argv[2], sys.argv[3])
    else: sys.exit(__doc__)
