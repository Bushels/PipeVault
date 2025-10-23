import { GoogleGenAI, Chat } from '@google/genai';
import type { ChatMessage, NewRequestDetails, Pipe, Session, TruckingInfo } from '../types';

if (!process.env.API_KEY) {
    console.warn("API_KEY environment variable not set. Using a mock response for Gemini API.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

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
    if (!process.env.API_KEY) return generateMockSummary(details, referenceId);

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
    if (!process.env.API_KEY) return getMockChatResponse(userMessage);

    const inventoryJson = JSON.stringify(inventoryData, null, 2);
    const systemInstruction = `You are a helpful inventory assistant for PipeStore Pro.
You are speaking with a representative from "${companyName}".
You can ONLY answer questions based on their pipe inventory provided below.
Do not make up information. If the user asks about something not in the data, or about another company, politely state that you do not have access to that information.
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