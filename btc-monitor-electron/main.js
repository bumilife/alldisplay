const { app, BrowserWindow, ipcMain, Tray, Menu, safeStorage } = require('electron');
const path = require('path');
const ccxt = require('ccxt');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let tray = null;
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 300,
    height: 120,
    minWidth: 200,
    minHeight: 100,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 개발 환경에서는 Vite 데브 서버, 빌드 후에는 dist/index.html 로드
  win.loadURL(
    isDev
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, '../dist/index.html')}`
  );

  // 항상 최상위 유지 강제 (일부 환경 대응)
  win.setAlwaysOnTop(true, 'screen-saver');

  // 창 최소화 이벤트 (트레이로 숨기기 대신 실제 최소화 처리)
  ipcMain.on('window-minimize', () => {
    win.minimize();
  });

  // 창 닫기 이벤트 (실제 종료)
  ipcMain.on('window-close', () => {
    app.quit();
  });

  ipcMain.on('resize-window', (event, width, height) => {
    win.setSize(width, height, true);
  });

  // Secure Storage IPC Handlers
  ipcMain.handle('encrypt-data', (event, plaintext) => {
    if (safeStorage.isEncryptionAvailable() && plaintext) {
      return safeStorage.encryptString(plaintext).toString('base64');
    }
    return plaintext; // fallback if encryption not available
  });

  ipcMain.handle('decrypt-data', (event, ciphertext) => {
    if (safeStorage.isEncryptionAvailable() && ciphertext) {
      try {
        const buffer = Buffer.from(ciphertext, 'base64');
        return safeStorage.decryptString(buffer);
      } catch (e) {
        console.error('Decryption failed:', e);
        return '';
      }
    }
    return ciphertext; // fallback
  });

  // CCXT IPC Handlers
  const getExchangeInstance = (exchangeId, apiKey = '', secret = '') => {
    const exchangeClass = ccxt[exchangeId.toLowerCase()];
    if (!exchangeClass) throw new Error(`Unsupported exchange: ${exchangeId}`);

    return new exchangeClass({
      apiKey,
      secret,
      options: { defaultType: 'future' }, // We are dealing with USDT futures
      enableRateLimit: true,
    });
  };

  ipcMain.handle('ccxt-fetch-ohlcv', async (event, { exchange, symbol, timeframe, limit }) => {
    try {
      const ex = getExchangeInstance(exchange);
      // symbol comes as BTCUSDT, ccxt needs BTC/USDT:USDT for futures usually, but simple loadMarkets handling is better
      await ex.loadMarkets();
      // find the correct symbol format for the exchange
      let formattedSymbol = `${symbol}/USDT:USDT`;
      if (exchange.toLowerCase() === 'binance') formattedSymbol = `${symbol}/USDT:USDT`;
      else if (exchange.toLowerCase() === 'bybit') formattedSymbol = `${symbol}/USDT:USDT`;
      else if (exchange.toLowerCase() === 'bitget') formattedSymbol = `${symbol}/USDT:USDT`;

      const ohlcv = await ex.fetchOHLCV(formattedSymbol, timeframe, undefined, limit);
      return ohlcv;
    } catch (e) {
      console.error('CCXT fetchOHLCV Error:', e.message);
      throw e;
    }
  });

  ipcMain.handle('ccxt-fetch-balance', async (event, { exchange, apiKey, secret }) => {
    try {
      if (!apiKey || !secret) throw new Error('API keys required for balance');
      const ex = getExchangeInstance(exchange, apiKey, secret);
      const balance = await ex.fetchBalance();
      return balance.USDT ? balance.USDT.total : 0;
    } catch (e) {
      console.error('CCXT fetchBalance Error:', e.message);
      throw e;
    }
  });

  ipcMain.handle('ccxt-create-market-order', async (event, { exchange, apiKey, secret, symbol, side, amount }) => {
    try {
      if (!apiKey || !secret) throw new Error('API keys required for trading');
      const ex = getExchangeInstance(exchange, apiKey, secret);
      await ex.loadMarkets();
      let formattedSymbol = `${symbol}/USDT:USDT`;
      const order = await ex.createMarketOrder(formattedSymbol, side, amount);
      return order;
    } catch (e) {
      console.error('CCXT createMarketOrder Error:', e.message);
      throw e;
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'btc_tray_icon.png');
  tray = new Tray(iconPath);

  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      { label: '보이기', click: () => win.show() },
      { label: '숨기기', click: () => win.hide() },
      { type: 'separator' },
      { 
        label: '투명도', 
        submenu: [
          { label: '20%', click: () => win.webContents.send('set-opacity', 0.2) },
          { label: '40%', click: () => win.webContents.send('set-opacity', 0.4) },
          { label: '60%', click: () => win.webContents.send('set-opacity', 0.6) },
          { label: '80%', click: () => win.webContents.send('set-opacity', 0.8) },
          { label: '100%', click: () => win.webContents.send('set-opacity', 1.0) },
        ]
      },
      { 
        label: '뉴스 표시 토글', 
        click: () => win.webContents.send('toggle-news') 
      },
      { type: 'separator' },
      { label: '종료', click: () => app.quit() }
    ]);
    tray.setContextMenu(contextMenu);
  };

  tray.setToolTip('BTC Monitor');
  updateMenu();

  // 트레이 아이콘 클릭 시 윈도우 토글
  tray.on('click', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
