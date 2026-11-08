/* ===== 67-mapload：換地圖——重建方塊、裝飾、網格與烘焙光影、路點、包點、出生點、天色、雷達底圖 ===== */
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
  try { renderer.compile(scene, camera); } catch (e) { /* 舊瀏覽器略過 */ }
  game.mapLoadMs = Math.round(performance.now() - t0);
  return true;
}
