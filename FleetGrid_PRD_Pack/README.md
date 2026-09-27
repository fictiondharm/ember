# FleetGrid PRD Pack

Give the Master PRD to every coding agent.
Give each person their own workstream PRD.
Also give every agent `00_CODING_AGENT_CONTRACT.txt`.

Recommended order:
1. Person 2 — Backend/Data establishes schema + API contracts.
2. Person 1 — Agent builds against those contracts/mocks.
3. Person 3 — Frontend builds against API contracts.
4. Person 4 — Voice integrates into incident API.
5. Person 5 — Payments/infra/proof integrates with backend events.

Important: everyone works in the same repository/branch strategy and reports contract changes before making them.

The goal is NOT maximum feature count.
The goal is ONE complete, reliable shared-state workflow.
