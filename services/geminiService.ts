import { GoogleGenAI, Chat } from '@google/genai';
import type {
    ChatMessage,
    NewRequestDetails,
    Pipe,
    Session,
    TruckingInfo,
    StorageRequest,
    StorageDocument,
} from '../types';
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
    if (lowerMessage.includes('shipping') || lowerMessage.includes('ship')) {
        return Promise.resolve("Got it. A shipping request is now logged and the yard crew will reach out with a quote and schedule.");
    }
    if (lowerMessage.includes('where') || lowerMessage.includes('location')) {
        return Promise.resolve("Those joints are staged in Yard B, Row 14 — ready when you are.");
    }
    if (lowerMessage.includes('how many') || lowerMessage.includes('quantity')) {
        return Promise.resolve("Current tally shows 150 joints of L80 casing and 300 joints of S135 drill pipe on hand.");
    }
    return Promise.resolve("Roughneck here — give me a few more details and I'll get you the right info.");
};


export const getChatbotResponse = async (
    companyName: string,
    inventoryData: Pipe[],
    requests: StorageRequest[],
    documents: StorageDocument[],
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

    const requestById = new Map(requests.map((req) => [req.id, req]));
    const requestSummaries = requests.map((req) => ({
        referenceId: req.referenceId,
        status: req.status,
        assignedLocation: req.assignedLocation ?? null,
        storageStartDate: req.requestDetails?.storageStartDate ?? null,
        storageEndDate: req.requestDetails?.storageEndDate ?? null,
        truckingType: req.truckingInfo?.truckingType ?? null,
        submittedBy: req.userId,
        lastUpdated: req.updatedAt ?? req.createdAt ?? null,
        approvalSummary: req.approvalSummary ?? null,
        rejectionReason: req.rejectionReason ?? null,
    }));

    const documentSummaries = documents.map((doc) => {
        const linkedRequest = doc.requestId ? requestById.get(doc.requestId) : undefined;
        return {
            fileName: doc.fileName,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
            uploadedAt: doc.uploadedAt,
            requestReferenceId: linkedRequest?.referenceId ?? null,
            requestStatus: linkedRequest?.status ?? null,
            storagePath: doc.storagePath,
            extractedData: doc.extractedData ?? null,
        };
    });

    const inventoryJson = JSON.stringify(enrichedInventory, null, 2);
    const requestsJson = JSON.stringify(requestSummaries, null, 2);
    const documentsJson = JSON.stringify(documentSummaries, null, 2);

    const systemInstruction = `You are Roughneck, an oilfield-savvy PipeVault assistant supporting "${companyName}".
You are speaking with a representative from "${companyName}".
You can answer questions using the storage request data, uploaded documents, and inventory provided below.
If the user asks about something not in these datasets, politely explain that you do not have access to that information.

STORAGE REQUESTS (status, locations, dates):
${requestsJson}

UPLOADED DOCUMENTS (files linked to their projects):
${documentsJson}

INVENTORY (current pipe status and counts):
${inventoryJson}

Guidelines:
- Never reference or speculate about data outside of the datasets provided.
- Use a calm, experienced field-hand tone with clear, practical guidance.
- Reference the relevant request reference ID when discussing status.
- If a document exists for a request, mention the file name and type.
- When asked to schedule shipping, confirm details and then respond ONLY with: "A shipping request has been logged and our team will contact you shortly with a quote and schedule."
- If data is missing, acknowledge the gap and suggest contacting the MPS team.
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

    const systemInstruction = `You are Roughneck Ops, the oilfield operations assistant for the PipeVault admin desk at MPS Group.

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
- Maintain a Roughneck Ops tone: direct, practical, and oilfield-savvy.
- Stay within the provided context; do not speculate about missing data.
- Be concise and data-driven.
- Use specific numbers and metrics when available.
- Format responses clearly (bullet points, line breaks).
- Proactively suggest relevant follow-up information.
- If data is incomplete, acknowledge it.

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
1. What is a project reference? - Unique identifier for their project (AFE number, project name, etc.)
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
You: "A project reference is your unique identifier for this storage request - like an AFE number or project name. You'll use it to check status and chat with the MPS team later, so make it memorable!"

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

