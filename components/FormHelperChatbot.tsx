/**
 * Form Helper Chatbot
 * Provides AI assistance for filling out the storage request form
 * Powered by Gemini 2.0 Flash (FREE tier for basic usage!)
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import GlassButton from './ui/GlassButton';
import GlassCard from './ui/GlassCard';
import { SendIcon, BotIcon, UserIcon } from './icons/Icons';
import Spinner from './ui/Spinner';
import { callGeminiFormHelper } from '../services/geminiService';

interface FormHelperChatbotProps {
  companyName: string;
}

const FormHelperChatbot: React.FC<FormHelperChatbotProps> = ({ companyName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content: `Howdy! Roughneck here — your oilfield-savvy form hand, ready to guide you through the storage request.

Tip: **Celebrating 20 Years of MPS!** You're getting FREE pipe storage as part of our anniversary promotion.

Ask me anything about the form fields - what is a project reference, connection types, how to calculate joints, etc.`,
    },
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
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const aiResponse = await callGeminiFormHelper(messages, currentInput);

      const modelMessage: ChatMessage = {
        role: 'model',
        content: aiResponse,
      };
      setMessages((prev) => [...prev, modelMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: ChatMessage = {
        role: 'model',
        content: 'Sorry, I encountered an error. Please try again or contact support.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GlassCard className="flex flex-col h-[75vh] max-h-[650px] border-slate-700/50 shadow-2xl overflow-hidden">
      <div className="flex-shrink-0 p-4 border-b border-slate-700/50 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 backdrop-blur-md">
        <h3 className="font-semibold text-white text-center tracking-wide">Need Help?</h3>
        <p className="text-sm text-slate-300 mt-1 text-center">
          Ask me anything about filling out this form!
        </p>
      </div>
      <div className="flex-grow p-3 overflow-y-auto space-y-3">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <BotIcon className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-gray-700 text-gray-100 rounded-bl-none'
              }`}
            >
              <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <BotIcon className="w-4 h-4 text-white" />
            </div>
            <div className="px-3 py-2 rounded-lg bg-gray-700 text-gray-100 rounded-bl-none">
              <Spinner className="w-4 h-4" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex-shrink-0 p-3 border-t border-slate-700/50 bg-slate-900/50 backdrop-blur-md">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="w-full glass-input text-white text-sm placeholder-slate-400 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 transition-all duration-200"
          />
          <GlassButton type="submit" disabled={isLoading || input.trim() === ''} className="px-3 py-2" variant="primary">
            <SendIcon className="w-4 h-4" />
          </GlassButton>
        </form>
      </div>
    </GlassCard>
  );
};

export default FormHelperChatbot;
