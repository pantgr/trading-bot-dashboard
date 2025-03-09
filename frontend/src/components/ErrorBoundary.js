// src/components/ErrorBoundary.js
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error information
    console.error('Error caught by boundary:', error);
    console.error('Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    // Reset error state and try to re-render
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          backgroundColor: '#fff5f5',
          border: '1px solid #fed7d7',
          borderRadius: '8px'
        }}>
          <h2 style={{ color: '#c53030' }}>Something went wrong</h2>
          <details style={{ whiteSpace: 'pre-wrap', margin: '10px 0' }}>
            <summary>Show error details</summary>
            <p style={{ color: '#c53030' }}>
              {this.state.error && this.state.error.toString()}
            </p>
            {this.state.errorInfo && (
              <pre style={{ 
                fontSize: '12px', 
                color: '#4a5568',
                backgroundColor: '#f7fafc',
                padding: '10px',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </details>
          <div>
            <button 
              onClick={this.handleReset}
              style={{
                backgroundColor: '#4299e1',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Try again
            </button>
            <button 
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#a0aec0',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    // If no error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;