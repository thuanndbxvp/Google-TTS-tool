
import React, { useState } from 'react';
import { ApiKey } from '../types';
import { KeyIcon } from './icons/KeyIcon';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ApiKey[];
  activeKeyId: number | null;
  onAddKey: (key: string) => void;
  onDeleteKey: (id: number) => void;
  onSetActiveKey: (id: number) => void;
}

const maskApiKey = (key: string): string => {
  if (key.length <= 8) {
    return '****';
  }
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
};

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKeys,
  activeKeyId,
  onAddKey,
  onDeleteKey,
  onSetActiveKey,
}) => {
  const [newKeyInput, setNewKeyInput] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleAddClick = () => {
    if (newKeyInput.trim()) {
      onAddKey(newKeyInput.trim());
      setNewKeyInput('');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="apiKeyModalTitle"
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-lg m-4 relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fade-in-scale 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-700"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="p-2">
            <h2 id="apiKeyModalTitle" className="text-2xl font-bold text-[--color-primary-400] mb-2 text-center transition-colors">Quản lý API Keys</h2>
            <p className="text-slate-400 mb-6 text-center text-sm">
            Thêm, xóa và chọn API key để sử dụng. Các key của bạn được lưu trữ cục bộ.
            </p>

            <div className="mb-4">
                <label htmlFor="new-key-input" className="block text-sm font-medium text-slate-300 mb-2">Thêm Key Mới</label>
                <div className="flex space-x-2">
                    <input
                        id="new-key-input"
                        type="password"
                        value={newKeyInput}
                        onChange={(e) => setNewKeyInput(e.target.value)}
                        className="flex-grow w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-slate-300 hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors duration-200"
                        placeholder="Dán Google AI API Key của bạn..."
                        aria-label="Ô nhập API Key mới"
                    />
                    <button onClick={handleAddClick} disabled={!newKeyInput.trim()} className="bg-[--color-primary-600] hover:bg-[--color-primary-500] disabled:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors">
                        Thêm
                    </button>
                </div>
            </div>

            <div className="border-t border-slate-700 my-4"></div>

            <h3 className="text-lg font-semibold text-white mb-3">Các Key đã lưu</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {apiKeys.length > 0 ? (
                apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="bg-slate-700/50 p-3 rounded-lg flex items-center justify-between border-l-2 border-transparent transition-all duration-200 hover:border-l-[--color-primary-500] hover:bg-slate-700">
                    <div className="flex items-center">
                        <KeyIcon />
                        <span className="ml-3 font-mono text-slate-300">{maskApiKey(apiKey.key)}</span>
                        {apiKey.id === activeKeyId && (
                            <span className="ml-3 text-xs font-medium bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">Hoạt động</span>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                    {apiKey.id !== activeKeyId && (
                        <button onClick={() => onSetActiveKey(apiKey.id)} className="text-[--color-primary-400] hover:text-[--color-primary-300] text-sm font-semibold transition-colors">
                            Kích hoạt
                        </button>
                    )}
                    <button onClick={() => onDeleteKey(apiKey.id)} className="text-red-400 hover:text-red-300 text-sm font-semibold transition-colors">
                        Xóa
                    </button>
                    </div>
                </div>
                ))
            ) : (
                <div className="text-center text-slate-500 py-8">
                    Chưa có API key nào được lưu.
                </div>
            )}
            </div>
        </div>
        
        <p className="text-xs text-slate-500 mt-6 text-center border-t border-slate-700 pt-4">
          Lấy API key của bạn từ{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[--color-primary-500] hover:underline"
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
      `}</style>
    </div>
  );
};
