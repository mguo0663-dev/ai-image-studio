import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface GenerateRequestBody {
  prompt: string;
  style?: string; // Can be comma-separated for multiple styles
  resolution?: string;
  detailLevel?: string;
  aspectRatio?: string;
  imageCount?: number;
  model?: string;
  referenceImageUrls?: string[];
}

// 将 data URL 解析为 { buffer, mimeType }
function parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

// 从 URL 或 data URL 获取图片 Buffer（如果是 http URL 则下载）
async function fetchImageBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  // data URL 直接解析
  if (url.startsWith('data:')) {
    return parseDataUrl(url);
  }
  // http URL 下载
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const arrayBuffer = await resp.arrayBuffer();
    const mimeType = resp.headers.get('content-type') || 'image/png';
    return { buffer: Buffer.from(arrayBuffer), mimeType };
  } catch {
    return null;
  }
}

// 新的生图 API 配置
const IMAGE_API_BASE = 'https://oneapi-comate.baidu-int.com';
const IMAGE_API_KEY = 'sk-3cTwA7lyKvSP6vHy86C357A4F32740D4944d8a501fC41e6e';
const DEFAULT_MODEL = 'gpt-image-2';

const STYLE_PROMPTS: Record<string, string> = {
  realistic: 'photorealistic, highly detailed, natural lighting',
  anime: 'anime style, cel shading, vibrant colors',
  oil_painting: 'oil painting style, textured brushstrokes, classical art',
  watercolor: 'watercolor painting, soft washes, delicate textures',
  pixel_art: 'pixel art style, retro game aesthetic, 8-bit',
  cyberpunk: 'cyberpunk style, neon lights, futuristic dystopia',
  minimalist: 'minimalist design, clean lines, simple composition',
  sketch: 'pencil sketch style, hand-drawn, graphite lines',
};

const DETAIL_PROMPTS: Record<string, string> = {
  low: 'simple, low detail, basic shapes',
  standard: 'moderate detail, balanced composition',
  high: 'ultra detailed, intricate details, 8K quality',
};

// 根据宽高比和分辨率档位（较长边像素）计算尺寸
function buildSizeString(aspectRatio: string, resolution: string): string {
  if (aspectRatio === 'custom') return resolution;

  const base = parseInt(resolution, 10) || 1024;

  const ratioMap: Record<string, [number, number]> = {
    '1:1': [1, 1],
    '16:9': [16, 9],
    '9:16': [9, 16],
    '4:3': [4, 3],
    '3:4': [3, 4],
    '3:2': [3, 2],
    '2:3': [2, 3],
  };

  const ratio = ratioMap[aspectRatio];
  if (!ratio) return `${base}x${base}`;

  const [rw, rh] = ratio;
  const scale = base / Math.max(rw, rh);
  const w = Math.round(rw * scale);
  const h = Math.round(rh * scale);

  return `${w}x${h}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequestBody = await request.json();
    const {
      prompt,
      style = '',
      detailLevel = 'standard',
      aspectRatio = '1:1',
      imageCount = 1,
      model = DEFAULT_MODEL,
      resolution = '1024',
    } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: '请输入图像描述' }, { status: 400 });
    }

    // Build style prompt from multiple styles (comma-separated)
    let stylePrompt = '';
    if (style) {
      const styleValues = style.split(',').filter(s => s.trim());
      stylePrompt = styleValues.map(s => STYLE_PROMPTS[s.trim()] || '').filter(p => p).join(', ');
    }

    const detailPrompt = DETAIL_PROMPTS[detailLevel] || DETAIL_PROMPTS.standard;
    const sizeString = buildSizeString(aspectRatio, resolution);

    // Build full prompt
    const promptParts = [prompt.trim()];
    if (stylePrompt) promptParts.push(stylePrompt);
    if (detailPrompt) promptParts.push(detailPrompt);
    const fullPrompt = promptParts.join(', ');

    // 预处理参考图：解析为 Buffer
    const referenceImageUrls = body.referenceImageUrls || [];
    const refImages = await Promise.all(
      referenceImageUrls.filter(Boolean).map(url => fetchImageBuffer(url))
    );
    const validRefImages = refImages.filter((img): img is { buffer: Buffer; mimeType: string } => img !== null);

    const hasReferenceImages = validRefImages.length > 0;
    const endpoint = hasReferenceImages ? '/v1/images/edits' : '/v1/images/generations';

    // 并发调用生图 API
    const generatePromises = Array.from({ length: imageCount }, () => {
      if (hasReferenceImages) {
        // 有参考图：使用 multipart form data 调用 edits 端点
        const formData = new FormData();
        formData.append('model', model);
        formData.append('prompt', fullPrompt);
        formData.append('n', '1');
        formData.append('size', sizeString);
        // 第一张参考图作为 image 参数
        const firstImage = validRefImages[0];
        formData.append('image', new Blob([firstImage.buffer], { type: firstImage.mimeType }), 'reference.png');
        // 多张参考图作为额外 image 参数
        for (let i = 1; i < validRefImages.length; i++) {
          formData.append('image', new Blob([validRefImages[i].buffer], { type: validRefImages[i].mimeType }), `reference${i}.png`);
        }
        return fetch(`${IMAGE_API_BASE}${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${IMAGE_API_KEY}`,
          },
          body: formData,
        });
      }
      // 无参考图：使用 JSON 调用 generations 端点
      return fetch(`${IMAGE_API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${IMAGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: fullPrompt,
          n: 1,
          size: sizeString,
        }),
      });
    });

    const responses = await Promise.all(generatePromises);
    const allImageUrls: string[] = [];

    for (const response of responses) {
      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Image generation API error:', response.status, errorBody);
        continue;
      }

      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          if (item.b64_json) {
            // base64 转为 data URL
            allImageUrls.push(`data:image/png;base64,${item.b64_json}`);
          } else if (item.url) {
            allImageUrls.push(item.url);
          }
        }
      }
    }

    if (allImageUrls.length === 0) {
      return NextResponse.json({ error: '图像生成失败，请稍后重试' }, { status: 500 });
    }

    // 保存到 Supabase（如果可用）
    let recordId: string | undefined;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('image_generations')
        .insert({
          prompt,
          style: style || null,
          resolution: sizeString,
          detail_level: detailLevel,
          aspect_ratio: aspectRatio,
          image_count: imageCount,
          image_urls: allImageUrls,
          reference_image_keys: referenceImageUrls.length > 0 ? referenceImageUrls : null,
          model,
          status: 'completed',
        })
        .select('id')
        .single();

      if (!error) {
        recordId = data?.id;
      }
    } catch (err) {
      console.error('Failed to save history:', err);
    }

    return NextResponse.json({
      imageUrls: allImageUrls,
      id: recordId,
    });
  } catch (err) {
    console.error('Generate error:', err);
    const message = err instanceof Error ? err.message : '服务器错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
