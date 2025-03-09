// Modified src/App.js with ErrorBoundary
import React from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  return (
    <div className="app">
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
    </div>
  );
}

export default App;