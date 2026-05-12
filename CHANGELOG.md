# Changelog

All notable changes to this project are documented here.

## [1.0.0] - 2026-05-12

### Released
- Shipped **mcp-aeo-server** as a public artifact for teams dealing with mcp governance.
- Packaged the current implementation, documentation, validation flow, and proof surfaces into a repo that can be reviewed by technical and operating stakeholders.
- Clarified the core problem the project is addressing: tool-surface drift, weak schema review, and fragile governance around agent-connected systems.

### Why this mattered
- Existing approaches in traditional AppSec tools, cloud posture products, and generic observability stacks were useful for parts of the workflow.
- They still left out an operator-visible layer that could explain tool exposure, control posture, and prompt-driven risk in one place.
- This release made the repo read like an operational capability rather than a narrow technical demo.

## [0.1.0] - 2026-03-11

### Shipped
- Cut the first coherent internal version of **mcp-aeo-server** with stable domain objects, review surfaces, and decision outputs.
- Established the first reviewable version of the architecture described as: MCP server exposing AEO Protocol declarations as four tools (fetch, inspect, get_claim, well_known_url). Drop-in for Claude Desktop, Cursor, or any MCP-compatible agent. Ships with conforming MCP Tool Cards for every tool. Part of the Kinetic Gain Protocol Suite.
- Focused the repo around actionability instead of passive reporting.

## [Prototype] - 2025-08-18

### Built
- Built the first runnable prototype for the repo's main workflow and decision model.
- Validated the concept against pressure points such as MCP governance gaps, prompt injection, destructive tool exposure, and weak evidence chains.
- Used the prototype phase to test whether the project could drive action, not just present information.

## [Design Phase] - 2024-11-12

### Designed
- Defined the system around operator-first and decision-legible outputs.
- Chose interfaces and examples that made sense for platform engineering, AI governance, and security teams.
- Avoided reducing the project to a generic dashboard, CRUD app, or fashionable wrapper around the stack.

## [Idea Origin] - 2024-03-12

### Observed
- The original idea surfaced while looking at how teams were handling tool-surface drift, weak schema review, and fragile governance around agent-connected systems.
- The recurring pattern was that teams had data and tools, but still lacked a usable operating layer for the hardest decisions.

## [Background Signals] - 2022-08-09

### Context
- Earlier platform, governance, and operator-tooling work made one pattern hard to ignore: the systems that create the most drag are often the ones with partial controls and weak operational coherence, not the ones with no controls at all.
- That pattern shaped the thinking behind this repo well before the public version existed.