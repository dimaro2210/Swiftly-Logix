// Removed Supabase import

// Helper functions for localStorage
const getLocalData = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const setLocalData = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export async function getShipments(): Promise<Shipment[]> {
  const shipments = getLocalData<Shipment>('swiftly_shipments');
  return shipments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function saveShipment(shipment: Shipment): Promise<void> {
  const shipments = getLocalData<Shipment>('swiftly_shipments');
  const index = shipments.findIndex(s => s.id === shipment.id);
  if (index >= 0) {
    shipments[index] = shipment;
  } else {
    shipments.push(shipment);
  }
  setLocalData('swiftly_shipments', shipments);
}

export async function deleteShipment(id: string): Promise<void> {
  let shipments = getLocalData<Shipment>('swiftly_shipments');
  shipments = shipments.filter(s => s.id !== id);
  setLocalData('swiftly_shipments', shipments);
}

export async function getShipmentsForUser(email: string): Promise<Shipment[]> {
  const shipments = getLocalData<Shipment>('swiftly_shipments');
  return shipments
    .filter(s => s.userEmail?.toLowerCase() === email.toLowerCase() || s.receiver_email?.toLowerCase() === email.toLowerCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getRegisteredUsers(): Promise<RegisteredUser[]> {
  const users = getLocalData<RegisteredUser>('swiftly_users');
  return users; // Order not strictly needed for local storage as they are ordered by insertion
}

export async function updateRegisteredUser(user: RegisteredUser): Promise<void> {
  const users = getLocalData<RegisteredUser>('swiftly_users');
  const index = users.findIndex(u => u.email === user.email);
  if (index >= 0) {
    users[index] = { ...users[index], ...user };
    setLocalData('swiftly_users', users);
  }
}

export async function getFullUserAccount(email: string): Promise<RegisteredUser | null> {
  const users = getLocalData<RegisteredUser>('swiftly_users');
  return users.find(u => u.email === email) || null;
}

export function generateTrackingNumber(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let num = "";
  for (let i = 0; i < 12; i++) {
    num += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SWF${num}`;
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
