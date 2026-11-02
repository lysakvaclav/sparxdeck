import type { McpPageDictionary } from "../types";

// The public MCP page in this language (src/app/[locale]/mcp/page.tsx).
const mcp: McpPageDictionary = {
  "title": "SparxDeck MCP",
  "subtitle": "Inspections, due dates and defects right in your AI assistant.",
  "intro": "SparxDeck MCP connects your company's records with AI assistants such as Claude, ChatGPT or Gemini through the open Model Context Protocol standard. Ask in plain language and the assistant answers from your real data.",
  "connectTitle": "How to connect",
  "address": "Server address",
  "steps": [
    "The company's owner turns AI assistants on in the SparxDeck app under AI assistants. Changes to data are allowed separately.",
    "In your assistant, add a custom connector (remote MCP server) with the address above.",
    "Sign in to SparxDeck, choose the company and allow access. You can revoke it at any time."
  ],
  "note": "Assistants that don't sign in with OAuth connect with a personal token created in the app.",
  "toolsTitle": "What the assistant can do",
  "readTitle": "Reading",
  "readGroups": [
    "Overview and due dates",
    "Buildings and customers",
    "Devices",
    "Inspections and summaries",
    "Defects and planned visits",
    "Search and lists"
  ],
  "writeTitle": "Changes, only when the owner allows them",
  "writeBody": "Every change takes two steps: the assistant first shows a preview and makes the change only after you explicitly confirm it.",
  "writeGroups": [
    "Defects",
    "Visit plan",
    "Notes"
  ],
  "extras": "There are also resources (the company, device types, details of a building, device, defect and inspection) and ready-made prompts: a plan for the coming days, a report for a customer, a brief for a building visit and a review of open defects.",
  "securityTitle": "Security",
  "security": [
    "Off by default. The company's owner turns it on and allows changes separately.",
    "The assistant has the same rights as the member who connected it, under the same data access rules as the app.",
    "You must explicitly confirm every change. Nothing is deleted and no protocols are issued.",
    "Technicians' locations and homes are never shown to the assistant.",
    "Text from the records reaches the assistant marked as data, not as instructions.",
    "Every call is recorded (who, when, which tool) and you see the overview in the app.",
    "Calls are rate-limited, tokens expire and you can revoke a connection at any time."
  ],
  "technicalTitle": "Technical details",
  "technical": [
    "Model Context Protocol 2026-07-28 over Streamable HTTP; older 2025 clients are supported too.",
    "OAuth 2.1 with PKCE (S256), dynamic client registration and Client ID Metadata Documents, tokens bound to this server (RFC 8707).",
    "Scopes sparxdeck:read and sparxdeck:write.",
    "Tools have descriptions, input and output schemas, annotations (read-only, destructive, idempotent) and pagination."
  ]
};

export default mcp;
