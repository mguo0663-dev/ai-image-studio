# AI Image Studio - 项目上下文

## 项目概览
AI驱动的图像生成工作室，支持文本描述生图、参考图上传、参数配置、历史记录管理。

### 版本技术栈
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **图像生成**: coze-coding-dev-sdk (ImageGenerationClient)
- **对象存储**: coze-coding-dev-sdk (S3Storage)
- **数据库**: Supabase (PostgreSQL + Drizzle ORM schema)

## 目录结构
```
├── public/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate/route.ts    # 图像生成API
│   │   │   ├── history/route.ts     # 历史记录列表API
│   │   │   ├── history/[id]/route.ts # 历史记录详情/删除API
│   │   │   ├── upload/route.ts      # 参考图上传API
│   │   │   └── download/route.ts    # 图像下载代理API
│   │   ├── globals.css              # 全局样式（暗色主题）
│   │   ├── layout.tsx               # 根布局
│   │   └── page.tsx                 # 主页面
│   ├── components/
│   │   ├── ai-studio/
│   │   │   ├── types.ts             # 共享类型定义 (GalleryItem, RefImage, HistoryRecord)
│   │   │   ├── gallery-grid.tsx     # 画廊墙（等高矩形卡片，生成/参考/加载态混排）
│   │   │   ├── prompt-input.tsx     # 文本输入（无边框，融入卡片，支持拖入参考图引用）
│   │   │   ├── param-settings.tsx   # 参数设置（紧凑 pill 下拉按钮行）
│   │   │   ├── ref-image-bar.tsx    # 参考图上传与拖拽排序（独立组件，当前未直接使用）
│   │   │   ├── image-preview.tsx    # 图像预览/放大/下载（独立组件）
│   │   │   └── history-panel.tsx    # 历史记录面板
│   │   └── ui/                      # shadcn/ui 组件库
│   ├── storage/database/
│   │   ├── supabase-client.ts       # Supabase客户端
│   │   └── shared/schema.ts         # Drizzle表结构定义
│   └── lib/
├── DESIGN.md                        # 设计规范
└── package.json
```

## 数据库
- 表 `image_generations`: 存储图像生成历史记录
- 使用 Supabase SDK 进行 CRUD 操作（不使用 Drizzle ORM 查询）
- RLS 已启用，场景A（无Auth，公开读写，service_role_key绕过RLS）

## 关键功能
1. **图像生成**: 调用 coze-coding-dev-sdk ImageGenerationClient，支持风格/比例/数量参数
2. **参考图上传**: 文件上传到S3存储，返回签名URL和key
3. **拖拽交互**: 参考图可拖拽排序，拖入文本框插入"图N"引用
4. **历史记录**: Supabase存储，支持查看/复用/删除
5. **下载**: 通过S3签名URL代理下载

## 开发规范
- 仅使用 pnpm 管理依赖
- TypeScript strict 模式
- 所有 Supabase 操作检查 `{ data, error }`
- 后端 SDK 调用使用 HeaderUtils.extractForwardHeaders 转发请求头
- 禁止在客户端使用 coze-coding-dev-sdk
- 暗色主题：背景 #09090b，卡片 #18181b，边框 #27272a
