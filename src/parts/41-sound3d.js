/* ===== 41-sound3d：M15 聲音（參考 CS2 的聲音改版）
   - 隔牆變悶：聲源和你之間被牆擋住就變小、高頻被濾掉（胸口、頭頂兩條線，擋一條算一半）。煙不擋聲音。
   - 方向：用 HRTF（人頭轉移函數）的立體聲，分得出前後、上下；同時最多 8 個（手機省 CPU），腳步這種小聲音只在 4 個以內才用，其他退回左右聲道。
     沒用 HRTF 的時候，背後的聲音稍微悶一點，比較分得出前後。設定可關。
   - 子彈打到東西：金屬「鏘」、木頭「叩」、水泥磚牆「啪＋碎屑」、地面「噗」；敵人的子彈從你耳邊 2 公尺內飛過有「咻—啪」。 */
const SND3 = { n: 0, max: 8, lowMax: 4, whizT: 0 };
const _sq = new THREE.Quaternion(), _sv = new V3(), _sa = new V3(), _sb = new V3();
// 被牆擋住的程度 0／0.5／1
function soundOcclusion(pos) {
  const c = camera.position, y0 = pos.y || 0;
  const a = lineClearNoSmoke(c, _sa.set(pos.x, y0 + 1.3, pos.z)), b = lineClearNoSmoke(c, _sb.set(pos.x, y0 + 2.3, pos.z));
  return a && b ? 0 : a || b ? 0.5 : 1;
}
const useHrtf = () => S.hrtf && AC && !!AC.createPanner;
// 把聲音接到輸出：pan 是數字（左右）或位置（HRTF）；回傳要接進去的節點（已接好 master 與殘響）
function panOut(pan, dur, rev = true, low = false) {
  if (pan && typeof pan === 'object') {
    if (useHrtf() && SND3.n < (low ? SND3.lowMax : SND3.max)) {
      const p = AC.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'linear'; p.rolloffFactor = 0; p.refDistance = 1; p.maxDistance = 10000;
      _sv.set(pan.x, (pan.y || 0) + 1.3, pan.z).sub(camera.position).applyQuaternion(_sq.copy(camera.quaternion).invert());
      if (_sv.lengthSq() < 1e-4) _sv.set(0, 0, -1); _sv.normalize();
      if (p.positionX) { p.positionX.value = _sv.x; p.positionY.value = _sv.y; p.positionZ.value = _sv.z; } else p.setPosition(_sv.x, _sv.y, _sv.z);
      p.connect(master); if (rev && REV.send) p.connect(REV.send);
      SND3.n++; setTimeout(() => { SND3.n--; try { p.disconnect(); } catch (e) { /* 已經斷了 */ } }, (dur + 0.4) * 1000);
      return p;
    }
    pan = pan.panNum || 0;
  }
  if (pan && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = pan; p.connect(master); if (rev && REV.send) p.connect(REV.send); return p; }
  return null;
}
// 接到輸出（沒有左右時直接接 master）
function connectOut(node, pan, dur, rev = true, low = false) {
  const o = panOut(pan, dur, rev, low);
  if (o) node.connect(o); else { node.connect(master); if (rev && REV.send) node.connect(REV.send); }
}
// 依位置算音量、悶的程度、左右（或 HRTF 的位置）、延遲
function spatial(pos) {
  const pp = camera.position, dx = pos.x - pp.x, dz = pos.z - pp.z, d = Math.hypot(dx, dz);
  const rel = angDiff(camera.rotation.y, Math.atan2(-dx, -dz));
  const occ = d < 60 ? soundOcclusion(pos) : 1;
  let vol = 1 / (1 + d / 12), lp = clamp(18000 * Math.exp(-d / 22), 900, 18000);
  if (occ) { vol *= 1 - occ * 0.5; lp = Math.min(lp, lerp(4200, 700, occ)); }
  const panNum = clamp(-Math.sin(rel) * 0.8, -0.8, 0.8), hr = useHrtf();
  if (!hr && Math.abs(rel) > Math.PI / 2) lp *= 0.72;   // 沒有 HRTF：背後的聲音稍微悶
  return { d, vol, lp, occ, pan: hr ? { x: pos.x, y: pos.y || 0, z: pos.z, panNum } : panNum, panNum, delay: d / 343 };
}
// 子彈打到東西的聲音（依材質）
const IMPACT_KIND = { container: 'metal', metal: 'metal', wood: 'wood', concrete: 'stone', brick: 'stone', plaster: 'stone', floor: 'ground', cobble: 'ground', gravel: 'gravel' };
function boxMat(i) { const b = BOXES[i]; return b ? MAT_OF[b.c] || 'concrete' : 'concrete'; }
function impactSfx(pos, mat, vol = 1) {
  if (window.__sfxLog) window.__sfxLog.push('impact:' + (IMPACT_KIND[mat] || 'stone'));
  if (!AC || !S.sound) return;
  const sp = spatial(pos); if (sp.d > 45) return;
  const v = vol * Math.min(1, sp.vol * 1.6), pn = sp.pan, k = IMPACT_KIND[mat] || 'stone', at = Math.min(sp.delay, 0.12);
  if (k === 'metal') { noise(0.025, 3600, 6, 0.45 * v, 'bandpass', at, pn); tonePan(rand(1900, 2900), 0.22, 0.05 * v, 'sine', at, 0, pn); tonePan(rand(4200, 5200), 0.1, 0.025 * v, 'sine', at, 0, pn); }
  else if (k === 'wood') { noise(0.05, 620, 4, 0.55 * v, 'bandpass', at, pn); noise(0.02, 2200, 2, 0.18 * v, 'bandpass', at, pn); }
  else if (k === 'stone') { noise(0.025, 2100, 1.4, 0.5 * v, 'bandpass', at, pn); noise(0.14, 700, 0.8, 0.18 * v, 'lowpass', at + 0.01, pn); noise(0.06, 5200, 1, 0.08 * v, 'highpass', at + 0.03, pn); }
  else if (k === 'gravel') { noise(0.05, 900, 1, 0.3 * v, 'lowpass', at, pn); noise(0.09, 3800, 1, 0.12 * v, 'highpass', at + 0.01, pn); }
  else { noise(0.06, 800, 0.8, 0.38 * v, 'lowpass', at, pn); noise(0.03, 2600, 1, 0.08 * v, 'bandpass', at, pn); }
}
// 敵人的子彈從耳邊飛過：找彈道上離你最近的點，2 公尺內就有「咻—啪」，從那個方向來
function bulletWhiz(o, end, shooterTeam) {
  if (shooterTeam === player.team || !player.alive || game.t < SND3.whizT) return false;
  const c = camera.position; _sv.subVectors(end, o); const L = _sv.length(); if (L < 3) return false;
  _sv.divideScalar(L); const t = clamp(_sa.subVectors(c, o).dot(_sv), 0, L);
  if (t < 4 || t > L - 0.5) return false;   // 太靠近開槍的人，或子彈停在你前面
  _sb.copy(o).addScaledVector(_sv, t); const d = _sb.distanceTo(c);
  if (d > 2.0 || d < 0.25) return false;
  SND3.whizT = game.t + 0.07;
  if (window.__sfxLog) window.__sfxLog.push('whiz');
  if (!AC || !S.sound) return true;
  const sp = spatial(_sb.setY(_sb.y - 1.3)), v = (1 - d / 2.2) * 0.9;
  noise(0.018, 4200, 0.9, 0.55 * v, 'highpass', 0, sp.pan);
  noise(0.09, 1500, 3, 0.22 * v, 'bandpass', 0.008, sp.pan);
  return true;
}
