import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('image_generations')
      .select('id, prompt, style, resolution, detail_level, aspect_ratio, image_count, image_urls, reference_image_keys, model, status, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`查询历史失败: ${error.message}`);

    const { count, error: countError } = await supabase
      .from('image_generations')
      .select('*', { count: 'exact', head: true });

    if (countError) throw new Error(`统计失败: ${countError.message}`);

    return NextResponse.json({ records: data, total: count });
  } catch (err) {
    console.error('History fetch error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '服务器错误' },
      { status: 500 }
    );
  }
}
