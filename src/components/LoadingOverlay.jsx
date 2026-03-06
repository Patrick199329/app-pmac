import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingOverlay = ({ message = 'Carregando...', subtitle = 'Por favor, aguarde.' }) => {
  return (
    <div className="loading-overlay-container fade-in">
      <div className="loading-content-clean">
        <div className="loading-animation">
          <Loader2 className="spinner" size={64} />
          <div className="loading-ring"></div>
        </div>
        <div className="loading-text">
          <h3>{message}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
        .loading-overlay-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          min-height: 400px;
          display: flex;
          justify-content: center;
          align-items: center;
          background: var(--bg-primary);
          z-index: 50;
          overflow: hidden;
        }

        .loading-content-clean {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          text-align: center;
          padding: 2rem;
        }

        .loading-animation {
          position: relative;
          width: 100px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          color: var(--accent-primary);
          animation: spin 1.5s linear infinite;
        }

        .loading-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 3px solid rgba(139, 92, 246, 0.05);
          border-top: 3px solid var(--accent-primary);
          border-radius: 50%;
          animation: spin 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        .loading-text h3 {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }

        .loading-text p {
          font-size: 1rem;
          color: var(--text-tertiary);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
};

export default LoadingOverlay;
