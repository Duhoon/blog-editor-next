import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const imageBucket = "blog-contents";

export function safeFileName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "image"
  );
}

export async function getImageSize(file: File) {
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

export async function uploadPostImage({
  supabase,
  postId,
  file,
  folder = "content",
}: {
  supabase: SupabaseClient<Database>;
  postId: number;
  file: File;
  folder?: "content" | "thumbnail";
}) {
  const now = new Date().toISOString();
  const name = safeFileName(file.name);
  const path = `posts/${postId}/${folder}/${now.replace(/[:.]/g, "-")}-${name}`;
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

  return publicUrl;
}
