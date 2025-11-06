# PipeVault Agent System

## Overview

The PipeVault application uses a specialized agent system to manage development, maintenance, and operations across different domains. Each agent has specific responsibilities and clear boundaries to ensure quality, consistency, and efficiency.

## Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Orchestration Agent (Coordinator)               │
│         Makes high-level decisions & resolves conflicts      │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    ┌───▼────┐          ┌────▼────┐
    │ Domain │          │ Support │
    │ Agents │          │ Agents  │
    └───┬────┘          └────┬────┘
        │                    │
   ┌────┼────┬───────┬───────┼────┬────────┐
   │    │    │       │       │    │        │
   ▼    ▼    ▼       ▼       ▼    ▼        ▼
  UI  Customer Admin Inventory Security Testing Docs
      Journey        Mgmt
```

## Core Agents

### 1. Domain Agents (Feature-Focused)
- **[UI/UX Agent](./01-ui-ux-agent.md)** - Interface design and user experience
- **[Customer Journey Agent](./02-customer-journey-agent.md)** - End-to-end customer workflow
- **[Admin Operations Agent](./03-admin-operations-agent.md)** - Admin dashboard and operations
- **[Inventory Management Agent](./04-inventory-management-agent.md)** - Pipe tracking and storage
- **[AI Services Agent](./05-ai-services-agent.md)** - Document extraction and chatbot

### 2. Infrastructure Agents (Platform-Focused)
- **[Database Integrity Agent](./06-database-integrity-agent.md)** - Data consistency and schema
- **[Integration & Events Agent](./07-integration-events-agent.md)** - Webhooks, emails, notifications
- **[Deployment & DevOps Agent](./08-deployment-devops-agent.md)** - Build and release management

### 3. Quality Assurance Agents (Governance-Focused)
- **[Security & Code Quality Agent](./09-security-quality-agent.md)** - Security audits and code standards
- **[Quality Assurance Agent](./10-qa-testing-agent.md)** - Testing and validation
- **[Knowledge Management Agent](./11-knowledge-management-agent.md)** - Documentation and organization

### 4. Coordination Agent
- **[Orchestration Agent](./12-orchestration-agent.md)** - High-level coordination and decision-making

---

## Agent Boundaries

### Clear Responsibilities
Each agent has a **well-defined scope**:
- **Owns**: Specific files, features, or domains
- **Collaborates**: With other agents on cross-cutting concerns
- **Defers**: To specialists when outside their expertise

### Handoff Protocol
When an agent encounters an issue outside their domain:
1. **Document** the issue with full context
2. **Identify** the appropriate agent
3. **Create handoff** using the [Agent Handoff Template](./templates/agent-handoff.md)
4. **Track** handoff in [Agent Coordination Log](../coordination-log.md)

---

## Weekly Agent Sync

Every week, agents submit reports using the [Agent Report Template](./templates/agent-report.md).

**Schedule:**
- **Monday**: Week planning and priority setting
- **Wednesday**: Mid-week progress check
- **Friday**: Week review and handoffs

**Format:**
- Tasks completed
- Issues found
- Recommendations
- Handoffs to other agents

---

## Agent Activation Phases

### Phase 1: Foundation (Week 1) ✅
- [x] Create agent playbook structure
- [ ] Activate Knowledge Management Agent
- [ ] Activate Security & Code Quality Agent
- [ ] Activate Database Integrity Agent
- [ ] Activate Quality Assurance Agent

### Phase 2: Feature Agents (Week 2-3)
- [ ] Activate Customer Journey Agent
- [ ] Activate Admin Operations Agent
- [ ] Activate UI/UX Agent
- [ ] Activate AI Services Agent
- [ ] Activate Inventory Management Agent

### Phase 3: Operations (Week 4+)
- [ ] Activate Integration & Events Agent
- [ ] Activate Deployment & DevOps Agent
- [ ] Activate Orchestration Agent
- [ ] Weekly coordination sync begins

---

## Quick Reference

### When to Use Each Agent

| Scenario | Agent to Use |
|----------|--------------|
| Component styling inconsistent | UI/UX Agent |
| Customer can't complete workflow | Customer Journey Agent |
| Admin feature not working | Admin Operations Agent |
| Inventory quantities don't match | Inventory Management Agent |
| AI extraction failing | AI Services Agent |
| Database constraints violated | Database Integrity Agent |
| Webhook/email not firing | Integration & Events Agent |
| Build failing | Deployment & DevOps Agent |
| Security vulnerability found | Security & Code Quality Agent |
| Feature needs testing | Quality Assurance Agent |
| Documentation missing | Knowledge Management Agent |
| Multiple agents needed | Orchestration Agent |

### Agent Communication Channels

- **Primary**: Agent report markdown files in `/docs/agents/reports/`
- **Secondary**: [Coordination Log](../coordination-log.md)
- **Emergency**: Direct escalation to Orchestration Agent

---

## Best Practices

### For Agent Users (You!)
1. **Read the playbook** before invoking an agent
2. **Provide context** - link to files, line numbers, error messages
3. **Be specific** - what needs to be done, why, and by when
4. **Follow handoffs** - track what was passed to other agents
5. **Review reports** - check weekly agent sync reports

### For Agent Authors (Maintainers)
1. **Keep playbooks updated** - reflect current reality
2. **Document decisions** - explain why, not just what
3. **Clear boundaries** - avoid scope creep
4. **Collaborative mindset** - agents work together, not in silos
5. **Continuous improvement** - refine based on learnings

---

## Templates

- [Agent Report Template](./templates/agent-report.md)
- [Agent Handoff Template](./templates/agent-handoff.md)
- [Agent Decision Record](./templates/agent-decision-record.md)

---

## Metrics & Success Criteria

### Agent Effectiveness
- **Response time**: How quickly agent completes tasks
- **Quality**: Bugs found/prevented, improvements suggested
- **Collaboration**: Successful handoffs to other agents
- **Coverage**: Percentage of domain covered by agent

### System Health
- **Build success rate**: % of builds passing
- **Test coverage**: % of code tested
- **Documentation coverage**: % of features documented
- **Security score**: Audit findings addressed

---

**Last Updated**: 2025-11-06
**Next Review**: 2025-12-06
**Maintained By**: Knowledge Management Agent
