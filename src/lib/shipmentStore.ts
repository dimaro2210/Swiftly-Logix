import { supabase } from "./supabase";

export interface Shipment {
  id: string;
  trackingNumber: string;
  tracking_code?: string;
  status: string;
  current_status?: string;
  service: string;
  from?: { name: string; address?: string; city: string; state: string; zip: string };
  to?: { name: string; address?: string; city: string; state: string; zip: string };
  weight: string;
  createdAt: string;
  estimatedDelivery?: string;
  expected_delivery_date?: string;
  events: Array<{ 
    status: string; 
    location: string; 
    time: string; 
    date: string;
    coordinates?: { lat: number; lng: number };
  }>;
  
  userEmail?: string;
  origin?: string;
  destination?: string;
  carrier?: string;
  shipment_type?: string;
  sender_name?: string;
  sender_email?: string;
  sender_phone?: string;
  sender_address?: string;
  receiver_name?: string;
  receiver_email?: string;
  receiver_phone?: string;
  receiver_address?: string;
  contents?: string;
  departure_date?: string;
  departure_time?: string;
  current_location?: string;
  notice?: string;
  transit_waypoints?: Array<{
    name: string;
    type: "origin" | "center" | "flight" | "destination";
    lat: number;
    lng: number;
    order: number;
  }>;
  changeRequest?: {
    id: string;
    type: "reschedule" | "reroute" | "hold" | "neighbor";
    status: "pending" | "approved" | "rejected";
    newData: any;
    createdAt: string;
  };
}

export interface RegisteredUser {
  id?: string; // supabase auth user id
  firstName: string;
  lastName: string;
  email: string;
  accountType: "Personal" | "Business";
  userId: string;
  company?: string;
  address?: string;
  postalCode?: string;
  profilePicture?: string;
  status?: "pending" | "approved" | "declined";
  is_admin?: boolean;
}

export async function getShipments(): Promise<Shipment[]> {
  try {
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbToShipment);
  } catch (err) {
    console.error("Error fetching shipments:", err);
    return [];
  }
}

export async function saveShipment(shipment: Shipment): Promise<void> {
  try {
    const dbPayload = {
      id: shipment.id,
      tracking_number: shipment.trackingNumber,
      status: shipment.status,
      current_status: shipment.current_status,
      service: shipment.service,
      weight: shipment.weight,
      created_at: shipment.createdAt,
      events: shipment.events,
      origin: shipment.origin,
      destination: shipment.destination,
      carrier: shipment.carrier,
      shipment_type: shipment.shipment_type,
      sender_name: shipment.sender_name,
      sender_email: shipment.sender_email,
      sender_phone: shipment.sender_phone,
      sender_address: shipment.sender_address,
      receiver_name: shipment.receiver_name,
      receiver_email: shipment.receiver_email,
      receiver_phone: shipment.receiver_phone,
      receiver_address: shipment.receiver_address,
      contents: shipment.contents,
      departure_date: shipment.departure_date,
      departure_time: shipment.departure_time,
      expected_delivery_date: shipment.expected_delivery_date,
      estimated_delivery: shipment.estimatedDelivery,
      current_location: shipment.current_location,
      notice: shipment.notice,
      user_email: shipment.userEmail,
      transit_waypoints: shipment.transit_waypoints,
      change_request: shipment.changeRequest,
      from_data: shipment.from,
      to_data: shipment.to,
    };

    await supabase.from('shipments').upsert(dbPayload);
  } catch (err) {
    console.error("Error saving shipment:", err);
  }
}

export async function deleteShipment(id: string): Promise<void> {
  try {
    await supabase.from('shipments').delete().eq('id', id);
  } catch (err) {
    console.error("Error deleting shipment:", err);
  }
}

export async function getShipmentsForUser(email: string): Promise<Shipment[]> {
  try {
    // A shipment belongs to a user if they are the sender (user_email) OR the receiver
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .or(`user_email.ilike.${email},receiver_email.ilike.${email}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbToShipment);
  } catch (err) {
    console.error("Error fetching user shipments:", err);
    return [];
  }
}

export async function getRegisteredUsers(): Promise<RegisteredUser[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return data.map(d => ({
      id: d.id,
      firstName: d.first_name,
      lastName: d.last_name,
      email: d.email,
      accountType: d.account_type,
      userId: d.user_id,
      company: d.company,
      address: d.address,
      postalCode: d.postal_code,
      profilePicture: d.profile_picture,
      status: d.status,
      is_admin: d.is_admin,
    }));
  } catch (err) {
    console.error("Error fetching users:", err);
    return [];
  }
}

export async function updateRegisteredUser(user: RegisteredUser): Promise<void> {
  try {
    if (!user.email) return;
    
    const updatePayload: any = {
      status: user.status
    };

    if (user.is_admin !== undefined) {
      updatePayload.is_admin = user.is_admin;
    }

    await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('email', user.email);
  } catch (err) {
    console.error("Error updating user:", err);
  }
}

export async function getFullUserAccount(email: string): Promise<RegisteredUser | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      accountType: data.account_type,
      userId: data.user_id,
      company: data.company,
      address: data.address,
      postalCode: data.postal_code,
      profilePicture: data.profile_picture,
      status: data.status,
      is_admin: data.is_admin,
    };
  } catch (err) {
    console.error("Error fetching full user:", err);
    return null;
  }
}

export function generateTrackingNumber(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let num = "";
  for (let i = 0; i < 12; i++) {
    num += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SWF${num}`;
}

// Mapper to map snake_case DB fields to our Shipment interface
function mapDbToShipment(dbData: any): Shipment {
  return {
    id: dbData.id,
    trackingNumber: dbData.tracking_number,
    tracking_code: dbData.tracking_number,
    status: dbData.status,
    current_status: dbData.current_status || dbData.status,
    service: dbData.service || "Standard",
    weight: dbData.weight || "0",
    createdAt: dbData.created_at,
    events: dbData.events || [],
    origin: dbData.origin,
    destination: dbData.destination,
    carrier: dbData.carrier,
    shipment_type: dbData.shipment_type,
    sender_name: dbData.sender_name,
    sender_email: dbData.sender_email,
    sender_phone: dbData.sender_phone,
    sender_address: dbData.sender_address,
    receiver_name: dbData.receiver_name,
    receiver_email: dbData.receiver_email,
    receiver_phone: dbData.receiver_phone,
    receiver_address: dbData.receiver_address,
    contents: dbData.contents,
    departure_date: dbData.departure_date,
    departure_time: dbData.departure_time,
    expected_delivery_date: dbData.expected_delivery_date,
    estimatedDelivery: dbData.estimated_delivery,
    current_location: dbData.current_location,
    notice: dbData.notice,
    userEmail: dbData.user_email,
    transit_waypoints: dbData.transit_waypoints,
    changeRequest: dbData.change_request,
    from: dbData.from_data,
    to: dbData.to_data,
  };
}

export const LOGISTICS_CENTERS = [
  // ── USA — Major Hubs ──────────────────────────────────────────────
  { name: "Atlanta Hartsfield–Jackson Airport (ATL)", lat: 33.6407, lng: -84.4277 },
  { name: "New York JFK International Airport (JFK)", lat: 40.6413, lng: -73.7781 },
  { name: "Chicago O'Hare International Airport (ORD)", lat: 41.9742, lng: -87.9073 },
  { name: "Los Angeles International Airport (LAX)", lat: 33.9425, lng: -118.4081 },
  { name: "Dallas/Fort Worth International Airport (DFW)", lat: 32.8998, lng: -97.0403 },
  { name: "Miami International Airport (MIA)", lat: 25.7959, lng: -80.2870 },
  { name: "Philadelphia International Airport (PHL)", lat: 39.8729, lng: -75.2437 },
  { name: "Denver International Airport (DEN)", lat: 39.8561, lng: -104.6737 },
  { name: "Seattle-Tacoma International Airport (SEA)", lat: 47.4502, lng: -122.3088 },
  { name: "Louisville Worldport Hub (SDF)", lat: 38.1744, lng: -85.7366 },
  { name: "Memphis Air Cargo Hub (MEM)", lat: 35.0424, lng: -89.9767 },

  // ── Europe ────────────────────────────────────────────────────────
  { name: "London Heathrow Airport (LHR)", lat: 51.4700, lng: -0.4543 },
  { name: "Paris Charles de Gaulle Airport (CDG)", lat: 49.0097, lng: 2.5479 },
  { name: "Frankfurt Airport (FRA)", lat: 50.0379, lng: 8.5622 },
  { name: "Amsterdam Schiphol Airport (AMS)", lat: 52.3105, lng: 4.7683 },
  { name: "Madrid Adolfo Suárez Airport (MAD)", lat: 40.4839, lng: -3.5680 },
  { name: "Istanbul Airport (IST)", lat: 41.2753, lng: 28.7519 },

  // ── Middle East ───────────────────────────────────────────────────
  { name: "Dubai International Airport (DXB)", lat: 25.2532, lng: 55.3657 },
  { name: "Doha Hamad International Airport (DOH)", lat: 25.2609, lng: 51.6138 },
  { name: "Abu Dhabi International Airport (AUH)", lat: 24.4330, lng: 54.6511 },

  // ── Asia Pacific ──────────────────────────────────────────────────
  { name: "Hong Kong International Airport (HKG)", lat: 22.3080, lng: 113.9185 },
  { name: "Tokyo Narita International Airport (NRT)", lat: 35.7720, lng: 140.3929 },
  { name: "Shanghai Pudong International Airport (PVG)", lat: 31.1434, lng: 121.8052 },
  { name: "Singapore Changi Airport (SIN)", lat: 1.3644, lng: 103.9915 },
  { name: "Seoul Incheon International Airport (ICN)", lat: 37.4602, lng: 126.4407 },
  { name: "Sydney Kingsford Smith Airport (SYD)", lat: -33.9399, lng: 151.1753 },

  // ── Africa ────────────────────────────────────────────────────────
  { name: "Lagos Murtala Muhammed Airport (LOS)", lat: 6.5774, lng: 3.3214 },
  { name: "Nairobi Jomo Kenyatta Airport (NBO)", lat: -1.3192, lng: 36.9275 },
  { name: "Johannesburg O.R. Tambo Airport (JNB)", lat: -26.1367, lng: 28.2411 },
  { name: "Cairo International Airport (CAI)", lat: 30.1219, lng: 31.4056 },
  { name: "Accra Kotoka International Airport (ACC)", lat: 5.6052, lng: -0.1668 },

  // ── Americas ──────────────────────────────────────────────────────
  { name: "Toronto Pearson International Airport (YYZ)", lat: 43.6777, lng: -79.6248 },
  { name: "São Paulo Guarulhos Airport (GRU)", lat: -23.4356, lng: -46.4731 },
  { name: "Bogotá El Dorado Airport (BOG)", lat: 4.7016, lng: -74.1469 },
];
