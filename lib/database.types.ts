export type LocaleMap = Record<string, string>;

export type Post = {
  id: number;
  title: string;
  brief: string | null;
  content: string;
  slug: string;
  locale: string;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  thumbnail: string | null;
  is_published: boolean | null;
  category: string | null;
};

export type Category = {
  id: string;
  name: LocaleMap;
  description: LocaleMap | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Tag = {
  id: number;
  name: string;
  created_at: string | null;
  updated_at: string | null;
};

export type TagPostLink = {
  tag_id: number;
  post_id: number;
  is_active: boolean;
  updated_at: string | null;
};

export type PostCategoryLink = {
  post_id: number;
  category_id: string;
  is_active: boolean | null;
  updated_at: string | null;
};

export type PostImage = {
  id: number;
  post_id: number;
  name: string;
  mimetype: string;
  uploaded_at: string | null;
  updated_at: string | null;
  width: number;
  height: number;
};

export type Database = {
  public: {
    Tables: {
      posts: {
        Row: Post;
        Insert: Partial<Omit<Post, "id">> & Pick<Post, "title" | "content" | "slug" | "locale">;
        Update: Partial<Omit<Post, "id">>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      tags: {
        Row: Tag;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      tag_post_links: {
        Row: TagPostLink;
        Insert: TagPostLink;
        Update: Partial<TagPostLink>;
        Relationships: [];
      };
      post_category_links: {
        Row: PostCategoryLink;
        Insert: PostCategoryLink;
        Update: Partial<PostCategoryLink>;
        Relationships: [];
      };
      images: {
        Row: PostImage;
        Insert: Omit<PostImage, "id">;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
