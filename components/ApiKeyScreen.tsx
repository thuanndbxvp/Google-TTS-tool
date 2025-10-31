
import React from 'react';
import { KeyIcon } from './icons/KeyIcon';

interface ApiKeyScreenProps {
  onSelectKey: () => void;
}

export const ApiKeyScreen: React.FC<ApiKeyScreenProps> = ({ onSelectKey }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-200 p-4">
      <div className="w-full max-w-md bg-slate-800 rounded-xl shadow-2xl p-8 text-center">
        <h1 className="text-3xl font-bold text-cyan-400 mb-4">Welcome!</h1>
        <p className="text-slate-400 mb-6">
          This application requires a Google API key to generate audio. Please select your key to proceed.
        </p>
        <button
          onClick={onSelectKey}
          className="w-full flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
        >
          <KeyIcon />
          <span>Select API Key</span>
        </button>
        <p className="text-xs text-slate-500 mt-6">
          For more information on API keys and billing, please visit the{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-500 hover:underline"
          >
            Google AI documentation
          </a>.
        </p>
      </div>
    </div>
  );
};
