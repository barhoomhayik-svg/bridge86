import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Role = 'center' | 'doctor' | 'lab';
export type OrderStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
export type QuotationStatus = 'pending' | 'responded' | 'accepted' | 'declined';
export type NotificationType = 'new_order' | 'order_update' | 'new_quotation' | 'quotation_update' | 'new_comment';

export interface Profile {
  id: string;
  role: Role;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  avatar_url: string | null;
  logo_url: string | null;
  profile_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  lab_id: string;
  name: string;
  description: string | null;
  price_from: number | null;
  price_to: number | null;
  turnaround_days: number | null;
  created_at: string;
}

export interface CasePhoto {
  id: string;
  lab_id: string;
  title: string;
  description: string | null;
  photo_url: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  from_id: string;
  lab_id: string;
  file_number: string;
  patient_name: string;
  dr_name: string;
  shade: string | null;
  teeth_numbers: string | null;
  service_id: string | null;
  notes: string | null;
  status: OrderStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  from_profile?: Profile;
  lab_profile?: Profile;
  service?: Service;
  attachments?: OrderAttachment[];
}

export interface OrderAttachment {
  id: string;
  order_id: string;
  uploader_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface OrderComment {
  id: string;
  order_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: Pick<Profile, 'id' | 'name' | 'role'>;
}

export interface QuotationService {
  id: string;
  quotation_id: string;
  service_id: string | null;
  service_name: string;
  notes: string | null;
  teeth_numbers: string | null;
  quoted_price: number | null;
  created_at: string;
  service?: Service;
}

export interface Quotation {
  id: string;
  from_id: string;
  lab_id: string;
  description: string | null;
  teeth_numbers: string | null;
  status: QuotationStatus;
  response_notes: string | null;
  created_at: string;
  updated_at: string;
  from_profile?: Profile;
  lab_profile?: Profile;
  quotation_services?: QuotationService[];
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  related_id: string | null;
  read: boolean;
  created_at: string;
}

export interface FavouriteLab {
  id: string;
  user_id: string;
  lab_id: string;
  created_at: string;
}

export interface CenterMember {
  id: string;
  center_id: string;
  doctor_id: string;
  created_at: string;
  doctor_profile?: Profile;
}
