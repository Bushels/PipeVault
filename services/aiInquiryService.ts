// AI Inquiry Service for customer questions
import { GoogleGenAI } from '@google/genai';
import type { ChatMessage } from '../types';
import {
  getStorageRequestByProjectRef,
  getInventoryByProjectRef,
  getDeliveriesByCustomer,
  getPickupsByCustomer,
} from './wixData';

const ai = process.env.API_KEY ? new GoogleGenAI({ apiKey: process.env.API_KEY }) : null;

// Generate mock response when no API key
const generateMockResponse = (userMessage: string): string => {
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('status')) {
    return `Your storage request is currently **approved** and active. Your pipes are safely stored in Yard B, Rack B-S-1.`;
  }

  if (lowerMessage.includes('last delivery') || lowerMessage.includes('last load')) {
    return `The last delivery was on **March 15, 2024** at 10:30 AM. We received 150 joints delivered by ABC Trucking.`;
  }

  if (lowerMessage.includes('how many') || lowerMessage.includes('joints')) {
    return `You currently have **450 joints** in storage, totaling approximately **5,400 metres** of pipe.`;
  }

  if (lowerMessage.includes('where') || lowerMessage.includes('location')) {
    return `Your pipes are stored in **Yard B, South Section, Rack B-S-1**. This is a covered storage area for protection from the elements.`;
  }

  if (lowerMessage.includes('deliver') && !lowerMessage.includes('last')) {
    return `You still need to deliver **200 joints** to reach your total storage request. Would you like to schedule a delivery?`;
  }

  if (lowerMessage.includes('pickup')) {
    return `You haven't scheduled any pickups yet. To request a pickup, you can use the "Request Pickup" option from the main menu.`;
  }

  if (lowerMessage.includes('cost') || lowerMessage.includes('price') || lowerMessage.includes('fee')) {
    return `Your current storage is part of our **free storage program**. There are no charges for the storage period specified in your request. If you need extended storage or additional services, please contact our team for pricing.`;
  }

  if (lowerMessage.includes('trucking') || lowerMessage.includes('transport')) {
    return `We can provide trucking services for both delivery and pickup. Would you like a trucking quote? You can request one through the "Schedule Delivery" or "Request Pickup" options in the main menu.`;
  }

  return `I can help you with information about your storage. You can ask me about:
• Current status of your storage request
• Delivery history and scheduling
• Number of joints in storage
• Storage location
• Pickup requests
• Trucking services

What would you like to know?`;
};

export const getInquiryChatResponse = async (
  customerEmail: string,
  projectReference: string,
  chatHistory: ChatMessage[],
  userMessage: string
): Promise<string> => {
  try {
    // Fetch customer data from mock database
    const requestResponse = await getStorageRequestByProjectRef(customerEmail, projectReference);
    const inventoryResponse = await getInventoryByProjectRef(customerEmail, projectReference);
    const deliveriesResponse = await getDeliveriesByCustomer(customerEmail);
    const pickupsResponse = await getPickupsByCustomer(customerEmail);

    // Build context from customer data
    let contextData = '';

    if (requestResponse.success && requestResponse.data) {
      const req = requestResponse.data;
      contextData += `\nStorage Request Information:
- Request Number: ${req.requestNumber}
- Status: ${req.status}
- Project Reference: ${req.projectReference}
- Company: ${req.companyName}
- Contact: ${req.contactName}
- Item Type: ${req.itemType}
- Total Joints: ${req.totalJoints}
- Total Length: ${req.totalLength} metres
- Storage Period: ${new Date(req.storageStartDate).toLocaleDateString()} to ${new Date(req.storageEndDate).toLocaleDateString()}
- Assigned Yard: ${req.assignedYard || 'Not yet assigned'}
- Assigned Rack: ${req.assignedRack || 'Not yet assigned'}
`;
    }

    if (inventoryResponse.success && inventoryResponse.data) {
      const inv = inventoryResponse.data;
      contextData += `\nCurrent Inventory:
- Joints Delivered: ${inv.jointsDelivered}
- Joints Picked Up: ${inv.jointsPickedUp}
- Joints Currently in Storage: ${inv.jointsInStorage}
- Total Length in Storage: ${inv.totalLengthInStorage} metres
- Yard Location: ${inv.yardLocation || 'Not assigned'}
- Rack Locations: ${inv.rackLocations || 'Not assigned'}
- Last Delivery: ${inv.lastDeliveryDate ? new Date(inv.lastDeliveryDate).toLocaleDateString() : 'No deliveries yet'}
- Last Pickup: ${inv.lastPickupDate ? new Date(inv.lastPickupDate).toLocaleDateString() : 'No pickups yet'}
`;
    }

    if (deliveriesResponse.success && deliveriesResponse.data && deliveriesResponse.data.length > 0) {
      contextData += `\nDelivery History (${deliveriesResponse.data.length} deliveries):`;
      deliveriesResponse.data.slice(0, 5).forEach((delivery) => {
        contextData += `\n- ${delivery.deliveryNumber}: ${new Date(delivery.deliveryDate).toLocaleDateString()} - ${delivery.totalJointsDelivery} joints - Status: ${delivery.status}`;
      });
    }

    if (pickupsResponse.success && pickupsResponse.data && pickupsResponse.data.length > 0) {
      contextData += `\nPickup History (${pickupsResponse.data.length} pickups):`;
      pickupsResponse.data.slice(0, 5).forEach((pickup) => {
        contextData += `\n- ${pickup.pickupNumber}: ${new Date(pickup.pickupDate).toLocaleDateString()} - ${pickup.totalJointsPickup} joints - Status: ${pickup.status}`;
      });
    }

    // If no data found, return error message
    if (!contextData) {
      return `I couldn't find any storage information for project reference "${projectReference}" under email ${customerEmail}. Please verify your project reference number or submit a new storage request if you haven't done so yet.`;
    }

    // If no AI API key, use mock responses
    if (!ai) {
      return generateMockResponse(userMessage);
    }

    // Build system instruction
    const systemInstruction = `You are a helpful AI assistant for PipeVault, a pipe storage inventory system.
You are currently helping a customer inquire about their storage.

Customer Information:
- Email: ${customerEmail}
- Project Reference: ${projectReference}

${contextData}

IMPORTANT RULES:
1. Only answer questions based on the data provided above
2. Be concise and friendly
3. If asked about something not in the data, politely say you don't have that information
4. Format numbers and dates clearly
5. When giving status updates, be specific with the actual status
6. If they ask about scheduling deliveries or pickups, tell them to use the main menu options
7. Always be helpful and suggest next steps when appropriate

Answer the customer's question based on their data.`;

    // Create chat and get response
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction },
      history: chatHistory.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
    });

    const response = await chat.sendMessage({ message: userMessage });
    return response.text;
  } catch (error) {
    console.error('Error getting inquiry response:', error);
    return generateMockResponse(userMessage);
  }
};
