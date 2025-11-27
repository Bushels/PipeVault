# Roughneck AI Reference & Development Log

This document tracks the features, capabilities, and ongoing development of the PipeVault AI assistants: Roughneck (customer-facing) and Roughneck Ops (admin-facing).

## 1. Overview

The Roughneck AI is designed to be a proactive, personalized, and context-aware assistant for PipeVault users. Its goal is to streamline user workflows, provide actionable insights, and offer a highly intuitive, conversational interface for managing pipe storage.

**Core Components:**
- **AI Service:** `services/geminiService.ts` - Contains the core logic for interacting with the Google Gemini API, including prompt construction and data scoping.
- **Chat UI:** `components/Chatbot.tsx` - The main React component for the chat interface.
- **Conversation Scripts:** `services/conversationScripts.ts` - Defines structured conversation flows for specific tasks (e.g., new storage requests).

## 2. Development Roadmap

This section outlines the planned phases for enhancing the AI's capabilities.

### Phase 1: Prompt Suggestions (✅ Completed)

- **Goal:** Guide users and showcase the AI's capabilities through clickable prompt suggestions.
- **Implementation:**
    - Modified `components/Chatbot.tsx` to display a list of pre-defined questions as buttons.
    - These buttons appear only on the initial chat screen before the conversation begins.
    - Clicking a button automatically sends that prompt to the chatbot.
    - The `handleSend` function was updated to support programmatic message sending.

### Phase 2: Proactive Inventory Insights (Upcoming)

- **Goal:** Make the AI's greeting dynamic and actionable by having it analyze the user's data upon opening the chat.
- **Planned Implementation:**
    - A new function will be created in `services/geminiService.ts` to generate insights from the user's `requests` and `inventoryData`.
    - The `Chatbot.tsx` component will call this function to generate a dynamic opening message.
    - **Example:** "Good morning! I see you have 2,800m of casing scheduled for site delivery soon. Would you like to schedule a pickup from the MPS yard?"

### Phase 3: External API Integration (Planned)

- **Goal:** Connect the AI to external services to provide real-time, personalized information (weather, market news, sports).
- **Planned Implementation:**
    - **Secure API Calls:** New Supabase Edge Functions will be created to securely call external APIs (e.g., tomorrow.io) and manage API keys.
    - **AI Integration:** The AI service will be updated to call these functions and incorporate the external data into its conversational responses.
    - **Personalization:** Future work may include storing user preferences (e.g., favorite sports team, stocks to follow) in the database to enhance personalization.
    - **Note:** API keys for `tomorrow.io` have been added to Supabase secrets and are ready for use in a dedicated Edge Function.

---
*This document was last updated on: 2025-10-31*
