// Backward compatibility — all external imports continue to work
export { processAIAgent } from './agent-processor'
export { buildSystemPrompt } from './prompt-builder'
export { ERROR_MESSAGES, ActionError } from './error-messages'
export { executeAction } from './action-executor'
export type { AgentInput, AgentResponse, AdvancedAIConfig, ParsedAIResponse } from './types'