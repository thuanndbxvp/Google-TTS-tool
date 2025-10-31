
import React, { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { generateSpeech } from './services/geminiService';
import { AudioResult, ApiKey } from './types';
import { FileUploader } from './components/FileUploader';
import { AudioPlayer } from './components/AudioPlayer';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { KeyIcon } from './components/icons/KeyIcon';
import { ZipIcon } from './components/icons/ZipIcon';
import { ApiKeyModal } from './components/ApiKeyModal';

const voiceOptions = [
  { id: 'Kore', name: 'Giọng Nữ 1 (Trầm tĩnh)' },
  { id: 'Zephyr', name: 'Giọng Nữ 2 (Thân thiện)' },
  { id: 'Luna', name: 'Giọng Nữ 3 (Trong trẻo)' },
  { id: 'Aura', name: 'Giọng Nữ 4 (Mềm mại)' },
  { id: 'Puck', name: 'Giọng Nam 1 (Năng lượng)' },
  { id: 'Charon', name: 'Giọng Nam 2 (Trầm)' },
  { id: 'Fenrir', name: 'Giọng Nam 3 (Uy quyền)' },
  { id: 'Orion', name: 'Giọng Nam 4 (Ấm áp)' },
  { id: 'Sol', name: 'Giọng Nam 5 (Rõ ràng)' },
];

interface ApiKeyState {
  keys: ApiKey[];
  activeKeyId: number | null;
}

const App: React.FC = () => {
  const [apiKeyState, setApiKeyState] = useState<ApiKeyState>({ keys: [], activeKeyId: null });
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
  const [textFileContent, setTextFileContent] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [audioResults, setAudioResults] = useState<AudioResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isKeyAvailable = !!apiKeyState.activeKeyId;
  const activeApiKey = apiKeyState.keys.find(k => k.id === apiKeyState.activeKeyId)?.key || null;

  useEffect(() => {
    try {
      const storedState = localStorage.getItem('gemini-api-keys-manager');
      if (storedState) {
        const parsedState: ApiKeyState = JSON.parse(storedState);
        if (parsedState.keys && Array.isArray(parsedState.keys)) {
          setApiKeyState(parsedState);
        }
      }
    } catch (e) {
      console.error("Failed to parse API key state from localStorage", e);
      // Clear corrupted storage
      localStorage.removeItem('gemini-api-keys-manager');
    }
  }, []);

  const saveApiKeyState = (newState: ApiKeyState) => {
    localStorage.setItem('gemini-api-keys-manager', JSON.stringify(newState));
    setApiKeyState(newState);
  };

  useEffect(() => {
    return () => {
      audioResults.forEach(result => URL.revokeObjectURL(result.audioUrl));
    };
  }, [audioResults]);

  const handleAddKey = (key: string) => {
    const trimmedKey = key.trim();
    if (!trimmedKey || apiKeyState.keys.some(k => k.key === trimmedKey)) {
      // Prevent adding empty or duplicate keys
      return;
    }
    const newKey: ApiKey = { id: Date.now(), key: trimmedKey };
    const newKeys = [...apiKeyState.keys, newKey];
    // If it's the first key, make it active
    const newActiveId = apiKeyState.activeKeyId === null ? newKey.id : apiKeyState.activeKeyId;
    saveApiKeyState({ keys: newKeys, activeKeyId: newActiveId });
  };

  const handleDeleteKey = (id: number) => {
    const newKeys = apiKeyState.keys.filter(k => k.id !== id);
    let newActiveId = apiKeyState.activeKeyId;
    // If the deleted key was the active one, find a new active key
    if (id === apiKeyState.activeKeyId) {
      newActiveId = newKeys.length > 0 ? newKeys[0].id : null;
    }
    saveApiKeyState({ keys: newKeys, activeKeyId: newActiveId });
  };

  const handleSetActiveKey = (id: number) => {
    saveApiKeyState({ ...apiKeyState, activeKeyId: id });
    setIsKeyModalOpen(false); // Close modal on selection for better UX
  };
  
  const handleFileSelect = useCallback((content: string, fileName: string) => {
    setTextFileContent(content);
    setAudioResults([]);
    setError(null);
  }, []);

  const handleGenerateAudio = async () => {
    if (!activeApiKey) {
      setError('Vui lòng đặt API Key đang hoạt động bằng nút ở góc trên bên phải trước khi tạo âm thanh.');
      setIsKeyModalOpen(true);
      return;
    }

    if (!textFileContent) {
      setError('Vui lòng tải lên một tệp văn bản hoặc nhập văn bản trước.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAudioResults([]);

    const paragraphs = textFileContent.split('\n').filter(p => p.trim() !== '');

    if (paragraphs.length === 0) {
      setError('Nội dung văn bản trống hoặc không chứa đoạn văn nào có thể đọc được.');
      setIsLoading(false);
      return;
    }
    
    try {
      const results = await Promise.all(
        paragraphs.map(async (p, index) => {
          const audioUrl = await generateSpeech(p, selectedVoice, activeApiKey);
          return { id: index, text: p, audioUrl };
        })
      );
      setAudioResults(results);
    } catch (err) {
      console.error('Error generating audio:', err);
      if (err instanceof Error && (err.message.includes('API key not valid') || err.message.includes('API key is invalid'))) {
        setError('API Key đang hoạt động của bạn có vẻ không hợp lệ. Vui lòng mở trình quản lý API Key và chọn hoặc thêm một key hợp lệ.');
      } else {
        setError('Tạo âm thanh thất bại. Vui lòng kiểm tra API key đang hoạt động và kết nối mạng của bạn.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (audioResults.length === 0) return;
  
    setIsZipping(true);
    setError(null);
  
    try {
      const zip = new JSZip();
  
      await Promise.all(
        audioResults.map(async (result) => {
          const response = await fetch(result.audioUrl);
          const audioBlob = await response.blob();
          zip.file(`segment_${result.id + 1}.wav`, audioBlob);
        })
      );
  
      const zipBlob = await zip.generateAsync({ type: 'blob' });
  
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = 'audio_clips.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
  
    } catch (err) {
      console.error('Failed to create zip file:', err);
      setError('Không thể tạo tệp zip để tải xuống.');
    } finally {
      setIsZipping(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans flex flex-col">
       <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        apiKeys={apiKeyState.keys}
        activeKeyId={apiKeyState.activeKeyId}
        onAddKey={handleAddKey}
        onDeleteKey={handleDeleteKey}
        onSetActiveKey={handleSetActiveKey}
      />
      <header className="bg-slate-800/50 backdrop-blur-sm p-4 border-b border-slate-700 shadow-lg flex items-center justify-between sticky top-0 z-10">
        <div className="text-center flex-grow pl-16">
          <h1 className="text-2xl md:text-3xl font-bold text-center text-cyan-400">
            Chuyển đổi Tệp Văn bản sang Giọng nói
          </h1>
          <p className="text-center text-slate-400 mt-1">Cung cấp bởi Gemini TTS</p>
        </div>
        <button
          onClick={() => setIsKeyModalOpen(true)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 border ${
            isKeyAvailable
              ? 'border-green-500/50 bg-green-500/10 hover:bg-green-500/20 text-green-300'
              : 'border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300'
          }`}
          title={isKeyAvailable ? "Quản lý API Keys (Đang hoạt động)" : "Thiết lập API Key của bạn"}
        >
          <KeyIcon />
          <span className="hidden sm:inline">API Key</span>
        </button>
      </header>
      
      <main className="flex-grow container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Control Panel */}
        <div className="bg-slate-800 rounded-xl shadow-2xl p-6 flex flex-col space-y-6 h-fit">
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">1. Cung cấp Văn bản</h2>
            <FileUploader onFileSelect={handleFileSelect} disabled={isLoading} />
             <div className="relative flex py-4 items-center">
              <div className="flex-grow border-t border-slate-600"></div>
              <span className="flex-shrink mx-4 text-slate-500">HOẶC</span>
              <div className="flex-grow border-t border-slate-600"></div>
            </div>
            <textarea
              value={textFileContent}
              onChange={(e) => setTextFileContent(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors duration-200 min-h-[200px]"
              placeholder="Dán hoặc gõ văn bản của bạn trực tiếp vào đây..."
              disabled={isLoading}
            />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">2. Chọn giọng đọc</h2>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              disabled={isLoading}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors duration-200"
              aria-label="Chọn giọng đọc"
            >
              {voiceOptions.map(voice => (
                <option key={voice.id} value={voice.id}>{voice.name}</option>
              ))}
            </select>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">3. Tạo âm thanh</h2>
             <button
              onClick={handleGenerateAudio}
              disabled={isLoading || !textFileContent}
              className="w-full flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <SpinnerIcon />
                  Đang tạo...
                </>
              ) : 'Tạo Clip Âm thanh'}
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="bg-slate-800 rounded-xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
            <h2 className="text-xl font-semibold text-white">Kết quả</h2>
            {audioResults.length > 0 && !isLoading && (
              <button
                onClick={handleDownloadAll}
                disabled={isZipping}
                className="flex items-center justify-center bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
              >
                {isZipping ? (
                  <>
                    <SpinnerIcon />
                    <span>Đang nén...</span>
                  </>
                ) : (
                  <>
                    <ZipIcon />
                    <span>Tải Tất cả (.zip)</span>
                  </>
                )}
              </button>
            )}
          </div>

          {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg mb-4">{error}</div>}
          
          {isLoading && (
             <div className="flex flex-col items-center justify-center text-slate-400 h-64">
                <SpinnerIcon />
                <p className="mt-4">Đang tạo âm thanh, vui lòng đợi...</p>
                <p className="text-sm text-slate-500">Quá trình này có thể mất một lúc đối với các văn bản dài.</p>
            </div>
          )}

          {!isLoading && audioResults.length === 0 && !error && (
            <div className="flex items-center justify-center text-slate-500 h-64">
              <p>Các clip âm thanh sẽ xuất hiện ở đây sau khi được tạo.</p>
            </div>
          )}

          {audioResults.length > 0 && (
            <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
              {audioResults.map((result) => (
                <AudioPlayer key={result.id} result={result} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
