# Gera fontes/marluvas.tar.gz.enc (AES-GCM, chave PBKDF2-SHA256 da senha da equipe) e restaura.
# Backup:   python3 backup_fontes.py backup  <pasta_fontes> <saida.enc>
# Restaurar: python3 backup_fontes.py restaurar <arquivo.enc> <pasta_destino>   (pede a senha)
import sys, os, io, tarfile, getpass
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
def key(pw, salt): return PBKDF2HMAC(hashes.SHA256(), 32, salt, 300000).derive(pw.encode())
if sys.argv[1] == 'backup':
    src, out = sys.argv[2], sys.argv[3]
    pw = open(os.path.join(src, 'pw.txt')).read().strip()
    skip = {'pwa', 'pwa_teste', 'conversor-ca-app.zip', 'chk.js', 't.js', 't2.js'}
    bio = io.BytesIO()
    with tarfile.open(fileobj=bio, mode='w:gz') as tf:
        for root, dirs, files in os.walk(src):
            dirs[:] = [d for d in dirs if d not in skip]
            for f in files:
                if f in skip or f.endswith('.enc'): continue
                p = os.path.join(root, f); tf.add(p, arcname=os.path.relpath(p, src))
    salt, iv = os.urandom(16), os.urandom(12)
    open(out, 'wb').write(b'CHAMAE1' + salt + iv + AESGCM(key(pw, salt)).encrypt(iv, bio.getvalue(), None))
    print('ok', out, os.path.getsize(out))
else:
    raw = open(sys.argv[2], 'rb').read(); assert raw[:7] == b'CHAMAE1'
    salt, iv, ct = raw[7:23], raw[23:35], raw[35:]
    data = AESGCM(key(getpass.getpass('Senha da equipe: '), salt)).decrypt(iv, ct, None)
    tarfile.open(fileobj=io.BytesIO(data)).extractall(sys.argv[3]); print('restaurado em', sys.argv[3])
