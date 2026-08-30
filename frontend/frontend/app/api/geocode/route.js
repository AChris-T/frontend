import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ address: null }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      { headers: { 'User-Agent': 'ui-road-monitor-admin-dashboard/1.0' } }
    );
    const data = await res.json();
    const roadName = data.address?.road || data.address?.pedestrian || data.address?.path || data.address?.footway || null;
    return NextResponse.json({ address: data.display_name || null, roadName });
  } catch {
    return NextResponse.json({ address: null });
  }
}
