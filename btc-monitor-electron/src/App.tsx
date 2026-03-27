import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
  const [showSettings, setShowSettings] = useState(false);

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
      // CoinTelegraph RSS via rss2json
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
    const newsInterval = setInterval(fetchNews, 300000); // 5 mins

    // Tray Settings Listeners
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
  }, []);

  const openLink = (url: string) => {
    if (url && url !== '#') {
      shell.openExternal(url);
    }
  };

  const getPriceColor = (current: string, prev: string) => {
    if (parseFloat(current) > parseFloat(prev)) return '#f87171'; // Red (상승)
    if (parseFloat(current) < parseFloat(prev)) return '#60a5fa'; // Blue (하락)
    return '#ffffff';
  };

  const gap = (parseFloat(prices.bybit) - parseFloat(prices.binance)).toFixed(1);

  return (
    <div 
      style={{
        background: `rgba(20, 20, 20, ${opacity})`,
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        padding: showNews ? '12px' : '16px 12px',
        color: 'white',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '8px', WebkitAppRegion: 'no-drag' as any }}>
        <button onClick={() => ipcRenderer.send('window-minimize')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '12px', opacity: 0.6 }}>—</button>
        <button onClick={() => ipcRenderer.send('window-close')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '12px', opacity: 0.6 }}>✕</button>
      </div>

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

      <>
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
        <style>{`
          @keyframes scroll-left {
            from { transform: translateX(0); }
            to { transform: translateX(-100%); }
          }
          .news-container:hover .news-ticker {
            animation-play-state: paused;
          }
        `}</style>
      </>
    </div>
  );
};

export default App;
