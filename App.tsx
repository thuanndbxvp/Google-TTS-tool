
import React, { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { generateSpeech } from './services/geminiService';
import { AudioResult } from './types';
import { FileUploader } from './components/FileUploader';
import { AudioPlayer } from './components/AudioPlayer';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { KeyIcon } from './components/icons/KeyIcon';
import { ZipIcon } from './components/icons/ZipIcon';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // FIX: Make aistudio optional to match environment declarations and prevent type errors.
    aistudio?: AIStudio;
  }
}

const voiceOptions = [
  { id: 'Kore', name: 'Female Voice 1 (Calm)' },
  { id: 'Zephyr', name: 'Female Voice 2 (Friendly)' },
  { id: 'Puck', name: 'Male Voice 1 (Energetic)' },
  { id: 'Charon', name: 'Male Voice 2 (Deep)' },
  { id: 'Fenrir', name: 'Male Voice 3 (Authoritative)' },
];


const App: React.FC = () => {
  const [isKeyAvailable, setIsKeyAvailable] = useState<boolean>(false);
  const [textFileContent, setTextFileContent] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [audioResults, setAudioResults] = useState<AudioResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const checkApiKey = useCallback(async () => {
    try {
      // FIX: Check if window.aistudio exists before using it.
      const hasKey = window.aistudio ? await window.aistudio.hasSelectedApiKey() : false;
      setIsKeyAvailable(hasKey);
    } catch (e) {
      console.error("Error checking for API key:", e);
      setIsKeyAvailable(false);
    }
  }, []);

  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);


  // Clear previous audio URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      audioResults.forEach(result => URL.revokeObjectURL(result.audioUrl));
    };
  }, [audioResults]);

  const handleSelectKey = async () => {
    try {
      // FIX: Check if window.aistudio exists and optimistically update key status to avoid race conditions.
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        // Per guidelines, assume key selection is successful to avoid race conditions with `hasSelectedApiKey`.
        setIsKeyAvailable(true);
      } else {
        console.error("aistudio context not available");
        setError("API Key selection is not available in this environment.");
      }
    } catch(e) {
      console.error("Could not open API key selection:", e);
      setError("An error occurred while trying to select an API key.");
    }
  };

  const handleFileSelect = useCallback((content: string, fileName: string) => {
    setTextFileContent(content);
    setAudioResults([]);
    setError(null);
  }, []);

  const handleGenerateAudio = async () => {
    if (!isKeyAvailable) {
      setError('Please set your API Key using the button in the top-right corner before generating audio.');
      return;
    }

    if (!textFileContent) {
      setError('Please upload a text file or enter some text first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAudioResults([]); // Clear previous results

    const paragraphs = textFileContent.split('\n').filter(p => p.trim() !== '');

    if (paragraphs.length === 0) {
      setError('The text content is empty or contains no readable paragraphs.');
      setIsLoading(false);
      return;
    }
    
    try {
      const results = await Promise.all(
        paragraphs.map(async (p, index) => {
          const audioUrl = await generateSpeech(p, selectedVoice);
          return { id: index, text: p, audioUrl };
        })
      );
      setAudioResults(results);
    } catch (err) {
      console.error('Error generating audio:', err);
      // FIX: Check for "Requested entity was not found" error to reset API key state, as per guidelines.
      if (err instanceof Error && err.message.includes('Requested entity was not found')) {
        setError('API Key is invalid. Please select a valid key.');
        setIsKeyAvailable(false);
      } else {
        setError('Failed to generate audio. This might be due to an invalid API key. Please try selecting your key again.');
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
      setError('Could not create the zip file for download.');
    } finally {
      setIsZipping(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans flex flex-col">
      <header className="bg-slate-800/50 backdrop-blur-sm p-4 border-b border-slate-700 shadow-lg flex items-center justify-between sticky top-0 z-10">
        <div className="text-center flex-grow pl-16">
          <h1 className="text-2xl md:text-3xl font-bold text-center text-cyan-400">
            Text File to Speech Converter
          </h1>
          <p className="text-center text-slate-400 mt-1">Powered by Gemini TTS</p>
        </div>
        <button
          onClick={handleSelectKey}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 border ${
            isKeyAvailable
              ? 'border-green-500/50 bg-green-500/10 hover:bg-green-500/20 text-green-300'
              : 'border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300'
          }`}
          title={isKeyAvailable ? "API Key is set" : "Set your API Key"}
        >
          <KeyIcon />
          <span className="hidden sm:inline">API Key</span>
        </button>
      </header>
      
      <main className="flex-grow container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Control Panel */}
        <div className="bg-slate-800 rounded-xl shadow-2xl p-6 flex flex-col space-y-6 h-fit">
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">1. Provide Text</h2>
            <FileUploader onFileSelect={handleFileSelect} disabled={isLoading} />
             <div className="relative flex py-4 items-center">
              <div className="flex-grow border-t border-slate-600"></div>
              <span className="flex-shrink mx-4 text-slate-500">OR</span>
              <div className="flex-grow border-t border-slate-600"></div>
            </div>
            <textarea
              value={textFileContent}
              onChange={(e) => setTextFileContent(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors duration-200 min-h-[200px]"
              placeholder="Paste or type your text directly here..."
              disabled={isLoading}
            />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">2. Select a voice</h2>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              disabled={isLoading}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors duration-200"
              aria-label="Select voice"
            >
              {voiceOptions.map(voice => (
                <option key={voice.id} value={voice.id}>{voice.name}</option>
              ))}
            </select>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">3. Generate audio</h2>
             <button
              onClick={handleGenerateAudio}
              disabled={isLoading || !textFileContent}
              className="w-full flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <SpinnerIcon />
                  Generating...
                </>
              ) : 'Generate Audio Clips'}
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="bg-slate-800 rounded-xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
            <h2 className="text-xl font-semibold text-white">Results</h2>
            {audioResults.length > 0 && !isLoading && (
              <button
                onClick={handleDownloadAll}
                disabled={isZipping}
                className="flex items-center justify-center bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
              >
                {isZipping ? (
                  <>
                    <SpinnerIcon />
                    <span>Zipping...</span>
                  </>
                ) : (
                  <>
                    <ZipIcon />
                    <span>Download All (.zip)</span>
                  </>
                )}
              </button>
            )}
          </div>

          {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg mb-4">{error}</div>}
          
          {isLoading && (
             <div className="flex flex-col items-center justify-center text-slate-400 h-64">
                <SpinnerIcon />
                <p className="mt-4">Generating audio, please wait...</p>
                <p className="text-sm text-slate-500">This may take a moment for longer texts.</p>
            </div>
          )}

          {!isLoading && audioResults.length === 0 && !error && (
            <div className="flex items-center justify-center text-slate-500 h-64">
              <p>Audio clips will appear here once generated.</p>
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
