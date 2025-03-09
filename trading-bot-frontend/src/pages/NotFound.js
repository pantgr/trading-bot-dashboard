 import React from 'react';

const NotFound = () => {
  return (
    <div className="not-found-page">
      <div className="not-found-container">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you are looking for does not exist or has been moved.</p>
        <button 
          className="back-button"
          onClick={() => window.location.href = '/'}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default NotFound;