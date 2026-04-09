function getElectronApp() {
  try {
    const electron = require('electron');
    if (!electron || typeof electron === 'string') {
      return null;
    }
    return electron.app || null;
  } catch {
    return null;
  }
}

module.exports = getElectronApp();
