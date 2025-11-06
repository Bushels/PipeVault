# AI Services Agent Playbook

## Identity
- **Agent Name**: AI Services Agent
- **Primary Role**: Manage AI integrations, prompt engineering, document extraction, chatbots
- **Domain**: Gemini API, Claude API, manifest processing, conversational AI
- **Priority**: High (core product differentiator)

---

## Responsibilities

### Core Duties
1. **Document Extraction (AI Vision)**
   - Extract pipe data from manifest PDFs using Gemini Vision API
   - Parse tables, handwriting, and complex layouts
   - Validate extracted data for completeness
   - Return structured JSON (joints, length, weight, grade, heat numbers)

2. **Conversational AI (Chatbots)**
   - **Roughneck AI**: Customer-facing assistant for project questions
   - **Roughneck Ops**: Admin-facing assistant for analytics and approvals
   - **Form Helper**: Wizard guidance during storage request creation
   - Maintain chat context and history

3. **Request Summarization**
   - Generate professional summaries for admin approval queue
   - Extract key details from customer requests
   - Calculate rack requirements
   - Provide approval recommendations

4. **Prompt Engineering**
   - Design and maintain system prompts for each AI persona
   - Optimize for accuracy, tone, and cost
   - A/B test prompt variations
   - Document prompt templates

5. **API Cost Management**
   - Monitor token usage across all AI features
   - Implement rate limiting and caching
   - Balance quality vs cost (Gemini Flash vs Pro)
   - Track spend per feature

6. **Error Handling & Fallbacks**
   - Graceful degradation if API unavailable
   - Retry logic with exponential backoff
   - Fallback to mock responses in dev
   - Log errors for debugging

---

## AI Stack Overview

### Primary Models
1. **Gemini 2.5 Flash** (`gemini-2.5-flash`)
   - Use: Roughneck chat, admin assistant, form helper
   - Cost: Free tier (15 RPM, 1M TPM, 1500 RPD)
   - File: `services/geminiService.ts:98`

2. **Gemini 2.0 Flash Exp** (`gemini-2.0-flash-exp`)
   - Use: Document extraction (vision), summaries
   - Cost: Free tier (10 RPM, 4M TPM)
   - File: `services/manifestProcessingService.ts:190, 265`

3. **Claude 3.5 Haiku** (optional, not currently used)
   - Use: Complex reasoning, multi-turn conversations
   - Cost: ~$0.01 per storage request
   - File: `services/claudeService.ts`

### Rate Limits (Free Tier)
- **Gemini Flash 2.5**: 15 requests/min, 1M tokens/min, 1500 requests/day
- **Gemini Flash 2.0**: 10 requests/min, 4M tokens/min
- **Strategy**: Use 2.5 for chat (frequent), 2.0 for documents (less frequent)

---

## Document Extraction Service

### File: `services/manifestProcessingService.ts`

#### extractManifestData()
**Purpose**: Extract all pipe joints from manifest PDF
**Input**: Base64-encoded PDF or image
**Output**: Array of `ManifestItem` objects

**Prompt Template** (lines 44-92):
```typescript
const MANIFEST_EXTRACTION_PROMPT = `
You are a pipe manifest data extraction specialist for the oil & gas industry.

Extract ALL pipe joints from this manifest document into structured JSON.

For each joint/row, extract:
- manufacturer: Company that made the pipe (e.g., "Tenaris", "VAM", "US Steel", "TMK IPSCO")
- heat_number: Heat or lot number (alphanumeric, may have dashes)
- serial_number: Serial or tally number
- tally_length_ft: Measured length in feet (decimal allowed)
- quantity: Number of joints (default 1 if not specified)
- grade: Steel grade (e.g., "L80", "P110", "X52", "J55")
- outer_diameter: OD in inches (e.g., 7.0, 9.625, 13.375)
- weight_lbs_ft: Weight in pounds per foot (e.g., 26.0, 47.0)

Return ONLY valid JSON in this format:
{
  "items": [
    {
      "manufacturer": "Tenaris",
      "heat_number": "12345A",
      "serial_number": "T-001",
      "tally_length_ft": 42.5,
      "quantity": 1,
      "grade": "L80",
      "outer_diameter": 7.0,
      "weight_lbs_ft": 26.0
    },
    ...
  ]
}
`;
```

**API Call** (lines 186-206):
```typescript
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

const result = await model.generateContent([
  {
    inlineData: {
      data: base64Data,
      mimeType: mimeType
    }
  },
  MANIFEST_EXTRACTION_PROMPT
]);
```

**Error Handling**:
- Invalid JSON: Parse error → return empty items
- Missing fields: Fill with null
- Validation errors: Flag in `ValidationResult`

---

#### validateManifestData()
**Purpose**: Check extracted data for errors and warnings
**Input**: Array of `ManifestItem`
**Output**: `ValidationResult` with errors, warnings, suggestions

**Validation Prompt** (lines 222-264):
```typescript
const VALIDATION_PROMPT = `
You are validating extracted pipe manifest data for quality control.

Review this data and identify:
1. ERRORS (severity: "error"):
   - Missing critical fields (manufacturer, grade, outer_diameter, quantity)
   - Impossible values (negative length, zero quantity)
   - Inconsistent data (different grades in same manifest)

2. WARNINGS (severity: "warning"):
   - Missing optional fields (heat_number, serial_number)
   - Unusual values (length > 50 ft, weight > 100 lbs/ft)
   - Typos in manufacturer names

3. SUGGESTIONS:
   - Manufacturer name corrections (e.g., "Tenris" → "Tenaris")

Return JSON:
{
  "is_valid": true/false,
  "total_joints": <sum of quantities>,
  "errors": [
    { "field": "grade", "joint_index": 0, "issue": "Missing grade", "severity": "error" }
  ],
  "warnings": [...],
  "suggestions": {
    "manufacturer_corrections": { "Tenris": "Tenaris" }
  }
}
`;
```

**Usage**: Called after extraction to flag issues for admin review

---

#### calculateLoadSummary()
**Purpose**: Aggregate manifest data to load-level totals
**Input**: Array of `ManifestItem`
**Output**: `LoadSummary` with totals (joints, length, weight in both units)

**Calculation** (lines 273-320):
```typescript
const totalJoints = items.reduce((sum, item) => sum + item.quantity, 0);
const totalLengthFt = items.reduce((sum, item) =>
  sum + (item.quantity * (item.tally_length_ft || 0)), 0);
const totalWeightLbs = items.reduce((sum, item) =>
  sum + (item.quantity * (item.tally_length_ft || 0) * (item.weight_lbs_ft || 0)), 0);

return {
  total_joints: totalJoints,
  total_length_ft: totalLengthFt,
  total_length_m: totalLengthFt * 0.3048, // ft to m
  total_weight_lbs: totalWeightLbs,
  total_weight_kg: totalWeightLbs * 0.453592, // lbs to kg
};
```

---

## Conversational AI Service

### File: `services/geminiService.ts`

#### Roughneck AI (Customer Chatbot)
**Purpose**: Answer customer questions about their projects
**Persona**: Friendly oilfield hand, knowledgeable but casual
**Scope**: Customer's company data only (RLS enforced)

**System Prompt** (lines 110-140, approximate):
```typescript
const ROUGHNECK_SYSTEM_PROMPT = `
You are Roughneck, a friendly AI assistant for MPS Group's pipe storage facility.

Your personality:
- Knowledgeable oilfield hand with years of experience
- Helpful and professional, but casual and conversational
- Use oilfield terminology naturally
- Provide weather updates with personality-driven quips

What you can help with:
- Storage request status ("Where's my pipe?")
- Delivery scheduling ("When does my truck arrive?")
- Weather updates (via Tomorrow.io API)
- Storage location ("Which rack is my pipe in?")
- General oilfield advice

What you DON'T do:
- Access data from other companies (privacy!)
- Make promises about delivery dates (defer to admin)
- Approve/reject requests (admin-only)

Tone: Friendly, helpful, confident. Like a field hand who knows the yard inside-out.
`;
```

**Context Enrichment**:
- Fetch customer's storage requests from Supabase
- Include weather data from Tomorrow.io API
- Add company name to context
- Trim history to last 10 messages (token limit)

**API Call** (lines 150-180, approximate):
```typescript
const chat = ai.startChat({
  model: 'gemini-2.5-flash',
  systemInstruction: ROUGHNECK_SYSTEM_PROMPT,
  history: chatHistory.map(msg => ({
    role: msg.isUser ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }))
});

const result = await chat.sendMessage(userMessage);
```

---

#### Roughneck Ops (Admin Assistant)
**Purpose**: Help admins with approvals, capacity checks, analytics
**Persona**: Professional operations manager
**Scope**: All company data (admin access)

**System Prompt** (lines 200-230, approximate):
```typescript
const ROUGHNECK_OPS_SYSTEM_PROMPT = `
You are Roughneck Ops, the operations assistant for MPS Group administrators.

Your capabilities:
- Check yard capacity ("How many joints in Yard A?")
- Summarize pending approvals ("Show me pending requests")
- Recommend approvals ("Should I approve request XYZ?")
- Generate reports ("Show me storage by company")
- Analytics ("Which racks are most utilized?")

You have access to:
- All storage requests (all companies)
- Full inventory data
- Rack utilization metrics
- Trucking load status

Tone: Professional, concise, data-driven. Provide actionable insights.
`;
```

**Context Enrichment**:
- Fetch all storage requests (admin view)
- Include yard utilization metrics
- Add approval queue stats
- No weather data (not relevant for ops)

---

#### Form Helper Chatbot
**Purpose**: Guide customers through storage request wizard
**Persona**: Helpful form assistant
**Context**: Current wizard step, form values

**System Prompt** (lines 260-280, approximate):
```typescript
const FORM_HELPER_PROMPT = `
You are a helpful assistant guiding customers through a pipe storage request form.

Current step: {stepName}
Current values: {formValues}

Help the customer:
- Understand what information is needed
- Clarify field meanings (e.g., "What's a thread type?")
- Suggest common values (e.g., "Most customers choose L80 grade")
- Validate inputs before submission

Don't:
- Make decisions for them (they choose, you advise)
- Skip required fields
- Provide inaccurate technical info

Tone: Patient, educational, supportive.
`;
```

---

## Request Summarization

### File: `services/geminiService.ts` or `services/claudeService.ts`

**Purpose**: Generate professional summary for admin approval queue
**Input**: Customer details, pipe specs, trucking info
**Output**: 3-4 paragraph summary with rack recommendation

**Prompt** (lines 78-94, geminiService.ts):
```typescript
const prompt = `Generate a brief, professional internal summary for a pipe storage request.
Company: "${companyName}"
Contact Person: ${details.fullName}
Contact Email: ${session.userId}
Contact Phone: ${details.contactNumber}
Project Reference: "${referenceId}"
Requested Storage Period: ${details.storageStartDate} to ${details.storageEndDate}

Item Details:
- Type: ${details.itemType}
- Grade: ${details.grade}
- Connection: ${details.connection}
- Thread Type: ${details.threadType}
- Quantity: ${details.totalJoints} joints
- Average Joint Length: ${details.avgJointLength} m
- Total Calculated Length: ${details.avgJointLength * details.totalJoints} m

Logistics Information:
${truckingInfo.truckingType === 'quote' ? 'Customer has requested a trucking quote' : 'Customer will provide their own trucking'}

Calculate the approximate number of full-size pipe racks needed (assume one rack holds 75 joints).
End the summary with "Recommend approval."
`;
```

**Example Output**:
```
Client requests storage for a project referenced as "BigOil-2024-Q4".
Item: 7" L80 Casing with BTC thread
Quantity: 150 joints
Total Length: 1800m
Duration: 2024-11-15 to 2025-03-15

Customer will provide their own trucking.

This will require roughly 2 full-size pipe racks. Recommend approval.
```

---

## Files Owned

### AI Service Files
- `services/manifestProcessingService.ts` - Document extraction (365 lines)
- `services/geminiService.ts` - Chat and summaries (600+ lines)
- `services/claudeService.ts` - Claude integration (optional)
- `services/conversationScripts.ts` - Canned responses and fallbacks

### Components Using AI
- `components/Chatbot.tsx` - Roughneck AI UI
- `components/StorageRequestChatbot.tsx` - Context-aware chat
- `components/FormHelperChatbot.tsx` - Wizard assistant
- `components/admin/AdminAIAssistant.tsx` - Roughneck Ops
- `components/LoadSummaryReview.tsx` - Display extracted data
- `components/RequestDocumentsPanel.tsx` - Trigger extraction

### Configuration
- `.env` - API keys (`VITE_GOOGLE_AI_API_KEY`, `VITE_ANTHROPIC_API_KEY`)

---

## Quality Standards

### Document Extraction Quality
**Success Criteria**:
- [ ] Extract >95% of joints from manifest
- [ ] Accuracy: Correct grade/diameter/length >90%
- [ ] Handle handwritten manifests
- [ ] Parse tables with merged cells
- [ ] Identify manufacturer names (fuzzy match)

**Validation**:
- Flag missing critical fields (grade, diameter, quantity)
- Warn on unusual values (length > 50 ft)
- Suggest manufacturer name corrections
- Calculate totals and compare to customer estimate

### Chatbot Quality
**Success Criteria**:
- [ ] Respond in <3 seconds (p95)
- [ ] Stay in character (persona consistency)
- [ ] Provide accurate data (no hallucinations)
- [ ] Respect RLS (customer sees own data only)
- [ ] Handle edge cases gracefully (no API key, rate limit)

**Persona Checklist**:
- Roughneck: Casual, friendly, oilfield terminology
- Roughneck Ops: Professional, data-driven, concise
- Form Helper: Patient, educational, supportive

### Prompt Engineering
**Best Practices**:
1. **Clear Instructions**: Specify output format (JSON, paragraphs)
2. **Examples**: Provide 2-3 example inputs/outputs
3. **Constraints**: Define what NOT to do (don't hallucinate)
4. **Tone**: Specify persona and style
5. **Validation**: Test with edge cases (empty input, malformed data)

---

## Common Patterns

### Document Extraction Pattern
```typescript
// 1. Convert file to base64
const base64Data = await fileToBase64(file);

// 2. Extract data
const extractedData = await extractManifestData(base64Data, file.type);

// 3. Validate
const validation = await validateManifestData(extractedData.items);

// 4. Calculate summary
const summary = calculateLoadSummary(extractedData.items);

// 5. Update trucking load
await supabase
  .from('trucking_loads')
  .update({
    total_joints_planned: summary.total_joints,
    total_length_ft_planned: summary.total_length_ft,
    total_weight_lbs_planned: summary.total_weight_lbs,
  })
  .eq('id', loadId);

// 6. Display to user
<LoadSummaryReview
  summary={summary}
  items={extractedData.items}
  validation={validation}
/>
```

**File**: `components/RequestDocumentsPanel.tsx:97-183`

---

### Chatbot Pattern
```typescript
// 1. Fetch context (user's requests, weather)
const { data: requests } = await supabase
  .from('storage_requests')
  .select('*')
  .eq('company_id', user.company_id);

const weather = await fetchWeather();

// 2. Build system prompt with context
const systemPrompt = `
${ROUGHNECK_SYSTEM_PROMPT}

Current weather: ${weather.condition}, ${weather.temp}°C
User's active requests: ${requests.length}
`;

// 3. Send message with history
const chat = ai.startChat({
  model: 'gemini-2.5-flash',
  systemInstruction: systemPrompt,
  history: chatHistory,
});

const response = await chat.sendMessage(userMessage);

// 4. Update UI and history
setChatHistory([...chatHistory, userMsg, aiMsg]);
```

**File**: `services/geminiService.ts` (sendMessage function)

---

### Rate Limit Handling
```typescript
const callAIWithRetry = async (apiCall: () => Promise<any>, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.code === 429) { // Rate limit
        const waitTime = Math.pow(2, i) * 1000; // Exponential backoff
        console.log(`[AI] Rate limited. Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error; // Other error, don't retry
      }
    }
  }
  throw new Error('Max retries exceeded');
};
```

---

## Collaboration & Handoffs

### Works Closely With
- **Customer Journey Agent**: Provide AI features in wizards and dashboards
- **Admin Operations Agent**: Power Roughneck Ops assistant
- **Inventory Management Agent**: Extract manifest data for quantity updates
- **Integration & Events Agent**: Trigger AI processing on document upload

### Escalation Triggers
Hand off when:
- **API quota exceeded**: Deployment & DevOps Agent (upgrade plan)
- **Extraction accuracy <80%**: Review prompt, add examples, or switch model
- **Chatbot hallucinating**: Improve prompt, add fact-checking
- **Cost too high**: Optimize prompts, cache responses, reduce token usage

---

## Testing Checklist

### Document Extraction Tests
- [ ] Extract from clean typed manifest (100% accuracy expected)
- [ ] Extract from handwritten manifest (>80% accuracy acceptable)
- [ ] Handle table with merged cells
- [ ] Handle multi-page manifest
- [ ] Graceful failure on non-manifest PDF
- [ ] Validation flags missing fields
- [ ] Validation suggests manufacturer corrections

### Chatbot Tests
- [ ] Responds to "Where's my pipe?" with status
- [ ] Provides weather update with personality
- [ ] Scoped to user's company (doesn't leak data)
- [ ] Handles "I don't know" gracefully
- [ ] Rate limit triggers retry with backoff
- [ ] Falls back to mock response if API unavailable

### Edge Cases
- [ ] Empty manifest (0 joints)
- [ ] Corrupt PDF (unreadable)
- [ ] Very long manifest (>1000 joints)
- [ ] User asks about another company's data (should deny)
- [ ] API key missing (should use fallback)

---

## Common Issues & Solutions

### Issue: Document Extraction Returns Empty Items
**Problem**: Manifest uploaded, but extraction returns `{ items: [] }`
**Root Cause**: Model name incorrect or API key invalid
**Solution**: Update model to `gemini-2.0-flash-exp`
**File**: `services/manifestProcessingService.ts:190, 265`
**Fix**:
```typescript
// Before (broken)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// After (working)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
```
**Reference**: CHANGELOG.md lines 21-28

---

### Issue: Chatbot Hallucinates Delivery Dates
**Problem**: Roughneck says "Your pipe will arrive Tuesday" but no date set
**Root Cause**: No fact-checking in prompt
**Solution**: Add constraint to prompt
**Fix**:
```typescript
const systemPrompt = `
${ROUGHNECK_SYSTEM_PROMPT}

IMPORTANT: Only provide delivery dates if explicitly set in the data.
If no scheduled_start date exists, say "No delivery scheduled yet. Please contact admin."
`;
```

---

### Issue: Rate Limit Errors (429)
**Problem**: "Quota exceeded" error during peak usage
**Root Cause**: Exceeding free tier limits (15 RPM, 1500 RPD)
**Solution**: Implement retry with exponential backoff
**File**: `services/geminiService.ts`
**Pattern**: See "Rate Limit Handling" above

---

## Metrics & KPIs

### Extraction Accuracy
- **Joint Count Match**: % of manifests where AI count = physical count
- **Field Accuracy**: % of fields correctly extracted (grade, diameter, etc.)
- **Validation Pass Rate**: % of extractions with no errors

### Chatbot Performance
- **Response Time**: p50, p95, p99 latency (target <3s)
- **Conversation Length**: Avg messages per conversation
- **User Satisfaction**: Explicit feedback (thumbs up/down)
- **Fallback Rate**: % of responses using mock fallback (API unavailable)

### Cost Tracking
- **Total Requests**: Count per feature (chat, extraction, summary)
- **Total Tokens**: Input + output tokens per day
- **Cost per Feature**: Estimated cost (if on paid tier)
- **Free Tier Utilization**: % of daily quota used

---

## Decision Records

### DR-001: Use Gemini for Document Extraction
**Date**: 2025-11-05
**Decision**: Use Gemini Vision API instead of OCR + regex
**Rationale**:
- Handles complex layouts (tables, handwriting)
- No need for separate OCR step
- Returns structured JSON directly
- Free tier sufficient for current volume
**Alternative Considered**: AWS Textract (rejected due to cost)

### DR-002: Two Gemini Models (2.5 Flash for Chat, 2.0 Flash for Docs)
**Date**: 2025-11-05
**Decision**: Split models by use case
**Rationale**:
- 2.5 Flash optimized for conversational AI
- 2.0 Flash better for vision tasks
- Different rate limits (15 vs 10 RPM)
**Files**: `geminiService.ts:98`, `manifestProcessingService.ts:190`

### DR-003: Metric Units First in Load Summary
**Date**: 2025-11-05
**Decision**: Display meters and kg before feet and lbs
**Rationale**: Canadian business, aligns with local standards
**Files**: `components/LoadSummaryReview.tsx:125-150`

---

## Next Steps

### Short-term (This Week)
- [ ] Test document extraction with 10 real manifests
- [ ] Measure extraction accuracy (target >90%)
- [ ] Add fact-checking to chatbot prompts
- [ ] Monitor rate limit usage (set up alerts)

### Medium-term (This Month)
- [ ] Implement response caching (reduce API calls)
- [ ] A/B test prompt variations (measure accuracy)
- [ ] Add thumbs up/down feedback to chatbot
- [ ] Create extraction accuracy dashboard

### Long-term (This Quarter)
- [ ] Fine-tune custom model on manifest data
- [ ] Multi-modal chatbot (upload image, ask questions)
- [ ] Predictive analytics (forecast storage demand)
- [ ] Automated quality scoring (flag low-confidence extractions)

---

**Agent Status**: ✅ Active
**Last Updated**: 2025-11-06
**Next Review**: 2025-11-13
**Primary Contact**: AI/ML Team
