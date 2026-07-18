export type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  destination: string | null;
  owner_id: string;
  created_at: string;
};

export type ProjectMember = {
  project_id: string;
  user_id: string;
  role: "owner" | "member";
  created_at: string;
  profiles?: Profile | null;
};

export type Invitation = {
  id: string;
  project_id: string;
  email: string;
  token: string;
  invited_by: string;
  status: "pending" | "accepted";
  created_at: string;
};

export type TripFile = {
  id: string;
  project_id: string;
  uploaded_by: string;
  name: string;
  kind: "text" | "image" | "doc";
  mime_type: string | null;
  storage_path: string | null;
  content_text: string | null;
  created_at: string;
};

export type ItineraryStop = {
  name: string;
  description?: string;
  time?: string;
  lat?: number | null;
  lng?: number | null;
};

export type ItineraryDay = {
  day: number;
  title?: string;
  stops: ItineraryStop[];
};

export type ItineraryData = {
  title?: string;
  summary?: string;
  days: ItineraryDay[];
};

export type Itinerary = {
  id: string;
  project_id: string;
  generated_by: string;
  title: string | null;
  summary: string | null;
  data: ItineraryData;
  created_at: string;
};
