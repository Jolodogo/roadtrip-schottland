export interface Post {
  id: string;
  created_at: string;
  title: string;
  text: string | null;
  latitude: number;
  longitude: number;
  image_url: string | null;
  location_name: string | null;
  day_number: number | null;
}

export interface Comment {
  id: string;
  created_at: string;
  post_id: string;
  author_name: string;
  text: string;
}

export interface CreatePostPayload {
  title: string;
  text?: string;
  latitude: number;
  longitude: number;
  image_url?: string;
  location_name?: string;
  day_number?: number;
  passcode: string;
}
