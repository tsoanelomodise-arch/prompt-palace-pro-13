# Improve with AI in editors

Add an AI-powered "Improve" action to the `ImageTextarea` component, available in all four editor surfaces (prompts, client notes, conversations, wiki pages).

## UX

- New **Sparkles "Improve with AI"** button in the editor toolbar.
- Clicking opens a small popover with:
  - Two preset modes: **Polish & Clarify** (default) and **Custom instruction** (free-text field, e.g. "make it more technical").
  - **Improve** submit button.
- Operates on the whole document content.
- While running: button shows spinner, editor is disabled.
- On success: open a **diff preview dialog** showing original vs improved side-by-side, with word-level highlights (additions green, removals red).
  - Buttons: **Accept** (replaces editor content), **Reject** (closes, keeps original), **Regenerate** (re-runs with same instruction).
- On error: toast with message (rate limit 429, credits 402, generic).

## Technical

**Server function** — `src/lib/improve.functions.ts`
- `improveContent` createServerFn (POST), auth-protected via `requireSupabaseAuth`.
- Input: `{ content: string, mode: 'polish' | 'custom', instruction?: string }` validated with Zod.
- Calls Lovable AI Gateway (`google/gemini-3-flash-preview`) via `@ai-sdk/openai-compatible` + `generateText` from `ai`.
- System prompt instructs the model to:
  - Preserve markdown structure, image tokens `![](...)`, and reference links `[Title](url)`.
  - For "polish": fix grammar, improve clarity/tone, no meaning changes, no length inflation.
  - For "custom": follow the user instruction strictly while preserving structure.
  - Return only the improved markdown (no preamble/code fences).
- Reads `LOVABLE_API_KEY` from `process.env` inside handler. Provisions via `ai_gateway--create` if missing.

**AI gateway helper** — `src/lib/ai-gateway.server.ts` (new, per `ai-sdk-lovable-gateway` knowledge): `createLovableAiGatewayProvider` factory.

**Diff component** — `src/components/ui/diff-view.tsx`
- Simple word-diff using a small inline LCS implementation (no new dep) rendering two columns.

**Editor integration** — `src/components/ui/image-textarea.tsx`
- Add Sparkles toolbar button + popover (shadcn `Popover`).
- Add diff `Dialog` for review.
- State: `improving`, `improveOpen`, `mode`, `instruction`, `diffOpen`, `improvedText`.
- Call server fn via `useServerFn`.
- All four editors already use `ImageTextarea`, so no changes needed in route files.

## Files

- New: `src/lib/ai-gateway.server.ts`
- New: `src/lib/improve.functions.ts`
- New: `src/components/ui/diff-view.tsx`
- Edit: `src/components/ui/image-textarea.tsx` (toolbar button, popover, diff dialog wiring)

## Out of scope

- Selection-only improvement, expand/shorten presets, streaming progress, history of past improvements.
