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
import { uploadPostImage } from "@/lib/image-upload";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type MarkdownRichEditorProps = {
  markdown: string;
  postId: number | null;
  onChange: (markdown: string) => void;
  onUploadBlocked: () => void;
  onUploadError: (message: string) => void;
  onUploadComplete: (url: string) => void;
};

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
            const publicUrl = await uploadPostImage({ supabase, postId, file });
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
    <div className="mdx-editor-shell">
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
        contentEditableClassName="mdx-editor-content"
        placeholder="Write markdown content..."
      />
    </div>
  );
}
