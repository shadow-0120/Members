import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { DarkModeProvider, useDarkMode } from './contexts/DarkModeContext';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';
import App from './App'

const rootElement = document.getElementById('root');

// Toast component that uses dark mode
function ToastWithTheme() {
  const { isDarkMode } = useDarkMode();
  
  return (
    <Toaster
      position="top-right"
      containerStyle={{
        top: '1rem',
        right: '1rem',
      }}
      toastOptions={{
        duration: 3000,
        style: {
          background: isDarkMode ? '#1f2937' : '#fff',
          color: isDarkMode ? '#fff' : '#000',
          border: isDarkMode ? '1px solid #374151' : '1px solid #000',
          borderRadius: '8px',
          padding: '12px 16px',
          maxWidth: 'calc(100vw - 2rem)',
          fontSize: '14px',
        },
        success: {
          iconTheme: {
            primary: isDarkMode ? '#10b981' : '#000',
            secondary: isDarkMode ? '#1f2937' : '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: isDarkMode ? '#ef4444' : '#000',
            secondary: isDarkMode ? '#1f2937' : '#fff',
          },
        },
      }}
    />
  );
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DarkModeProvider>
          <App />
          <ToastWithTheme />
        </DarkModeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
