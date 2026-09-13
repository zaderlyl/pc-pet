const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pcpet', {
  onSignals: (cb) => ipcRenderer.on('signals', (_e, data) => cb(data)),
  drag: (dx, dy) => ipcRenderer.send('drag', { dx, dy }),
  dragEnd: () => ipcRenderer.send('drag-end'),
  // --- fenêtre de friandises ---
  setClickable: (on) => ipcRenderer.send('treats-clickable', on),
  petBounds: () => ipcRenderer.invoke('pet-bounds'),
  feed: (kind) => ipcRenderer.send('feed', kind),
  openHub: () => ipcRenderer.send('open-hub'),
});
