const { app, BrowserWindow, ipcMain, shell, globalShortcut, screen } = require('electron');
const fs = require('fs'), path = require('path'), https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });
// Eski surumde veri klasoru "valtracker" idi; varsa onu kullan ki ayarlar, notlar ve istek listesi kaybolmasin
{
  const ad = app.getPath('appData'), eski = path.join(ad, 'valtracker'), yeni = path.join(ad, 'vantatracker');
  app.setPath('userData', fs.existsSync(eski) && !fs.existsSync(yeni) ? eski : yeni);
}
let S = null;
let win;
const cfgPath = () => path.join(app.getPath('userData'), 'cfg.json');
const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); } catch (e) { return {}; } };
ipcMain.handle('cfg', () => readCfg());
ipcMain.handle('cfgset', (_, c) => { fs.writeFileSync(cfgPath(), JSON.stringify(c)); app.relaunch(); app.exit(0); });
ipcMain.handle('wc', (_, a) => {
  if (!win) return;
  if (a === 'min') win.minimize();
  else if (a === 'max') { if (win.isMaximized()) win.unmaximize(); else win.maximize(); }
  else win.close();
});
ipcMain.handle('wstate', () => !!(win && win.isMaximized()));
const LOG = [];

function call(url, { method = 'GET', headers = {}, body, local = false } = {}) {
  return new Promise((resolve, reject) => {
    const r = https.request(url, { method, headers, agent: local ? agent : undefined }, s => {
      let d = ''; s.on('data', c => d += c);
      s.on('end', () => { let j = {}; try { j = JSON.parse(d); } catch (e) {} resolve({ status: s.statusCode, json: j }); });
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

async function init() {
  if (S) return S;
  const lock = path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'Riot Client', 'Config', 'lockfile');
  if (!fs.existsSync(lock)) throw new Error('Valorant açık değil. Oyunu başlatıp giriş yap, sonra tekrar dene.');
  const [, , port, pass] = fs.readFileSync(lock, 'utf8').split(':');
  const auth = 'Basic ' + Buffer.from('riot:' + pass).toString('base64');
  const tok = await call(`https://127.0.0.1:${port}/entitlements/v1/token`, { headers: { Authorization: auth }, local: true });
  if (!tok.json.accessToken) throw new Error('Oturum bilgisi alınamadı. Oyuna giriş yaptığından emin ol.');
  const ver = (await call('https://valorant-api.com/v1/version')).json.data.riotClientVersion;
  const headers = {
    Authorization: 'Bearer ' + tok.json.accessToken,
    'X-Riot-Entitlements-JWT': tok.json.token,
    'X-Riot-ClientVersion': ver,
    'X-Riot-ClientPlatform': Buffer.from(JSON.stringify({ platformType: 'PC', platformOS: 'Windows', platformOSVersion: '10.0.19042.1.256.64bit', platformChipset: 'Unknown' })).toString('base64'),
    'Content-Type': 'application/json'
  };
  for (const shard of ['eu', 'na', 'ap', 'kr']) {
    try {
      const r = await call(`https://pd.${shard}.a.pvp.net/store/v1/wallet/${tok.json.subject}`, { headers });
      if (r.status === 200) return (S = { headers, puuid: tok.json.subject, shard, port, auth });
    } catch (e) {}
  }
  throw new Error('Bölge bulunamadı. Oturumu yenilemek için oyunu yeniden başlat.');
}

ipcMain.handle('rc', async (_, { host, path: p, method, body }) => {
  try {
    const s = await init();
    const note = (st) => { LOG.push({ t: Date.now(), m: method || 'GET', h: host, p: p.replace('{me}', '<sen>').replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '<id>'), s: st }); if (LOG.length > 300) LOG.shift(); };
    if (host === 'local') {
      const r = await call(`https://127.0.0.1:${s.port}${p}`, { headers: { Authorization: s.auth }, local: true });
      note(r.status);
      return { ok: true, status: r.status, json: r.json, puuid: s.puuid };
    }
    const base = host === 'glz' ? `https://glz-${s.shard}-1.${s.shard}.a.pvp.net` : `https://pd.${s.shard}.a.pvp.net`;
    const r = await call(base + p.replace('{me}', s.puuid), { method, headers: s.headers, body: body ? JSON.stringify(body) : undefined });
    note(r.status);
    if (r.status === 400 || r.status === 401) S = null;
    return { ok: true, status: r.status, json: r.json, puuid: s.puuid };
  } catch (e) { S = null; return { ok: false, error: e.message }; }
});

// Otomatik guncelleme (yalnizca kurulu uygulamada; GitHub surumlerinden)
let upd = null;
const sendUpd = o => { if (win && !win.isDestroyed()) win.webContents.send('upd', o); };
function initUpdater() {
  if (!app.isPackaged) return;
  try {
    upd = require('electron-updater').autoUpdater;
    upd.autoDownload = false;
    upd.autoInstallOnAppQuit = true;
    upd.on('update-available', i => sendUpd({ s: 'available', v: i.version }));
    upd.on('update-not-available', () => sendUpd({ s: 'none' }));
    upd.on('download-progress', p => sendUpd({ s: 'progress', p: Math.round(p.percent) }));
    upd.on('update-downloaded', i => sendUpd({ s: 'ready', v: i.version }));
    upd.on('error', () => sendUpd({ s: 'error' }));
  } catch (e) { upd = null; }
}
const checkUpd = manual => {
  if (!upd) { if (manual) sendUpd({ s: 'dev' }); return; }
  upd.checkForUpdates().catch(() => sendUpd({ s: 'error' }));
};
ipcMain.handle('upd-check', () => checkUpd(true));
ipcMain.handle('upd-download', () => { if (upd) upd.downloadUpdate().catch(() => sendUpd({ s: 'error' })); });
ipcMain.handle('upd-install', () => { if (upd) upd.quitAndInstall(true, true); });
ipcMain.handle('ver', () => app.getVersion());

// Kucuk overlay: oyundan odagi calmaz, tiklamalari gecirir, sag ustte durur
let OV = null, KEY = 'Alt+C', PASS = false;
function overlayOn() {
  if (!win || OV) return;
  OV = { b: win.getNormalBounds(), top: win.isAlwaysOnTop(), min: win.isMinimized(), vis: win.isVisible(), max: win.isMaximized() };
  if (OV.max) win.unmaximize();
  const wa = screen.getPrimaryDisplay().workArea, w = Math.min(880, wa.width - 32), h = Math.min(680, wa.height - 32);
  win.setFocusable(false);
  win.setIgnoreMouseEvents(PASS, { forward: true });
  win.setAlwaysOnTop(true, 'screen-saver');
  if (OV.min) win.restore();
  win.setBounds({ x: wa.x + wa.width - w - 16, y: wa.y + 16, width: w, height: h });
  win.showInactive();
  win.webContents.send('overlay', true);
}
function overlayOff() {
  if (!win || !OV) return;
  const o = OV; OV = null;
  win.webContents.send('overlay', false);
  win.setIgnoreMouseEvents(false);
  win.setFocusable(true);
  win.setAlwaysOnTop(o.top);
  win.setBounds(o.b);
  if (o.max) win.maximize();
  if (o.min) win.minimize(); else if (!o.vis) win.hide();
}
function setKey(k) {
  globalShortcut.unregisterAll();
  KEY = k || 'Alt+C';
  try { globalShortcut.register(KEY, () => (OV ? overlayOff() : overlayOn())); } catch (e) {}
}

ipcMain.handle('open', (_, u) => { if (/^https:\/\//.test(u)) shell.openExternal(u); });

ipcMain.handle('win', (_, o) => {
  if (!win) return;
  win.setOpacity(Math.min(1, Math.max(0.3, o.opacity || 1)));
  if (!OV) win.setAlwaysOnTop(!!o.top);
  if (o.key && o.key !== KEY) setKey(o.key);
  if (typeof o.pass === 'boolean') { PASS = o.pass; if (OV) win.setIgnoreMouseEvents(PASS, { forward: true }); }
});
// Overlay'de yazi yazarken pencere gecici olarak odak alir, bitince birakir
ipcMain.handle('ovfocus', (_, on) => {
  if (!win || !OV) return;
  if (on) { win.setFocusable(true); win.focus(); } else { win.blur(); win.setFocusable(false); }
});
ipcMain.handle('show', () => overlayOn());
ipcMain.handle('hide', () => overlayOff());
ipcMain.handle('log', () => LOG);

app.whenReady().then(() => {
  const c = readCfg(), [w, h] = String(c.size || '1280x800').split('x').map(Number);
  win = new BrowserWindow({
    width: w || 1280, height: h || 800, backgroundColor: c.glass ? '#00000000' : '#0e1118',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    transparent: !!c.glass, frame: false, resizable: !c.glass, hasShadow: !c.glass, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  win.on('maximize', () => win.webContents.send('maxstate', true));
  win.on('unmaximize', () => win.webContents.send('maxstate', false));
  win.loadFile('index.html');
  setKey('Alt+C');
  initUpdater();
  setTimeout(() => checkUpd(false), 10000);
  setInterval(() => checkUpd(false), 6 * 3600 * 1000);
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
