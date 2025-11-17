# Agent Handoff Template

## Handoff Metadata
- **Handoff ID**: [Format: YYYY-MM-DD-###, e.g., 2025-11-06-001]
- **From Agent**: [Initiating agent name]
- **To Agent**: [Receiving agent name]
- **Date**: [YYYY-MM-DD]
- **Priority**: 🚨 Critical | ⚠️ High | ℹ️ Medium | ✅ Low
- **Status**: 🆕 New | 🔄 In Progress | ✅ Complete | ❌ Cancelled

---

## Issue/Task Summary
[1-2 sentence summary of what needs to be done and why]

---

## Detailed Description

### Problem Statement
[Detailed explanation of the issue or task]

**Context**:
- [Why this is happening]
- [What led to this situation]
- [Business impact if not addressed]

**Symptoms** (if applicable):
- [What the user sees/experiences]
- [Error messages]
- [Incorrect behavior]

### Expected Outcome
[Clear description of what "done" looks like]

**Success Criteria**:
- [ ] [Measurable criterion 1]
- [ ] [Measurable criterion 2]
- [ ] [Measurable criterion 3]

---

## Technical Details

### Affected Files
```
components/
  └── ComponentName.tsx (lines 42-58)
services/
  └── serviceName.ts (lines 120-145)
hooks/
  └── useHookName.ts (lines 78-92)
```

### Code References
[Link specific code sections that are relevant]

**File**: `path/to/file.tsx`
**Lines**: 42-58
**Issue**: [What's wrong with this code]

### Related Issues
- [Link to similar issues]
- [Related bug reports]
- [Previous handoffs on this topic]

---

## Investigation Done So Far

### What We Know
1. [Finding 1]
2. [Finding 2]
3. [Finding 3]

### What We've Tried
1. **[Attempted Solution 1]**
   - **Result**: [What happened]
   - **Conclusion**: [Why it didn't work]

2. **[Attempted Solution 2]**
   - **Result**: [What happened]
   - **Conclusion**: [Why it didn't work]

### What We Suspect
- [Hypothesis 1]: [Why we think this might be the cause]
- [Hypothesis 2]: [Alternative explanation]

---

## Recommendations

### Suggested Approach
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Alternative Approaches
- **Option A**: [Description] - Pros: [X, Y] - Cons: [Z]
- **Option B**: [Description] - Pros: [X, Y] - Cons: [Z]

### Resources
- [Documentation link]
- [Similar issue resolution]
- [External reference]

---

## Dependencies & Blockers

### Prerequisites
- [ ] [Thing that must be done first]
- [ ] [Thing that must be done first]

### Blockers
- **[Blocker 1]**: [Description] - Blocked by: [Who/What]
- **[Blocker 2]**: [Description] - Blocked by: [Who/What]

### Downstream Impact
[What other agents/features will be affected by the fix]

---

## Priority & Timeline

### Urgency Justification
[Why this priority level is appropriate]

**User Impact**:
- **Severity**: [Critical | High | Medium | Low]
- **Frequency**: [How often does this occur]
- **Users Affected**: [Number/percentage of users]

### Timeline
- **Requested Completion**: [Date]
- **Rationale**: [Why this deadline]
- **Flexibility**: [Can this slip? By how much?]

---

## Testing & Validation

### How to Reproduce (if bug)
1. [Step 1]
2. [Step 2]
3. [Step 3]
**Expected**: [What should happen]
**Actual**: [What actually happens]

### Test Cases
- [ ] [Test case 1]
- [ ] [Test case 2]
- [ ] [Test case 3]

### Validation Criteria
[How to verify the fix works]

---

## Communication

### Stakeholders
- **Customer Impact**: [Who needs to know]
- **Internal Teams**: [Which teams are affected]
- **External**: [Any vendors/partners involved]

### Updates Requested
- **Frequency**: [Daily | Weekly | On Completion]
- **Method**: [Agent report | Direct message | Email]
- **Key Milestones**: [When to notify]

---

## Follow-up Actions

### After Completion
- [ ] Update documentation
- [ ] Notify stakeholders
- [ ] Create test case
- [ ] Add to regression suite
- [ ] Update CHANGELOG

### Lessons Learned
[To be filled out by receiving agent after completion]
- **What Worked**: [...]
- **What Didn't**: [...]
- **Future Prevention**: [...]

---

## Notes

### Additional Context
[Any other relevant information]

### Questions for Receiving Agent
1. [Question 1]
2. [Question 2]

### Attachments
- [Screenshots]
- [Log files]
- [Error dumps]
- [Test data]

---

**Handoff Created By**: [Agent name]
**Contact**: [How to reach for questions]
**Handoff Accepted**: [ ] Yes [ ] No
**Accepted By**: [Receiving agent name]
**Accepted Date**: [YYYY-MM-DD]
