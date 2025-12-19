import React, { useState, useEffect } from 'react';
import { KeyIcon } from './icons/KeyIcon';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  // ElevenLabs props
  elevenLabsApiKey: string; // This now holds multi-line string
  elevenLabsBaseUrl: string;
  onElevenLabsConfigChange: (keys: string, baseUrl: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  elevenLabsApiKey,
  elevenLabsBaseUrl,
  onElevenLabsConfigChange
}) => {
  // ElevenLabs local state
  const [elevenLabsKeysInput, setElevenLabsKeysInput] = useState(elevenLabsApiKey);
  const [elevenLabsUrlInput, setElevenLabsUrlInput] = useState(elevenLabsBaseUrl);
  const [isEditingElevenLabs, setIsEditingElevenLabs] = useState(false);

  useEffect(() => {
    setElevenLabsKeysInput(elevenLabsApiKey);
    setElevenLabsUrlInput(elevenLabsBaseUrl);
  }, [elevenLabsApiKey, elevenLabsBaseUrl, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSaveElevenLabs = () => {
    onElevenLabsConfigChange(elevenLabsKeysInput, elevenLabsUrlInput.trim());
    setIsEditingElevenLabs(false);
  }

  const keyCount = elevenLabsApiKey.split('\n').filter(k => k.trim()).length;

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
            <h2 id="apiKeyModalTitle" className="text-2xl font-bold text-[--color-primary-400] mb-2 text-center transition-colors">Cài đặt API Keys</h2>
            
            {/* Note about Gemini Key Source */}
            <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-300">
                <p><strong>Thông báo Gemini:</strong> Để đảm bảo tính bảo mật và tuân thủ quy định API, mã khóa Gemini được quản lý thông qua biến môi trường hệ thống (System Environment) thay vì nhập thủ công.</p>
            </div>

            {/* ElevenLabs Section */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center justify-between">
                 <div className="flex items-center">
                    <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent mr-2">ElevenLabs</span>
                 </div>
                 {!isEditingElevenLabs && keyCount > 0 && (
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full border border-slate-600">
                        {keyCount} keys
                    </span>
                 )}
              </h3>
               <p className="text-slate-400 text-xs mb-4">
                Nhập nhiều API key (mỗi dòng 1 key) để tự động xoay vòng tránh lỗi giới hạn.
              </p>
              
              {!isEditingElevenLabs && keyCount > 0 ? (
                <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                   <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center">
                          <KeyIcon />
                          <span className="ml-3 font-mono text-slate-300 text-sm">Đang sử dụng {keyCount} key(s)</span>
                       </div>
                       <button onClick={() => setIsEditingElevenLabs(true)} className="text-[--color-primary-400] hover:text-[--color-primary-300] text-sm font-semibold transition-colors">
                          Cấu hình
                       </button>
                   </div>
                   <div className="text-xs text-slate-500 truncate">
                        API Endpoint: {elevenLabsBaseUrl || 'Mặc định'}
                   </div>
                </div>
              ) : (
                 <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Danh sách API Keys (Mỗi key một dòng)</label>
                        <textarea
                            value={elevenLabsKeysInput}
                            onChange={(e) => setElevenLabsKeysInput(e.target.value)}
                            className="w-full h-24 bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-slate-300 text-sm font-mono hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors"
                            placeholder="xi-api-key-1...&#10;xi-api-key-2..."
                        />
                    </div>
                    <div>
                         <label className="block text-xs font-medium text-slate-400 mb-1">
                             Custom Base URL / Proxy Endpoint (Tùy chọn)
                             <span className="block text-[10px] text-slate-500 font-normal">Sử dụng nếu bạn có Reverse Proxy riêng để ẩn IP (VD: https://my-proxy.com/v1)</span>
                         </label>
                         <input
                            type="text"
                            value={elevenLabsUrlInput}
                            onChange={(e) => setElevenLabsUrlInput(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-slate-300 text-sm hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] transition-colors"
                            placeholder="https://api.elevenlabs.io/v1"
                        />
                    </div>
                    <div className="flex space-x-2 justify-end">
                         {isEditingElevenLabs && (
                            <button onClick={() => { setIsEditingElevenLabs(false); setElevenLabsKeysInput(elevenLabsApiKey); setElevenLabsUrlInput(elevenLabsBaseUrl); }} className="text-slate-400 hover:text-white px-3 py-2 text-sm">
                               Hủy
                            </button>
                         )}
                        <button onClick={handleSaveElevenLabs} className="bg-[--color-primary-600] hover:bg-[--color-primary-500] text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm">
                            Lưu Cấu Hình
                        </button>
                    </div>
                </div>
              )}
            </div>

        </div>
        
        <p className="text-xs text-slate-500 mt-4 text-center border-t border-slate-700 pt-4">
          Cấu hình được lưu cục bộ trên trình duyệt của bạn.
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