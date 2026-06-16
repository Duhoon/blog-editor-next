"use client";

import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertCodeBlock,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  type MDXEditorMethods,
  Separator,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from "@mdxeditor/editor";
import { useMemo, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const imageBucket = "blog-contents";

type MarkdownRichEditorProps = {
  markdown: string;
  postId: number | null;
  onChange: (markdown: string) => void;
  onUploadBlocked: () => void;
  onUploadError: (message: string) => void;
  onUploadComplete: (url: string) => void;
};

function safeFileName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "image";
}

async function getImageSize(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    const loaded = new Promise<{ width: number; height: number }>((resolve, reject) => {
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("Could not read image dimensions."));
    });
    image.src = objectUrl;
    return await loaded;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function MarkdownRichEditor({
  markdown,
  postId,
  onChange,
  onUploadBlocked,
  onUploadError,
  onUploadComplete,
}: MarkdownRichEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      tablePlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: "tsx" }),
      codeMirrorPlugin({
        codeBlockLanguages: {
          js: "JavaScript",
          jsx: "JSX",
          ts: "TypeScript",
          tsx: "TSX",
          css: "CSS",
          html: "HTML",
          json: "JSON",
          md: "Markdown",
          bash: "Bash",
        },
      }),
      imagePlugin({
        disableImageResize: false,
        disableImageSettingsButton: false,
        allowSetImageDimensions: true,
        imageUploadHandler: async (file) => {
          if (!postId) {
            onUploadBlocked();
            throw new Error("Save the post before uploading images.");
          }

          try {
            const now = new Date().toISOString();
            const name = safeFileName(file.name);
            const path = `posts/${postId}/${now.replace(/[:.]/g, "-")}-${name}`;
            const dimensions = await getImageSize(file);
            const { error: uploadError } = await supabase.storage
              .from(imageBucket)
              .upload(path, file, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
              });

            if (uploadError) {
              throw uploadError;
            }

            const { data } = supabase.storage.from(imageBucket).getPublicUrl(path);
            const publicUrl = data.publicUrl;
            const { error: metadataError } = await supabase.from("images").insert({
              post_id: postId,
              name: path,
              mimetype: file.type || "application/octet-stream",
              uploaded_at: now,
              updated_at: now,
              width: dimensions.width,
              height: dimensions.height,
            });

            if (metadataError) {
              throw metadataError;
            }

            onUploadComplete(publicUrl);
            return publicUrl;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Image upload failed.";
            onUploadError(message);
            throw error;
          }
        },
      }),
      markdownShortcutPlugin(),
      diffSourcePlugin({ viewMode: "source" }),
      toolbarPlugin({
        toolbarContents: () => (
          <DiffSourceToggleWrapper>
            <UndoRedo />
            <Separator />
            <BlockTypeSelect />
            <BoldItalicUnderlineToggles />
            <CodeToggle />
            <ListsToggle />
            <Separator />
            <CreateLink />
            <InsertImage />
            <InsertTable />
            <InsertThematicBreak />
            <InsertCodeBlock />
          </DiffSourceToggleWrapper>
        ),
      }),
    ],
    [onUploadBlocked, onUploadComplete, onUploadError, postId, supabase],
  );

  return (
    <MDXEditor
      ref={editorRef}
      markdown={markdown}
      onChange={(nextMarkdown, initialNormalize) => {
        if (!initialNormalize) {
          onChange(nextMarkdown);
        }
      }}
      onError={(payload) => onUploadError(payload.error)}
      plugins={plugins}
      className="mdx-editor-shell"
      contentEditableClassName="mdx-editor-content"
      placeholder="Write markdown content..."
    />
  );
}
