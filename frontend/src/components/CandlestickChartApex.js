// src/components/CandlestickChartApex.js - Updated with currency formatting
import React, { useState, useEffect, useRef } from 'react';
import ReactApexChart from 'react-apexcharts';
import { connectSocket } from '../services/socketService';
import axios from 'axios';
import './CandlestickChartApex.css';

const CandlestickChartApex = ({ symbol, interval = '5m' }) => {
  // Use refs to track socket and subscription status
  const socketRef = useRef(null);
  const isSubscribedRef = useRef(false);
  const signalsRef = useRef([]);
  const signalUpdateTimeoutRef = useRef(null);
  const isInitializedRef = useRef(false); // Track initialization
  
  const [series, setSeries] = useState([{
    name: 'candle',
    data: []
  }]);
  
  const [volumeSeries, setVolumeSeries] = useState([{
    name: 'volume',
    data: []
  }]);
  
  const [signals, setSignals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quoteAsset, setQuoteAsset] = useState('');
  const [baseAsset, setBaseAsset] = useState('');
  
  // Initialize options with default settings
  const [options, setOptions] = useState({
    chart: {
      type: 'candlestick',
      height: 350,
      id: 'candles',
      toolbar: {
        autoSelected: 'pan',
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        },
      },
      animations: {
        enabled: false
      },
      background: '#1e293b',
    },
    title: {
      text: `${symbol} Price Chart (${interval})`,
      align: 'left',
      style: {
        color: '#e2e8f0'
      }
    },
    annotations: {
      points: []
    },
    tooltip: {
      enabled: true,
      theme: 'dark'
    },
    grid: {
      borderColor: '#334155',
      strokeDashArray: 2,
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#4CAF50',
          downward: '#FF5252'
        },
        wick: {
          useFillColor: true,
        }
      },
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: '#e2e8f0'
        }
      },
      axisBorder: {
        color: '#475569'
      },
      axisTicks: {
        color: '#475569'
      }
    },
    yaxis: {
      tickAmount: 6,
      labels: {
        style: {
          colors: '#e2e8f0'
        },
        formatter: function(val) {
          return val.toFixed(8);
        }
      },
      tooltip: {
        enabled: true
      }
    },
    noData: {
      text: 'Loading chart data...',
      style: {
        color: '#e2e8f0',
        fontSize: '16px'
      }
    },
    theme: {
      mode: 'dark'
    }
  });
  
  // Fixed: Use regular constant instead of state for volumeOptions
  const volumeOptions = {
    chart: {
      height: 150,
      type: 'bar',
      id: 'volume',
      brush: {
        enabled: true,
        target: 'candles'
      },
      selection: {
        enabled: true
      },
      background: '#1e293b',
    },
    dataLabels: {
      enabled: false
    },
    plotOptions: {
      bar: {
        columnWidth: '80%',
        colors: {
          ranges: [{
            from: -1000,
            to: 0,
            color: '#F15B46'
          }, {
            from: 1,
            to: 10000,
            color: '#48bb78'
          }]
        },
      }
    },
    stroke: {
      width: 0
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: '#e2e8f0'
        }
      },
      axisBorder: {
        color: '#475569'
      },
      axisTicks: {
        color: '#475569'
      }
    },
    yaxis: {
      labels: {
        show: true,
        style: {
          colors: '#e2e8f0'
        }
      }
    },
    title: {
      text: 'Volume',
      align: 'left',
      style: {
        color: '#e2e8f0'
      }
    },
    grid: {
      borderColor: '#334155',
      strokeDashArray: 2,
    },
    tooltip: {
      theme: 'dark'
    },
    theme: {
      mode: 'dark'
    }
  };

  // Fetch symbol details when symbol changes
  useEffect(() => {
    const fetchSymbolDetails = async () => {
      try {
        const response = await axios.get('/api/market-data/pairs');
        const symbolInfo = response.data.find(pair => pair.symbol === symbol);
        
        if (symbolInfo) {
          setQuoteAsset(symbolInfo.quoteAsset);
          setBaseAsset(symbolInfo.baseAsset);
          
          // Update chart title and y-axis formatter
          const newOptions = { ...options };
          newOptions.title.text = `${symbolInfo.baseAsset}/${symbolInfo.quoteAsset} (${interval})`;
          
          // Set appropriate decimal precision based on quote asset
          let decimals = 8;
          let prefix = '';
          
          switch (symbolInfo.quoteAsset) {
            case 'USDT':
            case 'BUSD':
            case 'USDC':
            case 'USD':
            case 'DAI':
              decimals = 2;
              prefix = '$';
              break;
            case 'EUR':
              decimals = 2;
              prefix = '€';
              break;
            case 'GBP':
              decimals = 2;
              prefix = '£';
              break;
            case 'BTC':
              prefix = '₿';
              break;
            case 'ETH':
              prefix = 'Ξ';
              break;
            default:
              // For other quote assets, use default (8 decimals, no prefix)
              break;
          }
          
          // Configure price display in tooltip and y-axis
          newOptions.yaxis.labels.formatter = function(val) {
            return prefix + val.toFixed(decimals);
          };
          
          newOptions.tooltip.custom = function({ seriesIndex, dataPointIndex, w }) {
            const o = w.globals.seriesCandleO[seriesIndex][dataPointIndex];
            const h = w.globals.seriesCandleH[seriesIndex][dataPointIndex];
            const l = w.globals.seriesCandleL[seriesIndex][dataPointIndex];
            const c = w.globals.seriesCandleC[seriesIndex][dataPointIndex];
            
            return (
              '<div class="apexcharts-tooltip-candlestick">' +
              '<div>Open: <span class="value">' + prefix + o.toFixed(decimals) + '</span></div>' +
              '<div>High: <span class="value">' + prefix + h.toFixed(decimals) + '</span></div>' +
              '<div>Low: <span class="value">' + prefix + l.toFixed(decimals) + '</span></div>' +
              '<div>Close: <span class="value">' + prefix + c.toFixed(decimals) + '</span></div>' +
              '</div>'
            );
          };
          
          setOptions(newOptions);
        }
      } catch (error) {
        console.error('Error fetching symbol details:', error);
      }
    };
    
    fetchSymbolDetails();
  }, [symbol, interval]);

  // Format data for ApexCharts
  const formatCandleData = (candles) => {
    if (!candles || !candles.length) return [];
    
    return candles.map(candle => ({
      x: new Date(candle.time),
      y: [candle.open, candle.high, candle.low, candle.close]
    }));
  };
  
  const formatVolumeData = (candles) => {
    if (!candles || !candles.length) return [];
    
    return candles.map(candle => {
      const color = candle.close >= candle.open ? '#48bb78' : '#FF5252';
      return {
        x: new Date(candle.time),
        y: candle.volume,
        fillColor: color
      };
    });
  };
  
  // Update signal annotations without triggering re-renders
  const updateSignalAnnotations = (allSignals) => {
    if (!allSignals || !allSignals.length) return;
    
    const annotations = allSignals.map(signal => {
      return {
        x: new Date(signal.time).getTime(),
        y: signal.price,
        marker: {
          size: 6,
          fillColor: signal.action === 'BUY' ? '#4CAF50' : '#FF5252',
          strokeColor: '#fff',
          radius: 2
        },
        label: {
          borderColor: signal.action === 'BUY' ? '#4CAF50' : '#FF5252',
          style: {
            color: '#fff',
            background: signal.action === 'BUY' ? '#4CAF50' : '#FF5252',
          },
          text: `${signal.indicator} ${signal.action}`
        }
      };
    });
    
    setOptions(prevOptions => ({
      ...prevOptions,
      annotations: {
        points: annotations
      }
    }));
  };

  // Initialize socket and handle cleanup
  useEffect(() => {
    // Only connect socket once
    if (!isInitializedRef.current) {
      console.log('Connecting to socket (one-time)');
      socketRef.current = connectSocket();
      isInitializedRef.current = true;
    }
    
    // Return a cleanup function
    return () => {
      // Final cleanup
      if (socketRef.current && isSubscribedRef.current) {
        socketRef.current.emit('unsubscribe_market', { 
          symbol, 
          interval 
        });
        isSubscribedRef.current = false;
      }
      
      if (signalUpdateTimeoutRef.current) {
        clearTimeout(signalUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Handle subscription for current symbol and interval
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    
    // Clear previous data
    setSeries([{ name: 'candle', data: [] }]);
    setVolumeSeries([{ name: 'volume', data: [] }]);
    setSignals([]);
    signalsRef.current = [];
    setIsLoading(true);
    
    // Update chart title
    setOptions(prevOptions => ({
      ...prevOptions,
      title: {
        ...prevOptions.title,
        text: `${symbol} Price Chart (${interval})`
      },
      annotations: {
        points: []
      }
    }));
    
    // Function to handle historical data
    const handleHistoricalData = (data) => {
      if (data.symbol === symbol && data.interval === interval) {
        console.log(`Received historical data for ${symbol}: ${data.data.length} candles`);
        
        const formattedCandles = formatCandleData(data.data);
        const formattedVolume = formatVolumeData(data.data);
        
        setSeries([{
          name: 'candle',
          data: formattedCandles
        }]);
        
        setVolumeSeries([{
          name: 'volume',
          data: formattedVolume
        }]);
        
        setIsLoading(false);
      }
    };
    
    // Function to handle price updates
    const handlePriceUpdate = (data) => {
      if (data.symbol === symbol && data.candle) {
        const candle = data.candle;
        
        setSeries(prevSeries => {
          // Skip update if component is unmounting
          if (!prevSeries[0]) return prevSeries;
          
          const newData = [...prevSeries[0].data];
          const lastCandleIndex = newData.findIndex(
            item => item && item.x && new Date(item.x).getTime() === new Date(candle.time).getTime()
          );
          
          const formattedCandle = {
            x: new Date(candle.time),
            y: [candle.open, candle.high, candle.low, candle.close]
          };
          
          if (lastCandleIndex >= 0) {
            // Update existing candle
            newData[lastCandleIndex] = formattedCandle;
          } else {
            // Add new candle
            newData.push(formattedCandle);
          }
          
          return [{
            name: 'candle',
            data: newData
          }];
        });
        
        setVolumeSeries(prevSeries => {
          // Skip update if component is unmounting
          if (!prevSeries[0]) return prevSeries;
          
          const newData = [...prevSeries[0].data];
          const lastVolumeIndex = newData.findIndex(
            item => item && item.x && new Date(item.x).getTime() === new Date(candle.time).getTime()
          );
          
          const color = candle.close >= candle.open ? '#48bb78' : '#FF5252';
          const formattedVolume = {
            x: new Date(candle.time),
            y: candle.volume,
            fillColor: color
          };
          
          if (lastVolumeIndex >= 0) {
            // Update existing volume
            newData[lastVolumeIndex] = formattedVolume;
          } else {
            // Add new volume
            newData.push(formattedVolume);
          }
          
          return [{
            name: 'volume',
            data: newData
          }];
        });
      }
    };
    
    // Function to handle trade signals
    const handleTradeSignal = (signal) => {
      if (signal.symbol === symbol) {
        console.log(`Received signal for ${symbol}: ${signal.action} (${signal.indicator})`);
        
        // Update our ref immediately
        const newSignals = [...signalsRef.current, signal];
        signalsRef.current = newSignals;
        
        // Debounce the state update to prevent too many re-renders
        if (signalUpdateTimeoutRef.current) {
          clearTimeout(signalUpdateTimeoutRef.current);
        }
        
        signalUpdateTimeoutRef.current = setTimeout(() => {
          setSignals(signalsRef.current);
          updateSignalAnnotations(signalsRef.current);
        }, 300);
      }
    };
    
    // Clean up previous subscription if needed
    if (isSubscribedRef.current) {
      console.log(`Unsubscribing from previous market data`);
      socket.emit('unsubscribe_market', { symbol, interval });
      
      // Remove previous listeners
      socket.off('historical_data', handleHistoricalData);
      socket.off('price_update', handlePriceUpdate);
      socket.off('trade_signal', handleTradeSignal);
      
      isSubscribedRef.current = false;
    }
    
    // Subscribe to new market data
    console.log(`Subscribing to market data for ${symbol} (${interval})`);
    socket.emit('subscribe_market', { symbol, interval });
    isSubscribedRef.current = true;
    
    // Set up event listeners
    socket.on('historical_data', handleHistoricalData);
    socket.on('price_update', handlePriceUpdate);
    socket.on('trade_signal', handleTradeSignal);
    
    // Cleanup function
    return () => {
      console.log(`Removing event listeners for ${symbol} (${interval})`);
      
      // Clear debounce timeout
      if (signalUpdateTimeoutRef.current) {
        clearTimeout(signalUpdateTimeoutRef.current);
      }
      
      // Remove event listeners but don't unsubscribe here - we do that in the next useEffect run
      socket.off('historical_data', handleHistoricalData);
      socket.off('price_update', handlePriceUpdate);
      socket.off('trade_signal', handleTradeSignal);
    };
  }, [symbol, interval]);
  
  // Format currency info for display
  const formatCurrencyInfo = () => {
    if (!baseAsset || !quoteAsset) return '';
    
    let quoteSymbol = '';
    switch (quoteAsset) {
      case 'BTC':
        quoteSymbol = '₿';
        break;
      case 'ETH':
        quoteSymbol = 'Ξ';
        break;
      case 'USDT':
      case 'BUSD':
      case 'USDC':
      case 'USD':
      case 'DAI':
        quoteSymbol = '$';
        break;
      case 'EUR':
        quoteSymbol = '€';
        break;
      case 'GBP':
        quoteSymbol = '£';
        break;
      default:
        quoteSymbol = quoteAsset;
    }
    
    return `${baseAsset}/${quoteAsset} (${quoteSymbol})`;
  };
  
  return (
    <div className="candlestick-chart-container">
      {isLoading && (
        <div className="chart-loading">
          <div className="loading-spinner"></div>
          <p>Loading chart data...</p>
        </div>
      )}
      
      <div className="chart-header">
        <h3>{formatCurrencyInfo()} - {interval} Timeframe</h3>
      </div>
      
      <div className="chart-wrapper">
        <ReactApexChart
          options={options}
          series={series}
          type="candlestick"
          height={350}
        />
      </div>
      <div className="volume-chart-wrapper">
        <ReactApexChart
          options={volumeOptions}
          series={volumeSeries}
          type="bar"
          height={150}
        />
      </div>
      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-marker buy-marker">●</span>
          <span>Buy Signal ({signals.filter(s => s.action === 'BUY').length})</span>
        </div>
        <div className="legend-item">
          <span className="legend-marker sell-marker">●</span>
          <span>Sell Signal ({signals.filter(s => s.action === 'SELL').length})</span>
        </div>
      </div>
    </div>
  );
};

export default CandlestickChartApex;