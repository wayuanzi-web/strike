"""用 MakeHuman 的人體資料（基礎網格＋變形目標，CC0）用程式捏出幾張臉，輸出成遊戲用的頭部資料 src/parts/58-heads.js。
做法：讀 base.obj → 疊上「人種／性別／年齡／肌肉體重」的總體目標與幾個臉部細節目標 → 只留頭和脖子（看骨架權重）→
每個頂點烘環境光遮蔽（鼻孔、嘴縫、眼窩、耳朵自然變暗）→ 眼球另外上色（眼白、虹膜、瞳孔）→ 轉到遊戲的座標（面向 -z、公尺）→ 量化後存成 base64。
用法：python3 tools/mh_heads.py /path/to/makehuman/makehuman/data
MakeHuman 資料授權：CC0（https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md）"""
import sys, json, base64, os, math
import numpy as np

DATA = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/mh/makehuman/makehuman/data'
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'parts', '58-heads.js')

def load_obj(p):
    V, F, G, g = [], [], [], ''
    for ln in open(p):
        if ln.startswith('v '): V.append([float(x) for x in ln.split()[1:4]])
        elif ln.startswith('g '): g = ln.split()[1]
        elif ln.startswith('f '):
            idx = [int(t.split('/')[0]) - 1 for t in ln.split()[1:]]
            F.append(idx); G.append(g)
    return np.array(V), F, G

def load_target(name):
    p = os.path.join(DATA, 'targets', name + '.target'); idx, d = [], []
    for ln in open(p):
        if ln.startswith('#') or not ln.strip(): continue
        a = ln.split(); idx.append(int(a[0])); d.append([float(a[1]), float(a[2]), float(a[3])])
    return np.array(idx, dtype=int), np.array(d, dtype=float).reshape(-1, 3)

V0, F, G = load_obj(os.path.join(DATA, '3dobjs', 'base.obj'))
W = json.load(open(os.path.join(DATA, 'rigs', 'default_weights.mhw')))['weights']
BODY_BONES = ('root', 'spine', 'pelvis', 'clavicle', 'shoulder', 'upperarm', 'lowerarm', 'wrist', 'finger', 'metacarpal', 'upperleg', 'lowerleg', 'foot', 'toe', 'breast')
headw = np.zeros(len(V0)); neckw = np.zeros(len(V0))
for bone, lst in W.items():
    if bone.startswith(BODY_BONES): continue
    for i, w in lst:
        headw[i] += w
        if bone.startswith('neck'): neckw[i] += w

# 四張臉：人種比例（非洲、亞洲、高加索）＋臉部細節目標（名稱 → 強度）；都是 25 歲上下的男性、肌肉偏多
VARIANTS = [
    dict(name='a', eth=(0.0, 0.0, 1.0), tone='#c9a184', iris='#5a7a8c', brow='#4a3626', det={'nose/nose-scale-horiz-decr': 0.3, 'chin/chin-width-incr': 0.4, 'cheek/l-cheek-bones-incr': 0.3, 'cheek/r-cheek-bones-incr': 0.3}),
    dict(name='b', eth=(1.0, 0.0, 0.0), tone='#7a5540', iris='#3a2414', brow='#17110d', det={'chin/chin-height-incr': 0.3, 'head/head-square': 0.3}),
    dict(name='c', eth=(0.0, 0.85, 0.15), tone='#c79b78', iris='#3c2616', brow='#1c1410', det={'head/head-round': 0.25, 'nose/nose-hump-decr': 0.3}),
    dict(name='d', eth=(0.3, 0.1, 0.6), tone='#a87a5c', iris='#4a3018', brow='#241a12', det={'chin/chin-prominent-incr': 0.4, 'nose/nose-scale-vert-incr': 0.3, 'head/head-rectangular': 0.3}),
]

def shape(var):
    V = V0.copy()
    def add(name, k):
        if k == 0: return
        try: idx, d = load_target(name)
        except FileNotFoundError: print('  （沒有這個目標，略過）', name); return
        V[idx] += d * k
    for eth, k in zip(('african', 'asian', 'caucasian'), var['eth']): add(f'macrodetails/{eth}-male-young', k)
    add('macrodetails/universal-male-young-maxmuscle-averageweight', 0.6)
    add('macrodetails/universal-male-young-averagemuscle-averageweight', 0.4)
    for name, k in var['det'].items(): add(name, k)
    return V

def tri_faces(faces):
    T = []
    for f in faces:
        if len(f) == 3: T.append(f)
        else: T.append([f[0], f[1], f[2]]); T.append([f[0], f[2], f[3]])
    return np.array(T)

body_faces = [f for f, g in zip(F, G) if g == 'body']
eyeL = sorted({i for f, g in zip(F, G) if g == 'helper-l-eye' for i in f}); eyeR = sorted({i for f, g in zip(F, G) if g == 'helper-r-eye' for i in f})
eye_faces = [f for f, g in zip(F, G) if g in ('helper-l-eye', 'helper-r-eye')]
teeth = sorted({i for f, g in zip(F, G) if g in ('helper-upper-teeth', 'helper-lower-teeth') for i in f})
head_faces = [f for f in body_faces if min(headw[i] for i in f) > 0.35]
TH = tri_faces(head_faces); TE = tri_faces(eye_faces)
used = np.unique(np.concatenate([TH.ravel(), TE.ravel()])); remap = -np.ones(len(V0), int); remap[used] = np.arange(len(used))
TRI = np.concatenate([remap[TH], remap[TE]]); is_eye_tri = np.concatenate([np.zeros(len(TH), bool), np.ones(len(TE), bool)])
print('頭部頂點', len(used), '三角形', len(TRI), '（眼球', len(TE), '）')

def normals(P, T):
    n = np.zeros_like(P); fn = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
    for k in range(3): np.add.at(n, T[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)

def bake_ao(P, N, T, rays=24, dist=0.045):
    """每個頂點往半球打幾條射線（Möller–Trumbore，numpy 向量化），被擋住越多越暗"""
    rng = np.random.default_rng(3); a, b, c = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]; e1, e2 = b - a, c - a
    occ = np.zeros(len(P))
    for r in range(rays):
        d = rng.normal(size=3); d /= np.linalg.norm(d)
        D = np.where((N @ d)[:, None] < 0, -d, d)                       # 每個頂點：朝自己法線那一側
        D = D * 0.75 + N * 0.25; D /= np.linalg.norm(D, axis=1, keepdims=True)
        O = P + N * 0.0012
        for s in range(0, len(P), 256):
            o, dd = O[s:s + 256, None, :], D[s:s + 256, None, :]
            h = np.cross(dd, e2[None]); det = (e1[None] * h).sum(-1); inv = 1 / np.where(np.abs(det) < 1e-12, 1e-12, det)
            t0 = o - a[None]; u = (t0 * h).sum(-1) * inv; q = np.cross(t0, e1[None]); v = (dd * q).sum(-1) * inv; t = (e2[None] * q).sum(-1) * inv
            hit = (np.abs(det) > 1e-12) & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 1e-4) & (t < dist)
            occ[s:s + 256] += hit.any(1)
    return 1 - occ / rays

def hexc(h): return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])

out = []
for var in VARIANTS:
    V = shape(var) * 0.1                      # 公寸 → 公尺
    P = V[used].copy()
    cl, cr = V[eyeL].mean(0), V[eyeR].mean(0); er = (V[eyeL].max(0) - V[eyeL].min(0)).max() / 2
    mouth = V[teeth].mean(0)
    # 對齊：兩眼中點放到遊戲裡頭骨的位置（x=0, y=1.682, z 讓臉的前緣在 -0.105 左右），轉成面向 -z
    mid = (cl + cr) / 2
    def xf(Q): Q = Q - mid; return np.stack([-Q[:, 0], Q[:, 1] + 1.682, -Q[:, 2] - 0.072], 1)
    P = xf(P); L = dict(eyeL=xf(cl[None])[0], eyeR=xf(cr[None])[0], mouth=xf(mouth[None])[0])
    T = TRI[:, [0, 2, 1]]                      # 鏡射 x、z 等於轉 180 度，繞向不變；這裡統一成逆時針朝外（下面檢查）
    N = normals(P, T)
    if (N[:, :] * (P - P.mean(0))).sum() < 0: T = TRI; N = normals(P, T)
    cache = f'/tmp/mh_ao_{var["name"]}.npy'
    if os.path.exists(cache) and len(np.load(cache)) == len(P): ao = np.load(cache)
    else: ao = bake_ao(P, N, T); np.save(cache, ao)
    eye_v = np.zeros(len(P), bool); eye_v[np.unique(T[is_eye_tri].ravel())] = True
    # 顏色：皮膚用白底（遊戲裡乘上每張臉的膚色）× 遮蔽；嘴唇偏紅、鼻頭臉頰微紅、頭皮（剃短的頭髮）偏暗
    C = np.ones((len(P), 3)) * (0.42 + 0.58 * ao ** 1.4)[:, None]
    front = N[:, 2] < -0.2
    m = L['mouth']; dx, dy = (P[:, 0] - m[0]) / 0.027, (P[:, 1] - (m[1] + 0.001)) / 0.0085
    lip = np.clip(1.15 - (dx * dx + dy * dy), 0, 1) * front * (P[:, 2] < m[2] - 0.012)
    C = C * (1 - lip[:, None] * 0.7) + lip[:, None] * 0.7 * np.array([0.9, 0.5, 0.5]) * C
    # 真人皮膚的顏色不均勻：臉頰、鼻頭、耳朵偏紅，眼睛下方略暗，下巴和上唇有鬍渣的青灰色，法令紋一道淡淡的陰影
    def blob(cx, cy, rx, ry): return np.clip(1 - ((np.abs(P[:, 0]) - cx) / rx) ** 2 - ((P[:, 1] - cy) / ry) ** 2, 0, 1) * front
    eyeY0 = L['eyeL'][1]
    red = np.clip(blob(0.045, eyeY0 - 0.045, 0.03, 0.025) * 0.5 + blob(0.0, eyeY0 - 0.05, 0.014, 0.014) * 0.6 + np.clip((np.abs(P[:, 0]) - 0.07) / 0.012, 0, 1) * np.clip(1 - np.abs(P[:, 1] - eyeY0 + 0.01) / 0.035, 0, 1) * 0.6, 0, 1)
    C = C * (1 - red[:, None] * 0.16 * np.array([0.0, 1.0, 0.9]))
    under = blob(0.031, eyeY0 - 0.016, 0.016, 0.008); C = C * (1 - under[:, None] * 0.13)
    fold = np.clip(1 - np.abs((np.abs(P[:, 0]) - 0.02) - (eyeY0 - 0.045 - P[:, 1]) * 0.45) / 0.0045, 0, 1) * np.clip((eyeY0 - 0.04 - P[:, 1]) / 0.008, 0, 1) * np.clip((P[:, 1] - (m[1] - 0.004)) / 0.008, 0, 1) * front
    C = C * (1 - fold[:, None] * 0.12)
    beard = np.clip((m[1] + 0.02 - P[:, 1]) / 0.012, 0, 1) * np.clip((P[:, 1] - 1.545) / 0.01, 0, 1) * np.clip((-P[:, 2] - 0.0) / 0.03, 0, 1) * (1 - lip) * (1 - np.clip((np.abs(P[:, 0]) - 0.03) / 0.01, 0, 1) * np.clip((P[:, 1] - m[1] - 0.004) / 0.006, 0, 1))
    C = C * (1 - beard[:, None] * 0.2 * np.array([1.0, 0.92, 0.85]))
    eyeY = L['eyeL'][1]
    scalp = np.clip((P[:, 1] - (eyeY + 0.062)) / 0.02, 0, 1) * np.clip((P[:, 2] + 0.07) / 0.03 + (P[:, 1] - eyeY - 0.075) / 0.02, 0, 1)
    side = np.clip((np.abs(P[:, 0]) - 0.058) / 0.01, 0, 1) * np.clip((P[:, 1] - eyeY - 0.012) / 0.01, 0, 1) * np.clip((P[:, 2] + 0.035) / 0.02, 0, 1)
    hair = np.clip(scalp + side, 0, 1) * 0.62
    C = C * (1 - hair[:, None]) + hair[:, None] * hexc(var['brow']) / np.maximum(hexc(var['tone']), 0.05) * 0.9
    # 眼球：眼白、虹膜（朝前 -z 的那一小圈）、瞳孔；整顆稍微暗一點（眼窩的陰影）
    kind = np.full(len(P), 3.0)                # 3＝皮膚（不投影舊的臉部細節圖）；0＝一般（眼球）
    for c in (L['eyeL'], L['eyeR']):
        d = P - c; r = np.linalg.norm(d, axis=1); sel = eye_v & (r < er * 1.6)
        ang = np.arccos(np.clip(-d[:, 2] / (r + 1e-9), -1, 1))
        col = np.where((ang < 0.2)[:, None], np.array([0.02, 0.02, 0.02]), np.where((ang < 0.52)[:, None], hexc(var['iris']) * 0.8, np.array([0.8, 0.78, 0.75])))
        col = col * np.clip(0.55 + 0.45 * ao, 0, 1)[:, None]
        C[sel] = col[sel]; kind[sel] = 0
    # 脖子的權重：下巴以下越低越跟脖子骨頭
    wn = np.clip((1.585 - P[:, 1]) / 0.05, 0, 1) * (P[:, 2] > -0.07)
    wn = np.maximum(wn, np.clip((1.56 - P[:, 1]) / 0.03, 0, 1))
    print(var['name'], '範圍', P.min(0).round(3), P.max(0).round(3), '眼', L['eyeL'].round(3), '嘴', L['mouth'].round(3), 'AO', ao.min().round(2), ao.mean().round(2))
    # 看不到的三角形不輸出：嘴裡面（遮蔽幾乎全黑）、頭盔和帽子蓋住的頭頂
    eyeT = np.isin(T, np.where(eye_v)[0]).all(1)
    hidden = ((ao[T] < 0.1).all(1) & ~eyeT) | (P[T][:, :, 1] > 1.752).all(1)
    eye_back = eyeT & (P[T][:, :, 2] > L['eyeL'][2] + 0.002).all(1)        # 眼球的後半顆
    Tk = T[~(hidden | eye_back)]
    print('   三角形', len(T), '→', len(Tk))
    q = lambda A, lo, hi, t: base64.b64encode(np.clip(np.round((A - lo) / (hi - lo) * (65535 if t == np.uint16 else 255)), 0, 65535 if t == np.uint16 else 255).astype(t).tobytes()).decode()
    out.append(dict(name=var['name'], tone=var['tone'], brow=var['brow'], n=len(P),
        eye=[round(float(abs(L['eyeL'][0])), 4), round(float(L['eyeL'][1]), 4)], mouth=[round(float(L['mouth'][1]), 4), round(float(L['mouth'][2]), 4)],
        p=q(P, -0.16, 0.16, np.uint16) if False else q(P - np.array([0, 1.65, 0]), -0.2, 0.2, np.uint16), nrm=q(N, -1, 1, np.uint8), c=q(C, 0, 1, np.uint8), k=q(kind, 0, 255, np.uint8), wn=q(wn, 0, 1, np.uint8),
        tri=base64.b64encode(Tk.astype(np.uint16).tobytes()).decode()))

js = ('/* ===== 58-heads：寫實的頭（tools/mh_heads.py 用 MakeHuman 的 CC0 人體資料產生，不要手改）\n'
      '   每張臉：位置（uint16，相對 (0,1.65,0)、±0.2 公尺）、法線、頂點顏色（含烘好的遮蔽、嘴唇、短髮、眼球）、種類、脖子權重、三角形索引 */\n'
      'const MH_HEADS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
open(OUT, 'w').write(js); print('寫出', OUT, round(len(js) / 1024), 'KB')
