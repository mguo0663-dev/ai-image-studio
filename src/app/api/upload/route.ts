import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '未找到文件' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';
    // 转为 data URL，无需外部存储
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const key = `ref-images/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    return NextResponse.json({ key, url: dataUrl });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '上传失败' },
      { status: 500 }
    );
  }
}
