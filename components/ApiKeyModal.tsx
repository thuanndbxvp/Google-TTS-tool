
import React, { useState, useEffect } from 'react';
import { KeyIcon } from './icons/KeyIcon';
import { verifyProxyConnection } from '../services/elevenLabsService';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  // ElevenLabs props
  elevenLabsApiKey: string;
  onElevenLabsConfigChange: (keys: string) => void;
  // Gemini props
  geminiApiKey?: string;
  onGeminiConfigChange?: (key: string) => void;
  // Proxy props
  proxyKey?: string;
  onProxyKeyChange?: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  elevenLabsApiKey,
  onElevenLabsConfigChange,
  geminiApiKey = '',
  onGeminiConfigChange,
  proxyKey = '',
  onProxyKeyChange
}) => {
  // ElevenLabs local state
  const [elevenLabsKeysInput, setElevenLabsKeysInput] = useState(elevenLabsApiKey);
  const [isEditingElevenLabs, setIsEditingElevenLabs] = useState(false);

  // Gemini local state
  const [geminiKeyInput, setGeminiKeyInput] = useState(geminiApiKey);
  const [isEditingGemini, setIsEditingGemini] = useState(false);

  // Proxy local state
  const [proxyKeyInput, setProxyKeyInput] = useState(proxyKey);
  const [isEditingProxy, setIsEditingProxy] = useState(false);
  const [isCheckingProxy, setIsCheckingProxy] = useState(false);
  const [checkResult, setCheckResult] = useState<{myIp: string, proxyIp: string, success: boolean, message: string} | null>(null);

  useEffect(() => {
    setElevenLabsKeysInput(elevenLabsApiKey);
    setGeminiKeyInput(geminiApiKey);
    setProxyKeyInput(proxyKey);
    setCheckResult(null); // Reset check result when modal opens
  }, [elevenLabsApiKey, geminiApiKey, proxyKey, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSaveElevenLabs = () => {
    onElevenLabsConfigChange(elevenLabsKeysInput);
    setIsEditingElevenLabs(false);
  }

  const handleSaveGemini = () => {
    if (onGeminiConfigChange) {
        onGeminiConfigChange(geminiKeyInput.trim());
        setIsEditingGemini(false);
    }
  }

  const handleSaveProxy = () => {
      if (onProxyKeyChange) {
          onProxyKeyChange(proxyKeyInput.trim());
          setIsEditingProxy(false);
          setCheckResult(null); // Reset result on save
      }
  }

  const handleCheckProxy = async () => {
      if (!proxyKeyInput) return;
      
      // Need at least one 11Labs key to verify connection to 11Labs
      const keys = elevenLabsKeysInput.split('\n').filter(k => k.trim());
      if (keys.length === 0) {
          setCheckResult({
              myIp: '-', proxyIp: '-', success: false, 
              message: "Cần nhập API Key ElevenLabs trước để kiểm tra kết nối tới server 11Labs."
          });
          return;
      }

      setIsCheckingProxy(true);
      setCheckResult(null);

      // Use the first key for verification
      const result = await verifyProxyConnection(proxyKeyInput.trim(), keys[0].trim());
      
      setCheckResult(result);
      setIsCheckingProxy(false);
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
            <h2 id="apiKeyModalTitle" className="text-2xl font-bold text-[--color-primary-400] mb-2 text-center transition-colors">Quản lý API Keys</h2>
            
            {/* ElevenLabs Section */}
            <div className="mb-4 pt-6 border-t border-slate-600">
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
                Nhập nhiều API key (mỗi dòng 1 key) để tự động xoay vòng tránh lỗi spam.
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
                    
                    <div className="flex space-x-2 justify-end">
                         {isEditingElevenLabs && (
                            <button onClick={() => { setIsEditingElevenLabs(false); setElevenLabsKeysInput(elevenLabsApiKey); }} className="text-slate-400 hover:text-white px-3 py-2 text-sm">
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

             {/* Proxy Xoay Section */}
             <div className="mb-4 pt-6 border-t border-slate-600">
               <h3 className="text-lg font-semibold text-white mb-2 flex items-center justify-between">
                 <div className="flex items-center">
                    <span className="bg-gradient-to-r from-green-400 to-teal-500 bg-clip-text text-transparent mr-2">Proxy Xoay</span>
                 </div>
                 {!isEditingProxy && proxyKey && (
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full border border-slate-600">
                        Đã kích hoạt
                    </span>
                 )}
              </h3>
              <p className="text-slate-400 text-xs mb-4">
                Sử dụng Key từ proxyxoay.shop. Khi kích hoạt, tool sẽ tự động kết nối qua server trung gian.
              </p>

               {!isEditingProxy && proxyKey ? (
                <div className="space-y-3">
                    <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <KeyIcon />
                            <span className="ml-3 font-mono text-slate-300 text-sm">
                                {proxyKey.substring(0, 4)}...{proxyKey.substring(proxyKey.length - 4)}
                            </span>
                        </div>
                        <button onClick={() => setIsEditingProxy(true)} className="text-[--color-primary-400] hover:text-[--color-primary-300] text-sm font-semibold transition-colors">
                            Cấu hình
                        </button>
                    </div>
                    </div>
                    
                    {/* Check Proxy Area for saved key */}
                    <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/30">
                        <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-medium text-slate-400">Trạng thái Proxy</span>
                             <button 
                                onClick={() => { setProxyKeyInput(proxyKey); handleCheckProxy(); }}
                                disabled={isCheckingProxy}
                                className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded flex items-center"
                             >
                                 {isCheckingProxy && <SpinnerIcon hasMargin={false} />}
                                 <span className={isCheckingProxy ? "ml-1" : ""}>{isCheckingProxy ? "Đang ktra..." : "Kiểm tra IP"}</span>
                             </button>
                        </div>
                        {checkResult && (
                            <div className={`text-xs p-2 rounded ${checkResult.success ? 'bg-green-500/10 text-green-300 border border-green-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}>
                                <div className="font-bold mb-1">{checkResult.message}</div>
                                {checkResult.success && (
                                    <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[10px]">
                                        <div>
                                            <span className="block text-slate-500">IP Máy (Gốc)</span>
                                            <span className="text-slate-300">{checkResult.myIp}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500">IP Proxy (Truy cập 11Lab)</span>
                                            <span className="text-[--color-primary-300]">{checkResult.proxyIp}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
              ) : (
                <div className="space-y-3">
                   <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Key Xoay (proxyxoay.shop)</label>
                        <input
                            type="text"
                            value={proxyKeyInput}
                            onChange={(e) => setProxyKeyInput(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-slate-300 text-sm font-mono hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors"
                            placeholder="Nhập key xoay..."
                        />
                         <p className="text-[10px] text-slate-500 mt-1">
                             Hệ thống sẽ tự động kết nối qua server trung gian để bảo mật.
                         </p>
                    </div>
                    <div className="flex space-x-2 justify-end">
                         {isEditingProxy && (
                            <button onClick={() => { setIsEditingProxy(false); setProxyKeyInput(proxyKey); setCheckResult(null); }} className="text-slate-400 hover:text-white px-3 py-2 text-sm">
                               Hủy
                            </button>
                         )}
                         {/* Button Save handles logic */}
                        <button onClick={handleSaveProxy} className="bg-[--color-primary-600] hover:bg-[--color-primary-500] text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm">
                            Lưu Key Proxy
                        </button>
                    </div>
                </div>
              )}
            </div>
            
            {/* Gemini Section */}
            <div className="mb-4 pt-6 border-t border-slate-600">
               <h3 className="text-lg font-semibold text-white mb-2 flex items-center justify-between">
                 <div className="flex items-center">
                    <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mr-2">Google Gemini</span>
                 </div>
                 {!isEditingGemini && geminiApiKey && (
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full border border-slate-600">
                        Đã nhập
                    </span>
                 )}
              </h3>
              <p className="text-slate-400 text-xs mb-4">
                Sử dụng Gemini 2.5 Flash để tạo giọng đọc. Cần có API Key từ Google AI Studio.
              </p>

               {!isEditingGemini && geminiApiKey ? (
                <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                   <div className="flex items-center justify-between">
                       <div className="flex items-center">
                          <KeyIcon />
                          <span className="ml-3 font-mono text-slate-300 text-sm">
                              {geminiApiKey.substring(0, 4)}...{geminiApiKey.substring(geminiApiKey.length - 4)}
                          </span>
                       </div>
                       <button onClick={() => setIsEditingGemini(true)} className="text-[--color-primary-400] hover:text-[--color-primary-300] text-sm font-semibold transition-colors">
                          Cấu hình
                       </button>
                   </div>
                </div>
              ) : (
                <div className="space-y-3">
                   <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Gemini API Key</label>
                        <input
                            type="password"
                            value={geminiKeyInput}
                            onChange={(e) => setGeminiKeyInput(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-slate-300 text-sm font-mono hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors"
                            placeholder="AIzaSy..."
                        />
                         <p className="text-[10px] text-slate-500 mt-1">
                             Nếu bỏ trống, ứng dụng sẽ thử dùng biến môi trường (nếu có).
                         </p>
                    </div>
                    <div className="flex space-x-2 justify-end">
                         {isEditingGemini && (
                            <button onClick={() => { setIsEditingGemini(false); setGeminiKeyInput(geminiApiKey); }} className="text-slate-400 hover:text-white px-3 py-2 text-sm">
                               Hủy
                            </button>
                         )}
                        <button onClick={handleSaveGemini} className="bg-[--color-primary-600] hover:bg-[--color-primary-500] text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm">
                            Lưu Cấu Hình
                        </button>
                    </div>
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
