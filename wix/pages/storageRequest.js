/**
 * Storage Request Page - Frontend Code
 *
 * This file goes in your Wix Page Code (not backend)
 * Wire up your Wix elements to these handlers
 *
 * REQUIRED WIX ELEMENTS ON PAGE:
 * - #companyNameInput (Text Input)
 * - #fullNameInput (Text Input)
 * - #emailInput (Text Input)
 * - #phoneInput (Text Input)
 * - #referenceInput (Text Input)
 * - #itemTypeDropdown (Dropdown)
 * - #gradeDropdown (Dropdown)
 * - #connectionDropdown (Dropdown)
 * - #odDropdown (Dropdown)
 * - #weightDropdown (Dropdown)
 * - #avgLengthInput (Number Input)
 * - #totalJointsInput (Number Input)
 * - #startDatePicker (Date Picker)
 * - #endDatePicker (Date Picker)
 * - #truckingQuoteButton (Button)
 * - #truckingOwnButton (Button)
 * - #submitButton (Button)
 * - #successBox (Box - hidden by default)
 * - #successMessage (Text)
 * - #errorMessage (Text - hidden by default)
 * - #chatInput (Text Input)
 * - #chatSendButton (Button)
 * - #chatMessages (Text - for displaying chat history)
 */

import { submitStorageRequest } from 'backend/data';
import { callClaudeFormHelper } from 'backend/ai';

let truckingType = null;
let chatHistory = [];

$w.onReady(function () {
  // Hide success/error messages initially
  $w('#successBox').hide();
  $w('#errorMessage').hide();

  // Populate dropdowns
  populateDropdowns();

  // Setup event handlers
  setupFormHandlers();
  setupChatbot();
});

/**
 * Populate form dropdowns
 */
function populateDropdowns() {
  // Item types
  $w('#itemTypeDropdown').options = [
    { label: 'Blank Pipe', value: 'Blank Pipe' },
    { label: 'Sand Control', value: 'Sand Control' },
    { label: 'Flow Control', value: 'Flow Control' },
    { label: 'Tools', value: 'Tools' },
    { label: 'Other', value: 'Other' }
  ];

  // Grades
  $w('#gradeDropdown').options = [
    { label: 'H40', value: 'H40' },
    { label: 'J55', value: 'J55' },
    { label: 'L80', value: 'L80' },
    { label: 'N80', value: 'N80' },
    { label: 'C90', value: 'C90' },
    { label: 'T95', value: 'T95' },
    { label: 'P110', value: 'P110' },
    { label: 'Other', value: 'Other' }
  ];

  // Connection types
  $w('#connectionDropdown').options = [
    { label: 'NUE', value: 'NUE' },
    { label: 'EUE', value: 'EUE' },
    { label: 'BTC', value: 'BTC' },
    { label: 'Premium', value: 'Premium' },
    { label: 'Semi-Premium', value: 'Semi-Premium' },
    { label: 'Other', value: 'Other' }
  ];

  // OD sizes (common casing sizes)
  $w('#odDropdown').options = [
    { label: '4.5"', value: '4.5' },
    { label: '5.5"', value: '5.5' },
    { label: '7"', value: '7' },
    { label: '9.625"', value: '9.625' },
    { label: '13.375"', value: '13.375' }
  ];

  // Set defaults
  $w('#itemTypeDropdown').value = 'Blank Pipe';
  $w('#gradeDropdown').value = 'J55';
  $w('#connectionDropdown').value = 'BTC';
}

/**
 * Setup form event handlers
 */
function setupFormHandlers() {
  // Trucking selection
  $w('#truckingQuoteButton').onClick(() => {
    truckingType = 'quote';
    $w('#truckingQuoteButton').style.backgroundColor = '#dc2626';
    $w('#truckingOwnButton').style.backgroundColor = '#374151';
  });

  $w('#truckingOwnButton').onClick(() => {
    truckingType = 'provided';
    $w('#truckingOwnButton').style.backgroundColor = '#dc2626';
    $w('#truckingQuoteButton').style.backgroundColor = '#374151';
  });

  // Form submission
  $w('#submitButton').onClick(async () => {
    await handleFormSubmit();
  });
}

/**
 * Handle form submission
 */
async function handleFormSubmit() {
  try {
    // Hide previous messages
    $w('#successBox').hide();
    $w('#errorMessage').hide();

    // Validate required fields
    if (!validateForm()) {
      $w('#errorMessage').text = 'Please fill in all required fields.';
      $w('#errorMessage').show();
      return;
    }

    if (!truckingType) {
      $w('#errorMessage').text = 'Please select a trucking option.';
      $w('#errorMessage').show();
      return;
    }

    // Show loading state
    $w('#submitButton').label = 'Submitting...';
    $w('#submitButton').disable();

    // Collect form data
    const requestData = {
      userId: $w('#emailInput').value,
      referenceId: $w('#referenceInput').value,
      requestDetails: {
        companyName: $w('#companyNameInput').value,
        fullName: $w('#fullNameInput').value,
        contactEmail: $w('#emailInput').value,
        contactNumber: $w('#phoneInput').value,
        itemType: $w('#itemTypeDropdown').value,
        grade: $w('#gradeDropdown').value,
        connection: $w('#connectionDropdown').value,
        casingSpec: {
          size_in: parseFloat($w('#odDropdown').value),
          weight_lbs_ft: parseFloat($w('#weightDropdown').value || 0)
        },
        avgJointLength: parseFloat($w('#avgLengthInput').value),
        totalJoints: parseInt($w('#totalJointsInput').value),
        storageStartDate: $w('#startDatePicker').value.toISOString().split('T')[0],
        storageEndDate: $w('#endDatePicker').value.toISOString().split('T')[0]
      },
      truckingInfo: {
        truckingType: truckingType,
        details: {}
      }
    };

    // Submit to backend
    const result = await submitStorageRequest(requestData);

    // Show success message
    $w('#successMessage').text = `
      ✅ Request Submitted Successfully!

      Your Reference ID: ${result.referenceId}

      ⚠️ IMPORTANT: Save this Reference ID! You'll need it to:
      - Check your request status
      - Schedule deliveries
      - Make inquiries

      We'll email you at ${result.userId} when your request is approved.
    `;
    $w('#successBox').show();

    // Reset form
    resetForm();

  } catch (error) {
    console.error('Error submitting request:', error);
    $w('#errorMessage').text = 'An error occurred. Please try again.';
    $w('#errorMessage').show();
  } finally {
    // Reset button
    $w('#submitButton').label = 'Submit Request';
    $w('#submitButton').enable();
  }
}

/**
 * Validate form fields
 */
function validateForm() {
  const requiredFields = [
    '#companyNameInput',
    '#fullNameInput',
    '#emailInput',
    '#phoneInput',
    '#referenceInput',
    '#avgLengthInput',
    '#totalJointsInput',
    '#startDatePicker',
    '#endDatePicker'
  ];

  for (const fieldId of requiredFields) {
    const value = $w(fieldId).value;
    if (!value || value === '') {
      return false;
    }
  }

  // Validate email format
  const email = $w('#emailInput').value;
  if (!email.includes('@')) {
    return false;
  }

  return true;
}

/**
 * Reset form after successful submission
 */
function resetForm() {
  $w('#companyNameInput').value = '';
  $w('#fullNameInput').value = '';
  $w('#emailInput').value = '';
  $w('#phoneInput').value = '';
  $w('#referenceInput').value = '';
  $w('#avgLengthInput').value = null;
  $w('#totalJointsInput').value = null;
  truckingType = null;
  $w('#truckingQuoteButton').style.backgroundColor = '#374151';
  $w('#truckingOwnButton').style.backgroundColor = '#374151';
}

/**
 * Setup AI chatbot
 */
function setupChatbot() {
  // Initialize chat with welcome message
  displayChatMessage('assistant', `Hi! I'm here to help you fill out the storage request form.

💡 **Celebrating 20 Years of MPS!** You're getting FREE pipe storage as part of our anniversary promotion.

Ask me anything about the form fields - what is a project reference, connection types, how to calculate joints, etc.`);

  // Handle send button
  $w('#chatSendButton').onClick(async () => {
    await handleChatMessage();
  });

  // Handle Enter key in chat input
  $w('#chatInput').onKeyPress(async (event) => {
    if (event.key === 'Enter') {
      await handleChatMessage();
    }
  });
}

/**
 * Handle chat message
 */
async function handleChatMessage() {
  const userMessage = $w('#chatInput').value;

  if (!userMessage || userMessage.trim() === '') {
    return;
  }

  // Display user message
  displayChatMessage('user', userMessage);

  // Clear input
  $w('#chatInput').value = '';

  // Disable send button while processing
  $w('#chatSendButton').disable();

  try {
    // Call AI backend
    const aiResponse = await callClaudeFormHelper(chatHistory, userMessage);

    // Add to history
    chatHistory.push({ role: 'user', content: userMessage });
    chatHistory.push({ role: 'model', content: aiResponse });

    // Display AI response
    displayChatMessage('assistant', aiResponse);
  } catch (error) {
    console.error('Chat error:', error);
    displayChatMessage('assistant', 'Sorry, I encountered an error. Please try again.');
  } finally {
    // Re-enable send button
    $w('#chatSendButton').enable();
  }
}

/**
 * Display chat message
 */
function displayChatMessage(role, content) {
  const prefix = role === 'user' ? '👤 You' : '🤖 AI Assistant';
  const currentText = $w('#chatMessages').text;
  $w('#chatMessages').text = `${currentText}\n\n${prefix}:\n${content}`;

  // Scroll to bottom (if possible with Wix element)
  // Note: Wix doesn't have built-in scroll, may need custom solution
}
