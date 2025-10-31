
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Pipe, StorageRequest, StorageDocument } from '../types';
import Button from './ui/Button';
import { getChatbotResponse } from '../services/geminiService';
import Card from './ui/Card';
import { SendIcon, BotIcon, UserIcon, CloseIcon, ExpandIcon, CollapseIcon } from './icons/Icons';

interface ChatbotProps {
  companyName: string;
  inventoryData: Pipe[];
  requests?: StorageRequest[];
  documents?: StorageDocument[];
  onClose: () => void;
  onToggleExpand: () => void;
  isExpanded: boolean;
}

const Chatbot: React.FC<ChatbotProps> = ({ companyName, inventoryData, requests = [], documents = [], onClose, onToggleExpand, isExpanded }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: `Howdy! I'm Roughneck, your PipeVault field hand for ${companyName}. What do you need help with on this project?` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === '' || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);

    try {
      const response = await getChatbotResponse(companyName, inventoryData, requests, documents, nextHistory, input);
      const modelMessage: ChatMessage = { role: 'model', content: response };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = { role: 'model', content: 'Sorry, I encountered an error. Please try again.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={`flex flex-col ${isExpanded ? 'h-[80vh] w-[60vw]' : 'h-[60vh] w-[400px]'} max-w-full transition-all duration-300`}>
      <div className="flex-shrink-0 p-3 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-bold">Roughneck AI</h2>
        <div className="flex items-center gap-2">
          <Button onClick={onToggleExpand} variant="ghost" size="icon" className="w-6 h-6">
            {isExpanded ? <CollapseIcon className="w-4 h-4" /> : <ExpandIcon className="w-4 h-4" />}
          </Button>
          <Button onClick={onClose} variant="ghost" size="icon" className="w-6 h-6">
            <CloseIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                  <BotIcon className="w-5 h-5 text-white" />
              </div>
            )}
            <div className={`max-w-xs md:max-w-md lg:max-w-xs xl:max-w-md px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
              <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
            </div>
             {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
        ))}
         {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                <BotIcon className="w-5 h-5 text-white" />
            </div>
            <div className="px-4 py-2 rounded-lg bg-gray-700 text-gray-200 rounded-bl-none">
                <Spinner className="w-5 h-5"/>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex-shrink-0 p-4 border-t border-gray-700">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your inventory..."
            disabled={isLoading}
            className="w-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button type="submit" disabled={isLoading || input.trim() === ''} className="p-2 aspect-square">
             <SendIcon className="w-5 h-5"/>
          </Button>
        </form>
      </div>
    </Card>
  );
};

export default Chatbot;

