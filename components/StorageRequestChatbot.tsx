/**
 * AI-Powered Storage Request Chatbot
 * Users chat with Claude to create storage requests naturally
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Session, StorageRequest } from '../types';
import Button from './ui/Button';
import Card from './ui/Card';
import { SendIcon, BotIcon, UserIcon } from './icons/Icons';
import Spinner from './ui/Spinner';
import Anthropic from '@anthropic-ai/sdk';

interface StorageRequestChatbotProps {
  session: Session;
  onRequestCreated: (request: Omit<StorageRequest, 'id'>) => void;
}

const CLAUDE_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const StorageRequestChatbot: React.FC<StorageRequestChatbotProps> = ({ session, onRequestCreated }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content: `Hi! I'm here to help you set up pipe storage at our facility. I'll need to gather some information about your project.

Let's start simple: **What's your project reference or well name?** (e.g., "ABC-123" or "Wildcat Well 5-12")`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationData, setConversationData] = useState<any>({});
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === '' || isLoading || requestSubmitted) return;

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

      const systemPrompt = `You are a helpful assistant for PipeVault, a pipe storage facility. You're helping ${session.company.name} create a storage request.

Your job is to:
1. Ask questions naturally to gather information about their pipe storage needs
2. Be conversational and friendly
3. Extract structured data from the conversation
4. When you have enough information, confirm the details and create the request

Required information to collect:
- Project reference ID (well name, AFE number, etc.)
- Contact person's full name
- Contact phone number
- Pipe type (Blank Pipe, Sand Control, Flow Control, Tools, or Other)
- Pipe grade (H40, J55, L80, N80, C90, T95, P110, or Other)
- Pipe size/diameter (in inches)
- Connection type (NUE, EUE, BTC, Premium, or Other)
- Total number of joints
- Average joint length (in meters)
- Storage start date
- Storage end date (or duration)
- Trucking: Will they provide trucking or need a quote?

Current conversation data collected so far:
${JSON.stringify(conversationData, null, 2)}

User's company: ${session.company.name}
User's email: ${session.userId}

IMPORTANT:
- Ask ONE or TWO questions at a time
- Be conversational and natural
- Use metric units (meters for length)
- If the user provides multiple pieces of info at once, acknowledge all of them
- When you have all required info, summarize and ask for confirmation
- If confirmed, respond with EXACTLY: "REQUEST_CONFIRMED:{json}" where {json} is the structured data
- Format dates as YYYY-MM-DD`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: systemPrompt,
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

      // Check if AI confirmed the request
      if (aiResponse.includes('REQUEST_CONFIRMED:')) {
        const jsonStart = aiResponse.indexOf('{');
        const jsonEnd = aiResponse.lastIndexOf('}') + 1;
        const jsonData = aiResponse.substring(jsonStart, jsonEnd);
        const requestData = JSON.parse(jsonData);

        // Update conversation data
        setConversationData(requestData);

        // Create the storage request
        const newRequest: Omit<StorageRequest, 'id'> = {
          companyId: session.company.id,
          userId: session.userId,
          referenceId: requestData.referenceId,
          status: 'PENDING',
          requestDetails: {
            companyName: session.company.name,
            fullName: requestData.contactName,
            contactNumber: requestData.contactPhone,
            itemType: requestData.pipeType || 'Blank Pipe',
            grade: requestData.grade || 'L80',
            connection: requestData.connection || 'NUE',
            avgJointLength: parseFloat(requestData.avgJointLength) || 12,
            totalJoints: parseInt(requestData.totalJoints) || 100,
            storageStartDate: requestData.storageStartDate,
            storageEndDate: requestData.storageEndDate,
            casingSpec: requestData.diameter
              ? {
                  size_in: parseFloat(requestData.diameter),
                  size_mm: parseFloat(requestData.diameter) * 25.4,
                  weight_lbs_ft: 40,
                  id_in: 0,
                  id_mm: 0,
                  drift_in: 0,
                  drift_mm: 0,
                }
              : null,
          },
          truckingInfo: {
            truckingType: requestData.truckingType === 'quote' ? 'quote' : 'provided',
            details: requestData.truckingType === 'quote' ? requestData.truckingDetails : undefined,
          },
        };

        onRequestCreated(newRequest);
        setRequestSubmitted(true);

        const confirmationMessage: ChatMessage = {
          role: 'model',
          content: `Success! I've submitted your storage request.

**Reference ID:** ${requestData.referenceId}

Your request is now pending admin approval. You'll receive an email notification once it's been reviewed.

Is there anything else you'd like to know about your request?`,
        };
        setMessages((prev) => [...prev, confirmationMessage]);
      } else {
        // Extract any new data from the conversation
        try {
          // Try to parse structured data from AI response if it includes JSON
          if (aiResponse.includes('{') && aiResponse.includes('}')) {
            const jsonStart = aiResponse.indexOf('{');
            const jsonEnd = aiResponse.lastIndexOf('}') + 1;
            const extractedData = JSON.parse(aiResponse.substring(jsonStart, jsonEnd));
            setConversationData((prev: any) => ({ ...prev, ...extractedData }));
          }
        } catch {
          // No structured data in this response, continue conversation
        }

        const modelMessage: ChatMessage = {
          role: 'model',
          content: aiResponse,
        };
        setMessages((prev) => [...prev, modelMessage]);
      }
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
    <Card className="flex flex-col h-[80vh] max-h-[900px]">
      <div className="flex-shrink-0 p-6 border-b border-gray-700 bg-gradient-to-r from-indigo-900 to-purple-900">
        <h1 className="text-2xl font-bold text-center text-white">Create Storage Request</h1>
        <p className="text-center text-gray-300 text-sm mt-2">
          Chat with our AI assistant to set up your pipe storage
        </p>
      </div>
      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <BotIcon className="w-6 h-6 text-white" />
              </div>
            )}
            <div
              className={`max-w-sm md:max-w-md px-4 py-3 rounded-xl shadow-md ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-gray-700 text-gray-100 rounded-bl-none'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === 'user' && (
              <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 shadow-md">
                <UserIcon className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <BotIcon className="w-6 h-6 text-white" />
            </div>
            <div className="px-4 py-3 rounded-xl bg-gray-700 text-gray-100 rounded-bl-none shadow-md">
              <Spinner className="w-5 h-5" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex-shrink-0 p-4 border-t border-gray-700 bg-gray-800">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={requestSubmitted ? 'Request submitted!' : 'Type your answer...'}
            disabled={isLoading || requestSubmitted}
            className="w-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={isLoading || input.trim() === '' || requestSubmitted}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            <SendIcon className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </Card>
  );
};

export default StorageRequestChatbot;
