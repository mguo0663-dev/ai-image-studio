import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const filename = searchParams.get('filename') || 'image.png';

    if (!url) {
      return NextResponse.json({ error: '缺少URL参数' }, { status: 400 });
    }

    const key = await storage.uploadFromUrl({ url, timeout: 30000 });
    const downloadUrl = await storage.generatePresignedUrl({
      key,
      expireTime: 3600,
    });

    return NextResponse.json({ downloadUrl, filename });
  } catch (err) {
    console.error('Download error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '下载失败' },
      { status: 500 }
    );
  }
}
