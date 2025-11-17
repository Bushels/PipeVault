# PipeVault Documentation

Welcome to the PipeVault documentation center. This directory contains all technical documentation, agent playbooks, troubleshooting guides, and coordination logs.

---

## 📁 Directory Structure

```
docs/
├── README.md (this file)
├── coordination-log.md - Agent collaboration tracking
│
├── agents/ - Agent playbook system
│   ├── README.md - Agent system overview
│   ├── 01-ui-ux-agent.md
│   ├── 02-customer-journey-agent.md
│   ├── 03-admin-operations-agent.md
│   ├── 04-inventory-management-agent.md
│   ├── 05-ai-services-agent.md
│   ├── 06-database-integrity-agent.md
│   ├── 07-integration-events-agent.md
│   ├── 08-deployment-devops-agent.md
│   ├── 09-security-quality-agent.md
│   ├── 10-qa-testing-agent.md
│   ├── 11-knowledge-management-agent.md
│   ├── 12-orchestration-agent.md
│   │
│   ├── templates/
│   │   ├── agent-report.md - Weekly report template
│   │   └── agent-handoff.md - Cross-agent handoff template
│   │
│   └── reports/ - Weekly agent reports (to be created)
│       └── 2025-W45/ - Week of Nov 6-12, 2025
│           └── (agent reports go here)
│
├── architecture/ - System design documents
│   ├── system-overview.md (to be created)
│   ├── data-model.md (to be created)
│   └── workflow-states.md (to be created)
│
├── troubleshooting/ - Issue resolution guides
│   └── (links to root-level troubleshooting docs)
│
└── runbooks/ - Operational procedures
    ├── deployment-process.md (to be created)
    └── migration-procedure.md (to be created)
```

---

## 🚀 Quick Start

### For Developers
1. **Read**: [Agent System Overview](./agents/README.md)
2. **Choose your agent**: Based on what you're working on
3. **Follow playbook**: Each agent has specific responsibilities
4. **Document work**: Use [agent report template](./agents/templates/agent-report.md)
5. **Coordinate**: Log handoffs in [coordination-log.md](./coordination-log.md)

### For New Team Members
1. Read this README first
2. Review [Customer Journey Agent](./agents/02-customer-journey-agent.md) to understand user flow
3. Review [Database Integrity Agent](./agents/06-database-integrity-agent.md) to understand data model
4. Review your domain-specific agent playbook
5. Join weekly agent sync (Fridays)

---

## 📊 Agent System

The PipeVault project uses a **specialized agent system** to manage development across different domains.

### Why Agents?
- **Focus**: Each agent specializes in one domain
- **Quality**: Experts maintain high standards in their area
- **Coordination**: Clear handoffs prevent work from falling through cracks
- **Documentation**: Every agent maintains their playbook
- **Accountability**: Weekly reports track progress

### 12 Specialized Agents

| # | Agent | Domain | Priority |
|---|-------|--------|----------|
| 01 | [UI/UX Agent](./agents/01-ui-ux-agent.md) | Interface design, accessibility | High |
| 02 | [Customer Journey Agent](./agents/02-customer-journey-agent.md) | End-to-end customer workflow | Critical |
| 03 | [Admin Operations Agent](./agents/03-admin-operations-agent.md) | Admin dashboard, approvals | High |
| 04 | [Inventory Management Agent](./agents/04-inventory-management-agent.md) | Pipe tracking, storage | High |
| 05 | [AI Services Agent](./agents/05-ai-services-agent.md) | Document extraction, chatbot | High |
| 06 | [Database Integrity Agent](./agents/06-database-integrity-agent.md) | Data consistency, schema | Critical |
| 07 | [Integration & Events Agent](./agents/07-integration-events-agent.md) | Webhooks, emails, notifications | Medium |
| 08 | [Deployment & DevOps Agent](./agents/08-deployment-devops-agent.md) | Build, deployment, monitoring | Medium |
| 09 | [Security & Code Quality Agent](./agents/09-security-quality-agent.md) | Security audits, code standards | Critical |
| 10 | [Quality Assurance Agent](./agents/10-qa-testing-agent.md) | Testing, validation | High |
| 11 | [Knowledge Management Agent](./agents/11-knowledge-management-agent.md) | Documentation, organization | High |
| 12 | [Orchestration Agent](./agents/12-orchestration-agent.md) | Coordination, decision-making | Critical |

### Agent Activation Status

**Phase 1: Foundation** (Week 1) - IN PROGRESS
- [x] Agent playbooks created
- [x] Templates ready
- [x] Coordination log initialized
- [ ] Knowledge Management Agent active
- [ ] Security & Code Quality Agent active
- [ ] Database Integrity Agent active
- [ ] Quality Assurance Agent active

**Phase 2: Feature Agents** (Week 2-3) - PENDING
- [ ] Customer Journey Agent active
- [ ] Admin Operations Agent active
- [ ] UI/UX Agent active
- [ ] AI Services Agent active
- [ ] Inventory Management Agent active

**Phase 3: Operations** (Week 4+) - PENDING
- [ ] Integration & Events Agent active
- [ ] Deployment & DevOps Agent active
- [ ] Orchestration Agent coordinating
- [ ] Weekly sync meetings established

---

## 📋 Key Documents

### Core Documentation
- **[CHANGELOG.md](../CHANGELOG.md)** - Version history and changes
- **[README.md](../README.md)** - Project overview and setup
- **[ADMIN_TROUBLESHOOTING_GUIDE.md](../ADMIN_TROUBLESHOOTING_GUIDE.md)** - Admin issue resolution
- **[AI_TROUBLESHOOTING.md](../AI_TROUBLESHOOTING.md)** - AI service debugging
- **[SETUP_STORAGE_BUCKET.md](../supabase/SETUP_STORAGE_BUCKET.md)** - Supabase storage setup

### Architecture (To Be Created)
- System Overview Diagram
- Data Model ER Diagram
- Workflow State Machine
- API Documentation

### Runbooks (To Be Created)
- Deployment Procedure
- Migration Procedure
- Rollback Procedure
- Incident Response

---

## 🔄 Weekly Workflow

### Monday: Planning
- Review last week's coordination log
- Prioritize tasks for the week
- Assign work to appropriate agents
- Check for blockers

### Wednesday: Check-in
- Mid-week progress update
- Address any blockers
- Adjust priorities if needed
- Quick sync on complex issues

### Friday: Review & Sync
- Agent reports due by EOD
- Review completed work
- Document learnings
- Plan next week

---

## 📈 Metrics & Health

### Documentation Coverage
- ✅ Agent playbooks: 12/12 (100%)
- ⏳ Architecture docs: 0/3 (0%)
- ⏳ Runbooks: 0/3 (0%)
- ✅ Troubleshooting guides: 3/3 (100%)

### Agent System Health
- Active agents: 0/12 (activation in progress)
- Weekly reports submitted: 0 (first week)
- Handoffs completed: 1
- Average resolution time: 1 day

### Code Quality
- Build status: ✅ Passing (963.09 kB)
- TypeScript errors: 0
- Test coverage: TBD
- Security issues: 0 known

---

## 🆘 Getting Help

### I need to...
| Task | Agent to Use |
|------|-------------|
| Fix a UI bug | [UI/UX Agent](./agents/01-ui-ux-agent.md) |
| Change customer workflow | [Customer Journey Agent](./agents/02-customer-journey-agent.md) |
| Update admin features | [Admin Operations Agent](./agents/03-admin-operations-agent.md) |
| Investigate data issue | [Database Integrity Agent](./agents/06-database-integrity-agent.md) |
| Fix AI extraction | [AI Services Agent](./agents/05-ai-services-agent.md) |
| Security audit | [Security & Code Quality Agent](./agents/09-security-quality-agent.md) |
| Write documentation | [Knowledge Management Agent](./agents/11-knowledge-management-agent.md) |
| Complex multi-agent issue | [Orchestration Agent](./agents/12-orchestration-agent.md) |

### Emergency Contacts
- Critical production issue: Escalate to Orchestration Agent
- Security vulnerability: Escalate to Security & Code Quality Agent
- Data loss risk: Escalate to Database Integrity Agent

---

## 📝 Contributing

### Adding Documentation
1. Determine which agent owns the topic
2. Follow that agent's documentation standards
3. Update relevant playbook if needed
4. Submit for review
5. Update this index if adding new files

### Updating Agent Playbooks
1. Only Knowledge Management Agent updates playbooks
2. Submit change request via agent report or handoff
3. Include rationale for change
4. Update "Last Updated" date
5. Notify affected agents

---

## 🎯 Success Criteria

### Documentation is Successful When:
- ✅ New developers can onboard in < 1 day
- ✅ Common issues have documented solutions
- ✅ Agent responsibilities are clear and non-overlapping
- ✅ Coordination logs prevent duplicate work
- ✅ Weekly reports track progress effectively

### Agent System is Successful When:
- All 12 agents actively maintained
- Weekly reports submitted on time
- Handoffs completed smoothly
- Resolution time decreasing over time
- No work falling through cracks

---

**Documentation Owner**: Knowledge Management Agent
**Last Updated**: 2025-11-06
**Next Review**: 2025-11-13
**Questions?**: Submit agent report or create handoff
