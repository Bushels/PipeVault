import React, { useState, useRef, useEffect } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';
import Spinner from './ui/Spinner';
import { BotIcon, UserIcon, SendIcon } from './icons/Icons';
import type { ChatMessage } from '../types';
import { getInquiryChatResponse } from '../services/aiInquiryService';

interface AIInquiryChatProps {
  onBack: () => void;
  customerEmail?: string;
  prefilledProjectRef?: string;
}

const AIInquiryChat: React.FC<AIInquiryChatProps> = ({
  onBack,
  customerEmail: initialEmail,
  prefilledProjectRef,
}) => {
  const [isValidated, setIsValidated] = useState(false);
  const [email, setEmail] = useState(initialEmail || '');
  const [projectReference, setProjectReference] = useState(prefilledProjectRef || '');
  const [validationError, setValidationError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Handle validation
  const handleValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);
    setValidationError('');

    try {
      // In production, this would verify against Wix Data
      // For now, we'll simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Mock validation - in production, check if request exists
      if (email && projectReference) {
        setIsValidated(true);
        const welcomeMessage: ChatMessage = {
          role: 'model',
          content: `Hello! I'm your PipeVault AI assistant. I have access to your storage information for project "${projectReference}".\n\nYou can ask me questions like:\n• "When was the last load dropped off?"\n• "How many pipes do we still have to deliver?"\n• "What's the status of my storage request?"\n• "Where is my pipe currently stored?"\n• "Show me all my deliveries"\n\nHow can I help you today?`,
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
      } else {
        setValidationError('Please enter both email and project reference');
      }
    } catch (error) {
      setValidationError('Failed to validate credentials. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  // Handle sending a message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === '' || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await getInquiryChatResponse(
        email,
        projectReference,
        messages,
        input
      );
      const modelMessage: ChatMessage = {
        role: 'model',
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, modelMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'model',
        content: 'Sorry, I encountered an error. Please try again or contact support.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset validation
  const handleReset = () => {
    setIsValidated(false);
    setMessages([]);
    setEmail('');
    setProjectReference('');
    setValidationError('');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="text-indigo-400 hover:text-indigo-300 mb-4 flex items-center gap-2"
          >
            ← Back to Menu
          </button>
          <h1 className="text-3xl font-bold text-white">Ask AI - Inquiry Portal</h1>
          <p className="text-gray-400 mt-2">
            Ask questions about your storage, deliveries, and inventory
          </p>
        </div>

        {/* Validation Form */}
        {!isValidated ? (
          <Card className="max-w-md mx-auto">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">💬</div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Verify Your Identity
                </h2>
                <p className="text-gray-400 text-sm">
                  Please enter your email and project reference number to continue
                </p>
              </div>

              <form onSubmit={handleValidation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@company.com"
                    required
                    className="w-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Project Reference Number
                  </label>
                  <input
                    type="text"
                    value={projectReference}
                    onChange={(e) => setProjectReference(e.target.value)}
                    placeholder="e.g., AFE-12345, Well-XYZ"
                    required
                    className="w-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {validationError && (
                  <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-md p-3">
                    <p className="text-red-300 text-sm">{validationError}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isValidating}>
                  {isValidating ? (
                    <div className="flex items-center justify-center gap-2">
                      <Spinner className="w-5 h-5" />
                      <span>Validating...</span>
                    </div>
                  ) : (
                    'Continue'
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-700">
                <p className="text-xs text-gray-400 text-center">
                  Don't have a project reference number?{' '}
                  <button
                    onClick={onBack}
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    Submit a new storage request first
                  </button>
                </p>
              </div>
            </div>
          </Card>
        ) : (
          /* Chat Interface */
          <Card className="flex flex-col" style={{ height: '70vh' }}>
            {/* Chat Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">AI Assistant</h2>
                <p className="text-sm text-gray-400">
                  Project: {projectReference}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Change Project
              </button>
            </div>

            {/* Messages */}
            <div className="flex-grow p-4 overflow-y-auto space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${
                    msg.role === 'user' ? 'justify-end' : ''
                  }`}
                >
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                      <BotIcon className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-gray-700 text-gray-200 rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </p>
                    {msg.timestamp && (
                      <p className="text-xs opacity-60 mt-1">
                        {msg.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
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
                    <Spinner className="w-5 h-5" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-4 border-t border-gray-700">
              <form onSubmit={handleSend} className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about your storage..."
                  disabled={isLoading}
                  className="w-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button
                  type="submit"
                  disabled={isLoading || input.trim() === ''}
                  className="p-2 aspect-square"
                >
                  <SendIcon className="w-5 h-5" />
                </Button>
              </form>

              {/* Quick Questions */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setInput('What is the status of my storage request?')}
                  disabled={isLoading}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded-full transition-colors"
                >
                  Request Status
                </button>
                <button
                  onClick={() => setInput('When was the last delivery?')}
                  disabled={isLoading}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded-full transition-colors"
                >
                  Last Delivery
                </button>
                <button
                  onClick={() => setInput('How many joints are in storage?')}
                  disabled={isLoading}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded-full transition-colors"
                >
                  Current Inventory
                </button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AIInquiryChat;
