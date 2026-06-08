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
