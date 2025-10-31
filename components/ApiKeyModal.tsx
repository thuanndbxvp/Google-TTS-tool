
import React, { useState, useEffect } from 'react';
import { KeyIcon } from './icons/KeyIcon';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  currentKey: string;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentKey }) => {
  const [keyInput, setKeyInput] = useState(currentKey);

  useEffect(() => {
    setKeyInput(currentKey);
  }, [currentKey, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    onSave(keyInput);
  };
  
  const handleClear = () => {
    setKeyInput('');
    onSave(''); // Save empty string to clear it
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="apiKeyModalTitle"
    >
      <div 
        className="bg-slate-800 rounded-xl shadow-2xl p-8 w-full max-w-md m-4 relative transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fade-in-scale 0.3s forwards' }}
      >
        <button 
            onClick={onClose} 
            className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-700"
            aria-label="Close"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 id="apiKeyModalTitle" className="text-2xl font-bold text-cyan-400 mb-4 text-center">Manage API Key</h2>
        <p className="text-slate-400 mb-6 text-center">
          Please enter your Google AI API key. Your key will be stored locally in your browser.
        </p>
        <div className="relative flex items-center">
            <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-slate-500">
                <KeyIcon />
            </div>
            <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 pl-10 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors duration-200"
                placeholder="Enter your API Key..."
                aria-label="API Key Input"
            />
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mt-6">
           <button
            onClick={handleClear}
            className="w-full flex items-center justify-center bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200"
          >
            Clear Key
          </button>
          <button
            onClick={handleSave}
            disabled={!keyInput.trim()}
            className="w-full flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-200"
          >
            Save & Close
          </button>
        </div>
         <p className="text-xs text-slate-500 mt-6 text-center">
          Get your API key from{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-500 hover:underline"
          >
            Google AI Studio
          </a>.
        </p>
      </div>
      <style>{`
        @keyframes fade-in-scale {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in-scale {
            animation: fade-in-scale 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};
