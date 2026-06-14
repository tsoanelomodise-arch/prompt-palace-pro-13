## Agency Wiki

A lightweight internal wiki for know-how (SOPs, playbooks, research notes, onboarding docs) that can be linked to Clients, Projects, and Prompts.

### Data model (one migration)

**`wiki_spaces`** — top-level grouping (e.g. "Agency SOPs", "Design System", "Onboarding")
- `name`, `slug`, `description`, `icon`, `created_by`

**`wiki_pages`** — the actual articles
- `space_id` → wiki_spaces
- `parent_id` → wiki_pages (self-ref, for nested tree)
- `title`, `slug`, `content` (markdown text), `excerpt`
- `status` (`draft` | `published`)
- `created_by`, `updated_by`, `position` (int for sort)

**`wiki_page_links`** — polymorphic many-to-many to attach a page to clients/projects/prompts
- `page_id` → wiki_pages
- `entity_type` (`client` | `project` | `prompt`)
- `entity_id` (uuid)
- unique(page_id, entity_type, entity_id)

**`wiki_page_revisions`** — simple version history
- `page_id`, `title`, `content`, `edited_by`, `created_at`
- written by a trigger on `wiki_pages` UPDATE

RLS: any signed-in user can read; only `admin` or the page's `created_by` can edit/delete. Spaces admin-only to create. All tables get GRANTs + `updated_at` trigger.

### Server functions (`src/lib/wiki.functions.ts`)
- `listSpaces`, `createSpace` (admin), `updateSpace`, `deleteSpace` (admin)
- `listPages({ spaceId, parentId? })`, `getPage(id)`, `searchPages(q)` (ILIKE on title+content)
- `createPage`, `updatePage` (writes revision via trigger), `deletePage`
- `listPageLinks(pageId)`, `attachPageLink({pageId, entityType, entityId})`, `detachPageLink`
- `listLinkedPages({entityType, entityId})` — used on client/project/prompt detail tabs

### UI / routes (under `_authenticated`)

```
/wiki                              -> space list + recent pages + search bar
/wiki/$spaceSlug                   -> sidebar tree of pages + welcome
/wiki/$spaceSlug/$pageSlug         -> page view (rendered markdown)
/wiki/$spaceSlug/$pageSlug/edit    -> editor (markdown textarea + preview, link picker)
/wiki/new                          -> quick create (pick space + parent)
```

Components:
- `WikiSidebar` — collapsible nested tree per space
- `WikiPageView` — rendered markdown (`react-markdown` + `remark-gfm`), breadcrumbs, "linked to" chips, last-edited meta, Edit button
- `WikiPageEditor` — title, markdown textarea, status toggle, parent picker, **Links** panel (search Clients / Projects / Prompts → attach)
- `WikiSearch` — command-palette-style search across pages
- `LinkedWikiPages` — small list component embedded on Client, Project, and Prompt detail pages ("Related know-how" section) with an "Attach page" picker

Nav: add **Wiki** to the existing sticky header next to Clients · Prompts · Team.

### Out of scope (call out)
- Rich-text/WYSIWYG editor (markdown only)
- Comments, mentions, real-time collab
- File/image uploads inside pages (links only)
- Per-space ACLs (everyone can read all spaces)
- Full-text ranking — simple ILIKE search only

### Open questions before building
1. OK with **markdown-only** editing (no WYSIWYG)?
2. **Edit permissions** — admin + original author only, or any signed-in member can edit any page?
3. Do you want a **public-facing** option (publish a page to a public URL for clients), or strictly internal?
