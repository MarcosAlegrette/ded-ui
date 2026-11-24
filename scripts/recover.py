#!/usr/bin/env python3
"""Recupera el código original de DED desde ../data/juego_ded/main.exe.

El juego (Python 2.5 + pygame, empaquetado con py2exe) trae un zip pegado al final de
main.exe. Los módulos del juego están en framework/*.me y game/**/*.me: son bytecode
marshal de Python 2.5 ofuscado con un XOR encadenado (c[i] = p[i] ^ p[i-1], con 0x0d
como valor inicial). Este script:
  1. extrae los .me (y des.pyo / version.pyo)            -> _original_src/zip
  2. deshace la ofuscación y antepone el magic de py2.5   -> _original_src/pyc
  3. decompila con uncompyle6 y desensambla con xdis      -> _original_src/py, _original_src/dis
  4. genera una copia con los literales latin-1 en UTF-8  -> _original_src/py_utf8
  5. descomprime los datos DAT! (zlib) de data/*.tc?      -> _original_src/data_decoded

Sólo se PARSEA el código original, nunca se ejecuta. Uso: python3.11 -I scripts/recover.py
"""
import ast, os, re, subprocess, sys, venv, zipfile, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, '..', 'data', 'juego_ded')
OUT = os.path.join(ROOT, '_original_src')
MAGIC = bytes.fromhex('b3f20d0a') + b'\x00' * 4


def extract():
    z = zipfile.ZipFile(os.path.join(GAME, 'main.exe'))
    for n in z.namelist():
        if n.endswith('.me') or n in ('des.pyo', 'version.pyo'):
            dst = os.path.join(OUT, 'zip', n)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            open(dst, 'wb').write(z.read(n))


def decode():
    src = os.path.join(OUT, 'zip')
    for base, _, files in os.walk(src):
        for f in files:
            raw = open(os.path.join(base, f), 'rb').read()
            rel = os.path.relpath(os.path.join(base, f), src)
            if f.endswith('.me'):
                plain = bytearray(len(raw)); prev = 0x0d
                for i, b in enumerate(raw):
                    prev ^= b; plain[i] = prev
                data = MAGIC + bytes(plain)
            else:
                data = raw
            dst = os.path.join(OUT, 'pyc', os.path.splitext(rel)[0] + '.pyc')
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            open(dst, 'wb').write(data)


def tools():
    vdir = os.path.join(OUT, 'tools', 'venv')
    if not os.path.exists(os.path.join(vdir, 'bin', 'uncompyle6')):
        venv.create(vdir, with_pip=True)
        subprocess.check_call([os.path.join(vdir, 'bin', 'pip'), '-q', 'install', 'uncompyle6'])
    return os.path.join(vdir, 'bin')


def decompile(bin_dir):
    src = os.path.join(OUT, 'pyc')
    for base, _, files in os.walk(src):
        for f in files:
            pyc = os.path.join(base, f)
            rel = os.path.splitext(os.path.relpath(pyc, src))[0]
            for tool, sub, ext in (('uncompyle6', 'py', '.py'), ('pydisasm', 'dis', '.dis')):
                dst = os.path.join(OUT, sub, rel + ext)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                with open(dst, 'wb') as fh:
                    subprocess.call([os.path.join(bin_dir, tool), pyc], stdout=fh, stderr=subprocess.DEVNULL)


BYTES = re.compile(r"""b('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")""")


def utf8():
    src = os.path.join(OUT, 'py')
    for base, _, files in os.walk(src):
        for f in files:
            if not f.endswith('.py'):
                continue
            text = open(os.path.join(base, f), encoding='utf-8', errors='replace').read()
            text = BYTES.sub(lambda m: repr(ast.literal_eval('b' + m.group(1)).decode('latin-1')), text)
            dst = os.path.join(OUT, 'py_utf8', os.path.relpath(os.path.join(base, f), src))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            open(dst, 'w', encoding='utf-8').write(text)


def data():
    dst = os.path.join(OUT, 'data_decoded')
    os.makedirs(dst, exist_ok=True)
    for f in sorted(os.listdir(os.path.join(GAME, 'data'))):
        if f.endswith(('.tcs', '.tcl', '.tcd')):
            raw = open(os.path.join(GAME, 'data', f), 'rb').read()
            assert raw[:4] == b'DAT!', f
            open(os.path.join(dst, f + '.txt'), 'w', encoding='utf-8').write(zlib.decompress(raw[4:]).decode('latin-1'))


if __name__ == '__main__':
    extract(); decode(); decompile(tools()); utf8(); data()
    n = sum(len(fs) for _, _, fs in os.walk(os.path.join(OUT, 'py')))
    print('recuperados', n, 'modulos en', os.path.relpath(OUT, ROOT))
