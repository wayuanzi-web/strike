"""用 MakeHuman 的人體資料（基礎網格＋變形目標，CC0）用程式捏出幾張臉，輸出成遊戲用的頭部資料 src/parts/58-heads.js。
做法：讀 base.obj → 疊上「人種／性別／年齡／肌肉體重」的總體目標與幾個臉部細節目標 → 只留頭和脖子（看骨架權重）→
每個頂點烘環境光遮蔽（鼻孔、嘴縫、眼窩、耳朵自然變暗）→ 眼球另外上色（眼白、虹膜、瞳孔）→ 轉到遊戲的座標（面向 -z、公尺）→ 量化後存成 base64。
用法：python3 tools/mh_heads.py /path/to/makehuman/makehuman/data
MakeHuman 資料授權：CC0（https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md）"""
import sys, json, base64, os, math
import numpy as np

DATA = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/mh/makehuman/makehuman/data'
SKINS = sys.argv[2] if len(sys.argv) > 2 else '/home/claude/mhskin'   # MakeHuman 的皮膚貼圖（public domain；download.tuxfamily.org/makehuman/assets/1.2/base/skins/textures）
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'parts', '58-heads.js')

def load_obj(p):
    V, F, G, VT, FT, g = [], [], [], [], [], ''
    for ln in open(p):
        if ln.startswith('v '): V.append([float(x) for x in ln.split()[1:4]])
        elif ln.startswith('vt '): VT.append([float(x) for x in ln.split()[1:3]])
        elif ln.startswith('g '): g = ln.split()[1]
        elif ln.startswith('f '):
            idx = [int(t.split('/')[0]) - 1 for t in ln.split()[1:]]
            F.append(idx); G.append(g); FT.append([int(t.split('/')[1]) - 1 for t in ln.split()[1:]])
    return np.array(V), F, G, np.array(VT), FT

def load_target(name):
    p = os.path.join(DATA, 'targets', name + '.target'); idx, d = [], []
    for ln in open(p):
        if ln.startswith('#') or not ln.strip(): continue
        a = ln.split(); idx.append(int(a[0])); d.append([float(a[1]), float(a[2]), float(a[3])])
    return np.array(idx, dtype=int), np.array(d, dtype=float).reshape(-1, 3)

V0, F, G, VT, FT = load_obj(os.path.join(DATA, '3dobjs', 'base.obj'))
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
    dict(name='a', skin='pack/skins/jartur69_middleage_slavic_male_with_genitals_and_beard/Jartur_mid_old_Slavic_Male_with_Genitals_and_Beard_lsdif_lighter', hairk=0.0, tint=(1.06, 1.0, 0.95), eth=(0.0, 0.0, 1.0), tone='#c9a184', iris='#6c8ea4', brow='#3a2a1e', det={'nose/nose-scale-horiz-decr': 0.3, 'chin/chin-width-incr': 0.4, 'cheek/l-cheek-bones-incr': 0.3, 'cheek/r-cheek-bones-incr': 0.3}),
    dict(name='b', skin='pack/skins/mindfront_skin_male_african_middleage/skin_male_african_middleage', hairk=0.0, tint=(1, 1, 1), eth=(1.0, 0.0, 0.0), tone='#7a5540', iris='#4a2d17', brow='#17110d', det={'chin/chin-height-incr': 0.3, 'head/head-square': 0.3}),
    dict(name='c', skin='pack/skins/onlytheghosts_old_eurasian_male/old_eurasian_male_diffuse', hairk=0.0, sat=0.72, tint=(0.97, 0.97, 0.97), eth=(0.0, 0.85, 0.15), tone='#c79b78', iris='#553419', brow='#1c1410', det={'head/head-round': 0.25, 'nose/nose-hump-decr': 0.3}),
    dict(name='d', skin='pack/skins/toigo_light_skin_male_bronze/young_lightskinned_male_diffuse_Bronze', hairk=0.4, tint=(0.9, 0.86, 0.82), eth=(0.3, 0.1, 0.6), tone='#a87a5c', iris='#7b5a30', brow='#2a1c12', det={'chin/chin-prominent-incr': 0.4, 'nose/nose-scale-vert-incr': 0.3, 'head/head-rectangular': 0.3}),
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
    for sd in 'lr':   # 眼睛：真人放鬆時上眼瞼會蓋到一點虹膜、有雙眼皮褶與一點眼袋
        add(f'eyes/{sd}-eye-height2-decr', var.get('lid', 0.08)); add(f'eyes/{sd}-eye-eyefold-down', var.get('fold', 0.25)); add(f'eyes/{sd}-eye-bag-incr', 0.3)
    return V

def tri_faces(faces):
    T = []
    for f in faces:
        if len(f) == 3: T.append(f)
        else: T.append([f[0], f[1], f[2]]); T.append([f[0], f[2], f[3]])
    return np.array(T)

FTof = {id(f): ft for f, ft in zip(F, FT)}
body_faces = [f for f, g in zip(F, G) if g == 'body']
eyeL = sorted({i for f, g in zip(F, G) if g == 'helper-l-eye' for i in f}); eyeR = sorted({i for f, g in zip(F, G) if g == 'helper-r-eye' for i in f})
eye_faces = [f for f, g in zip(F, G) if g in ('helper-l-eye', 'helper-r-eye')]
teeth = sorted({i for f, g in zip(F, G) if g in ('helper-upper-teeth', 'helper-lower-teeth') for i in f})
head_faces = [f for f in body_faces if min(headw[i] for i in f) > 0.35]
TH = tri_faces(head_faces); TE = tri_faces(eye_faces)
used = np.unique(np.concatenate([TH.ravel(), TE.ravel()])); remap = -np.ones(len(V0), int); remap[used] = np.arange(len(used))
# 睫毛：MakeHuman 的睫毛片（兩面都畫），頂點接在最後面（遮蔽的快取照舊可用）
lash_all = [(f, g) for f, g in zip(F, G) if 'eyelashes' in g]
_eyc = {sd: V0[sorted({i for f, g in zip(F, G) if g == f'helper-{sd}-eye' for i in f})].mean(0) for sd in 'lr'}
for gname in sorted({g for f, g in lash_all}): print('  睫毛組', gname, '平均高度 − 眼球中心', round(float(np.mean([V0[i][1] for f, g in lash_all if g == gname for i in f]) - _eyc[gname[7]][1]), 3))
lash_faces = [f for f, g in lash_all if np.mean([V0[i][1] for i in f]) > _eyc[g[7]][1]]   # 只留上睫毛（下睫毛做成實心片太重）
TL = tri_faces(lash_faces); lash_used = np.unique(TL.ravel()); n_base = len(used)
remap[lash_used] = n_base + np.arange(len(lash_used)); used = np.concatenate([used, lash_used])
TRI = np.concatenate([remap[TH], remap[TE], remap[TL], remap[TL][:, ::-1]]); is_eye_tri = np.concatenate([np.zeros(len(TH), bool), np.ones(len(TE), bool), np.zeros(len(TL) * 2, bool)])
lash_v = np.zeros(len(used), bool); lash_v[n_base:] = True
# 貼圖座標：同一個頂點在 UV 接縫兩邊有不同座標 → 依（頂點、vt）拆開；輸出時用拆開後的頂點
THt = tri_faces([FTof[id(f)] for f in head_faces]); TEt = tri_faces([FTof[id(f)] for f in eye_faces])
TRIvt = np.concatenate([THt, TEt, np.zeros((len(TL) * 2, 3), int)])
KK = len(VT) + 1; pair, inv = np.unique(TRI.ravel() * KK + TRIvt.ravel(), return_inverse=True)
SV, SVT = pair // KK, pair % KK; TRI_S = inv.reshape(-1, 3)
print('拆開 UV 接縫後頂點', len(SV))
eye_v_base = np.zeros(len(used), bool); eye_v_base[np.unique(TRI[is_eye_tri].ravel())] = True
AW, AH, HH = 640, 1344, 1088          # 貼圖集：寬、高、頭佔的高度
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
    BL = np.zeros_like(V)                      # 眨眼：MakeHuman 的「閉眼」表情目標（依人種比例混合）
    for eth, k in zip(('african', 'asian', 'caucasian'), var['eth']):
        for sd in ('left', 'right'):
            bi, bd = load_target(f'expression/units/{eth}/eye-{sd}-closure')
            if len(bi): BL[bi] += bd * k * 0.1
    BL = np.stack([-BL[used][:, 0], BL[used][:, 1], -BL[used][:, 2]], 1); BL[eye_v_base] = 0
    P = xf(P); L = dict(eyeL=xf(cl[None])[0], eyeR=xf(cr[None])[0], mouth=xf(mouth[None])[0])
    T = TRI[:, [0, 2, 1]]                      # 鏡射 x、z 等於轉 180 度，繞向不變；這裡統一成逆時針朝外（下面檢查）
    N = normals(P, T)
    TS = TRI_S[:, [0, 2, 1]]
    if (N[:, :] * (P - P.mean(0))).sum() < 0: T = TRI; TS = TRI_S; N = normals(P, T)
    cache = f'/tmp/mh_ao_{var["name"]}.npy'
    if os.path.exists(cache) and len(np.load(cache)) == n_base: ao = np.load(cache)
    else: ao = bake_ao(P[:n_base], N[:n_base], T[(T < n_base).all(1)]); np.save(cache, ao)
    ao = np.concatenate([ao, np.ones(len(P) - n_base)])
    N[lash_v] = np.array([0, 0.5, -0.87])
    Ps = P[:n_base]                                   # 睫毛縮短：每個睫毛頂點往最近的皮膚頂點靠（根部不動、尖端縮回來）
    for i in np.where(lash_v)[0]:
        qn = Ps[np.argmin(((Ps - P[i]) ** 2).sum(1))]; P[i] = qn + (P[i] - qn) * 0.14
    eye_v = np.zeros(len(P), bool); eye_v[np.unique(T[is_eye_tri].ravel())] = True
    # 顏色：皮膚用白底（遊戲裡乘上每張臉的膚色）× 遮蔽；嘴唇偏紅、鼻頭臉頰微紅、頭皮（剃短的頭髮）偏暗
    C = np.ones((len(P), 3)) * (0.5 + 0.5 * ao ** 1.2)[:, None]; C0 = C.copy()
    front = N[:, 2] < -0.2
    m = L['mouth']; dx, dy = (P[:, 0] - m[0]) / 0.027, (P[:, 1] - (m[1] + 0.001)) / 0.0085
    lip = np.clip(1.15 - (dx * dx + dy * dy), 0, 1) * front * (P[:, 2] < m[2] - 0.012)
    # 真人皮膚的顏色不均勻：臉頰、鼻頭、耳朵偏紅，眼睛下方略暗，下巴和上唇有鬍渣的青灰色，法令紋一道淡淡的陰影
    def blob(cx, cy, rx, ry): return np.clip(1 - ((np.abs(P[:, 0]) - cx) / rx) ** 2 - ((P[:, 1] - cy) / ry) ** 2, 0, 1) * front
    eyeY0 = L['eyeL'][1]
    red = np.clip(blob(0.045, eyeY0 - 0.045, 0.03, 0.025) * 0.5 + blob(0.0, eyeY0 - 0.05, 0.014, 0.014) * 0.6 + np.clip((np.abs(P[:, 0]) - 0.07) / 0.012, 0, 1) * np.clip(1 - np.abs(P[:, 1] - eyeY0 + 0.01) / 0.035, 0, 1) * 0.6, 0, 1)
    C = C * (1 - red[:, None] * 0.16 * np.array([0.0, 1.0, 0.9]))
    under = blob(0.031, eyeY0 - 0.016, 0.016, 0.008); C = C * (1 - under[:, None] * 0.13)
    fold = np.clip(1 - np.abs((np.abs(P[:, 0]) - 0.02) - (eyeY0 - 0.045 - P[:, 1]) * 0.45) / 0.0045, 0, 1) * np.clip((eyeY0 - 0.04 - P[:, 1]) / 0.008, 0, 1) * np.clip((P[:, 1] - (m[1] - 0.004)) / 0.008, 0, 1) * front
    C = C * (1 - fold[:, None] * 0.12)
    beard = np.clip((m[1] + 0.02 - P[:, 1]) / 0.012, 0, 1) * np.clip((P[:, 1] - 1.545) / 0.01, 0, 1) * np.clip((-P[:, 2] - 0.0) / 0.03, 0, 1) * (1 - lip) * (1 - np.clip((np.abs(P[:, 0]) - 0.03) / 0.01, 0, 1) * np.clip((P[:, 1] - m[1] - 0.004) / 0.006, 0, 1))
    C = C0.copy()   # 貼圖裡已經有紅暈、眼下、法令紋、鬍渣
    eyeY = L['eyeL'][1]
    scalp = np.clip((P[:, 1] - (eyeY + 0.062)) / 0.02, 0, 1) * np.clip((P[:, 2] + 0.07) / 0.03 + (P[:, 1] - eyeY - 0.075) / 0.02, 0, 1)
    side = np.clip((np.abs(P[:, 0]) - 0.058) / 0.01, 0, 1) * np.clip((P[:, 1] - eyeY - 0.012) / 0.01, 0, 1) * np.clip((P[:, 2] + 0.035) / 0.02, 0, 1)
    hair = np.clip(scalp + side, 0, 1) * var['hairk']
    C = C * (1 - hair[:, None]) + hair[:, None] * hexc(var['brow']) / np.maximum(hexc(var['tone']), 0.05) * 0.9
    # 眼球：眼白、虹膜（朝前 -z 的那一小圈）、瞳孔；整顆稍微暗一點（眼窩的陰影）
    EUV = np.zeros((len(P), 2))
    kind = np.full(len(P), 3.0)                # 3＝皮膚；3.5＝頭髮（剃短）；4＝嘴唇；0＝一般（眼球、睫毛）
    kind[(np.clip(scalp + side, 0, 1) > 0.5) & (var['hairk'] > 0)] = 3.5; kind[lip > 0.45] = 4.0
    seam = np.clip(1 - np.abs(P[:, 1] - (m[1] + 0.001)) / 0.0022, 0, 1) * np.clip(1 - np.abs(P[:, 0]) / 0.03, 0, 1) * front; C = C * (1 - seam[:, None] * 0.2)   # 唇縫
    for c in (L['eyeL'], L['eyeR']):           # 眼瞼邊緣：上眼瞼一道深色（睫毛根部的陰影），下眼瞼淡一點
        dd = np.linalg.norm(P - c, axis=1); rimm = np.clip(1 - (dd - er * 1.0) / (er * 0.22), 0, 1) * (dd > er * 0.9) * front * ~eye_v * ~lash_v
        C = C * (1 - rimm[:, None] * np.where(P[:, 1] > c[1], 0.16, 0.0)[:, None])
    for c in (L['eyeL'], L['eyeR']):
        d = P - c; r = np.linalg.norm(d, axis=1); sel = eye_v & (r < er * 1.6)
        ang = np.arccos(np.clip(-d[:, 2] / (r + 1e-9), -1, 1))
        iris = hexc(var['iris'])
        col = np.where((ang < 0.2)[:, None], np.array([0.02, 0.02, 0.02]), np.where((ang < 0.3)[:, None], iris * 1.05, np.where((ang < 0.44)[:, None], iris * 0.78, np.where((ang < 0.54)[:, None], iris * 0.35, np.array([0.8, 0.77, 0.74])))))
        col = np.where(((ang >= 0.54) & (ang < 1.3))[:, None], col * (1 - 0.1 * np.clip((ang - 0.9) / 0.4, 0, 1))[:, None] * np.array([1.0, 0.94, 0.92]), col)   # 眼白往眼角偏粉
        col = col * np.clip(0.55 + 0.45 * ao, 0, 1)[:, None]
        C[sel] = np.clip(0.78 + 0.22 * ao, 0, 1)[sel, None]; kind[sel] = 5      # 5＝眼球（用眼睛貼圖）
        rr = ang * 54.5; hx = np.hypot(d[:, 0], d[:, 1]) + 1e-9          # 眼睛貼圖是「從正面攤平」的：離瞳孔的角度 → 離圖上瞳孔的距離
        EUV[sel, 0] = ((180.5 + d[:, 0] / hx * rr) / AW)[sel]; EUV[sel, 1] = ((HH + 75.9 - d[:, 1] / hx * rr) / AH)[sel]
    C[lash_v] = hexc(var['brow']) * 0.5; kind[lash_v] = 0
    # 脖子的權重：下巴以下越低越跟脖子骨頭
    wn = np.clip((1.585 - P[:, 1]) / 0.05, 0, 1) * (P[:, 2] > -0.07)
    wn = np.maximum(wn, np.clip((1.56 - P[:, 1]) / 0.03, 0, 1))
    print(var['name'], '範圍', P.min(0).round(3), P.max(0).round(3), '眼', L['eyeL'].round(3), '嘴', L['mouth'].round(3), 'AO', ao.min().round(2), ao.mean().round(2))
    # 看不到的三角形不輸出：嘴裡面（遮蔽幾乎全黑）、頭盔和帽子蓋住的頭頂
    eyeT = np.isin(T, np.where(eye_v)[0]).all(1)
    hidden = ((ao[T] < 0.1).all(1) & ~eyeT) | (P[T][:, :, 1] > 1.752).all(1)
    eye_back = eyeT & (P[T][:, :, 2] > L['eyeL'][2] + 0.002).all(1)        # 眼球的後半顆
    Tk = TS[~(hidden | eye_back)]
    print('   三角形', len(T), '→', len(Tk))
    q = lambda A, lo, hi, t: base64.b64encode(np.clip(np.round((A - lo) / (hi - lo) * (65535 if t == np.uint16 else 255)), 0, 65535 if t == np.uint16 else 255).astype(t).tobytes()).decode()
        # 貼圖集：上面 512×768 是頭（從 2048 的皮膚貼圖裁出頭的 UV 範圍），左下 256×256 是眼睛
    from PIL import Image, ImageEnhance
    import io
    hv = ~eye_v[SV] & ~lash_v[SV] & (VT[SVT][:, 0] > 0.62) & (VT[SVT][:, 1] > 0.12) & (VT[SVT][:, 1] < 0.85); uvh = VT[SVT[hv]]; print('   頭的 UV 島頂點', hv.sum(), '脖子（在身體的 UV 島）', (~hv & ~eye_v[SV] & ~lash_v[SV]).sum()); u0, u1 = uvh[:, 0].min() - 0.004, uvh[:, 0].max() + 0.004; v0, v1 = uvh[:, 1].min() - 0.004, uvh[:, 1].max() + 0.004
    sk = Image.open(os.path.join(SKINS, var['skin'] + '.png')).convert('RGB'); Wd, Hd = sk.size
    head = sk.crop((int(u0 * Wd), int((1 - v1) * Hd), int(u1 * Wd), int((1 - v0) * Hd))).resize((AW, HH), Image.LANCZOS)
    head = ImageEnhance.Color(head).enhance(var.get('sat', 1.0))
    head = Image.fromarray(np.clip(np.asarray(head).astype(float) * np.array(var['tint']), 0, 255).astype(np.uint8))
    eye = np.asarray(Image.open(os.path.join(DATA, 'eyes', 'materials', 'brown_eye.png')).convert('RGB').resize((256, 256), Image.LANCZOS)).astype(float) / 255
    yy, xx = np.mgrid[0:256, 0:256]; ic = hexc(var['iris']); eye = np.clip(eye * 1.14, 0, 1)
    for (ex, ey) in ((180.5, 75.9), (74.0, 181.4)):      # 虹膜換成這張臉的顏色：保留原圖的紋理明暗，只換色
        rr_ = np.hypot(xx - ex, yy - ey); msk = np.clip((27.5 - rr_) / 2.0, 0, 1)[:, :, None]; lum = eye.mean(2, keepdims=True); ml = lum[rr_ < 24].mean()
        eye = eye * (1 - msk) + msk * np.clip((lum / ml) ** 1.3 * ic * 0.72 * (1 - 0.45 * np.clip((rr_ - 21) / 6, 0, 1))[:, :, None], 0, 1)
    neckc = tuple(int(x) for x in np.asarray(head)[20:80, 20:130].reshape(-1, 3).mean(0))
    atlas = Image.new('RGB', (AW, AH), neckc); atlas.paste(head, (0, 0)); atlas.paste(Image.fromarray((eye * 255).astype(np.uint8)), (0, HH))
    # 毛孔、鬍渣、皺紋的凹凸：從照片的明暗細節推出法線貼圖（暗的地方當成凹下去）
    g = np.asarray(head.convert('L').resize((512, 896), Image.LANCZOS)).astype(float) / 255
    from PIL import ImageFilter
    blur = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))).astype(float) / 255
    hgt = g - blur; gx = np.zeros_like(hgt); gy = np.zeros_like(hgt); gx[:, 1:-1] = hgt[:, 2:] - hgt[:, :-2]; gy[1:-1] = hgt[2:] - hgt[:-2]
    nx, ny = np.clip(-gx * 3.2, -0.5, 0.5), np.clip(-gy * 3.2, -0.5, 0.5); nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0.05, 1))
    nim = Image.fromarray((np.stack([nx, ny, nz], 2) * 127.5 + 127.5).astype(np.uint8)); nb = io.BytesIO(); nim.save(nb, 'JPEG', quality=86); ntex = 'data:image/jpeg;base64,' + base64.b64encode(nb.getvalue()).decode()
    buf = io.BytesIO(); atlas.save(buf, 'JPEG', quality=84); tex = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode(); atlas.save(f'/tmp/mh_atlas_{var["name"]}.jpg')
    UV = np.zeros((len(SV), 2)); raw = VT[SVT]
    UV[:, 0] = np.where(eye_v[SV], EUV[SV, 0], (raw[:, 0] - u0) / (u1 - u0)); UV[:, 1] = np.where(eye_v[SV], EUV[SV, 1], (v1 - raw[:, 1]) / (v1 - v0) * HH / AH); UV[lash_v[SV]] = 0
    nk = ~hv & ~eye_v[SV] & ~lash_v[SV]; UV[nk] = np.array([0.75, (HH + 128) / AH])   # 脖子下緣：用一塊平的膚色
    UVQ = base64.b64encode(np.clip(np.round(UV * 65535), 0, 65535).astype(np.uint16).tobytes()).decode()
    P, N, C, kind, wn, BL = P[SV], N[SV], C[SV], kind[SV], wn[SV], BL[SV]
    print('   眨眼最大位移', np.abs(BL).max().round(4), '會動的頂點', (np.abs(BL).max(1) > 1e-4).sum())
    out.append(dict(name=var['name'], tone=var['tone'], brow=var['brow'], n=len(P), tex=tex, ntex=ntex, kb=len(tex) // 1024, nkb=len(ntex) // 1024, bl=q(BL, -0.02, 0.02, np.uint8),
        eye=[round(float(abs(L['eyeL'][0])), 4), round(float(L['eyeL'][1]), 4)], mouth=[round(float(L['mouth'][1]), 4), round(float(L['mouth'][2]), 4)],
        p=q(P, -0.16, 0.16, np.uint16) if False else q(P - np.array([0, 1.65, 0]), -0.2, 0.2, np.uint16), nrm=q(N, -1, 1, np.uint8), c=q(C, 0, 1, np.uint8), k=q(kind * 10, 0, 255, np.uint8), wn=q(wn, 0, 1, np.uint8),
        tri=base64.b64encode(Tk.astype(np.uint16).tobytes()).decode()))

# 眉毛：MakeHuman 的眉毛貼圖（一根一根的毛、帶透明度），四張臉各一種，排成 512×512（每列 512×128，涵蓋 x ±0.07 公尺、y 1.685–1.72）
from PIL import Image
import io
BROWS = {'a': '010', 'b': '012', 'c': '012', 'd': '010'}; sheet = np.zeros((512, 512))
PXM = 512 / 0.14
for r, var in enumerate(VARIANTS):
    al = np.asarray(Image.open(os.path.join(SKINS, 'brow', f'eyebrow{BROWS[var["name"]]}.png')).convert('RGBA'))[:, :, 3].astype(float) / 255
    rows = np.where(al.sum(1) > 1.0)[0]; brk = np.where(np.diff(rows) > 3)[0]; r1 = rows[brk[0]] if len(brk) else rows[-1]     # 第一條眉毛所在的那幾列
    half = al[rows[0]:r1 + 1]; xs = np.where(half.sum(0) > 0.5)[0]; one = half[:, xs.min():xs.max() + 1]
    if one[:, :one.shape[1] // 2].sum() < one[:, one.shape[1] // 2:].sum(): one = one[:, ::-1]          # 粗的那頭（眉頭）放左邊
    wpx = int(0.05 * PXM); hpx = max(8, int(one.shape[0] * wpx / one.shape[1] * (1.05 if var['name'] == 'c' else 1.3)))
    im = np.asarray(Image.fromarray((one * 255).astype(np.uint8)).resize((wpx, hpx), Image.LANCZOS)).astype(float) / 255
    cy = int((1.72 - 1.6965) * PXM); y0 = r * 128 + cy - hpx // 2; x0 = 256 + int(0.011 * PXM)
    y0 = max(r * 128, min(y0, r * 128 + 128 - hpx))
    sheet[y0:y0 + hpx, x0:x0 + wpx] = np.maximum(sheet[y0:y0 + hpx, x0:x0 + wpx], im)
    sheet[y0:y0 + hpx, 512 - x0 - wpx:512 - x0] = np.maximum(sheet[y0:y0 + hpx, 512 - x0 - wpx:512 - x0], im[:, ::-1])
bim = Image.fromarray((np.clip(sheet * 1.25, 0, 1) * 255).astype(np.uint8)); buf = io.BytesIO(); bim.save(buf, 'PNG', optimize=True); bim.save('/tmp/mh_brows.png')
BROW_URL = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
js = ('/* ===== 58-heads：寫實的頭（tools/mh_heads.py 用 MakeHuman 的 CC0 人體資料產生，不要手改）\n'
      '   每張臉：位置（uint16，相對 (0,1.65,0)、±0.2 公尺）、法線、頂點顏色（含烘好的遮蔽、嘴唇、短髮、眼球）、種類、脖子權重、三角形索引 */\n'
      'const MH_ATLAS = [' + f'{AW}, {AH}, {HH}' + '];\nconst MH_HEAD_UV = "' + UVQ + '";\nconst MH_BROW_TEX = "' + BROW_URL + '";\nconst MH_HEADS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
open(OUT, 'w').write(js); print('寫出', OUT, round(len(js) / 1024), 'KB')
