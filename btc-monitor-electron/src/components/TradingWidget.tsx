import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { RSI } from 'technicalindicators';

type TradingMode = 'PAPER' | 'REAL';

interface Props {
  coin: string;
  exchange: string;
}

const TradingWidget: React.FC<Props> = ({ coin, exchange }) => {
  const [mode, setMode] = useState<TradingMode>('PAPER');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  // AI Auto-Reflection States
  const [aiEnabled, setAiEnabled] = useState(localStorage.getItem('btc-monitor-ai-enabled') === 'true');
  const [openaiKey, setOpenaiKey] = useState('');
  const [reflectionPeriod, setReflectionPeriod] = useState('1d'); // Default 1 day
  const [showReflectionLog, setShowReflectionLog] = useState(false);
  const [reflectionLogs, setReflectionLogs] = useState<string[]>([]);
  const [currentParameters, setCurrentParameters] = useState({ rsiPeriod: 14, rsiBuy: 30, rsiSell: 70 });

  const [isActive, setIsActive] = useState(false);
  const [strategy, setStrategy] = useState('RSI');

  // Paper trading state
  const [paperBalance, setPaperBalance] = useState(10000);
  const [paperPosition, setPaperPosition] = useState(0); // 0 means flat, >0 means long
  const [logs, setLogs] = useState<string[]>([]);

  // Real-time tracking
  const pricesRef = useRef<number[]>([]);

  const { ipcRenderer } = (window as any).require('electron');

  useEffect(() => {
    const loadKeys = async () => {
      const encKey = localStorage.getItem(`btc-monitor-api-key-${exchange}`);
      const encSecret = localStorage.getItem(`btc-monitor-api-secret-${exchange}`);
      const encOpenai = localStorage.getItem('btc-monitor-openai-key');

      if (encKey) setApiKey(await ipcRenderer.invoke('decrypt-data', encKey));
      if (encSecret) setApiSecret(await ipcRenderer.invoke('decrypt-data', encSecret));
      if (encOpenai) setOpenaiKey(await ipcRenderer.invoke('decrypt-data', encOpenai));
    };
    loadKeys();
  }, [exchange, ipcRenderer]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  const saveKeys = async () => {
    const encKey = await ipcRenderer.invoke('encrypt-data', apiKey);
    const encSecret = await ipcRenderer.invoke('encrypt-data', apiSecret);
    const encOpenai = await ipcRenderer.invoke('encrypt-data', openaiKey);

    localStorage.setItem(`btc-monitor-api-key-${exchange}`, encKey);
    localStorage.setItem(`btc-monitor-api-secret-${exchange}`, encSecret);
    localStorage.setItem('btc-monitor-openai-key', encOpenai);
    addLog('API 키가 안전하게 암호화되어 로컬에 저장되었습니다.');
  };

  const toggleAi = () => {
    const newVal = !aiEnabled;
    setAiEnabled(newVal);
    localStorage.setItem('btc-monitor-ai-enabled', newVal.toString());
  };

  const addReflectionLog = (msg: string) => {
    setReflectionLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  };

  const runBackgroundOptimization = async () => {
    try {
      // Fetch real historical data for optimization (last 500 candles of 15m)
      const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, {
        params: { symbol: `${coin}USDT`, interval: '15m', limit: 500 }
      });
      const closes = res.data.map((d: any) => parseFloat(d[4]));

      let bestParams = { rsiPeriod: 14, rsiBuy: 30, rsiSell: 70 };
      let bestPnL = -Infinity;

      // Simple brute force optimization over a small parameter grid
      const periods = [10, 14, 20];
      const buys = [25, 30, 35];
      const sells = [65, 70, 75];

      for (const p of periods) {
        const rsiVals = RSI.calculate({ values: closes, period: p });
        const fullRsi = [...Array(p).fill(50), ...rsiVals];

        for (const b of buys) {
          for (const s of sells) {
            let bal = 10000, pos = 0;
            for (let i = p; i < closes.length; i++) {
              if (fullRsi[i] < b && pos === 0) {
                pos = bal / closes[i];
                bal = 0;
              } else if (fullRsi[i] > s && pos > 0) {
                bal = pos * closes[i];
                pos = 0;
              }
            }
            if (pos > 0) bal = pos * closes[closes.length - 1];

            const pnl = bal - 10000;
            if (pnl > bestPnL) {
              bestPnL = pnl;
              bestParams = { rsiPeriod: p, rsiBuy: b, rsiSell: s };
            }
          }
        }
      }
      return bestParams;
    } catch (e) {
      console.error('Optimization error:', e);
      // Fallback
      return { rsiPeriod: 14, rsiBuy: 30, rsiSell: 70 };
    }
  };

  const evaluateAndReflect = async (lossAmount: number) => {
    if (!aiEnabled || !openaiKey) {
      addReflectionLog(`손실 감지 ($${lossAmount.toFixed(2)}). AI 회고가 꺼져있어 계속 진행합니다.`);
      return;
    }

    setIsActive(false); // Pause bot
    addReflectionLog(`손실 감지 ($${lossAmount.toFixed(2)}). 봇을 일시정지하고 AI 회고를 시작합니다...`);

    try {
      addReflectionLog('백그라운드 파라미터 최적화 진행 중...');
      const optimizedParams: any = await runBackgroundOptimization();

      addReflectionLog('OpenAI API를 통한 시장 상황 분석 요청...');

      // Call OpenAI API
      const prompt = `
        현재 암호화폐 거래 봇이 손실을 기록했습니다.
        코인: ${coin}
        최근 손실액: $${lossAmount.toFixed(2)}
        현재 파라미터: RSI Buy ${currentParameters.rsiBuy}, RSI Sell ${currentParameters.rsiSell}
        백그라운드 최적화로 찾은 새 파라미터 후보: RSI Buy ${optimizedParams.rsiBuy}, RSI Sell ${optimizedParams.rsiSell}

        새로운 파라미터를 적용하는 것이 좋을지, 아니면 시장의 변동성이 너무 커서 봇을 계속 정지시켜야 할지 1~2문장으로 조언해주고,
        마지막 줄에 반드시 "결정: 적용" 또는 "결정: 정지" 라고 적어주세요.
      `;

      // NOTE: Using a real OpenAI API call here.
      // Handled errors gracefully if key is invalid.
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150
        })
      });

      if (!res.ok) {
        throw new Error('OpenAI API 호출 실패 (키 확인 필요)');
      }

      const data = await res.json();
      const aiResponse = data.choices[0].message.content;

      addReflectionLog(`[AI 분석] ${aiResponse}`);

      if (aiResponse.includes('적용')) {
        setCurrentParameters(optimizedParams);
        addReflectionLog(`새로운 파라미터로 업데이트 됨: Buy ${optimizedParams.rsiBuy}, Sell ${optimizedParams.rsiSell}`);
        addReflectionLog('봇을 자동으로 재시작합니다.');
        setIsActive(true);
      } else {
        addReflectionLog('AI의 판단에 따라 봇 작동을 계속 중지 상태로 유지합니다.');
      }

    } catch (error: any) {
      addReflectionLog(`AI 회고 중 오류 발생: ${error.message}`);
      addReflectionLog('봇 작동을 중지 상태로 유지합니다.');
    }
  };

  const toggleBot = () => {
    if (!isActive) {
      if (mode === 'REAL' && (!apiKey || !apiSecret)) {
        alert('실전 투자를 위해서는 API 키를 입력해야 합니다.');
        return;
      }
      addLog(`${exchange}에서 ${coin} 봇이 ${mode} 모드로 시작되었습니다. (전략: ${strategy}, 설정: Buy ${currentParameters.rsiBuy} Sell ${currentParameters.rsiSell})`);
    } else {
      addLog('봇이 중지되었습니다.');
    }
    setIsActive(!isActive);
  };

  // Real Data Bot Loop
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${coin}USDT`);
        const currentPrice = parseFloat(res.data.price);

        // Track recent prices for RSI calculation
        pricesRef.current.push(currentPrice);
        if (pricesRef.current.length > 50) pricesRef.current.shift(); // keep last 50 prices

        if (pricesRef.current.length > currentParameters.rsiPeriod) {
          const rsiVals = RSI.calculate({ values: pricesRef.current, period: currentParameters.rsiPeriod });
          const currentRSI = rsiVals[rsiVals.length - 1];

          if (currentRSI < currentParameters.rsiBuy && paperPosition === 0) {
             if (mode === 'PAPER') {
               const qty = paperBalance / currentPrice;
               setPaperPosition(qty);
               setPaperBalance(0);
               addLog(`매수 (PAPER) at $${currentPrice.toFixed(2)} (RSI: ${currentRSI.toFixed(1)})`);
             } else {
               // Placeholder for Real Order Execution using CCXT or direct REST
               // await placeRealOrder('BUY', currentPrice);
               addLog(`실전 매수 주문 전송 시도: ${currentPrice.toFixed(2)}`);
             }
          } else if (currentRSI > currentParameters.rsiSell && paperPosition > 0) {
             if (mode === 'PAPER') {
               const newBalance = paperPosition * currentPrice;
               const pnl = newBalance - 10000;
               setPaperBalance(newBalance);
               setPaperPosition(0);
               addLog(`매도 (PAPER) at $${currentPrice.toFixed(2)} | PnL: $${pnl.toFixed(2)} (RSI: ${currentRSI.toFixed(1)})`);
               if (pnl < 0 && newBalance < 10000) evaluateAndReflect(Math.abs(pnl));
             } else {
               // await placeRealOrder('SELL', currentPrice);
               addLog(`실전 매도 주문 전송 시도: ${currentPrice.toFixed(2)}`);
             }
          }
        }
      } catch (err) {
        console.error("Error fetching price for bot:", err);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [isActive, paperPosition, paperBalance, aiEnabled, openaiKey, currentParameters, coin]);

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

      {/* API Keys Input */}
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {mode === 'REAL' && (
          <>
            <p style={{ margin: 0, fontSize: '12px', color: '#f87171' }}>⚠️ 거래소 API 키는 로컬에만 저장됩니다.</p>
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
          </>
        )}

        <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#60a5fa' }}>🧠 AI 자동 회고를 위한 OpenAI 키 (선택사항)</p>
        <input
          type="password"
          placeholder="OpenAI API Key (sk-...)"
          value={openaiKey}
          onChange={(e) => setOpenaiKey(e.target.value)}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: 'none', background: 'rgba(0,0,0,0.2)', color: 'white' }}
        />
        <button onClick={saveKeys} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '6px', borderRadius: '4px', cursor: 'pointer', marginTop: '4px' }}>
          설정 저장
        </button>
      </div>

      {/* AI Auto-Reflection Settings */}
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: aiEnabled ? '#26a69a' : 'gray' }}>
            {aiEnabled ? '✅ AI 자동 회고 켜짐' : '❌ AI 자동 회고 꺼짐'}
          </label>
          <button onClick={toggleAi} style={{ background: aiEnabled ? '#ef5350' : '#26a69a', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>
            {aiEnabled ? '끄기' : '켜기'}
          </button>
        </div>

        {aiEnabled && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '11px', opacity: 0.8 }}>손실 감지 기준 기간:</label>
            <select
              value={reflectionPeriod}
              onChange={(e) => setReflectionPeriod(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.2)', color: 'white', border: 'none', padding: '4px', borderRadius: '4px', fontSize: '11px' }}
            >
              <option value="1h">1시간</option>
              <option value="4h">4시간</option>
              <option value="1d">1일 (디폴트)</option>
              <option value="1w">1주</option>
            </select>
          </div>
        )}
      </div>

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

      {/* Reflection & Logs Toggle */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => setShowReflectionLog(false)} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: 'none', background: !showReflectionLog ? 'rgba(255,255,255,0.1)' : 'transparent', color: 'white', fontSize: '11px', cursor: 'pointer' }}>거래 로그</button>
        <button onClick={() => setShowReflectionLog(true)} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: 'none', background: showReflectionLog ? 'rgba(255,255,255,0.1)' : 'transparent', color: 'white', fontSize: '11px', cursor: 'pointer' }}>회고 로그 (AI)</button>
      </div>

      {/* Logs View */}
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', height: '100px', overflowY: 'auto', fontSize: '10px', fontFamily: 'monospace' }}>
        {!showReflectionLog ? (
          <>
            {logs.map((log, i) => <div key={i} style={{ marginBottom: '2px', opacity: 0.8 }}>{log}</div>)}
            {logs.length === 0 && <span style={{ opacity: 0.5 }}>거래 기록이 없습니다...</span>}
          </>
        ) : (
          <>
            {reflectionLogs.map((log, i) => <div key={i} style={{ marginBottom: '2px', color: '#60a5fa' }}>{log}</div>)}
            {reflectionLogs.length === 0 && <span style={{ opacity: 0.5 }}>AI 회고 기록이 없습니다...</span>}
          </>
        )}
      </div>

    </div>
  );
};

export default TradingWidget;
