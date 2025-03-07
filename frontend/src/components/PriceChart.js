// src/components/PriceChart.js
import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const PriceChart = () => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    // Mock δεδομένα για το γράφημα
    const mockPriceData = generateMockPriceData();
    
    if (chartContainerRef.current) {
      // Αφαίρεση προηγούμενου chart αν υπάρχει
      if (chartRef.current) {
        chartRef.current.remove();
      }
      
      // Δημιουργία νέου chart
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 400,
        layout: {
          backgroundColor: '#253248',
          textColor: 'rgba(255, 255, 255, 0.9)',
        },
        grid: {
          vertLines: {
            color: 'rgba(70, 130, 180, 0.5)',
          },
          horzLines: {
            color: 'rgba(70, 130, 180, 0.5)',
          },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });
      
      // Προσθήκη σειράς candlestick
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#4CAF50',
        downColor: '#FF5252',
        borderVisible: false,
        wickUpColor: '#4CAF50',
        wickDownColor: '#FF5252',
      });
      
      // Προσθήκη δεδομένων
      candlestickSeries.setData(mockPriceData);
      
      // Αποθήκευση αναφοράς στο chart
      chartRef.current = chart;
      
      // Resize handler
      const handleResize = () => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({ 
            width: chartContainerRef.current.clientWidth 
          });
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
        }
      };
    }
  }, []);

  // Συνάρτηση για τη δημιουργία mock δεδομένων τιμών
  const generateMockPriceData = () => {
    const data = [];
    const numberOfPoints = 100;
    let basePrice = 35000;
    const now = new Date();
    
    for (let i = 0; i < numberOfPoints; i++) {
      const time = new Date(now);
      time.setDate(now.getDate() - (numberOfPoints - i));
      
      const volatility = Math.random() * 500;
      const open = basePrice + (Math.random() - 0.5) * volatility;
      const high = open + Math.random() * 300;
      const low = open - Math.random() * 300;
      const close = (open + high + low) / 3 + (Math.random() - 0.5) * 100;
      
      data.push({
        time: time.getTime() / 1000,
        open,
        high,
        low,
        close
      });
      
      basePrice = close;
    }
    
    return data;
  };

  return (
    <div className="chart-container">
      <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }} />
    </div>
  );
};

export default PriceChart;