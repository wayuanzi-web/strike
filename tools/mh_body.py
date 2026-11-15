"""用 MakeHuman 的人體資料（CC0）做身體和手：讀基礎網格 → 疊男性青年、肌肉偏多的總體目標 → 用 MakeHuman 自己的骨架把姿勢擺成遊戲的綁定姿勢
（手臂垂下、腿伸直、手指彎起來握東西）→ 骨架權重併到遊戲的 16 根骨頭 → 輸出 src/parts/57-body.js。頭和脖子由 mh_heads.py 處理，這裡只留身體。
用法：python3 tools/mh_body.py /path/to/makehuman/makehuman/data"""
import sys, json, base64, os, math
import numpy as np
DATA = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/mh/makehuman/makehuman/data'
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'parts', '57-body.js')
TWIST = float(os.environ.get('TWIST', '-90'))       # 前臂到手腕繞手臂軸轉幾度（讓手掌朝遊戲裡握槍的方向）
CURL = [float(x) for x in os.environ.get('CURL', '55,75,45').split(',')]   # 四指三節各彎幾度
THUMB = [float(x) for x in os.environ.get('THUMB', '20,20,30').split(',')]
CSIGN = float(os.environ.get('CSIGN', '1'))

def load_obj(p):
    V, F, G, g = [], [], [], ''
    for ln in open(p):
        if ln.startswith('v '): V.append([float(x) for x in ln.split()[1:4]])
        elif ln.startswith('g '): g = ln.split()[1]
        elif ln.startswith('f '): F.append([int(t.split('/')[0]) - 1 for t in ln.split()[1:]]); G.append(g)
    return np.array(V), F, G
def load_target(name):
    idx, d = [], []
    for ln in open(os.path.join(DATA, 'targets', name + '.target')):
        if ln.startswith('#') or not ln.strip(): continue
        a = ln.split(); idx.append(int(a[0])); d.append([float(a[1]), float(a[2]), float(a[3])])
    return np.array(idx, dtype=int), np.array(d, dtype=float).reshape(-1, 3)
V, F, G = load_obj(os.path.join(DATA, '3dobjs', 'base.obj'))
for name, k in (('macrodetails/caucasian-male-young', 1.0), ('macrodetails/universal-male-young-maxmuscle-averageweight', 0.6), ('macrodetails/universal-male-young-averagemuscle-averageweight', 0.4)):
    i, d = load_target(name); V[i] += d * k
SK = json.load(open(os.path.join(DATA, 'rigs', 'default.mhskel'))); W = json.load(open(os.path.join(DATA, 'rigs', 'default_weights.mhw')))['weights']
J = {k: V[v].mean(0) for k, v in SK['joints'].items()}; BN = SK['bones']
names = list(BN.keys()); order = []
def visit(b):
    if b in order: return
    if BN[b].get('parent'): visit(BN[b]['parent'])
    order.append(b)
for b in names: visit(b)
head = {b: J[BN[b]['head']] for b in names}; tail = {b: J[BN[b]['tail']] for b in names}

def rot_to(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b); v = np.cross(a, b); c = float(a @ b); s = np.linalg.norm(v)
    if s < 1e-9: return np.eye(3)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]]); return np.eye(3) + K + K @ K * ((1 - c) / (s * s))
def rot_axis(ax, deg):
    ax = ax / np.linalg.norm(ax); t = math.radians(deg); K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
    return np.eye(3) + math.sin(t) * K + (1 - math.cos(t)) * (K @ K)
# 正向運動學：每根骨頭的全域變換 p → A p + t；姿勢用「擺好父骨頭之後，再繞自己的頭轉」來給
GA, GT = {}, {}
def apply(b, p): return p @ GA[b].T + GT[b]
DOWN = np.array([0.0, -1.0, 0.0])
for b in order:
    par = BN[b].get('parent'); A, t = (GA[par], GT[par]) if par else (np.eye(3), np.zeros(3))
    h = head[b] @ A.T + t; tl = tail[b] @ A.T + t; d = tl - h; R = np.eye(3); side = 1.0 if b.endswith('.L') else -1.0
    base = b[:-2] if b[-2:] in ('.L', '.R') else b
    AIM = {'upperarm01': 'lowerarm01', 'lowerarm01': 'wrist', 'upperleg01': 'lowerleg01', 'lowerleg01': 'foot'}
    if base in AIM: R = rot_to(head[AIM[base] + b[-2:]] @ A.T + t - h, DOWN)      # 對準「下一個關節」而不是骨頭自己的尾端（有些尾端不在肢體軸線上）
    elif base in ('lowerarm02', 'wrist') and TWIST: R = rot_axis(d, TWIST * 0.5 * side)
    elif base.startswith('finger'):
        f, seg = int(base[6]), int(base[8]) - 1; ang = (THUMB if f == 1 else CURL)[seg]
        if ang:
            # 彎曲軸：手掌的橫向（食指根 → 小指根），在擺好的姿勢下量
            sfx = b[-2:]; lat = (head['finger5-1' + sfx] - head['finger2-1' + sfx]) @ GA['wrist' + sfx].T
            if f == 1: lat = np.cross(d, np.cross(lat, d))
            R = rot_axis(lat, ang * CSIGN * side)
    GA[b] = R @ A; GT[b] = R @ (t - h) + h
# 線性混合蒙皮（用 MakeHuman 原本的權重）
Vp = np.zeros_like(V); wsum = np.zeros(len(V))
for b, lst in W.items():
    if b not in GA: continue
    i = np.array([x[0] for x in lst]); w = np.array([x[1] for x in lst]); Vp[i] += apply(b, V[i]) * w[:, None]; wsum[i] += w
nz = wsum > 1e-6; Vp[nz] /= wsum[nz, None]; Vp[~nz] = V[~nz]
# 併到遊戲的骨頭
HB = dict(root=0, hips=1, thighL=2, kneeL=3, thighR=4, kneeR=5, spine=6, chest=7, neck=8, head=9, shL=10, elL=11, haL=12, shR=13, elR=14, haR=15)
HB_POS = [[0, 0, 0], [0, 0.95, 0], [-0.1, 0.93, 0], [-0.1, 0.5, 0], [0.1, 0.93, 0], [0.1, 0.5, 0], [0, 1.08, 0], [0, 1.3, 0], [0, 1.5, 0], [0, 1.6, 0], [-0.2, 1.44, 0], [-0.2, 1.13, 0], [-0.2, 0.86, 0], [0.2, 1.44, 0], [0.2, 1.13, 0], [0.2, 0.86, 0]]
def gbone(b):
    s = 'L' if b.endswith('.L') else 'R'; n = b[:-2] if b[-2:] in ('.L', '.R') else b
    if n.startswith(('upperleg',)): return HB['thigh' + s]
    if n.startswith(('lowerleg', 'foot', 'toe')): return HB['knee' + s]
    if n.startswith('upperarm'): return HB['sh' + s]
    if n.startswith('lowerarm'): return HB['el' + s]
    if n.startswith(('wrist', 'finger', 'metacarpal')): return HB['ha' + s]
    if n in ('root', 'pelvis', 'spine05'): return HB['hips']
    if n in ('spine04', 'spine03'): return HB['spine']
    if n in ('spine02', 'spine01', 'clavicle', 'shoulder01', 'breast'): return HB['chest']
    if n.startswith('neck'): return HB['neck']
    return HB['head']
GW = np.zeros((len(V), 16)); headw = np.zeros(len(V)); footw = np.zeros(len(V))
BODY_BONES = ('root', 'spine', 'pelvis', 'clavicle', 'shoulder', 'upperarm', 'lowerarm', 'wrist', 'finger', 'metacarpal', 'upperleg', 'lowerleg', 'foot', 'toe', 'breast')
for b, lst in W.items():
    i = np.array([x[0] for x in lst]); w = np.array([x[1] for x in lst]); GW[i, gbone(b)] += w
    if not b.startswith(BODY_BONES): headw[i] += w
    if b.startswith(('foot', 'toe')): footw[i] += w
GW /= np.maximum(GW.sum(1, keepdims=True), 1e-9)
# 轉到遊戲座標（跟 mh_heads.py 一樣：兩眼中點放到 (0,1.682,-0.072)、面向 -z、公寸 → 公尺）
eyeL = sorted({i for f, g in zip(F, G) if g == 'helper-l-eye' for i in f}); eyeR = sorted({i for f, g in zip(F, G) if g == 'helper-r-eye' for i in f})
mid = (V[eyeL].mean(0) + V[eyeR].mean(0)) / 2 * 0.1
def xf(Q): Q = Q * 0.1 - mid; return np.stack([-Q[:, 0], Q[:, 1] + 1.682, -Q[:, 2] - 0.072], 1)
P = xf(Vp)
pj = lambda b: xf((head[b] @ GA[BN[b]['parent']].T + GT[BN[b]['parent']])[None])[0] if BN[b].get('parent') else xf(head[b][None])[0]
JMAP = {HB['thighL']: 'upperleg01.L', HB['kneeL']: 'lowerleg01.L', HB['thighR']: 'upperleg01.R', HB['kneeR']: 'lowerleg01.R', HB['shL']: 'upperarm01.L', HB['elL']: 'lowerarm01.L', HB['haL']: 'wrist.L', HB['shR']: 'upperarm01.R', HB['elR']: 'lowerarm01.R', HB['haR']: 'wrist.R'}
# 每根遊戲骨頭一個變換：把擺好的關節搬到遊戲骨架的關節上；上臂、前臂、大腿沿長度縮放（兩邊骨架的肢段長度不同），軀幹整體往前 3 公分
CHILD = {HB['thighL']: HB['kneeL'], HB['thighR']: HB['kneeR'], HB['shL']: HB['elL'], HB['shR']: HB['elR'], HB['elL']: HB['haL'], HB['elR']: HB['haR']}
MH0 = np.zeros((16, 3)); G0 = np.zeros((16, 3)); SC = np.ones(16)
for gb, b in JMAP.items(): MH0[gb] = pj(b); G0[gb] = HB_POS[gb]
for gb, ch in CHILD.items(): SC[gb] = (HB_POS[gb][1] - HB_POS[ch][1]) / (MH0[gb][1] - MH0[ch][1]); print('  肢段', gb, '長度比', SC[gb].round(3))
for gb in (HB['hips'], HB['spine'], HB['chest'], HB['root']): G0[gb] = np.array([0, 0, -0.03])
for b in ('root', 'spine05', 'spine03', 'spine02', 'neck01', 'foot.L'): print('  （參考）', b, pj(b).round(3))
Pn = np.zeros_like(P)
for gb in range(16):
    Q = P - MH0[gb]; Q[:, 1] *= SC[gb]; Pn += (Q + G0[gb]) * GW[:, gb:gb + 1]
P = Pn
# 只留身體：不是頭（跟 mh_heads.py 同一個判斷）、不是腳掌（靴子蓋住）
body_faces = [f for f, g in zip(F, G) if g == 'body' and not min(headw[i] for i in f) > 0.35 and not min(footw[i] for i in f) > 0.6]
T = []
for f in body_faces:
    T.append([f[0], f[1], f[2]])
    if len(f) == 4: T.append([f[0], f[2], f[3]])
T = np.array(T); used = np.unique(T.ravel()); remap = -np.ones(len(V), int); remap[used] = np.arange(len(used)); T = remap[T][:, [0, 2, 1]]
P = P[used]; GWu = GW[used]
def normals(P, T):
    n = np.zeros_like(P); fn = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
    for k in range(3): np.add.at(n, T[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)
N = normals(P, T)
if (N * (P - P.mean(0))).sum() < 0: T = T[:, [0, 2, 1]]; N = normals(P, T)
hand = GWu[:, HB['haL']] + GWu[:, HB['haR']]; leg = GWu[:, [HB['thighL'], HB['kneeL'], HB['thighR'], HB['kneeR']]].sum(1) + GWu[:, HB['hips']] * 0.6
neckw = GWu[:, HB['neck']] + GWu[:, HB['head']]
puff = (0.005 + 0.011 * leg) * (1 - np.clip(hand * 1.5, 0, 1)) * (1 - np.clip(neckw * 2, 0, 1)) + 0.0015 * np.clip(hand * 1.5, 0, 1)     # 衣服比皮膚厚一點；褲子比較寬鬆；手是手套
P = P + N * puff[:, None]
# 小腿下段收細，塞進靴筒裡（靴筒半徑約 5 公分；不收的話小腿會穿出靴子）
kneew = GWu[:, [HB['kneeL'], HB['kneeR']]].sum(1); k = np.clip((0.31 - P[:, 1]) / 0.05, 0, 1) * (kneew > 0.5); ax = np.where(P[:, 0] < 0, -0.1, 0.1)
P[:, 0] = ax + (P[:, 0] - ax) * (1 - 0.5 * k); P[:, 2] = 0.02 + (P[:, 2] - 0.02) * (1 - 0.5 * k)
N = normals(P, T)
o = np.argsort(-GWu, 1)[:, :2]; w0 = np.take_along_axis(GWu, o, 1); w0 = w0 / w0.sum(1, keepdims=True)
print('頂點', len(P), '三角形', len(T), '範圍', P.min(0).round(3), P.max(0).round(3))
b64 = lambda a: base64.b64encode(a.tobytes()).decode()
q16 = lambda A, lo, hi: np.clip(np.round((A - lo) / (hi - lo) * 65535), 0, 65535).astype(np.uint16)
out = dict(n=len(P), p=b64(q16(P, -1.2, 2.2)), nrm=b64(np.clip(np.round((N + 1) * 127.5), 0, 255).astype(np.uint8)), bi=b64(o.astype(np.uint8)), bw=b64(np.round(w0[:, 0] * 255).astype(np.uint8)),
           hand=b64(np.round(np.clip(hand * 1.5, 0, 1) * 255).astype(np.uint8)), tri=b64(T.astype(np.uint16)))
js = '/* ===== 57-body：身體和手（tools/mh_body.py 用 MakeHuman 的 CC0 人體資料產生，不要手改）\n   位置（uint16，-1.2–2.2 公尺）、法線、兩根骨頭的索引與第一根的權重、是不是手、三角形索引 */\nconst MH_BODY = ' + json.dumps(out, separators=(',', ':')) + ';\n'
open(OUT, 'w').write(js); print('寫出', OUT, round(len(js) / 1024), 'KB')
