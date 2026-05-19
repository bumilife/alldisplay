import React, { useState, useEffect } from 'react';

type TradingMode = 'PAPER' | 'REAL';

interface Props {
  coin: string;
  exchange: string;
}

const TradingWidget: React.FC<Props> = ({ coin, exchange }) => {
  const [mode, setMode] = useState<TradingMode>('PAPER');
  const [apiKey, setApiKey] = useState(localStorage.getItem('btc-monitor-api-key') || '');
  const [apiSecret, setApiSecret] = useState(localStorage.getItem('btc-monitor-api-secret') || '');
  const [isActive, setIsActive] = useState(false);
  const [strategy, setStrategy] = useState('RSI');

  // Paper trading state
  const [paperBalance, setPaperBalance] = useState(10000);
  const [paperPosition, setPaperPosition] = useState(0); // 0 means flat, >0 means long
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  const saveKeys = () => {
    localStorage.setItem('btc-monitor-api-key', apiKey);
    localStorage.setItem('btc-monitor-api-secret', apiSecret);
    addLog('API keys saved locally.');
  };

  const toggleBot = () => {
    if (!isActive) {
      if (mode === 'REAL' && (!apiKey || !apiSecret)) {
        alert('실전 투자를 위해서는 API 키를 입력해야 합니다.');
        return;
      }
      addLog(`${exchange}에서 ${coin} 봇이 ${mode} 모드로 시작되었습니다. (${strategy} 전략)`);
    } else {
      addLog('봇이 중지되었습니다.');
    }
    setIsActive(!isActive);
  };

  // Mock bot logic loop
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      // In a real scenario, this would fetch latest kline, run indicators, and place real orders.
      // Here we just mock paper trading randomly for demonstration.
      const currentPrice = 65000 + Math.random() * 1000;

      if (Math.random() > 0.9) {
        if (paperPosition === 0) {
          // Buy
          const qty = paperBalance / currentPrice;
          setPaperPosition(qty);
          setPaperBalance(0);
          addLog(`PAPER BUY at $${currentPrice.toFixed(2)}`);
        } else {
          // Sell
          const newBalance = paperPosition * currentPrice;
          const pnl = newBalance - 10000;
          setPaperBalance(newBalance);
          setPaperPosition(0);
          addLog(`PAPER SELL at $${currentPrice.toFixed(2)} | PnL: $${pnl.toFixed(2)}`);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isActive, paperPosition, paperBalance]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px' }}>

      {/* Mode Selection */}
      <h3 style={{ margin: 0, fontSize: '14px', color: mode === 'PAPER' ? '#60a5fa' : '#ef5350' }}>
        자동 매매 설정 ({exchange})
      </h3>

      {/* Mode Selection */}
      <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
        <button
          onClick={() => setMode('PAPER')}
          style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: mode === 'PAPER' ? '#60a5fa' : 'transparent', color: 'white', fontWeight: mode === 'PAPER' ? 'bold' : 'normal' }}
        >
          모의 투자 (Paper)
        </button>
        <button
          onClick={() => setMode('REAL')}
          style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: mode === 'REAL' ? '#ef5350' : 'transparent', color: 'white', fontWeight: mode === 'REAL' ? 'bold' : 'normal' }}
        >
          실전 투자 (Real)
        </button>
      </div>

      {/* Real Trading API Keys Input */}
      {mode === 'REAL' && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#f87171' }}>⚠️ API 키는 로컬에만 저장됩니다. 실전 투자는 위험을 동반합니다.</p>
          <input
            type="text"
            placeholder={`${exchange} API Key`}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: 'none', background: 'rgba(0,0,0,0.2)', color: 'white' }}
          />
          <input
            type="password"
            placeholder={`${exchange} API Secret`}
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: 'none', background: 'rgba(0,0,0,0.2)', color: 'white' }}
          />
          <button onClick={saveKeys} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}>
            저장 (Save Keys)
          </button>
        </div>
      )}

      {/* Settings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>전략 (Strategy)</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '6px', borderRadius: '4px' }}
          >
            <option value="RSI">RSI (30/70)</option>
            <option value="MACD">MACD Cross</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>주문 수량 (Trade Size)</label>
          <input
            type="text"
            defaultValue="100%"
            disabled
            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: 'none', background: 'rgba(0,0,0,0.2)', color: 'gray' }}
          />
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={toggleBot}
        style={{
          background: isActive ? '#ef5350' : '#26a69a',
          color: 'white',
          border: 'none',
          padding: '12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '16px'
        }}
      >
        {isActive ? '봇 중지 (STOP BOT)' : '봇 시작 (START BOT)'}
      </button>

      {/* Paper Trading Status */}
      {mode === 'PAPER' && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '10px', opacity: 0.6 }}>모의 잔고 (Paper Balance)</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>${paperBalance.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', opacity: 0.6 }}>보유량 ({coin})</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{paperPosition.toFixed(4)}</div>
          </div>
        </div>
      )}

      {/* Logs */}
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', height: '100px', overflowY: 'auto', fontSize: '10px', fontFamily: 'monospace' }}>
        {logs.map((log, i) => <div key={i} style={{ marginBottom: '2px', opacity: 0.8 }}>{log}</div>)}
        {logs.length === 0 && <span style={{ opacity: 0.5 }}>No activity...</span>}
      </div>

    </div>
  );
};

export default TradingWidget;
