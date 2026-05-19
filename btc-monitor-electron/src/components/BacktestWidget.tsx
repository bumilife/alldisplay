import React, { useState } from 'react';
import axios from 'axios';
import { RSI, MACD, SMA } from 'technicalindicators';

type Strategy = 'RSI' | 'MACD' | 'SMA_CROSS';
type Period = '1h' | '4h' | '8h' | '1d' | '1w' | '1M';

const BacktestWidget: React.FC = () => {
  const [strategy, setStrategy] = useState<Strategy>('RSI');
  const [period, setPeriod] = useState<Period>('1d');
  const [timeframe, setTimeframe] = useState<'1m'|'5m'|'15m'>('15m');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const getLimitByPeriod = (p: Period, tf: string) => {
    // Rough estimation of how many candles we need.
    // e.g., 1 day of 15m candles = 24 * 4 = 96
    const multiplier = tf === '1m' ? 60 : (tf === '5m' ? 12 : 4);
    switch (p) {
      case '1h': return multiplier;
      case '4h': return multiplier * 4;
      case '8h': return multiplier * 8;
      case '1d': return multiplier * 24;
      case '1w': return multiplier * 24 * 7;
      case '1M': return Math.min(multiplier * 24 * 30, 1000); // Binance max is usually 1000 for standard klines
    }
  };

  const runBacktest = async () => {
    setIsLoading(true);
    setResults(null);
    try {
      const limit = getLimitByPeriod(period, timeframe);
      const response = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, {
        params: {
          symbol: 'BTCUSDT',
          interval: timeframe,
          limit: limit,
        }
      });

      const closes = response.data.map((d: any) => parseFloat(d[4]));

      let signals: ('BUY'|'SELL'|'HOLD')[] = [];

      if (strategy === 'RSI') {
        const rsiValues = RSI.calculate({ values: closes, period: 14 });
        // Padding for the initial 14 periods where RSI is not calculated
        const pad = Array(14).fill(50);
        const fullRsi = [...pad, ...rsiValues];

        signals = fullRsi.map(val => {
          if (val < 30) return 'BUY';
          if (val > 70) return 'SELL';
          return 'HOLD';
        });
      } else if (strategy === 'MACD') {
        const macdValues = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
        const pad = Array(26).fill({ MACD: 0, signal: 0, histogram: 0 });
        const fullMacd = [...pad, ...macdValues];

        for (let i = 0; i < fullMacd.length; i++) {
          if (i === 0) { signals.push('HOLD'); continue; }
          const prev = fullMacd[i-1];
          const curr = fullMacd[i];
          if (prev.MACD < prev.signal && curr.MACD > curr.signal) signals.push('BUY');
          else if (prev.MACD > prev.signal && curr.MACD < curr.signal) signals.push('SELL');
          else signals.push('HOLD');
        }
      } else if (strategy === 'SMA_CROSS') {
        const shortSma = SMA.calculate({ values: closes, period: 10 });
        const longSma = SMA.calculate({ values: closes, period: 30 });

        const padShort = Array(10).fill(0);
        const padLong = Array(30).fill(0);

        const fullShort = [...padShort, ...shortSma];
        const fullLong = [...padLong, ...longSma];

        for (let i = 0; i < closes.length; i++) {
          if (i === 0 || i < 30) { signals.push('HOLD'); continue; }
          const prevS = fullShort[i-1], currS = fullShort[i];
          const prevL = fullLong[i-1], currL = fullLong[i];

          if (prevS <= prevL && currS > currL) signals.push('BUY');
          else if (prevS >= prevL && currS < currL) signals.push('SELL');
          else signals.push('HOLD');
        }
      }

      // Simulate trading
      let balance = 10000; // Starting with $10,000
      let position = 0; // BTC holding
      let trades = 0;
      let wins = 0;

      for (let i = 0; i < signals.length; i++) {
        const price = closes[i];
        if (signals[i] === 'BUY' && position === 0) {
          position = balance / price;
          balance = 0;
          trades++;
        } else if (signals[i] === 'SELL' && position > 0) {
          const newBalance = position * price;
          if (newBalance > 10000) wins++; // Simplified win logic
          balance = newBalance;
          position = 0;
        }
      }

      // Force close at end
      if (position > 0) {
        balance = position * closes[closes.length - 1];
        position = 0;
      }

      const pnl = balance - 10000;
      const winRate = trades > 0 ? ((wins / trades) * 100).toFixed(2) : '0.00';

      setResults({
        finalBalance: balance.toFixed(2),
        pnl: pnl.toFixed(2),
        winRate,
        trades
      });

    } catch (error) {
      console.error('Error in backtest:', error);
      alert('Backtest failed. Check console.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>Strategy</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as Strategy)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '6px', borderRadius: '4px' }}
          >
            <option value="RSI">RSI (30/70)</option>
            <option value="MACD">MACD Cross</option>
            <option value="SMA_CROSS">SMA Cross (10/30)</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '6px', borderRadius: '4px' }}
          >
            <option value="1h">1 Hour</option>
            <option value="4h">4 Hours</option>
            <option value="8h">8 Hours</option>
            <option value="1d">1 Day</option>
            <option value="1w">1 Week</option>
            <option value="1M">1 Month</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>Candle Timeframe</label>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '6px', borderRadius: '4px' }}
          >
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
          </select>
        </div>
      </div>

      <button
        onClick={runBacktest}
        disabled={isLoading}
        style={{
          background: '#26a69a',
          color: 'white',
          border: 'none',
          padding: '10px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold',
          opacity: isLoading ? 0.7 : 1
        }}
      >
        {isLoading ? 'Running Backtest...' : 'Run Backtest'}
      </button>

      {results && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Results (Initial: $10,000)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
            <div>Final Balance:</div>
            <div style={{ fontWeight: 'bold' }}>${results.finalBalance}</div>

            <div>PnL:</div>
            <div style={{ fontWeight: 'bold', color: parseFloat(results.pnl) >= 0 ? '#26a69a' : '#ef5350' }}>
              ${results.pnl}
            </div>

            <div>Win Rate:</div>
            <div style={{ fontWeight: 'bold' }}>{results.winRate}%</div>

            <div>Total Trades:</div>
            <div style={{ fontWeight: 'bold' }}>{results.trades}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BacktestWidget;
