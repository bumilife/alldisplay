const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let tray = null;
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 300,
    height: 120,
    minWidth: 200,
    minHeight: 100,
    maxWidth: 600,
    maxHeight: 400,
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
