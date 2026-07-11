'use strict';

const SETTINGS_KEY = 'internetCafeSettings';

let settings = {
  bgmEnabled: true,
  sfxEnabled: true
};

function load() {
  try {
    const saved = wx.getStorageSync(SETTINGS_KEY);
    if (saved) {
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
      if (parsed.bgmEnabled !== undefined) settings.bgmEnabled = !!parsed.bgmEnabled;
      if (parsed.sfxEnabled !== undefined) settings.sfxEnabled = !!parsed.sfxEnabled;
    }
  } catch (e) {
    // use defaults
  }
}

function save() {
  try {
    wx.setStorageSync(SETTINGS_KEY, settings);
  } catch (e) {
    // ignore
  }
}

load();

module.exports = {
  getSettings: function() { return { bgmEnabled: settings.bgmEnabled, sfxEnabled: settings.sfxEnabled }; },
  setBgm: function(enabled) { settings.bgmEnabled = !!enabled; save(); },
  setSfx: function(enabled) { settings.sfxEnabled = !!enabled; save(); },
  isBgmEnabled: function() { return settings.bgmEnabled; },
  isSfxEnabled: function() { return settings.sfxEnabled; }
};
