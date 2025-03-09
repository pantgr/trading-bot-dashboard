import React, { useState } from 'react';
import { SocketProvider } from './contexts/SocketContext';
import { DataProvider } from './contexts/DataContext';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import './styles/App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  return (
    <SocketProvider>
      <DataProvider>
        <div className="app-container">
          {currentPage === 'dashboard' && <Dashboard onOpenSettings={() => setCurrentPage('settings')} />}
          {currentPage === 'settings' && <Settings onBack={() => setCurrentPage('dashboard')} />}
        </div>
      </DataProvider>
    </SocketProvider>
  );
}

export default App;