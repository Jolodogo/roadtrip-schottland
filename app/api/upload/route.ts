import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, STORAGE_BUCKET } from '@/lib/supabase';

// Prüft ob die ersten Bytes echte Bild-Signaturen sind (verhindert MIME-Spoofing)
function hasValidImageMagicBytes(buffer: Uint8Array): boolean {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // WebP: "RIFF" an Byte 0, "WEBP" an Byte 8
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true;
  // HEIC/HEIF: ISO Base Media — "ftyp"-Box an Byte 4–7
  if (buffer.length >= 8 &&
      buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return true;
  return false;
}

export async function POST(request: NextRequest) {
  const passcode = request.headers.get('x-passcode');

  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: 'Ungültiger Passcode' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Keine Datei übergeben' }, { status: 400 });
  }

  // MIME-Typ prüfen
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Nur JPG, PNG, WebP oder HEIC erlaubt' }, { status: 400 });
  }

  // 10MB limit
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Maximale Dateigröße: 10 MB' }, { status: 400 });
  }

  // Magic-Bytes prüfen (verhindert gefälschten Content-Type)
  const headerBuffer = await file.slice(0, 12).arrayBuffer();
  if (!hasValidImageMagicBytes(new Uint8Array(headerBuffer))) {
    return NextResponse.json({ error: 'Datei ist kein gültiges Bild' }, { status: 400 });
  }

  const supabase = createServerClient();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return NextResponse.json({ url: urlData.publicUrl }, { status: 201 });
}
