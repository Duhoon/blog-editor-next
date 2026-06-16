# Blog Markdown Editor Plan

## Summary

Implement a Supabase-backed markdown post editor for the existing Next.js App Router app. The first version uses Supabase Auth email/password login, full post CRUD, one active category per post, multi-tag assignment, linked image metadata display, and a rich MDXEditor markdown editor.

The post list sidebar can be hidden from the editor header. The preference is stored in browser `localStorage`, and hiding the sidebar expands the editor without changing the selected post or draft state.

The markdown editor uses `@mdxeditor/editor` with toolbar formatting, source-first editing, tables, links, code blocks, image insertion, markdown shortcuts, and a separate live preview panel. Content is still saved as plain markdown in `posts.content`.

The post metadata controls are placed directly below the Title and Slug inputs instead of in a right-side column. This keeps Locale, Category, Thumbnail, Published, Tags, and Linked Images close to the primary post fields and gives the markdown editor more room.

## Data Model

The editor uses the exposed Supabase tables `posts`, `categories`, `post_category_links`, `tags`, `tag_post_links`, and `images`. Markdown content is stored in `posts.content`. Category assignment is stored in `post_category_links`; tag assignment is stored in `tag_post_links`; linked image metadata is displayed from `images`.

## Behavior

New posts require a manually entered slug. Publishing sets `is_published` and `published_at`; unpublishing clears `published_at`. Saving updates `updated_at`. Category removal and tag removal mark link rows inactive during normal editing. Permanent post deletion confirms first, then removes related link/image rows and the post row. Image uploads use the public `blog-contents` bucket and require the post to be saved first.

## Validation

Validate with `pnpm lint`, `pnpm build`, and manual checks for auth, listing, create, edit, save, publish, unpublish, delete, metadata layout below title/slug, category selection, tag assignment, thumbnail editing, image metadata display, visible MDXEditor source input, live preview, toolbar/source mode, and image upload.
