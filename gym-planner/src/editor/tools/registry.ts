import type { Tool } from '@/types';
import type { ToolHandler } from './types';

const handlers = new Map<Tool, ToolHandler>();

export function registerTool(h: ToolHandler) {
  handlers.set(h.id, h);
}
export function getTool(id: Tool): ToolHandler | undefined {
  return handlers.get(id);
}
export function allTools(): ToolHandler[] {
  return [...handlers.values()];
}
