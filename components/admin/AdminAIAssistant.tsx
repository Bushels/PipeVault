/**
 * Admin AI Assistant - Help admins find answers quickly
 * Powered by Gemini 2.0 Flash (FREE tier for basic usage!)
 */

import React, { useState, useRef, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { callGeminiAdminAssistant } from '../../services/geminiService';
import type { StorageRequest, Company, Yard, Pipe } from '../../types';

interface AdminAIAssistantProps {
  requests: StorageRequest[];
  companies: Company[];
  yards: Yard[];
  inventory: Pipe[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AdminAIAssistant: React.FC<AdminAIAssistantProps> = ({ requests, companies, yards, inventory }) => {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: 'Hi! I\'m your PipeVault admin assistant powered by Gemini 2.0 Flash. I can help you with:\n\n• Storage capacity and availability\n• Request status and analytics\n• Company information\n• Inventory queries\n• Operational insights\n\nWhat would you like to know?'
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Build context summary for AI
  const buildContextSummary = () => {
    const pendingCount = requests.filter(r => r.status === 'PENDING').length;
    const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
    const totalCapacity = yards.reduce((sum, yard) =>
      sum + yard.areas.reduce((asum, area) =>
        asum + area.racks.reduce((rsum, rack) => rsum + rack.capacityMeters, 0), 0), 0);
    const totalOccupied = yards.reduce((sum, yard) =>
      sum + yard.areas.reduce((asum, area) =>
        asum + area.racks.reduce((rsum, rack) => rsum + (rack.occupiedMeters || 0), 0), 0), 0);
    const availableCapacity = totalCapacity - totalOccupied;

    return {
      requests: {
        total: requests.length,
        pending: pendingCount,
        approved: approvedCount,
        byStatus: {
          PENDING: requests.filter(r => r.status === 'PENDING').length,
          APPROVED: requests.filter(r => r.status === 'APPROVED').length,
          COMPLETED: requests.filter(r => r.status === 'COMPLETED').length,
          REJECTED: requests.filter(r => r.status === 'REJECTED').length,
        }
      },
      companies: {
        total: companies.length,
        list: companies.map(c => ({ id: c.id, name: c.name, domain: c.domain }))
      },
      storage: {
        yards: yards.map(yard => ({
          id: yard.id,
          name: yard.name,
          capacity: yard.areas.reduce((sum, a) => sum + a.racks.reduce((s, r) => s + r.capacityMeters, 0), 0),
          occupied: yard.areas.reduce((sum, a) => sum + a.racks.reduce((s, r) => s + (r.occupiedMeters || 0), 0), 0),
          areas: yard.areas.map(area => ({
            id: area.id,
            name: area.name,
            capacity: area.racks.reduce((s, r) => s + r.capacityMeters, 0),
            occupied: area.racks.reduce((s, r) => s + (r.occupiedMeters || 0), 0),
            rackCount: area.racks.length
          }))
        })),
        totalCapacity,
        totalOccupied,
        availableCapacity,
        utilizationPercent: (totalOccupied / totalCapacity * 100).toFixed(1)
      },
      inventory: {
        total: inventory.length,
        inStorage: inventory.filter(p => p.status === 'IN_STORAGE').length,
        pickedUp: inventory.filter(p => p.status === 'PICKED_UP').length,
      }
    };
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const context = buildContextSummary();
      const response = await callGeminiAdminAssistant(messages, userMessage, context);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error('AI Assistant error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or rephrase your question.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Quick action buttons
  const quickQuestions = [
    'What storage areas have space available?',
    'How many pending requests do we have?',
    'What is our current storage utilization?',
    'Which companies have the most inventory?',
  ];

  const handleQuickQuestion = (question: string) => {
    setInput(question);
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="border-b border-gray-700 pb-4 mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          Admin AI Assistant
        </h3>
        <p className="text-sm text-gray-400 mt-1">Ask me anything about your operations</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-100 border border-gray-700'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-100 border border-gray-700 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length === 1 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">Quick questions:</p>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickQuestion(q)}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-md border border-gray-700 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me anything..."
          disabled={loading}
          className="flex-1 bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="px-4 py-2 bg-red-600 hover:bg-red-700"
        >
          {loading ? '...' : 'Send'}
        </Button>
      </div>
    </Card>
  );
};

export default AdminAIAssistant;
