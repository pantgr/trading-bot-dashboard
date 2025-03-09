// Updated CandlestickChartApex.js - Fixed Promise rendering issue
import React, { useState, useEffect, useRef } from 'react';
import ReactApexChart from 'react-apexcharts';
import { connectSocket } from '../services/socketService';
import axios from 'axios';
import './CandlestickChartApex.css';

const CandlestickChartApex = ({ symbol, interval = '5m', initialSignals = [] }) => {
  // Use refs to track socket and subscription status
  const socketRef = useRef(null);
  const isSubscribedRef = useRef(false);
  const signalsRef = useRef(initialSignals); // Initialize with initialSignals
  const signalUpdateTimeoutRef = useRef(null);
  const annotationTimerRef = useRef(null); // Timer ref to ensure annotations persist
  const isInitializedRef = useRef(false);
  
  const [series, setSeries] = useState([{
    name: 'candle',
    data: []
  }]);
  
  const [volumeSeries, setVolumeSeries] = useState([{
    name: 'volume',
    data: []
  }]);
  
  // Initialize signals state with initialSignals
  const [signals, setSignals] = useState(initialSignals);
  const [isLoading, setIsLoading] = useState(true);
  const [quoteAsset, setQuoteAsset] = useState('');
  const [baseAsset, setBaseAsset] = useState('');
  const [pairInfo, setPairInfo] = useState(''); // Added to store formatted pair info
  
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
      events: {
        // Add event to reapply annotations when chart is redrawn
        beforeResetZoom: function() {
          setTimeout(() => updateSignalAnnotations(signalsRef.current), 100);
          return true;
        },
        zoomed: function() {
          setTimeout(() => updateSignalAnnotations(signalsRef.current), 100);
        },
        scrolled: function() {
          setTimeout(() => updateSignalAnnotations(signalsRef.current), 100);
        }
      }
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
  
  // Fetch signals from API
  const fetchSignals = async () => {
    try {
      const response = await axios.get('/api/signals/recent', {
        params: {
          symbol,
          interval,
          limit: 100
        }
      });
      
      if (response.data && Array.isArray(response.data)) {
        console.log(`Fetched ${response.data.length} signals from API`);
        signalsRef.current = response.data;
        setSignals(response.data);
        updateSignalAnnotations(response.data);
      }
    } catch (error) {
      console.error('Error fetching signals:', error);
    }
  };

  // Create a function to persistently keep annotations updated
  const ensureAnnotationsPresent = () => {
    if (signalsRef.current && signalsRef.current.length > 0) {
      updateSignalAnnotations(signalsRef.current);
    }
  };

  // Start a timer that periodically checks and reapplies annotations
  useEffect(() => {
    // Apply initial annotations immediately when component mounts
    if (initialSignals && initialSignals.length > 0) {
      // Short delay to ensure chart is ready
      setTimeout(() => {
        console.log('Setting initial annotations:', initialSignals.length);
        updateSignalAnnotations(initialSignals);
      }, 500);
    } else {
      // If no initial signals provided, fetch from API
      fetchSignals();
    }

    // Set up a timer to reapply annotations every few seconds
    annotationTimerRef.current = setInterval(() => {
      ensureAnnotationsPresent();
    }, 2000); // Check every 2 seconds
    
    return () => {
      // Clean up timer on unmount
      if (annotationTimerRef.current) {
        clearInterval(annotationTimerRef.current);
      }
    };
  }, []);

  // When symbol or interval changes, refetch signals
  useEffect(() => {
    fetchSignals();
  }, [symbol, interval]);

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
    
    // Update options with new annotations
    setOptions(prevOptions => {
      // Create a new options object, making sure it's a deep copy
      const newOptions = JSON.parse(JSON.stringify(prevOptions));
      newOptions.annotations = { points: annotations };
      return newOptions;
    });
  };

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

  // Initialize socket and handle cleanup
  useEffect(() => {
    // Only connect socket once
    if (!isInitializedRef.current) {
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

  // Fetch symbol details when symbol changes
  useEffect(() => {
    const fetchSymbolDetails = async () => {
      try {
        const response = await axios.get('/api/market-data/pairs');
        const symbolInfo = response.data.find(pair => pair.symbol === symbol);
        
        if (symbolInfo) {
          setQuoteAsset(symbolInfo.quoteAsset);
          setBaseAsset(symbolInfo.baseAsset);
          
          // Update formatted pair info
          let quoteSymbol = '';
          switch (symbolInfo.quoteAsset) {
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
              quoteSymbol = symbolInfo.quoteAsset;
          }
          
          // Set the formatted pair info - this is synchronous, not a Promise
          setPairInfo(`${symbolInfo.baseAsset}/${symbolInfo.quoteAsset} (${quoteSymbol})`);
          
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
          
          // Preserve existing annotations
          if (signalsRef.current && signalsRef.current.length > 0) {
            updateSignalAnnotations(signalsRef.current);
          }
          
          setOptions(newOptions);
        }
      } catch (error) {
        console.error('Error fetching symbol details:', error);
      }
    };
    
    fetchSymbolDetails();
  }, [symbol, interval]);

  // Handle subscription for current symbol and interval
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    
    // Clear previous data but preserve signals/annotations
    setSeries([{ name: 'candle', data: [] }]);
    setVolumeSeries([{ name: 'volume', data: [] }]);
    setIsLoading(true);
    
    // Update chart title WITHOUT clearing annotations
    setOptions(prevOptions => {
      const newOptions = { ...prevOptions };
      newOptions.title.text = `${symbol} Price Chart (${interval})`;
      return newOptions;
    });
    
    // Function to handle historical data
    const handleHistoricalData = (data) => {
      if (data.symbol === symbol && data.interval === interval) {
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
        
        // After loading historical data, reapply annotations with a slight delay
        setTimeout(() => {
          if (signalsRef.current.length > 0) {
            console.log('Reapplying annotations after data load:', signalsRef.current.length);
            updateSignalAnnotations(signalsRef.current);
          }
        }, 500);
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
        
        // Ensure annotations remain after price updates
        ensureAnnotationsPresent();
      }
    };
    
    // Function to handle trade signals
    const handleTradeSignal = (signal) => {
      if (signal.symbol === symbol) {
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
        
        // Also trigger a fetch from the API to ensure we have all signals
        fetchSignals();
      }
    };
    
    // Clean up previous subscription if needed
    if (isSubscribedRef.current) {
      socket.emit('unsubscribe_market', { symbol, interval });
      
      // Remove previous listeners
      socket.off('historical_data', handleHistoricalData);
      socket.off('price_update', handlePriceUpdate);
      socket.off('trade_signal', handleTradeSignal);
      
      isSubscribedRef.current = false;
    }
    
    // Subscribe to new market data
    socket.emit('subscribe_market', { symbol, interval });
    isSubscribedRef.current = true;
    
    // Set up event listeners
    socket.on('historical_data', handleHistoricalData);
    socket.on('price_update', handlePriceUpdate);
    socket.on('trade_signal', handleTradeSignal);
    
    // Cleanup function
    return () => {
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
  
  // Fixed volume chart options - defined as a constant outside the render cycle
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
  
  return (
    <div className="candlestick-chart-container">
      {isLoading && (
        <div className="chart-loading">
          <div className="loading-spinner"></div>
          <p>Loading chart data...</p>
        </div>
      )}
      
      <div className="chart-header">
        {/* FIX: Use the precomputed pairInfo instead of calling a function that might return a Promise */}
        <h3>{pairInfo || `${symbol} - ${interval}`}</h3>
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