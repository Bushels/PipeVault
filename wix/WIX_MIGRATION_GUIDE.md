# PipeVault - Wix Migration Guide

This guide will help you deploy PipeVault on your Wix site.

## Prerequisites

- Wix Premium Plan (required for Velo)
- Claude API key (Anthropic)
- Gemini API key (Google) - Optional, has free tier

## Step 1: Enable Velo on Your Wix Site

1. Open your Wix site in the Editor
2. Click **Dev Mode** in the top menu
3. Enable **Velo Development Mode**

## Step 2: Create Wix Data Collections

Go to **Database** in the left sidebar and create these collections:

### Collection: `Companies`
- **Collection ID**: `Companies`
- **Permissions**: Site Content (read/write requires backend code)
- **Fields**:
  - `_id` (auto-generated)
  - `name` (Text)
  - `domain` (Text)
  - `_createdDate` (Date - auto)
  - `_updatedDate` (Date - auto)

### Collection: `StorageRequests`
- **Collection ID**: `StorageRequests`
- **Permissions**: Site Content
- **Fields**:
  - `_id` (auto-generated)
  - `companyId` (Text) - Reference to Companies
  - `userId` (Text) - Email address
  - `referenceId` (Text) - Project reference
  - `status` (Text) - PENDING, APPROVED, REJECTED
  - `requestDetails` (JSON) - All form data
  - `truckingInfo` (JSON)
  - `approvalSummary` (Text)
  - `assignedLocation` (Text)
  - `assignedRackIds` (Text - JSON array)
  - `rejectionReason` (Text)
  - `_createdDate` (Date - auto)
  - `_updatedDate` (Date - auto)

### Collection: `Inventory`
- **Collection ID**: `Inventory`
- **Permissions**: Site Content
- **Fields**:
  - `_id` (auto-generated)
  - `companyId` (Text)
  - `referenceId` (Text)
  - `rackId` (Text)
  - `status` (Text) - STORED, PICKED_UP
  - `pipeData` (JSON) - OD, weight, grade, etc.
  - `pickUpTimestamp` (Date)
  - `assignedUWI` (Text)
  - `assignedWellName` (Text)
  - `_createdDate` (Date - auto)

### Collection: `Yards`
- **Collection ID**: `Yards`
- **Permissions**: Admin only (Content Manager Permissions)
- **Fields**:
  - `_id` (auto-generated)
  - `yardId` (Text)
  - `name` (Text)
  - `areas` (JSON) - Array of areas with racks

### Collection: `TruckLoads`
- **Collection ID**: `TruckLoads`
- **Permissions**: Admin only
- **Fields**:
  - `_id` (auto-generated)
  - `loadNumber` (Text)
  - `truckDetails` (JSON)
  - `status` (Text)
  - `_createdDate` (Date - auto)

## Step 3: Store API Keys Securely

1. In Velo sidebar, click **Secrets Manager**
2. Add these secrets:
   - Name: `ANTHROPIC_API_KEY`, Value: `your-claude-api-key`
   - Name: `GOOGLE_AI_API_KEY`, Value: `your-gemini-api-key`

## Step 4: Add Backend Files

Create these files in the **Backend** section:

### File: `backend/ai.js` (or `.jsw` for web module)

```javascript
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';

/**
 * Call Claude API for form helper chatbot
 * @param {Array} messages - Chat history
 * @param {String} userMessage - New user message
 * @returns {Promise<String>} AI response
 */
export async function callClaudeAPI(messages, userMessage) {
  const apiKey = await getSecret('ANTHROPIC_API_KEY');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      system: `You are a helpful assistant for MPS Group's PipeVault storage facility...`,
      messages: [
        ...messages.map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.content
        })),
        { role: 'user', content: userMessage }
      ]
    })
  });

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Generate request summary using Gemini
 * @param {Object} requestData - Storage request data
 * @returns {Promise<String>} Summary text
 */
export async function generateRequestSummary(requestData) {
  const apiKey = await getSecret('GOOGLE_AI_API_KEY');

  const prompt = `Generate a professional summary for this pipe storage request:
Company: ${requestData.companyName}
Contact: ${requestData.fullName} (${requestData.contactEmail})
Reference: ${requestData.referenceId}
Pipe Type: ${requestData.itemType}
... (include all relevant details)

Create a concise 2-3 sentence summary.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
```

### File: `backend/data.jsw` (Web Module - callable from frontend)

```javascript
import wixData from 'wix-data';
import { generateRequestSummary } from './ai';

/**
 * Add a new storage request
 * @param {Object} requestData
 * @returns {Promise<Object>} Created request
 */
export async function addStorageRequest(requestData) {
  // Generate AI summary
  const summary = await generateRequestSummary(requestData);

  // Insert into collection
  const result = await wixData.insert('StorageRequests', {
    companyId: requestData.companyId,
    userId: requestData.userId,
    referenceId: requestData.referenceId,
    status: 'PENDING',
    requestDetails: requestData.requestDetails,
    truckingInfo: requestData.truckingInfo,
    approvalSummary: summary
  });

  return result;
}

/**
 * Get storage requests for a company
 * @param {String} companyId
 * @returns {Promise<Array>} Requests
 */
export async function getCompanyRequests(companyId) {
  const results = await wixData.query('StorageRequests')
    .eq('companyId', companyId)
    .descending('_createdDate')
    .find();

  return results.items;
}

/**
 * Find or create company by email domain
 * @param {String} email
 * @param {String} companyName
 * @returns {Promise<Object>} Company
 */
export async function findOrCreateCompany(email, companyName) {
  const domain = email.split('@')[1];

  // Try to find existing company
  const results = await wixData.query('Companies')
    .eq('domain', domain)
    .find();

  if (results.items.length > 0) {
    return results.items[0];
  }

  // Create new company
  const newCompany = await wixData.insert('Companies', {
    name: companyName,
    domain: domain
  });

  return newCompany;
}

/**
 * Get inventory for a company
 * @param {String} companyId
 * @returns {Promise<Array>} Inventory items
 */
export async function getCompanyInventory(companyId) {
  const results = await wixData.query('Inventory')
    .eq('companyId', companyId)
    .find();

  return results.items;
}
```

## Step 5: Add Frontend Page Code

In your Wix page's **Page Code** (not in an external file):

```javascript
import { addStorageRequest, findOrCreateCompany } from 'backend/data';
import { callClaudeAPI } from 'backend/ai';

$w.onReady(function () {
  // Handle form submission
  $w('#submitButton').onClick(async () => {
    const formData = {
      companyName: $w('#companyNameInput').value,
      fullName: $w('#fullNameInput').value,
      contactEmail: $w('#emailInput').value,
      contactNumber: $w('#phoneInput').value,
      referenceId: $w('#referenceInput').value,
      // ... collect all form fields
    };

    // Find or create company
    const company = await findOrCreateCompany(
      formData.contactEmail,
      formData.companyName
    );

    // Submit request
    const request = await addStorageRequest({
      companyId: company._id,
      userId: formData.contactEmail,
      referenceId: formData.referenceId,
      requestDetails: formData,
      truckingInfo: { /* trucking data */ }
    });

    // Show success message
    $w('#successText').text = `Request submitted! Reference ID: ${request.referenceId}`;
    $w('#successBox').show();
  });

  // Handle chatbot
  let chatHistory = [];

  $w('#chatSendButton').onClick(async () => {
    const userMessage = $w('#chatInput').value;
    chatHistory.push({ role: 'user', content: userMessage });

    // Call AI
    const aiResponse = await callClaudeAPI(chatHistory, userMessage);
    chatHistory.push({ role: 'model', content: aiResponse });

    // Display in chat
    $w('#chatDisplay').text += `\n\nYou: ${userMessage}\n\nAI: ${aiResponse}`;
    $w('#chatInput').value = '';
  });
});
```

## Step 6: Alternative - Embed React App

If you want to keep your React code:

1. Build your React app: `npm run build`
2. Host the build files on Wix Media or external CDN
3. Use Custom Element or iFrame to embed:

```javascript
// In Wix page code
$w('#customElement1').setAttribute('src', 'https://your-cdn.com/index.html');
```

Or use `@wix/react-velo` package (requires npm package installation via Velo).

## Step 7: Update React Code for Wix (If Using React)

Replace Supabase calls with Wix backend calls:

```javascript
// Old:
import { supabase } from './lib/supabase';

// New:
import { addStorageRequest, getCompanyRequests } from 'backend/data';

// Usage remains similar
const requests = await getCompanyRequests(companyId);
```

## Step 8: Test & Deploy

1. **Preview** your site to test all functionality
2. **Test Database**: Add test data, verify collections work
3. **Test AI**: Verify chatbot and summary generation
4. **Publish** your site when ready

## Recommended Approach

**For Wix:** I recommend building a **native Wix page** using Velo instead of embedding React. Benefits:
- Better SEO
- Faster load times
- Native Wix features (members area, payments, etc.)
- Easier maintenance

We can convert the React components to Wix repeaters, forms, and custom elements.

Would you like me to create the native Wix version?
