
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
  // ElevenLabs props
  elevenLabsApiKey: string;
  onElevenLabsKeyChange: (key: string) => void;
}

const maskApiKey = (key: string): string => {
  if (!key) return '';
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
  elevenLabsApiKey,
  onElevenLabsKeyChange
}) => {
  const [newKeyInput, setNewKeyInput] = useState('');
  const [elevenLabsInput, setElevenLabsInput] = useState(elevenLabsApiKey);
  const [isEditingElevenLabs, setIsEditingElevenLabs] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleAddClick = () => {
    if (newKeyInput.trim()) {
      onAddKey(newKeyInput.trim());
      setNewKeyInput('');
    }
  };

  const handleSaveElevenLabs = () => {
    onElevenLabsKeyChange(elevenLabsInput.trim());
    setIsEditingElevenLabs(false);
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="apiKeyModalTitle"
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-lg m-4 relative flex flex-col max-h-[90vh]"
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

        <div className="p-2 overflow-y-auto custom-scrollbar">
            <h2 id="apiKeyModalTitle" className="text-2xl font-bold text-[--color-primary-400] mb-2 text-center transition-colors">Quản lý API Keys</h2>
            
            {/* Gemini Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center">
                <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent mr-2">Gemini</span> API Keys
              </h3>
              <p className="text-slate-400 text-xs mb-4">
                Sử dụng cho giọng đọc Gemini (Google). Hỗ trợ xoay vòng key.
              </p>

              <div className="mb-4">
                  <label htmlFor="new-key-input" className="block text-sm font-medium text-slate-300 mb-2">Thêm Key Gemini</label>
                  <div className="flex space-x-2">
                      <input
                          id="new-key-input"
                          type="password"
                          value={newKeyInput}
                          onChange={(e) => setNewKeyInput(e.target.value)}
                          className="flex-grow w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-slate-300 hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors duration-200"
                          placeholder="Dán Gemini API Key..."
                      />
                      <button onClick={handleAddClick} disabled={!newKeyInput.trim()} className="bg-[--color-primary-600] hover:bg-[--color-primary-500] disabled:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
                          Thêm
                      </button>
                  </div>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar border-t border-slate-700 pt-2">
                {apiKeys.length > 0 ? (
                    apiKeys.map((apiKey) => (
                    <div key={apiKey.id} className="bg-slate-700/50 p-3 rounded-lg flex items-center justify-between border-l-2 border-transparent transition-all duration-200 hover:border-l-[--color-primary-500] hover:bg-slate-700">
                        <div className="flex items-center overflow-hidden">
                            <KeyIcon />
                            <span className="ml-3 font-mono text-slate-300 truncate">{maskApiKey(apiKey.key)}</span>
                            {apiKey.id === activeKeyId && (
                                <span className="ml-3 text-xs font-medium bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full whitespace-nowrap">Hoạt động</span>
                            )}
                        </div>
                        <div className="flex items-center space-x-2 ml-2">
                        {apiKey.id !== activeKeyId && (
                            <button onClick={() => onSetActiveKey(apiKey.id)} className="text-[--color-primary-400] hover:text-[--color-primary-300] text-sm font-semibold transition-colors">
                                Chọn
                            </button>
                        )}
                        <button onClick={() => onDeleteKey(apiKey.id)} className="text-red-400 hover:text-red-300 text-sm font-semibold transition-colors">
                            Xóa
                        </button>
                        </div>
                    </div>
                    ))
                ) : (
                    <div className="text-center text-slate-500 py-4 text-sm">
                        Chưa có key Gemini.
                    </div>
                )}
              </div>
            </div>

            {/* ElevenLabs Section */}
            <div className="mb-4 pt-6 border-t border-slate-600">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center">
                 <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent mr-2">ElevenLabs</span> API Key
              </h3>
               <p className="text-slate-400 text-xs mb-4">
                Sử dụng cho các giọng đọc cao cấp từ ElevenLabs.
              </p>
              
              {!isEditingElevenLabs && elevenLabsApiKey ? (
                <div className="bg-slate-700/50 p-3 rounded-lg flex items-center justify-between border border-slate-600">
                   <div className="flex items-center">
                      <KeyIcon />
                      <span className="ml-3 font-mono text-slate-300">{maskApiKey(elevenLabsApiKey)}</span>
                   </div>
                   <button onClick={() => setIsEditingElevenLabs(true)} className="text-[--color-primary-400] hover:text-[--color-primary-300] text-sm font-semibold transition-colors">
                      Thay đổi
                   </button>
                </div>
              ) : (
                 <div className="flex space-x-2">
                    <input
                        type="password"
                        value={elevenLabsInput}
                        onChange={(e) => setElevenLabsInput(e.target.value)}
                        className="flex-grow w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-slate-300 hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors duration-200"
                        placeholder="Dán ElevenLabs API Key..."
                    />
                    <button onClick={handleSaveElevenLabs} className="bg-[--color-primary-600] hover:bg-[--color-primary-500] text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
                        Lưu
                    </button>
                     {isEditingElevenLabs && (
                        <button onClick={() => { setIsEditingElevenLabs(false); setElevenLabsInput(elevenLabsApiKey); }} className="text-slate-400 hover:text-white px-2">
                           Hủy
                        </button>
                     )}
                </div>
              )}
            </div>

        </div>
        
        <p className="text-xs text-slate-500 mt-4 text-center border-t border-slate-700 pt-4">
          Keys được lưu cục bộ trên trình duyệt của bạn.
        </p>
      </div>
      <style>{`
        @keyframes fade-in-scale {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #475569;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};
