import { randomUUID } from "node:crypto";
import type { ResponsesItemIdRepairConfig } from "../types";
import { relaySseWithPayloadRewrite, type SsePayloadRewrite } from "./sse-payload-rewrite";
import type { TranslatorBudget } from "../lib/translator-budget";

type RepairableItemType = "message" | "reasoning";

interface ResponsesItemIdRepairState {
  readonly repairMissingTerminalIds: boolean;
  readonly repairInvalidIds: boolean;
  readonly placeholders: Record<RepairableItemType, ReadonlySet<string>>;
  readonly outputIds: Record<RepairableItemType, Map<number, string>>;
  /** JSON [outputIndex, rawId] -> canonical id, for exact item_id rewrites on part/delta events. */
  readonly rawIds: Map<string, string>;
  readonly scope: string;
  readonly budget?: TranslatorBudget;
}

const REPAIRABLE_PREFIXES: Record<RepairableItemType, string> = {
  message: "msg_",
  reasoning: "rs_",
};

const ITEM_ID_EVENT_TYPES: Readonly<Record<string, RepairableItemType>> = {
  "response.content_part.added": "message",
  "response.content_part.done": "message",
  "response.output_text.annotation.added": "message",
  "response.output_text.delta": "message",
  "response.output_text.done": "message",
  "response.refusal.delta": "message",
  "response.refusal.done": "message",
  "response.reasoning_summary_part.added": "reasoning",
  "response.reasoning_summary_part.done": "reasoning",
  "response.reasoning_summary_text.delta": "reasoning",
  "response.reasoning_summary_text.done": "reasoning",
  "response.reasoning_text.delta": "reasoning",
  "response.reasoning_text.done": "reasoning",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asOutputIndex(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function repairableItemType(item: Record<string, unknown>): RepairableItemType | null {
  return item.type === "message" || item.type === "reasoning" ? item.type : null;
}

function mintCanonicalId(type: RepairableItemType, scope: string, outputIndex: number): string {
  return `${REPAIRABLE_PREFIXES[type]}ocx_${scope}_${outputIndex}`;
}

function createRepairState(config: ResponsesItemIdRepairConfig, budget?: TranslatorBudget): ResponsesItemIdRepairState {
  const state = {
    repairMissingTerminalIds: config.repairMissingTerminalIds === true,
    repairInvalidIds: config.repairInvalidIds === true,
    placeholders: {
      message: new Set(config.message ?? []),
      reasoning: new Set(config.reasoning ?? []),
    },
    outputIds: {
      message: new Map<number, string>(),
      reasoning: new Map<number, string>(),
    },
    rawIds: new Map<string, string>(),
    scope: randomUUID().replace(/-/g, ""),
    budget,
  };
  budget?.chargeRetained(new TextEncoder().encode(JSON.stringify({
    message: [...state.placeholders.message],
    reasoning: [...state.placeholders.reasoning],
    scope: state.scope,
  })).byteLength, { kind: "item_ids" });
  return state;
}

function rememberMappedId(
  state: ResponsesItemIdRepairState,
  outputIndex: number,
  item: Record<string, unknown>,
): string | null {
  const type = repairableItemType(item);
  if (!type) return null;
  const existing = state.outputIds[type].get(outputIndex);
  if (existing) return existing;
  const rawId = typeof item.id === "string" ? item.id : undefined;
  if (!rawId) return null;
  const mapped = state.placeholders[type].has(rawId)
    ? mintCanonicalId(type, state.scope, outputIndex)
    : state.repairInvalidIds && !rawId.startsWith(REPAIRABLE_PREFIXES[type])
      // An existing id without the canonical msg_/rs_ prefix (bare UUIDs from
      // DeepSeek's Responses route) leaves Codex stuck on Thinking (#938).
      ? mintCanonicalId(type, state.scope, outputIndex)
      : state.repairMissingTerminalIds
        ? rawId
        : null;
  if (!mapped) return null;
  state.budget?.chargeRetained(new TextEncoder().encode(JSON.stringify([outputIndex, rawId, mapped])).byteLength, { kind: "item_ids" });
  state.outputIds[type].set(outputIndex, mapped);
  // Keyed by (index, rawId): an upstream that reuses one placeholder id across
  // several items must not collapse them into the last item's canonical id.
  if (rawId !== mapped) state.rawIds.set(JSON.stringify([outputIndex, rawId]), mapped);
  return mapped;
}

function rewriteOutputItem(
  state: ResponsesItemIdRepairState,
  outputIndex: number,
  item: Record<string, unknown>,
): { item: Record<string, unknown>; changed: boolean } {
  const mapped = rememberMappedId(state, outputIndex, item);
  if (!mapped) return { item, changed: false };
  const currentId = typeof item.id === "string" ? item.id : undefined;
  if (currentId === mapped) return { item, changed: false };
  if (currentId === undefined && !state.repairMissingTerminalIds) return { item, changed: false };
  return { item: { ...item, id: mapped }, changed: true };
}

function rewriteItemIdField(
  state: ResponsesItemIdRepairState,
  event: Record<string, unknown>,
  outputIndex: number,
): { event: Record<string, unknown>; changed: boolean } {
  const eventType = typeof event.type === "string" ? ITEM_ID_EVENT_TYPES[event.type] : undefined;
  if (!eventType) return { event, changed: false };
  const currentId = typeof event.item_id === "string" ? event.item_id : undefined;
  // content_part.* events are shared between message and reasoning items (DeepSeek's
  // streamed reasoning wraps its text in content parts), so the static event-type map
  // can point at the wrong id table. The rewrite is therefore exact-only when the
  // event carries an item_id: it fires when (output_index, item_id) names an id the
  // item stream already repaired, and otherwise leaves the event alone — an unknown
  // id belongs to an item this repair never touched (function_call, already-canonical
  // ids), and guessing by index could borrow a sibling item's identity. The index
  // table serves only events with NO item_id, where repairMissingTerminalIds
  // explicitly opts into the positional guess (the pre-existing contract).
  if (currentId !== undefined) {
    const mapped = state.rawIds.get(JSON.stringify([outputIndex, currentId]));
    if (!mapped || currentId === mapped) return { event, changed: false };
    return { event: { ...event, item_id: mapped }, changed: true };
  }
  if (!state.repairMissingTerminalIds) return { event, changed: false };
  const mapped = state.outputIds[eventType].get(outputIndex);
  if (!mapped) return { event, changed: false };
  return { event: { ...event, item_id: mapped }, changed: true };
}

function rewriteResponseSnapshot(
  state: ResponsesItemIdRepairState,
  response: Record<string, unknown>,
): { response: Record<string, unknown>; changed: boolean } {
  if (!Array.isArray(response.output)) return { response, changed: false };
  let changed = false;
  const output = response.output.map((item, outputIndex) => {
    if (!isPlainObject(item)) return item;
    const rewritten = rewriteOutputItem(state, outputIndex, item);
    changed = changed || rewritten.changed;
    return rewritten.item;
  });
  return changed ? { response: { ...response, output }, changed: true } : { response, changed: false };
}

function repairEventPayload(
  payload: string,
  state: ResponsesItemIdRepairState,
): string {
  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    return payload;
  }
  if (!isPlainObject(event)) return payload;

  let changed = false;
  let nextEvent = event;
  const outputIndex = asOutputIndex(event.output_index);
  if (outputIndex !== null && isPlainObject(event.item)) {
    const rewritten = rewriteOutputItem(state, outputIndex, event.item);
    if (rewritten.changed) {
      nextEvent = { ...nextEvent, item: rewritten.item };
      changed = true;
    }
  }
  if (outputIndex !== null) {
    const rewritten = rewriteItemIdField(state, nextEvent, outputIndex);
    if (rewritten.changed) {
      nextEvent = rewritten.event;
      changed = true;
    }
  }
  if (isPlainObject(event.response)) {
    const rewritten = rewriteResponseSnapshot(state, event.response);
    if (rewritten.changed) {
      nextEvent = { ...nextEvent, response: rewritten.response };
      changed = true;
    }
  }
  if (!changed) return payload;
  const rewritten = JSON.stringify(nextEvent);
  const bytes = new TextEncoder().encode(rewritten).byteLength;
  const reservation = state.budget?.reserveTransient(bytes, { kind: "item_ids" });
  reservation?.commitRetained();
  if (state.budget) queueMicrotask(() => state.budget?.releaseRetained(bytes, { kind: "item_ids" }));
  return rewritten;
}

/**
 * [Decision Log]
 * - Purpose and intent: some openai-responses compatible gateways reuse or omit message and
 *   reasoning item ids; repair them selectively, in the downstream SSE only, so Codex Desktop
 *   card correlation stays stable.
 * - Existing implementation and constraints: the default passthrough is relayed byte for byte and
 *   local replay state remembers the raw upstream response. function_call id / call_id carry
 *   upstream meaning and must never be changed.
 * - Main alternatives considered: always rewrite every passthrough SSE, also rewrite the raw
 *   inspect branch, or normalize all item ids including function_call.
 * - Chosen approach: only when a provider-local opt-in is set, and only on the client-facing SSE
 *   branch, repair exact message/reasoning placeholder ids and missing terminal ids keyed by item
 *   type + output_index; event-level item_id is changed only for an explicit message/reasoning
 *   lifecycle allowlist.
 * - Why this over the alternatives: it keeps the disabled-by-default byte-for-byte passthrough,
 *   and previous_response_id replay keeps using the raw upstream snapshot so synthetic ids never
 *   flow back upstream.
 * - Pros, cons and impact: the default path is unchanged. Even if a malformed stream reuses an
 *   output_index for another item type, function_call id/call_id are preserved. An opted-in
 *   gateway gets unique canonical ids even on sequential streams, and pays the JS stream
 *   rewrite cost only when a repair is needed.
 */
/** Stateful payload rewrite for composition with other client-facing SSE transforms. */
export function createResponsesItemIdPayloadRewrite(
  config: ResponsesItemIdRepairConfig,
  budget?: TranslatorBudget,
): SsePayloadRewrite {
  const state = createRepairState(config, budget);
  return (payload) => repairEventPayload(payload, state);
}

export function relaySseWithResponsesItemIdRepair(
  body: ReadableStream<Uint8Array>,
  config: ResponsesItemIdRepairConfig,
  budget: TranslatorBudget,
): ReadableStream<Uint8Array> {
  return relaySseWithPayloadRewrite(body, createResponsesItemIdPayloadRewrite(config, budget), budget);
}

export function hasResponsesItemIdRepair(config: ResponsesItemIdRepairConfig | undefined): boolean {
  return config?.repairMissingTerminalIds === true
    || config?.repairInvalidIds === true
    || (config?.message?.length ?? 0) > 0
    || (config?.reasoning?.length ?? 0) > 0;
}

/**
 * Client-facing id normalization for a WHOLE bounded-JSON Responses object.
 *
 * The bounded-JSON policy (#875) answers a streaming client by synthesizing SSE
 * from a completed JSON body, and reframes the same body into events for WS
 * turns. Neither path goes through the SSE relay, so neither picks up the SSE
 * item-id rewrite — a provider that needs id repair would get it on a streaming
 * response and silently lose it the moment the reliability policy switched the
 * upstream to bounded JSON. This applies the same rewrite to the object so all
 * three paths agree. Raw recorded state is untouched: recording happens before
 * any normalization.
 */
export function repairResponsesJsonItemIds(
  response: Record<string, unknown>,
  config: ResponsesItemIdRepairConfig,
  budget?: TranslatorBudget,
): Record<string, unknown> {
  const state = createRepairState(config, budget);
  const rewritten = rewriteResponseSnapshot(state, response);
  return rewritten.changed ? rewritten.response : response;
}
