
import React, { useEffect, useRef } from 'react';

interface WindowWithMarked extends Window {
  marked?: {
    parse: (markdown: string) => string;
  };
}
import { ChatMessage, ChatMessagePart } from '../types';
import { UserIcon, ModelIcon, AudioSparkIcon, LoadingSpinner } from './icons';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && (window as WindowWithMarked).marked) {
      const sanitizedHtml = (window as WindowWithMarked).marked.parse(content);
      contentRef.current.innerHTML = sanitizedHtml;
    }
  }, [content]);

  return <div ref={contentRef} className="prose prose-invert prose-sm md:prose-base max-w-none prose-table:w-full prose-table:border prose-table:border-gray-600 prose-th:border prose-th:border-gray-600 prose-th:p-2 prose-td:border prose-td:border-gray-600 prose-td:p-2" />;
};

const ChatMessageContent: React.FC<{ part: ChatMessagePart }> = ({ part }) => {
  if (part.text) {
    return <p>{part.text}</p>;
  }
  if (part.inlineData) {
    return <img src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} alt="User upload" className="mt-2 rounded-lg max-w-xs h-auto shadow-lg" />;
  }
  return null;
};


const ChatDisplay: React.FC<{ chatHistory: ChatMessage[], onPlaySpeech?: (text: string, messageIndex: number) => void, activeTTSIndex?: number | null, theme?: 'dark' | 'light' }> = ({ chatHistory, onPlaySpeech, activeTTSIndex, theme = 'dark' }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const isDark = theme === 'dark';

  return (
    <div className="space-y-6">
      {chatHistory.map((message, index) => {
        const displayableParts = message.parts.filter(p => p.text || p.inlineData);

        // Don't render messages that are purely for tool context
        if (displayableParts.length === 0) {
            return null;
        }

        return (
            <div key={index} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'model' && (
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <ModelIcon />
                    </div>
                )}
                
                <div className={`relative max-w-xl lg:max-w-3xl rounded-xl p-4 shadow-md ${
                    message.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-800 border border-gray-100'
                }`}>
                    {displayableParts.map((part, pIndex) => {
                        if (part.text && message.role === 'model') {
                            return (
                                <div key={pIndex}>
                                    <MarkdownRenderer content={part.text} />
                                    {onPlaySpeech && (
                                        <button 
                                            onClick={() => onPlaySpeech(part.text || '', index)} 
                                            className={`absolute -bottom-3 -right-3 p-1.5 rounded-full text-white transition-all shadow-lg ${
                                                isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-blue-500 hover:bg-blue-600'
                                            }`}
                                            aria-label="Escuchar respuesta"
                                            disabled={activeTTSIndex === index}
                                        >
                                            {activeTTSIndex === index ? <LoadingSpinner /> : <AudioSparkIcon className="h-4 w-4" />}
                                        </button>
                                    )}
                                </div>
                            );
                        }
                        return <ChatMessageContent key={pIndex} part={part} />;
                    })}
                </div>

                {message.role === 'user' && (
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}>
                    <UserIcon />
                    </div>
                )}
            </div>
        );
        })}
      <div ref={endOfMessagesRef} />
    </div>
  );
};

export default ChatDisplay;
