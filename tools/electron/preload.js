// Gives the game a copy of its saves on disk (%APPDATA%\Granny x DBD\saves), next to the browser storage, so progress
// survives anything that clears or moves the browser storage. Only two keys, only plain text, nothing else exposed.
const { contextBridge, ipcRenderer } = require('electron');
const KEYS = new Set(['profile', 'settings']);
contextBridge.exposeInMainWorld('gdbdDisk', {
  load: k => (KEYS.has(k) ? ipcRenderer.sendSync('gdbd-load', k) : null),
  save: (k, v) => { if (KEYS.has(k) && typeof v === 'string' && v.length < 4e6) ipcRenderer.send('gdbd-save', k, v); },
});
