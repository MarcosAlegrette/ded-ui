#!/usr/bin/env python3
"""Extrae los datos de juego (departamentos, museos, objetos robados, ladrones, testigos,
declaraciones, pistas, ríos, lagunas, cerros, hechos históricos, localidades, escritores...)
de game/data/datastore.py recuperado, y los guarda como JSON en src/data/datastore.json.

El código original NUNCA se ejecuta: se parsea con `ast` y se interpretan sólo las
construcciones simples que usan los métodos set_up_* (asignaciones, listas, llamadas a
constructores de datamodel, list.append, índices y return). Cada objeto se guarda como
{"cls": <clase de datamodel>, "args": [...]} y las referencias a objetos de otras listas
como {"$ref": [<lista>, <índice>]}.

Uso: python3.11 -I scripts/extract_datastore.py <datastore.py> <datamodel.py> <salida.json>
"""
import ast, json, re, sys

SRC, MODEL, OUT = sys.argv[1:4]


def py2_to_py3(src):
    # Sólo para poder parsear: el código no se ejecuta.
    src = re.sub(r"^(\s*)print\b(.*)$", r"\1pass", src, flags=re.M)
    src = re.sub(r"^(\s*)raise (\w+), (.*)$", r"\1raise \2(\3)", src, flags=re.M)
    src = re.sub(r"except (\w+), (\w+):", r"except \1 as \2:", src)
    src = re.sub(r"^return\s*$", "", src, flags=re.M)
    src = src.replace('file.close\n', 'file.close()\n')
    return src


tree = ast.parse(py2_to_py3(open(SRC, encoding='latin-1').read()))

# Parámetros de los constructores de datamodel (para documentar los args)
mtree = ast.parse(py2_to_py3(open(MODEL, encoding='latin-1').read()))
params = {}
for node in mtree.body:
    if isinstance(node, ast.ClassDef):
        for f in node.body:
            if isinstance(f, ast.FunctionDef) and f.name == '__init__':
                params[node.name] = [a.arg for a in f.args.args[1:]]

consts = {}
cls_node = None
for node in tree.body:
    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        try:
            consts[node.targets[0].id] = ast.literal_eval(node.value)
        except Exception:
            pass
    if isinstance(node, ast.ClassDef) and node.name == 'Datastore':
        cls_node = node


def dec(v):
    if isinstance(v, bytes):
        return v.decode('latin-1')
    if isinstance(v, dict):
        return {dec(k): dec(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [dec(x) for x in v]
    return v


consts = {k: dec(v) for k, v in consts.items()}
methods = {f.name: f for f in cls_node.body if isinstance(f, ast.FunctionDef)}
lists = {}       # nombre de lista -> [objetos]
obj_ids = {}     # id(obj) -> (lista, índice)


class Obj:
    def __init__(self, cls, args):
        self.cls, self.args = cls, args


def ev(e, env):
    if isinstance(e, ast.Constant):
        return dec(e.value)
    if isinstance(e, ast.Name):
        if e.id in env:
            return env[e.id]
        if e.id in consts:
            return consts[e.id]
        if e.id in ('True', 'False', 'None'):
            return {'True': True, 'False': False, 'None': None}[e.id]
        raise KeyError(e.id)
    if isinstance(e, (ast.List, ast.Tuple)):
        return [ev(x, env) for x in e.elts]
    if isinstance(e, ast.UnaryOp) and isinstance(e.op, ast.USub):
        return -ev(e.operand, env)
    if isinstance(e, ast.BinOp) and isinstance(e.op, ast.Add):
        return ev(e.left, env) + ev(e.right, env)
    if isinstance(e, ast.Attribute) and isinstance(e.value, ast.Name) and e.value.id == 'self':
        return lists[e.attr]
    if isinstance(e, ast.Subscript):
        return ev(e.value, env)[ev(e.slice, env)]
    if isinstance(e, ast.Call):
        f = e.func
        if isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name) and f.value.id == 'datamodel':
            args = [ev(a, env) for a in e.args]
            kw = {k.arg: ev(k.value, env) for k in e.keywords}
            if kw:
                names = params[f.attr]
                for k, v in kw.items():
                    i = names.index(k)
                    while len(args) <= i:
                        args.append(None)
                    args[i] = v
            return Obj(f.attr, args)
        if isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name) and f.value.id == 'self' and f.attr == 'get_clue_type':
            t = ev(e.args[0], env)
            for o in lists['list_clue_types']:
                if o.args[0] == t:
                    return o
            raise KeyError(t)
    raise ValueError('expresión no soportada: ' + ast.dump(e)[:200])


def run(name):
    env = {}
    for st in methods[name].body:
        if isinstance(st, ast.Assign):
            v = ev(st.value, env)
            for t in st.targets:
                if isinstance(t, ast.Name):
                    env[t.id] = v
                else:
                    raise ValueError('asignación no soportada en ' + name)
        elif isinstance(st, ast.Expr) and isinstance(st.value, ast.Call) and isinstance(st.value.func, ast.Attribute) and st.value.func.attr == 'append':
            env[st.value.func.value.id].append(ev(st.value.args[0], env))
        elif isinstance(st, ast.Return):
            return ev(st.value, env) if st.value is not None else None
        elif isinstance(st, ast.Pass):
            pass
        else:
            raise ValueError('sentencia no soportada en %s: %s' % (name, ast.dump(st)[:200]))


# Orden y nombres tal cual Datastore.set_up_data
order = []
for st in methods['set_up_data'].body:
    if isinstance(st, ast.Assign) and isinstance(st.value, ast.Call) and isinstance(st.value.func, ast.Attribute):
        fn = st.value.func.attr
        t = st.targets[0]
        if fn.startswith('set_up_') and isinstance(t, ast.Attribute):
            order.append((t.attr, fn))
for attr, fn in order:
    lists[attr] = run(fn)
    if isinstance(lists[attr], list):
        for i, o in enumerate(lists[attr]):
            if isinstance(o, Obj):
                obj_ids[id(o)] = (attr, i)


def ser(v, top=False):
    if isinstance(v, Obj):
        if not top and id(v) in obj_ids:
            return {'$ref': list(obj_ids[id(v)])}
        return {'cls': v.cls, 'args': [ser(a) for a in v.args]}
    if isinstance(v, list):
        return [ser(x) for x in v]
    return v



def matrix_from_dis(method):
    # uncompyle6 escribe mal las listas grandes de constantes (pone índices de co_consts en lugar
    # de los valores), así que las matrices se leen del desensamblado.
    dis = SRC.replace('/py/', '/dis/')[:-3] + '.dis'
    rows, cur, inside = [], [], False
    for line in open(dis, encoding='latin-1'):
        if line.startswith('# Method Name:'):
            inside = line.split()[-1] == method
            continue
        if not inside:
            continue
        m = re.search(r'LOAD_CONST\s+\((-?\d+)\)', line)
        if m:
            cur.append(int(m.group(1)))
            continue
        m = re.search(r'BUILD_LIST\s+(\d+)', line)
        if m and int(m.group(1)) > 0:
            rows.append(cur[-int(m.group(1)):])
        cur = []
    return rows


out = {
    'constants': {k: v for k, v in consts.items() if isinstance(v, (int, str, dict)) and not k.startswith('SCORE_')},
    'order': [a for a, _ in order],
    'lists': {a: [ser(o, True) for o in lists[a]] for a, _ in order},
    'params': params,
    'bordering_matrix': matrix_from_dis('generate_departments_bordering_matrix'),
    'proximity_matrix': matrix_from_dis('generate_departments_proximity_matrix'),
}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('datastore: ' + ', '.join('%s=%d' % (a, len(lists[a])) for a, _ in order))
