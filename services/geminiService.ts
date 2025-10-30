import { GoogleGenAI, Chat } from '@google/genai';
import type { ChatMessage, NewRequestDetails, Pipe, Session, TruckingInfo } from '../types';
import { calculateDaysInStorage } from '../utils/dateUtils';

const GEMINI_API_KEY = import.meta.env.VITE_GOOGLE_AI_API_KEY;

if (!GEMINI_API_KEY) {
    console.warn("VITE_GOOGLE_AI_API_KEY environment variable not set. Using a mock response for Gemini API.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || '' });

const generateMockSummary = (details: NewRequestDetails, referenceId: string) => {
    const space = Math.ceil(details.totalJoints / 75);
    return Promise.resolve(
        `Client requests storage for a project referenced as "${referenceId}".
Item: ${details.itemType}
Quantity: ${details.totalJoints} joints
Total Length: ${details.avgJointLength * details.totalJoints}m
Duration: ${details.storageStartDate} to ${details.storageEndDate}
This will require roughly ${space} full-size pipe racks. Recommend approval.`
    );
}

export const generateRequestSummary = async (
    companyName: string, 
    session: Session,
    referenceId: string,
    details: NewRequestDetails,
    truckingInfo: TruckingInfo,
): Promise<string> => {
    if (!GEMINI_API_KEY) return generateMockSummary(details, referenceId);

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
    Contact Email: ${session.userId}
    Contact Phone: ${details.contactNumber}
    Project Reference: "${referenceId}"
    Requested Storage Period: ${details.storageStartDate} to ${details.storageEndDate}
    
    Item Details:
${itemDetailsLines.join('\n    ')}

    Logistics Information:
    ${logisticsLines.join('\n    ')}
    
    Calculate the approximate number of full-size pipe racks needed (assume one rack holds 75 joints).
    End the summary with "Recommend approval."
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating summary with Gemini:", error);
        return generateMockSummary(details, referenceId);
    }
};

const getMockChatResponse = (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase();
    if(lowerMessage.includes('shipping') || lowerMessage.includes('ship')) {
        return Promise.resolve("A shipping request has been logged and our team will contact you shortly with a quote and schedule.");
    }
    if(lowerMessage.includes('where') || lowerMessage.includes('location')) {
        return Promise.resolve("Your pipes are currently stored in Yard B, Row 14.");
    }
    if(lowerMessage.includes('how many') || lowerMessage.includes('quantity')) {
        return Promise.resolve("You have two types of pipes stored: 150 joints of L80 Casing and 300 joints of S135 Drill Pipe.");
    }
    return Promise.resolve("I can help with that. Please provide more details about your pipes.");
}


export const getChatbotResponse = async (
    companyName: string,
    inventoryData: Pipe[],
    chatHistory: ChatMessage[],
    userMessage: string
): Promise<string> => {
    if (!GEMINI_API_KEY) return getMockChatResponse(userMessage);

    // Enrich inventory data with calculated days in storage
    const enrichedInventory = inventoryData.map(pipe => ({
        ...pipe,
        daysInStorage: calculateDaysInStorage(pipe.dropOffTimestamp, pipe.pickUpTimestamp),
        dropOffDate: pipe.dropOffTimestamp ? new Date(pipe.dropOffTimestamp).toLocaleDateString() : 'N/A',
        pickUpDate: pipe.pickUpTimestamp ? new Date(pipe.pickUpTimestamp).toLocaleDateString() : null,
    }));

    const inventoryJson = JSON.stringify(enrichedInventory, null, 2);
    const systemInstruction = `You are a helpful inventory assistant for PipeVault.
You are speaking with a representative from "${companyName}".
You can ONLY answer questions based on their pipe inventory provided below.
Do not make up information. If the user asks about something not in the data, or about another company, politely state that you do not have access to that information.

The inventory data includes:
- Current status (IN_STORAGE, PICKED_UP, etc.)
- Days in storage (calculated from drop-off to pickup or current date)
- Drop-off dates (when pipe arrived at facility)
- Pick-up dates (when pipe was picked up, if applicable)
- Well assignments (UWI and well name for picked up pipes)
- Storage locations (rack/area where pipe is stored)

When asked to schedule shipping, confirm the details based on the inventory and then respond ONLY with: "A shipping request has been logged and our team will contact you shortly with a quote and schedule."

Their Inventory Data:
${inventoryJson}
`;

    try {
        const chat: Chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction },
            history: chatHistory.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.content }]
            }))
        });

        const response = await chat.sendMessage({ message: userMessage });
        return response.text;
    } catch (error) {
        console.error("Error getting chatbot response:", error);
        return "Sorry, I'm having trouble connecting right now. Please try again later.";
    }
};

/**
 * Admin AI Assistant - Help admins with operational queries
 * Uses Gemini 2.0 Flash (FREE for basic usage!)
 */
export const callGeminiAdminAssistant = async (
    chatHistory: Array<{ role: string; content: string }>,
    userMessage: string,
    context: any
): Promise<string> => {
    if (!GEMINI_API_KEY) {
        return "I'm sorry, Gemini AI is not configured. Please check your API key.";
    }

    const systemInstruction = `You are an AI assistant for the PipeVault admin dashboard at MPS Group, a pipe storage facility celebrating 20 years of service.

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
        const chat: Chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction },
            history: chatHistory.slice(1).map(msg => ({ // Skip initial greeting
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }))
        });

        const response = await chat.sendMessage({ message: userMessage });
        return response.text;
    } catch (error) {
        console.error("Error getting Gemini admin response:", error);
        return "Sorry, I'm having trouble connecting right now. Please try again later.";
    }
};

/**
 * Form Helper Chatbot - Help users with storage request form
 * Uses Gemini 2.0 Flash (FREE for basic usage!)
 */
export const callGeminiFormHelper = async (
    chatHistory: Array<{ role: string; content: string }>,
    userMessage: string
): Promise<string> => {
    if (!GEMINI_API_KEY) {
        return "I'm sorry, Gemini AI is not configured. Please check your API key.";
    }

    const systemInstruction = `You are a helpful assistant for MPS Group's PipeVault storage request form.

**YOUR ROLE**: Help users complete the storage request form by answering questions about:
- What information is needed
- What each field means
- Industry terminology
- Storage options

**YOU CAN HELP WITH**:
1. What is a project reference? - Acts as passcode, unique identifier for their project (AFE number, project name, etc.)
2. Pipe Types - Blank, Sand Control, Flow Control, Tools
3. Connection Types - NUE, EUE, BTC, Premium, Semi-Premium, Other
4. Thread Types - Common types explained
5. Trucking options - Quote vs. Customer-provided
6. Storage duration requirements

**IMPORTANT GUIDELINES**:
- Be concise and friendly
- Use simple language
- Provide examples when helpful
- If unsure, suggest contacting MPS directly
- Do not make up technical specifications
- Keep responses under 3 sentences when possible

**EXAMPLE INTERACTIONS**:
User: "What is a project reference?"
You: "A project reference is your unique identifier for this storage request - like an AFE number or project name. This will also act as your passcode to check status and make inquiries later, so make it memorable!"

User: "What's the difference between NUE and EUE?"
You: "NUE (Non-Upset End) has threads that are the same diameter as the pipe body. EUE (External Upset End) has a slightly larger diameter at the threaded end for added strength. EUE is more common for higher pressure applications."

Respond helpfully to the user's question about the storage request form.`;

    try {
        const chat: Chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction },
            history: chatHistory.slice(1).map(msg => ({ // Skip initial greeting
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }))
        });

        const response = await chat.sendMessage({ message: userMessage });
        return response.text;
    } catch (error) {
        console.error("Error getting Gemini form helper response:", error);
        return "Sorry, I'm having trouble connecting right now. Please try again later.";
    }
};