const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('update-available', (event, info) => {
            callback(info);
        });
    },
    
    onUpdateDownloadProgress: (callback) => {
        ipcRenderer.on('update-download-progress', (event, progress) => {
            callback(progress);
        });
    },
    
    onUpdateDownloaded: (callback) => {
        ipcRenderer.on('update-downloaded', (event, info) => {
            callback(info);
        });
    },
    
    onUpdateError: (callback) => {
        ipcRenderer.on('update-error', (event, error) => {
            callback(error);
        });
    },
    
    triggerUpdateDownload: async () => {
        await ipcRenderer.invoke('trigger-update-download');
    },
    
    triggerUpdateInstall: async () => {
        await ipcRenderer.invoke('trigger-update-install');
    }
});