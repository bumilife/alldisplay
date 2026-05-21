import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import axios from 'axios';

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

interface Props {
  coin: string;
  exchange: string;
}

const { ipcRenderer } = (window as any).require('electron');

const ChartWidget: React.FC<Props> = ({ coin, exchange }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<any>(null);
  const [candlestickSeries, setCandlestickSeries] = useState<any>(null);
  const [sma10Series, setSma10Series] = useState<any>(null);
  const [sma30Series, setSma30Series] = useState<any>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const newChart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 350,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const newCandleSeries = newChart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const newSma10 = newChart.addLineSeries({ color: '#2962FF', lineWidth: 1, title: 'SMA 10' });
    const newSma30 = newChart.addLineSeries({ color: '#FF6D00', lineWidth: 1, title: 'SMA 30' });

    setChart(newChart);
    setCandlestickSeries(newCandleSeries);
    setSma10Series(newSma10);
    setSma30Series(newSma30);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      newChart.remove();
    };
  }, []);

  useEffect(() => {
    if (!candlestickSeries) return;

    const calculateSMA = (data: any[], period: number) => {
      const smaData = [];
      for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += data[i - j].close;
        smaData.push({ time: data[i].time, value: sum / period });
      }
      return smaData;
    };

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const ohlcv = await ipcRenderer.invoke('ccxt-fetch-ohlcv', {
          exchange: exchange.toLowerCase(),
          symbol: coin,
          timeframe: timeframe,
          limit: 500
        });

        const data = ohlcv.map((d: any) => ({
          time: d[0] / 1000,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));

        candlestickSeries.setData(data);

        if (sma10Series && sma30Series) {
          sma10Series.setData(calculateSMA(data, 10));
          sma30Series.setData(calculateSMA(data, 30));
        }

      } catch (error) {
        console.error(`Error fetching chart data from ${exchange}:`, error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Polling using CCXT
    const interval = setInterval(async () => {
      try {
        const ohlcv = await ipcRenderer.invoke('ccxt-fetch-ohlcv', {
          exchange: exchange.toLowerCase(),
          symbol: coin,
          timeframe: timeframe,
          limit: 1
        });

        if (ohlcv && ohlcv.length > 0) {
          const d = ohlcv[0];
          candlestickSeries.update({
            time: d[0] / 1000,
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
          });
        }
      } catch (error) {
        console.error('Error fetching real-time chart data:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [candlestickSeries, sma10Series, sma30Series, timeframe, coin, exchange]);

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {timeframes.map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            style={{
              background: timeframe === tf ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
              border: 'none',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {tf}
          </button>
        ))}
        {isLoading && <span style={{ fontSize: '12px', color: 'gray', alignSelf: 'center', marginLeft: '8px' }}>Loading...</span>}
      </div>
      <div ref={chartContainerRef} style={{ width: '100%', height: '350px' }} />
    </div>
  );
};

export default ChartWidget;
