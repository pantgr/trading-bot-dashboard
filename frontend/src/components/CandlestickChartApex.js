// src/components/CandlestickChartApex.js
import React, { useState, useEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { connectSocket } from '../services/socketService';
import './CandlestickChartApex.css';

const CandlestickChartApex = ({ symbol, interval = '5m' }) => {
  const [series, setSeries] = useState([{
    name: 'candle',
    data: []
  }]);
  const [volumeSeries, setVolumeSeries] = useState([{
    name: 'volume',
    data: []
  }]);
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
  
  const [volumeOptions, setVolumeOptions] = useState({
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
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [signals, setSignals] = useState([]);

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
  
  // Update signals on chart
  const updateSignalAnnotations = (allSignals) => {
    if (!allSignals.length) return;
    
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

  useEffect(() => {
    // Reset data when symbol or interval changes
    setSeries([{ name: 'candle', data: [] }]);
    setVolumeSeries([{ name: 'volume', data: [] }]);
    setSignals([]);
    setIsLoading(true);
    
    // Update chart title
    setOptions(prevOptions => ({
      ...prevOptions,
      title: {
        ...prevOptions.title,
        text: `${symbol} Price Chart (${interval})`
      }
    }));
    
    // Connect to socket
    const socket = connectSocket();
    
    // Subscribe to market data
    socket.emit('subscribe_market', { symbol, interval });
    
    // Listen for historical data
    socket.on('historical_data', (data) => {
      if (data.symbol === symbol && data.interval === interval) {
        console.log('Received historical data:', data.data.length, 'candles');
        
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
    });
    
    // Listen for real-time updates
    socket.on('price_update', (data) => {
      if (data.symbol === symbol && data.candle) {
        const candle = data.candle;
        
        setSeries(prevSeries => {
          const newData = [...prevSeries[0].data];
          const lastCandleIndex = newData.findIndex(
            item => new Date(item.x).getTime() === new Date(candle.time).getTime()
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
          const newData = [...prevSeries[0].data];
          const lastVolumeIndex = newData.findIndex(
            item => new Date(item.x).getTime() === new Date(candle.time).getTime()
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
    });
    
    // Listen for trading signals
    socket.on('trade_signal', (signal) => {
      if (signal.symbol === symbol) {
        const newSignals = [...signals, signal];
        setSignals(newSignals);
        updateSignalAnnotations(newSignals);
      }
    });
    
    // Cleanup
    return () => {
      socket.off('historical_data');
      socket.off('price_update');
      socket.off('trade_signal');
      socket.emit('unsubscribe_market', { symbol, interval });
    };
  }, [symbol, interval]);

  return (
    <div className="candlestick-chart-container">
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
          <span>Buy Signal</span>
        </div>
        <div className="legend-item">
          <span className="legend-marker sell-marker">●</span>
          <span>Sell Signal</span>
        </div>
      </div>
    </div>
  );
};

export default CandlestickChartApex;