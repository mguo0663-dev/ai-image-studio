import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '缺少ID' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('image_generations')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除失败: ${error.message}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '服务器错误' },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '缺少ID' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('image_generations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`查询失败: ${error.message}`);
    if (!data) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    return NextResponse.json({ record: data });
  } catch (err) {
    console.error('Get record error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '服务器错误' },
      { status: 500 }
    );
  }
}
