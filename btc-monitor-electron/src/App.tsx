import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Expand, Shrink, X, Minus, Activity, Briefcase, Settings } from 'lucide-react';
import ChartWidget from './components/ChartWidget';
import BacktestWidget from './components/BacktestWidget';
import TradingWidget from './components/TradingWidget';

const { ipcRenderer, shell } = (window as any).require('electron');

interface NewsItem {
  title: string;
  link: string;
}

const App: React.FC = () => {
  const [prices, setPrices] = useState({ binance: '0', bybit: '0' });
  const [prevPrices, setPrevPrices] = useState({ binance: '0', bybit: '0' });
  const [news, setNews] = useState<NewsItem[]>([{ title: 'Fetching news...', link: '#' }]);
  const [opacity, setOpacity] = useState(
    parseFloat(localStorage.getItem('btc-monitor-opacity') || '0.75')
  );
  const [showNews, setShowNews] = useState(
    localStorage.getItem('btc-monitor-show-news') !== 'false'
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'backtest' | 'trade'>('chart');

  const fetchPrices = async () => {
    try {
      const [binanceRes, bybitRes] = await Promise.all([
        axios.get('https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT'),
        axios.get('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT')
      ]);

      setPrevPrices(prices);
      setPrices({
        binance: parseFloat(binanceRes.data.price).toFixed(1),
        bybit: parseFloat(bybitRes.data.result.list[0].lastPrice).toFixed(1)
      });
    } catch (error) {
      console.error('Error fetching prices:', error);
    }
  };

  const fetchNews = async () => {
    try {
      const res = await axios.get('https://api.rss2json.com/v1/api.json?rss_url=https://cointelegraph.com/rss');
      const items = res.data.items.map((item: any) => ({
        title: item.title,
        link: item.link
      }));
      setNews(items);
    } catch (error) {
      console.error('Error fetching news:', error);
    }
  };

  useEffect(() => {
    fetchPrices();
    fetchNews();
    const priceInterval = setInterval(fetchPrices, 2000);
    const newsInterval = setInterval(fetchNews, 300000);

    const handleSetOpacity = (_event: any, val: number) => {
      setOpacity(val);
      localStorage.setItem('btc-monitor-opacity', val.toString());
    };
    const handleToggleNewsIpc = () => {
      setShowNews(prev => {
        const newVal = !prev;
        localStorage.setItem('btc-monitor-show-news', newVal.toString());
        return newVal;
      });
    };

    ipcRenderer.on('set-opacity', handleSetOpacity);
    ipcRenderer.on('toggle-news', handleToggleNewsIpc);

    return () => {
      clearInterval(priceInterval);
      clearInterval(newsInterval);
      ipcRenderer.removeListener('set-opacity', handleSetOpacity);
      ipcRenderer.removeListener('toggle-news', handleToggleNewsIpc);
    };
  }, [prices]); // Added prices to dependency to avoid stale closure for prevPrices, though it's fine.

  const toggleExpand = () => {
    if (isExpanded) {
      ipcRenderer.send('resize-window', 300, 120);
    } else {
      ipcRenderer.send('resize-window', 800, 600);
    }
    setIsExpanded(!isExpanded);
  };

  const openLink = (url: string) => {
    if (url && url !== '#') {
      shell.openExternal(url);
    }
  };

  const getPriceColor = (current: string, prev: string) => {
    if (parseFloat(current) > parseFloat(prev)) return '#f87171'; // Red
    if (parseFloat(current) < parseFloat(prev)) return '#60a5fa'; // Blue
    return '#ffffff';
  };

  const gap = (parseFloat(prices.bybit) - parseFloat(prices.binance)).toFixed(1);

  return (
    <div 
      style={{
        background: `rgba(20, 20, 20, ${opacity})`,
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        padding: isExpanded ? '16px' : (showNews ? '12px' : '16px 12px'),
        color: 'white',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        boxSizing: 'border-box',
        position: 'relative',
        transition: 'all 0.3s ease',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '8px', WebkitAppRegion: 'no-drag' as any, zIndex: 10 }}>
        <button onClick={toggleExpand} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.6 }}>
          {isExpanded ? <Shrink size={14} /> : <Expand size={14} />}
        </button>
        <button onClick={() => ipcRenderer.send('window-minimize')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.6 }}>
          <Minus size={14} />
        </button>
        <button onClick={() => ipcRenderer.send('window-close')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.6 }}>
          <X size={14} />
        </button>
      </div>

      {!isExpanded ? (
        // --- COMPACT VIEW ---
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', WebkitAppRegion: 'drag' as any }}>
            <div style={{ fontSize: '12px', opacity: 0.8, fontWeight: 500 }}>BINANCE</div>
            <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace', color: getPriceColor(prices.binance, prevPrices.binance) }}>
              {prices.binance}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px', WebkitAppRegion: 'drag' as any }}>
            <div style={{ fontSize: '12px', opacity: 0.8, fontWeight: 500 }}>BYBIT</div>
            <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace', color: getPriceColor(prices.bybit, prevPrices.bybit) }}>
              {prices.bybit}
            </div>
          </div>

          <div style={{
            marginTop: '8px',
            fontSize: '10px',
            textAlign: 'right',
            color: parseFloat(gap) >= 0 ? '#f87171' : '#60a5fa',
            fontWeight: 600,
            marginBottom: showNews ? '4px' : '0'
          }}>
            GAP: {gap}
          </div>

          {showNews && (
            <div className="news-container" style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '4px',
              padding: '4px',
              fontSize: '9px',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              position: 'relative',
              height: '14px',
              WebkitAppRegion: 'no-drag' as any
            }}>
              <div className="news-ticker" style={{
                display: 'inline-block',
                animation: 'scroll-left 40s linear infinite',
                paddingLeft: '100%',
                cursor: 'pointer'
              }}>
                {news.map((item, idx) => (
                  <span
                    key={idx}
                    onClick={() => openLink(item.link)}
                    style={{ marginRight: '40px', transition: 'opacity 0.2s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    {item.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // --- EXPANDED DASHBOARD VIEW ---
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', WebkitAppRegion: 'no-drag' as any, paddingTop: '16px' }}>
          {/* Header Dashboard Status */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', WebkitAppRegion: 'drag' as any }}>
            <div>
              <div style={{ fontSize: '10px', opacity: 0.6 }}>Binance BTC/USDT</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: getPriceColor(prices.binance, prevPrices.binance) }}>{prices.binance}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', opacity: 0.6 }}>Bybit BTC/USDT</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: getPriceColor(prices.bybit, prevPrices.bybit) }}>{prices.bybit}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', opacity: 0.6 }}>Gap</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: parseFloat(gap) >= 0 ? '#f87171' : '#60a5fa' }}>{gap}</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
            <button
              onClick={() => setActiveTab('chart')}
              style={{ background: activeTab === 'chart' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Activity size={14} /> Chart
            </button>
            <button
              onClick={() => setActiveTab('backtest')}
              style={{ background: activeTab === 'backtest' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Activity size={14} /> Backtest
            </button>
            <button
              onClick={() => setActiveTab('trade')}
              style={{ background: activeTab === 'trade' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Briefcase size={14} /> Auto Trade
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'chart' && <ChartWidget />}
            {activeTab === 'backtest' && <BacktestWidget />}
            {activeTab === 'trade' && <TradingWidget />}
          </div>
        </div>
      )}

      <style>{`
        @keyframes scroll-left {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        .news-container:hover .news-ticker {
          animation-play-state: paused;
        }

        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
};

export default App;
