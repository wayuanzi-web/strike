/* ===== 67-mapload：換地圖——重建方塊、裝飾、網格與烘焙光影、路點、包點、出生點、天色、雷達底圖 ===== */
// 預熱顯示卡：把場景（含隱藏的人物、所有槍、投擲物）強制畫一次，只畫左下角 1 個像素，讓著色器編譯和貼圖上傳在載入時做完。
// three.js 的 compile() 只處理看得見的物件、也不上傳貼圖，所以機器人第一次出現（開打第一幀）會卡 100–500 毫秒。
function warmGPU() {
  if (window.__noWarm) { try { renderer.compile(scene, camera); } catch (e) {} return; }   // 測試用：關掉預熱來比較
  const forced = [], culled = [];
  const prep = (root) => root.traverse((o) => { if (!o.visible) { forced.push(o); o.visible = true; } if (o.frustumCulled && (o.isMesh || o.isSprite || o.isPoints)) { culled.push(o); o.frustumCulled = false; } });
  try {
    prep(scene); prep(vmScene);
    const sc = renderer.getScissorTest(); renderer.setScissorTest(true); renderer.setScissor(0, 0, 1, 1);
    renderer.render(scene, camera); renderer.render(vmScene, vmCam);
    renderer.setScissorTest(sc); renderer.setScissor(0, 0, renderer.domElement.width, renderer.domElement.height);
  } catch (e) { /* 舊瀏覽器略過 */ }
  for (const o of forced) o.visible = false; for (const o of culled) o.frustumCulled = true;
}
function switchMap(id) {
  if (MAP.id === id && mapMeshes.length) return false;
  const t0 = performance.now();
  clearNades(); resetBomb();
  setMapData(id);
  SUN_DIR.fromArray(MAP.theme.sun).normalize();   // 先換太陽方向再烘光影（以前用到上一張地圖的太陽）
  rebuildMapMeshes(); applyTheme();
  buildNav(); loadSites(); loadTeamSpawns(); buildSiteMarks();
  radarBase = null; bakeIndex();
  for (const b of bots) { b.path = null; b.goalTag = null; }
  warmGPU();
  game.mapLoadMs = Math.round(performance.now() - t0);
  return true;
}
