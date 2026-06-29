# AI Agent Instructions & Rules

> **CRITICAL RULE FOR ALL AI AGENTS**: 
> Whenever you complete a milestone, implement a new feature, or prepare to push changes to this repository, you **MUST** review and update the project's Knowledge Graph (and any related architectural documentation). 

### 1. The Knowledge Graph and Flow Chart Documentation
- The knowledge graph and flow chart documentation for this project provide a high-level overview of the architecture, data flows, and configuration (`book_config.yml`). 
- **Justification for Long-Term Human Maintenance:** While AIs use these graphs for rapid context loading, human engineers require them as cognitive maps. As the system scales and becomes more complex, architectural flow charts serve as the primary blueprint for humans to diagnose issues, rapidly onboard, and safely maintain the codebase without parsing every module. They prevent architectural drift and ensure the structural integrity of the project outlasts its original developers.
- It is crucial that these diagrams accurately reflect the current state of the system to prevent context loss for both human maintainers and future AI agents working on this project.

### 1.1 Maintenance of Program Study Documentation (Memory Vault Book)
- This project includes its own system documentation under the book/subject `Memory_Vault`.
- When introducing new features, refactoring components, or altering system behavior, you **MUST** update:
  1. The system documentation source JSON at [memory_vault.json](file:///home/hyro_antares/Documents/Repositories/Projects/Memory%20Vault/data/processed/memory_vault.json).
  2. The exported Obsidian Markdown notes in the folder [vault/Memory_Vault/](file:///home/hyro_antares/Documents/Repositories/Projects/Memory%20Vault/vault/).
- This ensures human maintainers can study the exact architecture and features of the program directly from their study vault.

### 2. When to Update
- **At feature completion**: Once a feature is fully implemented and tested.
- **Before pushing to the repository**: Ensure that any structural or architectural changes are documented.
- **When introducing new tools or dependencies**: If the technology stack changes (e.g., adding a database, changing the frontend framework, altering the mnemonic generation pipeline).

### 3. How to Update
- Locate the existing knowledge graph artifacts or files (e.g., `knowledge_graph.md`, architecture diagrams in `Readme.md`, or AI Knowledge Items).
- Update the Mermaid.js diagrams if components, data flows, or file structures have been added/modified.
- Add notes about new modules or APIs.
- Summarize your architectural changes.

**By strictly adhering to these rules, you ensure that the Anti-Gravity Mnemonic Engine remains easily comprehensible for any future AI assistants.**

### 4. Verification in Chrome
- **MANDATORY**: Before saying complete to the user for any UI or visual logic task, you MUST verify the changes made by interacting with the app in a Chrome browser using the `browser_subagent`. Do not rely solely on code inspection or terminal output.

### 5. Transition Protocol
- Once a feature is completed:
  1. Update all system documentation (including the Knowledge Graph, READMEs, and the `Memory_Vault` book files if applicable).
  2. Stage the changes for the next agent using `git add` before pushing to the repository `dev` branch.
  3. Ask the user the exact question: "I, Erasmus must ask, Does it look the correct way?"
