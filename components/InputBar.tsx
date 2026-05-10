
import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, UploadIcon, LoadingSpinner, XIcon } from './icons';
import { compressImage } from '../utils/image';

interface InputBarProps {
    onSendMessage: (prompt: string, files: { mimeType: string; data: string }[] | null) => void;
  isLoading: boolean;
  placeholder?: string;
  theme?: 'dark' | 'light';
}

const InputBar: React.FC<InputBarProps> = ({ onSendMessage, isLoading, placeholder, theme = 'dark' }) => {
  const [prompt, setPrompt] = useState('');
    const [files, setFiles] = useState<{ file: File; preview: string; mimeType: string; data: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles) {
      const newFiles = Array.from(selectedFiles as FileList).filter((file: File) => file.type.startsWith('image/') || file.type === 'application/pdf');
      newFiles.forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          let base64Data = (reader.result as string).split(',')[1];
          let mimeType = file.type;

          if (mimeType.startsWith('image/')) {
              try {
                  const compressed = await compressImage(base64Data, mimeType);
                  base64Data = compressed.data;
                  mimeType = compressed.mimeType;
              } catch (compressErr) {
                  console.warn("Compression failed, using original image", compressErr);
              }
          }

          setFiles(prevFiles => [...prevFiles, {
            file,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file as Blob) : '',
            mimeType: mimeType,
            data: base64Data
          }]);
        };
        reader.readAsDataURL(file as Blob);
      });
    }
  };

    const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || (!prompt.trim() && files.length === 0)) return;
    const filesData = files.length > 0 ? files.map(f => ({ mimeType: f.mimeType, data: f.data })) : null;
    onSendMessage(prompt.trim() || (files.some(f => f.mimeType === 'application/pdf') ? 'Analiza estos documentos.' : 'Analiza estas imágenes.'), filesData);
    setPrompt('');
    setFiles([]);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };
  
    const removeFile = (index: number) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    if(fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className={`w-full max-w-4xl mx-auto rounded-xl p-2 flex items-end gap-2 border shadow-lg ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <button type="button" onClick={() => fileInputRef.current?.click()} className={`p-2 transition-colors flex-shrink-0 ${
          isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-blue-600'
      }`} aria-label="Upload file">
        <UploadIcon />
      </button>
      <input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />

      <div className="flex-1 flex flex-col">
                {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {files.map((file, index) => (
              <div key={index} className="relative w-20 h-20">
                {file.mimeType.startsWith('image/') ? (
                    <img src={file.preview} alt={`Preview ${index}`} className="w-full h-full object-cover rounded-md" />
                ) : (
                    <div className={`w-full h-full rounded-md flex flex-col items-center justify-center p-1 text-[10px] text-center overflow-hidden ${
                        isDark ? 'bg-gray-700' : 'bg-gray-100'
                    }`}>
                        <span className="text-red-400 font-bold mb-1">PDF</span>
                        <span className={`truncate w-full px-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{file.file.name}</span>
                    </div>
                )}
                <button onClick={() => removeFile(index)} className="absolute -top-1 -right-1 bg-gray-900 rounded-full p-0.5 text-white" aria-label={`Remove file ${index}`}>
                  <XIcon />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textAreaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder={placeholder || "Venta 500€, Entrada Juan, Reserva..."}
          className={`w-full bg-transparent resize-none border-none focus:ring-0 p-2 max-h-40 ${
              isDark ? 'text-gray-200 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'
          }`}
          rows={1}
          disabled={isLoading}
        />
      </div>

            <button type="submit" disabled={isLoading || (!prompt.trim() && files.length === 0)} className={`p-2 rounded-lg disabled:cursor-not-allowed transition-colors flex-shrink-0 ${
                isDark ? 'bg-blue-600 text-white disabled:bg-gray-600' : 'bg-blue-500 text-white disabled:bg-gray-300'
            }`}>
        {isLoading ? <LoadingSpinner /> : <SendIcon />}
      </button>
    </form>
  );
};

export default InputBar;
