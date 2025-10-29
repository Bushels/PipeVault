/**
 * Form Helper Chatbot
 * Provides AI assistance for filling out the storage request form
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import Button from './ui/Button';
import Card from './ui/Card';
import { SendIcon, BotIcon, UserIcon } from './icons/Icons';
import Spinner from './ui/Spinner';
import Anthropic from '@anthropic-ai/sdk';

interface FormHelperChatbotProps {
  companyName: string;
}

const CLAUDE_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const FORM_HELPER_SYSTEM_PROMPT = `You are a helpful assistant for MPS Group's PipeVault storage facility. You're helping customers fill out the FREE pipe storage request form as part of MPS's 20 Year Anniversary celebration.

**YOUR ROLE**: Answer questions about the form fields and help customers understand what information is needed.

**YOU CAN HELP WITH**:

1. **What is a project reference?**
   - It's a unique identifier for their project (AFE number, well name, project code, etc.)
   - IMPORTANT: This acts as their passcode to check status and make inquiries later
   - They should choose something memorable

2. **Pipe Types**:
   - Blank Pipe: Standard pipe without special features
   - Sand Control: Pipe with screens for sand management
   - Flow Control: Pipe with flow regulation features
   - Tools: Downhole tools and equipment
   - Other: Any other tubular goods

3. **Connection Types**:
   - NUE (Non-Upset End): Basic threaded connection
   - EUE (External Upset End): Externally thickened connection
   - BTC (Buttress Thread Casing): Standard API buttress threads
   - Premium: High-end proprietary connections
   - Semi-Premium: Mid-tier enhanced connections
   - Other: Custom or specialty connections

4. **Grade Information**:
   - H40, J55, L80, N80, C90, T95, P110: API steel grades
   - Higher numbers = higher strength
   - L80/N80 are most common for oil & gas

5. **Casing Specifications**:
   - OD (Outer Diameter): Outside diameter in inches
   - Weight: Weight per foot in lbs/ft
   - ID (Inner Diameter): Calculated based on OD and weight
   - Drift ID: Minimum guaranteed inner diameter

6. **Screen Types** (for Sand Control):
   - DWW: Direct Wire Wrap
   - PPS: Premium Packing Screen
   - SL: Slotted Liner
   - Other: Specialty screens

7. **Trucking Options**:
   - Request a Quote: MPS will arrange and quote trucking
   - Will Provide Trucking: Customer handles their own transportation

8. **General Information**:
   - This is FREE storage as part of 20 Year Anniversary promotion!
   - Storage duration is flexible
   - Requests go to admin for approval
   - They'll receive email notification upon approval

**CONVERSATION STYLE**:
- Friendly and helpful
- Keep answers concise and clear
- If you don't know something specific, acknowledge it
- Encourage them to contact support for complex technical questions
- Remind them about the FREE storage promotion when appropriate`;

const FormHelperChatbot: React.FC<FormHelperChatbotProps> = ({ companyName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content: `Hi! I'm here to help you fill out the storage request form.

💡 **Celebrating 20 Years of MPS!** You're getting FREE pipe storage as part of our anniversary promotion.

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
    setInput('');
    setIsLoading(true);

    try {
      if (!CLAUDE_API_KEY) {
        throw new Error('Claude API key not configured');
      }

      const anthropic = new Anthropic({
        apiKey: CLAUDE_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
        system: FORM_HELPER_SYSTEM_PROMPT,
        messages: [
          ...messages.map((msg) => ({
            role: msg.role === 'model' ? ('assistant' as const) : msg.role,
            content: msg.content,
          })),
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const aiResponse = textContent && 'text' in textContent ? textContent.text : "I couldn't process that.";

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
    <Card className="flex flex-col h-[75vh] max-h-[650px]">
      <div className="flex-shrink-0 p-4 border-b border-gray-700 bg-gradient-to-r from-indigo-900 to-purple-900">
        <h3 className="font-semibold text-white text-center">Need Help?</h3>
        <p className="text-sm text-gray-300 mt-1 text-center">
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
      <div className="flex-shrink-0 p-3 border-t border-gray-700 bg-gray-800">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="w-full bg-gray-700 text-white text-sm placeholder-gray-400 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <Button type="submit" disabled={isLoading || input.trim() === ''} className="px-3 py-2">
            <SendIcon className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
};

export default FormHelperChatbot;
