"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  Eye,
  FileText,
  Loader2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import type {
  Category,
  Database,
  Post,
  PostCategoryLink,
  PostImage,
  Tag,
  TagPostLink,
} from "@/lib/database.types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type CategoryLinkWithCategory = PostCategoryLink & {
  categories: Category | null;
};

type TagLinkWithTag = TagPostLink & {
  tags: Tag | null;
};

type PostWithRelations = Post & {
  post_category_links: CategoryLinkWithCategory[];
  tag_post_links: TagLinkWithTag[];
  images: PostImage[];
};

type DraftPost = {
  id: number | null;
  title: string;
  brief: string;
  content: string;
  slug: string;
  locale: string;
  thumbnail: string;
  is_published: boolean;
  published_at: string | null;
  categoryId: string;
  tagIds: number[];
};

const inputClass =
  "h-10 w-full border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20";
const textareaClass =
  "min-h-56 w-full resize-none border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20";
const labelClass = "grid gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground";
const sidebarPreferenceKey = "blog-editor-sidebar-open";

function emptyDraft(): DraftPost {
  return {
    id: null,
    title: "",
    brief: "",
    content: "",
    slug: "",
    locale: "en",
    thumbnail: "",
    is_published: false,
    published_at: null,
    categoryId: "",
    tagIds: [],
  };
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

function categoryLabel(category: Category, locale: string) {
  return category.name[locale] ?? category.name["en-US"] ?? category.name.ko ?? category.id;
}

async function runSupabaseWrite<T extends { error: Error | null }>(write: PromiseLike<T>) {
  const result = await write;
  if (result.error) {
    throw result.error;
  }
}

function draftFromPost(post: PostWithRelations): DraftPost {
  const categoryLink = post.post_category_links.find((link) => link.is_active !== false);
  const activeTagIds = post.tag_post_links
    .filter((link) => link.is_active !== false)
    .map((link) => link.tag_id);

  return {
    id: post.id,
    title: post.title,
    brief: post.brief ?? "",
    content: post.content,
    slug: post.slug,
    locale: post.locale || "en",
    thumbnail: post.thumbnail ?? "",
    is_published: post.is_published === true,
    published_at: post.published_at,
    categoryId: categoryLink?.category_id ?? "",
    tagIds: activeTagIds,
  };
}

async function syncCategoryLink(
  supabase: SupabaseClient<Database>,
  postId: number,
  categoryId: string,
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("post_category_links")
    .select("*")
    .eq("post_id", postId);

  if (error) {
    throw error;
  }

  const existingLinks = (data ?? []) as PostCategoryLink[];

  for (const link of existingLinks.filter((item) => item.is_active !== false)) {
    await runSupabaseWrite(
      supabase
        .from("post_category_links")
        .update({ is_active: false, updated_at: now })
        .eq("post_id", postId)
        .eq("category_id", link.category_id),
    );
  }

  const existingSelected = existingLinks.find((link) => link.category_id === categoryId);
  if (categoryId) {
    await runSupabaseWrite(
      existingSelected
        ? supabase
            .from("post_category_links")
            .update({ is_active: true, updated_at: now })
            .eq("post_id", postId)
            .eq("category_id", categoryId)
        : supabase
            .from("post_category_links")
            .insert({ post_id: postId, category_id: categoryId, is_active: true, updated_at: now }),
    );
  }
}

async function syncTagLinks(
  supabase: SupabaseClient<Database>,
  postId: number,
  tagIds: number[],
) {
  const now = new Date().toISOString();
  const selected = new Set(tagIds);
  const { data, error } = await supabase
    .from("tag_post_links")
    .select("*")
    .eq("post_id", postId);

  if (error) {
    throw error;
  }

  const existingLinks = (data ?? []) as TagPostLink[];

  for (const link of existingLinks.filter((item) => item.is_active && !selected.has(item.tag_id))) {
    await runSupabaseWrite(
      supabase
        .from("tag_post_links")
        .update({ is_active: false, updated_at: now })
        .eq("post_id", postId)
        .eq("tag_id", link.tag_id),
    );
  }

  for (const tagId of selected) {
    const existing = existingLinks.find((link) => link.tag_id === tagId);
    await runSupabaseWrite(
      existing
        ? supabase
            .from("tag_post_links")
            .update({ is_active: true, updated_at: now })
            .eq("post_id", postId)
            .eq("tag_id", tagId)
        : supabase
            .from("tag_post_links")
            .insert({ post_id: postId, tag_id: tagId, is_active: true, updated_at: now }),
    );
  }
}

export function BlogEditor() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [posts, setPosts] = useState<PostWithRelations[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftPost>(() => emptyDraft());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem(sidebarPreferenceKey) !== "false";
  });

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) ?? null,
    [posts, selectedPostId],
  );

  const loadData = useCallback(
    async (preferredPostId?: number | null) => {
      setDataLoading(true);
      setError(null);

      try {
        const [postsResponse, categoriesResponse, tagsResponse] = await Promise.all([
          supabase
            .from("posts")
            .select("*, post_category_links(*, categories(*)), tag_post_links(*, tags(*)), images(*)")
            .order("updated_at", { ascending: false, nullsFirst: false }),
          supabase.from("categories").select("*").order("id", { ascending: true }),
          supabase.from("tags").select("*").order("name", { ascending: true }),
        ]);

        if (postsResponse.error) {
          throw postsResponse.error;
        }
        if (categoriesResponse.error) {
          throw categoriesResponse.error;
        }
        if (tagsResponse.error) {
          throw tagsResponse.error;
        }

        const nextPosts = (postsResponse.data ?? []) as PostWithRelations[];
        setPosts(nextPosts);
        setCategories(categoriesResponse.data ?? []);
        setTags(tagsResponse.data ?? []);

        const nextPostId = preferredPostId ?? nextPosts[0]?.id ?? null;
        const nextPost = nextPosts.find((post) => post.id === nextPostId) ?? nextPosts[0] ?? null;
        setSelectedPostId(nextPost?.id ?? null);
        setDraft(nextPost ? draftFromPost(nextPost) : emptyDraft());
      } catch (caughtError) {
        setError(errorMessage(caughtError));
      } finally {
        setDataLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      setAuthLoading(false);
      if (data.session) {
        void loadData();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        void loadData();
      } else {
        setPosts([]);
        setSelectedPostId(null);
        setDraft(emptyDraft());
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadData, supabase]);

  useEffect(() => {
    window.localStorage.setItem(sidebarPreferenceKey, String(isSidebarOpen));
  }, [isSidebarOpen]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      setMessage("Signed in.");
    }

    setSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMessage(null);
  }

  function handleNewPost() {
    setSelectedPostId(null);
    setDraft(emptyDraft());
    setMessage("Drafting a new post.");
    setError(null);
  }

  function handleSelectPost(post: PostWithRelations) {
    setSelectedPostId(post.id);
    setDraft(draftFromPost(post));
    setMessage(null);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const title = draft.title.trim();
      const slug = draft.slug.trim();
      const locale = draft.locale.trim() || "en";

      if (!title) {
        throw new Error("Title is required.");
      }
      if (!slug) {
        throw new Error("Slug is required.");
      }

      const now = new Date().toISOString();
      const publishedAt = draft.is_published ? draft.published_at ?? now : null;
      const postPayload = {
        title,
        brief: nullableText(draft.brief),
        content: draft.content,
        slug,
        locale,
        thumbnail: nullableText(draft.thumbnail),
        is_published: draft.is_published,
        published_at: publishedAt,
        updated_at: now,
        category: nullableText(draft.categoryId),
      };

      const response = draft.id
        ? await supabase.from("posts").update(postPayload).eq("id", draft.id).select().single()
        : await supabase
            .from("posts")
            .insert({ ...postPayload, created_at: now })
            .select()
            .single();

      if (response.error) {
        throw response.error;
      }

      const savedPostId = response.data.id;
      await syncCategoryLink(supabase, savedPostId, draft.categoryId);
      await syncTagLinks(supabase, savedPostId, draft.tagIds);
      await loadData(savedPostId);
      setMessage("Post saved.");
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft.id) {
      handleNewPost();
      return;
    }

    const confirmed = window.confirm("Delete this post permanently?");
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const postId = draft.id;
      const cleanupResponses = await Promise.all([
        supabase.from("tag_post_links").delete().eq("post_id", postId),
        supabase.from("post_category_links").delete().eq("post_id", postId),
        supabase.from("images").delete().eq("post_id", postId),
      ]);
      const cleanupFailure = cleanupResponses.find((response) => response.error);
      if (cleanupFailure?.error) {
        throw cleanupFailure.error;
      }

      const { error: deleteError } = await supabase.from("posts").delete().eq("id", postId);
      if (deleteError) {
        throw deleteError;
      }

      await loadData(null);
      setMessage("Post deleted.");
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  function toggleTag(tagId: number) {
    setDraft((current) => ({
      ...current,
      tagIds: current.tagIds.includes(tagId)
        ? current.tagIds.filter((id) => id !== tagId)
        : [...current.tagIds, tagId],
    }));
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <form
          onSubmit={handleLogin}
          className="grid w-full max-w-sm gap-5 border border-border bg-card p-6 shadow-sm"
        >
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Blog Editor</h1>
            <p className="text-sm text-muted-foreground">Sign in with Supabase Auth.</p>
          </div>
          <label className={labelClass}>
            Email
            <input
              className={inputClass}
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className={labelClass}>
            Password
            <input
              className={inputClass}
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Sign In
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blog Editor</h1>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setIsSidebarOpen((current) => !current)}
            aria-pressed={isSidebarOpen}
          >
            {isSidebarOpen ? (
              <PanelLeftClose aria-hidden="true" />
            ) : (
              <PanelLeftOpen aria-hidden="true" />
            )}
            {isSidebarOpen ? "Hide Posts" : "Show Posts"}
          </Button>
          <Button variant="outline" onClick={() => void loadData(selectedPostId)} disabled={dataLoading}>
            <RefreshCw className={cn(dataLoading && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleNewPost}>
            <Plus aria-hidden="true" />
            New
          </Button>
          <Button variant="outline" onClick={() => void handleSignOut()}>
            <LogOut aria-hidden="true" />
            Sign Out
          </Button>
        </div>
      </header>

      <div
        className={cn(
          "grid min-h-[calc(100vh-89px)] grid-cols-1",
          isSidebarOpen && "lg:grid-cols-[320px_minmax(0,1fr)]",
        )}
      >
        {isSidebarOpen ? (
          <aside className="border-b border-border bg-muted/20 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Posts</h2>
              <span className="text-xs text-muted-foreground">{posts.length}</span>
            </div>
            <div className="max-h-80 overflow-auto lg:max-h-[calc(100vh-142px)]">
              {posts.map((post) => {
                const activeCategories = post.post_category_links.filter(
                  (link) => link.is_active !== false,
                );
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => handleSelectPost(post)}
                    className={cn(
                      "grid w-full gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted",
                      selectedPostId === post.id && "bg-muted",
                    )}
                  >
                    <span className="truncate text-sm font-medium">{post.title || "Untitled"}</span>
                    <span className="truncate text-xs text-muted-foreground">/{post.slug}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "inline-block size-2 border border-border",
                          post.is_published ? "bg-emerald-500" : "bg-transparent",
                        )}
                      />
                      {post.is_published ? "Published" : "Draft"}
                      {activeCategories[0]?.categories
                        ? ` · ${categoryLabel(activeCategories[0].categories, post.locale)}`
                        : null}
                    </span>
                  </button>
                );
              })}
              {!posts.length && !dataLoading ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">No posts found.</p>
              ) : null}
            </div>
          </aside>
        ) : null}

        <section className="grid gap-6 p-4 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-lg font-semibold">
                {draft.id ? `Editing #${draft.id}` : "New Post"}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSave()} disabled={saving || dataLoading}>
                {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                Save
              </Button>
              <Button variant="destructive" onClick={() => void handleDelete()} disabled={saving}>
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            </div>
          </div>

          {message ? <p className="border border-border bg-muted px-3 py-2 text-sm">{message}</p> : null}
          {error ? <p className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className={labelClass}>
                  Title
                  <input
                    className={inputClass}
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  />
                </label>
                <label className={labelClass}>
                  Slug
                  <input
                    className={inputClass}
                    value={draft.slug}
                    onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))}
                  />
                </label>
              </div>

              <label className={labelClass}>
                Brief
                <textarea
                  className="min-h-20 w-full resize-none border border-border bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  value={draft.brief}
                  onChange={(event) => setDraft((current) => ({ ...current, brief: event.target.value }))}
                />
              </label>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className={labelClass}>
                  Markdown
                  <textarea
                    className={cn(textareaClass, "font-mono")}
                    value={draft.content}
                    onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                  />
                </label>
                <div className="grid gap-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <Eye className="size-3.5" aria-hidden="true" />
                    Preview
                  </div>
                  <div className="markdown-preview min-h-56 overflow-auto border border-border bg-card px-4 py-3 text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {draft.content || "_No markdown content yet._"}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>

            <aside className="grid content-start gap-4 border border-border bg-card p-4">
              <label className={labelClass}>
                Locale
                <input
                  className={inputClass}
                  value={draft.locale}
                  onChange={(event) => setDraft((current) => ({ ...current, locale: event.target.value }))}
                />
              </label>

              <label className={labelClass}>
                Category
                <select
                  className={inputClass}
                  value={draft.categoryId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, categoryId: event.target.value }))
                  }
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {categoryLabel(category, draft.locale)}
                    </option>
                  ))}
                </select>
              </label>

              <label className={labelClass}>
                Thumbnail
                <input
                  className={inputClass}
                  value={draft.thumbnail}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, thumbnail: event.target.value }))
                  }
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={draft.is_published}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      is_published: event.target.checked,
                      published_at: event.target.checked ? current.published_at : null,
                    }))
                  }
                />
                Published
              </label>

              <div className="grid gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Tags
                </h3>
                <div className="grid max-h-48 gap-2 overflow-auto border border-border p-2">
                  {tags.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.tagIds.includes(tag.id)}
                        onChange={() => toggleTag(tag.id)}
                      />
                      {tag.name}
                    </label>
                  ))}
                  {!tags.length ? <p className="text-sm text-muted-foreground">No tags found.</p> : null}
                </div>
              </div>

              <div className="grid gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Linked Images
                </h3>
                <div className="grid gap-2 border border-border p-2 text-sm">
                  {selectedPost?.images.length ? (
                    selectedPost.images.map((image) => (
                      <div key={image.id} className="grid gap-1 border-b border-border pb-2 last:border-b-0 last:pb-0">
                        <span className="font-medium">{image.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {image.mimetype} · {image.width}x{image.height}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No linked image metadata.</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
