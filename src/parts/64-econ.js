/* ===== 64-econ：經濟——開局 800、上限 16000；擊殺獎金看武器；回合勝 3250（炸掉或拆掉 3500）、敗方連敗補助 1400 起每次 +500
   攻方裝了炸彈但輸了每人多 800；裝彈、拆彈的人自己 +300。回合開始的準備時間（加開打後 20 秒內、在出生區）可以買東西。
   練習模式：隨時能買、不花錢。 */
const ECON = { start: 800, max: 16000, win: 3250, winBomb: 3500, loss: [1400, 1900, 2400, 2900, 3400], plantBonus: 800, plant: 300, defuse: 300, buyLive: 20 };
// 可以買的東西（armor：防彈衣 650；防彈衣＋頭盔 1000，已有防彈衣只要 350；kit：拆彈器只有守方能買）
const SHOP = [
  { id: 'smg', cat: '主武器', w: WEAPONS.smg }, { id: 'shotgun', cat: '主武器', w: WEAPONS.shotgun },
  { id: 'rifle', cat: '主武器', w: WEAPONS.rifle }, { id: 'sniper', cat: '主武器', w: WEAPONS.sniper },
  { id: 'vest', cat: '裝備', name: '防彈衣', price: 650 }, { id: 'helm', cat: '裝備', name: '防彈衣＋頭盔', price: 1000 },
  { id: 'kit', cat: '裝備', name: '拆彈器', price: 400, def: true },
  { id: 'he', cat: '投擲物', n: NADES.he }, { id: 'flash', cat: '投擲物', n: NADES.flash }, { id: 'smoke', cat: '投擲物', n: NADES.smoke },
];
const shopPrice = (it, u) => it.w ? it.w.price : it.n ? it.n.price : it.id === 'helm' && (u === player ? INV.vest : u.vest) ? 350 : it.price;
const freeBuy = () => game.mode !== 'match';
function addMoney(u, n, why) {
  if (game.mode !== 'match' || !n) return;
  u.money = clamp((u.money || 0) + n, 0, ECON.max);
  if (u === player) hudCash(n, why);
}

// ---------- 你的購買 ----------
function inBuyZone() {
  if (freeBuy()) return true;
  const sp = TEAM_SPAWN[ROUND.atk === player.team ? 'atk' : 'def'][0];
  return Math.hypot(player.body.pos.x - sp[0], player.body.pos.z - sp[1]) < 12;
}
function buyOpen() {
  if (!player.alive || game.state !== 'play') return false;
  if (freeBuy()) return true;
  if (ROUND.phase === 'freeze') return true;
  return ROUND.phase === 'live' && ROUND.length - ROUND.t < ECON.buyLive && !BOMB.planted && inBuyZone();
}
// 這件買不買得到：回傳空字串＝可以，否則是原因
function cantBuy(it) {
  if (it.id === 'kit' && (game.mode !== 'match' || ROUND.atk === player.team)) return '只有守方能買';
  if (it.w && INV.primary && INV.primary.def === it.w) return '已經有了';
  if (it.n && INV[it.id] >= it.n.max) return '帶滿了';
  if (it.id === 'vest' && INV.vest) return '已經有了';
  if (it.id === 'helm' && INV.helmet) return '已經有了';
  if (it.id === 'kit' && INV.kit) return '已經有了';
  if (!freeBuy() && (player.money || 0) < shopPrice(it, player)) return '錢不夠';
  return '';
}
function buyItem(id) {
  const it = SHOP.find((x) => x.id === id); if (!it || !buyOpen()) return false;
  const why = cantBuy(it); if (why) { hudTip(why, 1); return false; }
  if (!freeBuy()) player.money -= shopPrice(it, player);
  if (it.w) giveWeapon(it.w, true);
  else if (it.n) { INV[it.id]++; }
  else if (it.id === 'vest') INV.vest = true;
  else if (it.id === 'helm') { INV.vest = true; INV.helmet = true; }
  else if (it.id === 'kit') INV.kit = true;
  sfx('cash'); renderBuy();
  return true;
}
// 一鍵購買：照錢買最好的一套（步槍→防彈衣頭盔→煙→閃→手榴彈）
function autoBuy() {
  const order = ['rifle', 'helm', 'smoke', 'flash', 'he', 'kit', 'flash'];
  const m = freeBuy() ? 1e9 : (player.money || 0);
  if (!INV.primary && m < 2900 + 650) order.unshift(m >= 1250 + 650 ? 'smg' : 'vest');
  let n = 0;
  for (const id of order) {
    const it = SHOP.find((x) => x.id === id);
    if (id === 'helm' && !freeBuy() && player.money < 1000 && !INV.vest && player.money >= 650) { if (buyItem('vest')) n++; continue; }
    if (it && !cantBuy(it) && buyItem(id)) n++;
  }
  if (!n) hudTip('沒有可以買的', 1);
}

// ---------- 購買選單 ----------
const buyEl = $('buy');
function renderBuy() {
  if (buyEl.hidden) return;
  $('buyMoney').textContent = freeBuy() ? '練習模式：免費' : '$ ' + (player.money || 0);
  for (const b of buyEl.querySelectorAll('[data-buy]')) {
    const it = SHOP.find((x) => x.id === b.dataset.buy), why = cantBuy(it);
    b.disabled = !!why; b.querySelector('em').textContent = why || '$ ' + shopPrice(it, player);
    b.classList.toggle('own', why === '已經有了' || why === '帶滿了');
  }
}
function buildBuyMenu() {
  const g = $('buyGrid'); g.innerHTML = '';
  for (const it of SHOP) {
    const b = document.createElement('button'); b.className = 'bi'; b.dataset.buy = it.id;
    const nm = it.w ? it.w.name : it.n ? it.n.name : it.name;
    const info = it.w ? `傷害 ${it.w.pellets ? it.w.dmg + '×' + it.w.pellets : it.w.dmg}・${it.w.semi || it.w.scope || it.w.pellets ? '單發' : '連發'}・殺敵 +$${it.w.reward}` :
      it.id === 'he' ? '範圍傷害' : it.id === 'flash' ? '讓人暫時看不見' : it.id === 'smoke' ? '擋住視線 17 秒' : it.id === 'vest' ? '身體受傷打折' : it.id === 'helm' ? '頭也有保護' : '拆彈 10→5 秒';
    b.innerHTML = `<small>${it.cat}</small><b>${nm}</b><span>${info}</span><em></em>`;
    onTap(b, () => buyItem(it.id));
    g.appendChild(b);
  }
}
function openBuy() {
  if (!buyOpen()) { hudTip(game.mode === 'match' ? '只有準備時間（和開打後 20 秒內在出生區）能買' : '現在不能買', 1.5); return; }
  buyEl.hidden = false; renderBuy();
}
function closeBuy() { buyEl.hidden = true; }

// ---------- 機器人買東西：錢夠就步槍＋頭盔＋投擲物；全隊錢少就存錢（只買手槍局的防彈衣） ----------
function botBuy(b, teamAvg, pistolRound) {
  const m = () => b.money;
  const pay = (n) => { b.money -= n; };
  const role = b.team === ROUND.atk ? 'atk' : 'def';
  if (pistolRound) {
    if (Math.random() < 0.5 && m() >= 650) { pay(650); b.vest = true; }
    else { if (m() >= 200) { pay(200); b.nades.flash++; } if (m() >= 300 && Math.random() < 0.5) { pay(300); b.nades.he++; } }
    return;
  }
  const eco = !b.primary && teamAvg < 2600 && m() < 3700;
  if (!b.primary && !eco) {
    const sniperOk = !bots.some((o) => o !== b && o.active && o.team === b.team && o.primary === WEAPONS.sniper);
    if (m() >= 6200 && sniperOk && Math.random() < 0.3) { pay(4750); b.primary = WEAPONS.sniper; }
    else if (m() >= 3900) { pay(2900); b.primary = WEAPONS.rifle; }
    else if (m() >= 1900) { const w = Math.random() < 0.3 ? WEAPONS.shotgun : WEAPONS.smg; pay(w.price); b.primary = w; }
  }
  if (eco) return;
  if (!b.helmet && m() >= 1000) { pay(b.vest ? 350 : 1000); b.vest = b.helmet = true; }
  else if (!b.vest && m() >= 650) { pay(650); b.vest = true; }
  if (m() >= 300 && !b.nades.smoke && Math.random() < 0.7) { pay(300); b.nades.smoke = 1; }
  if (m() >= 200 && b.nades.flash < 2 && Math.random() < 0.7) { pay(200); b.nades.flash++; }
  if (m() >= 300 && !b.nades.he && Math.random() < 0.6) { pay(300); b.nades.he = 1; }
  if (role === 'def' && !b.kit && m() >= 400 && Math.random() < 0.6) { pay(400); b.kit = true; }
}
