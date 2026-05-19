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
  const [prices, setPrices] = useState({ binance: '0', bybit: '0', bitget: '0' });
  const [prevPrices, setPrevPrices] = useState({ binance: '0', bybit: '0', bitget: '0' });
  const [news, setNews] = useState<NewsItem[]>([{ title: 'Fetching news...', link: '#' }]);
  const [opacity, setOpacity] = useState(
    parseFloat(localStorage.getItem('btc-monitor-opacity') || '0.75')
  );
  const [showNews, setShowNews] = useState(
    localStorage.getItem('btc-monitor-show-news') !== 'false'
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'BINANCE' | 'BYBIT' | 'BITGET'>('BINANCE');

  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [allCoins, setAllCoins] = useState<string[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  useEffect(() => {
    const fetchCoins = async () => {
      try {
        const res = await axios.get('https://fapi.binance.com/fapi/v1/exchangeInfo');
        const symbols = res.data.symbols
          .filter((s: any) => s.quoteAsset === 'USDT' && s.status === 'TRADING')
          .map((s: any) => s.baseAsset);
        setAllCoins(Array.from(new Set(symbols)) as string[]);
      } catch (error) {
        console.error('Error fetching coin list:', error);
      }
    };
    fetchCoins();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setSearchResults(allCoins.filter(c => c.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5));
      setShowSearchDropdown(true);
    } else {
      setShowSearchDropdown(false);
    }
  }, [searchQuery, allCoins]);

  const fetchPrices = async () => {
    try {
      const symbol = `${selectedCoin}USDT`;
      const [binanceRes, bybitRes, bitgetRes] = await Promise.all([
        axios.get(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`).catch(() => ({ data: { price: '0' } })),
        axios.get(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`).catch(() => ({ data: { result: { list: [{ lastPrice: '0' }] } } })),
        axios.get(`https://api.bitget.com/api/v2/mix/market/ticker?productType=USDT-FUTURES&symbol=${symbol}`).catch(() => ({ data: { data: [{ lastPr: '0' }] } }))
      ]);

      setPrevPrices(prices);
      setPrices({
        binance: parseFloat(binanceRes.data.price).toFixed(2),
        bybit: parseFloat(bybitRes.data.result.list[0]?.lastPrice || 0).toFixed(2),
        bitget: parseFloat(bitgetRes.data.data[0]?.lastPr || 0).toFixed(2)
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
  }, [prices, selectedCoin]);

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

  const validPrices = [parseFloat(prices.binance), parseFloat(prices.bybit), parseFloat(prices.bitget)].filter(p => p > 0);
  const maxPrice = validPrices.length ? Math.max(...validPrices) : 0;
  const minPrice = validPrices.length ? Math.min(...validPrices) : 0;
  const gap = (maxPrice - minPrice).toFixed(1);

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
      {/* HEADER SECTION (Tabs + Coin Search) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: isExpanded ? '16px' : '8px', WebkitAppRegion: 'drag' as any, alignItems: 'center' }}>
        <button onClick={() => setActiveTab('BINANCE')} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: 'none', background: activeTab === 'BINANCE' ? '#60a5fa' : 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontWeight: activeTab === 'BINANCE' ? 'bold' : 'normal', WebkitAppRegion: 'no-drag' as any }}>BINANCE</button>
        <button onClick={() => setActiveTab('BYBIT')} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: 'none', background: activeTab === 'BYBIT' ? '#60a5fa' : 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontWeight: activeTab === 'BYBIT' ? 'bold' : 'normal', WebkitAppRegion: 'no-drag' as any }}>BYBIT</button>
        <button onClick={() => setActiveTab('BITGET')} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: 'none', background: activeTab === 'BITGET' ? '#60a5fa' : 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontWeight: activeTab === 'BITGET' ? 'bold' : 'normal', WebkitAppRegion: 'no-drag' as any }}>BITGET</button>
      </div>

      <div style={{ position: 'relative', marginBottom: '8px', WebkitAppRegion: 'no-drag' as any }}>
        <input
          type="text"
          placeholder="코인 검색 (예: BTC, ETH)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => { if(searchQuery) setShowSearchDropdown(true); }}
          onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
          style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: 'none', background: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none' }}
        />
        {showSearchDropdown && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#2a2e39', borderRadius: '4px', zIndex: 20, maxHeight: '150px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', marginTop: '4px' }}>
            {searchResults.map(coin => (
              <div
                key={coin}
                onClick={() => { setSelectedCoin(coin); setSearchQuery(''); setShowSearchDropdown(false); }}
                style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {coin}
              </div>
            ))}
          </div>
        )}
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px', WebkitAppRegion: 'drag' as any }}>
            <div style={{ fontSize: '12px', opacity: 0.8, fontWeight: 500 }}>BITGET</div>
            <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace', color: getPriceColor(prices.bitget, prevPrices.bitget) }}>
              {prices.bitget}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', alignItems: 'center' }}>
            <div style={{ fontSize: '10px', opacity: 0.6 }}>{selectedCoin}</div>
            <div style={{ fontSize: '10px', textAlign: 'right', color: '#ef5350', fontWeight: 600 }}>
              GAP: {gap}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', gap: '8px', WebkitAppRegion: 'no-drag' as any }}>
            <button onClick={toggleExpand} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>▶ 펼치기</button>
            <button onClick={() => ipcRenderer.send('window-close')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>✕ 닫기</button>
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', WebkitAppRegion: 'no-drag' as any }}>

          {/* Main Price Header for Active Tab */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', opacity: 0.8, fontWeight: 'bold' }}>{selectedCoin}/USDT ({activeTab})</div>
            <div style={{ fontSize: '32px', fontWeight: 800, fontFamily: 'monospace', color: getPriceColor(prices[activeTab.toLowerCase() as keyof typeof prices], prevPrices[activeTab.toLowerCase() as keyof typeof prevPrices]) }}>
              {prices[activeTab.toLowerCase() as keyof typeof prices]}
            </div>
            <div style={{ fontSize: '12px', color: '#ef5350' }}>최대 가격 갭(GAP): {gap}</div>
          </div>

          {/* Main Layout Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', flex: 1, overflow: 'hidden' }}>
            {/* Left Side: Chart & Backtest */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              <ChartWidget coin={selectedCoin} />
              <BacktestWidget coin={selectedCoin} exchange={activeTab} />
            </div>

            {/* Right Side: Trade */}
            <div style={{ overflowY: 'auto', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '16px' }}>
               <TradingWidget coin={selectedCoin} exchange={activeTab} />
            </div>
          </div>

          <button onClick={toggleExpand} style={{ alignSelf: 'center', marginTop: '16px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
            ▼ 위젯으로 돌아가기
          </button>
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
