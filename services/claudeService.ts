/**
 * Claude AI Service - Using Claude 3.5 Haiku for complex conversations
 * Cost: ~$0.01 per storage request conversation
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, NewRequestDetails, TruckingInfo } from '../types';

const CLAUDE_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

if (!CLAUDE_API_KEY) {
    console.warn("VITE_ANTHROPIC_API_KEY environment variable not set. Claude AI features will be disabled.");
}

const anthropic = CLAUDE_API_KEY ? new Anthropic({
    apiKey: CLAUDE_API_KEY,
    dangerouslyAllowBrowser: true, // For development - move to Edge Functions in production
}) : null;

/**
 * Generate a professional summary for a storage request
 * Uses Claude 3.5 Haiku for cost-effectiveness
 */
export const generateRequestSummary = async (
    companyName: string,
    userEmail: string,
    referenceId: string,
    details: NewRequestDetails,
    truckingInfo: TruckingInfo,
): Promise<string> => {
    if (!anthropic) {
        return generateMockSummary(details, referenceId);
    }

    const itemDetailsLines = [
        `- Type: ${details.itemType === 'Other' ? details.itemTypeOther : details.itemType}`
    ];
    if (details.itemType === 'Sand Control') {
        itemDetailsLines.push(`- Sand Control Screen: ${details.sandControlScreenType === 'Other' ? details.sandControlScreenTypeOther : details.sandControlScreenType}`);
    }
    if (details.casingSpec) {
        itemDetailsLines.push(`- Casing OD: ${details.casingSpec.size_in}" (${details.casingSpec.size_mm} mm)`);
        itemDetailsLines.push(`- Casing Weight: ${details.casingSpec.weight_lbs_ft} lbs/ft`);
    }
    itemDetailsLines.push(`- Grade: ${details.grade === 'Other' ? details.gradeOther : details.grade}`);
    itemDetailsLines.push(`- Connection: ${details.connection === 'Other' ? details.connectionOther : details.connection}`);
    if (details.threadType) {
        itemDetailsLines.push(`- Thread Type: ${details.threadType}`);
    }
    itemDetailsLines.push(`- Quantity: ${details.totalJoints} joints`);
    itemDetailsLines.push(`- Average Joint Length: ${details.avgJointLength} m`);
    itemDetailsLines.push(`- Total Calculated Length: ${details.avgJointLength * details.totalJoints} m`);

    const logisticsLines = [];
    if (truckingInfo.truckingType === 'quote' && truckingInfo.details) {
        logisticsLines.push('Customer has requested a trucking quote from us. Pickup details below:');
        logisticsLines.push(`- Current Storage Company: ${truckingInfo.details.storageCompany}`);
        logisticsLines.push(`- Contact Name: ${truckingInfo.details.storageContactName}`);
        logisticsLines.push(`- Contact Email: ${truckingInfo.details.storageContactEmail}`);
        logisticsLines.push(`- Contact Phone: ${truckingInfo.details.storageContactNumber}`);
        logisticsLines.push(`- Pickup Location: ${truckingInfo.details.storageLocation}`);
        logisticsLines.push(`- Special Instructions: ${truckingInfo.details.specialInstructions || 'None'}`);
    } else if (truckingInfo.truckingType === 'provided') {
        logisticsLines.push('Customer will provide their own trucking.');
        if (truckingInfo.details?.specialInstructions) {
            logisticsLines.push(`- Additional Information: ${truckingInfo.details.specialInstructions}`);
        }
    }

    const prompt = `Generate a brief, professional internal summary for a pipe storage request.

Company: "${companyName}"
Contact Person: ${details.fullName}
Contact Email: ${userEmail}
Contact Phone: ${details.contactNumber}
Project Reference: "${referenceId}"
Requested Storage Period: ${details.storageStartDate} to ${details.storageEndDate}

Item Details:
${itemDetailsLines.join('\n')}

Logistics Information:
${logisticsLines.join('\n')}

Calculate the approximate number of full-size pipe racks needed (assume one rack holds 75 joints).
End the summary with "Recommend approval."`;

    try {
        const message = await anthropic.messages.create({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 500,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });

        const textContent = message.content.find(block => block.type === 'text');
        return textContent && 'text' in textContent ? textContent.text : generateMockSummary(details, referenceId);
    } catch (error) {
        console.error("Error generating summary with Claude:", error);
        return generateMockSummary(details, referenceId);
    }
};

/**
 * Get AI response for complex conversations (storage requests, scheduling)
 * Uses Claude 3.5 Haiku for better understanding and structured responses
 */
export const getClaudeResponse = async (
    systemPrompt: string,
    chatHistory: ChatMessage[],
    userMessage: string
): Promise<string> => {
    if (!anthropic) {
        return "I'm sorry, Claude AI is not configured. Please check your API key.";
    }

    try {
        const message = await anthropic.messages.create({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
                ...chatHistory.map(msg => ({
                    role: msg.role === 'model' ? 'assistant' as const : msg.role,
                    content: msg.content,
                })),
                {
                    role: 'user',
                    content: userMessage,
                },
            ],
        });

        const textContent = message.content.find(block => block.type === 'text');
        return textContent && 'text' in textContent ? textContent.text : "I couldn't generate a response.";
    } catch (error) {
        console.error("Error getting Claude response:", error);
        return "Sorry, I'm having trouble connecting right now. Please try again later.";
    }
};

/**
 * Admin AI Assistant - Help admins with operational queries
 * Uses Claude 3.5 Haiku for intelligent data analysis
 */
export const callClaudeAdminAssistant = async (
    chatHistory: Array<{ role: string; content: string }>,
    userMessage: string,
    context: any
): Promise<string> => {
    if (!anthropic) {
        return "I'm sorry, Claude AI is not configured. Please check your API key.";
    }

    const systemPrompt = `You are an AI assistant for the PipeVault admin dashboard at MPS Group, a pipe storage facility celebrating 20 years of service.

Your role is to help administrators quickly find information and insights about their operations.

CURRENT SYSTEM STATE:
${JSON.stringify(context, null, 2)}

CAPABILITIES:
- Answer questions about storage capacity and availability
- Provide insights on pending/approved requests
- Search through company and inventory data
- Calculate utilization metrics
- Suggest optimal storage allocation
- Provide operational recommendations

RESPONSE GUIDELINES:
- Be concise and data-driven
- Use specific numbers and metrics when available
- Format responses clearly (use bullet points, line breaks)
- Proactively suggest relevant follow-up information
- If data is incomplete, acknowledge it

EXAMPLE QUERIES YOU CAN HANDLE:
- "What storage areas have space available?"
- "How many pending requests do we have?"
- "What is our current storage utilization?"
- "Which yard has the most capacity?"
- "Show me companies with the most inventory"

Respond professionally and helpfully to the administrator's questions.`;

    try {
        const message = await anthropic.messages.create({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 1000,
            system: systemPrompt,
            messages: [
                ...chatHistory.slice(1).map(msg => ({ // Skip initial greeting
                    role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
                    content: msg.content,
                })),
                {
                    role: 'user',
                    content: userMessage,
                },
            ],
        });

        const textContent = message.content.find(block => block.type === 'text');
        return textContent && 'text' in textContent ? textContent.text : "I couldn't generate a response.";
    } catch (error) {
        console.error("Error getting Claude admin response:", error);
        return "Sorry, I'm having trouble connecting right now. Please try again later.";
    }
};

/**
 * Fallback mock summary when AI is unavailable
 */
function generateMockSummary(details: NewRequestDetails, referenceId: string): string {
    const space = Math.ceil(details.totalJoints / 75);
    return `Client requests storage for a project referenced as "${referenceId}".
Item: ${details.itemType}
Quantity: ${details.totalJoints} joints
Total Length: ${details.avgJointLength * details.totalJoints}m
Duration: ${details.storageStartDate} to ${details.storageEndDate}
This will require roughly ${space} full-size pipe racks. Recommend approval.`;
}
