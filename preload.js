const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  rc: a => ipcRenderer.invoke('rc', a), open: u => ipcRenderer.invoke('open', u), win: o => ipcRenderer.invoke('win', o),
  show: () => ipcRenderer.invoke('show'), hide: () => ipcRenderer.invoke('hide'), log: () => ipcRenderer.invoke('log'),
  cfg: () => ipcRenderer.invoke('cfg'), cfgset: c => ipcRenderer.invoke('cfgset', c), wc: a => ipcRenderer.invoke('wc', a),
  onOverlay: cb => ipcRenderer.on('overlay', (_, v) => cb(v)),
  onMax: cb => ipcRenderer.on('maxstate', (_, v) => cb(v)), wstate: () => ipcRenderer.invoke('wstate'), ovFocus: on => ipcRenderer.invoke('ovfocus', on),
  onUpdate: cb => ipcRenderer.on('upd', (_, v) => cb(v)), updCheck: () => ipcRenderer.invoke('upd-check'),
  updDownload: () => ipcRenderer.invoke('upd-download'), updInstall: () => ipcRenderer.invoke('upd-install'), version: () => ipcRenderer.invoke('ver')
});
