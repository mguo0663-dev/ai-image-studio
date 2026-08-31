import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AI Image Studio',
    template: '%s | AI Image Studio',
  },
  description: 'AI驱动的图像生成工作室，从文字到视觉的创造空间',
  keywords: ['AI', '图像生成', 'AI绘画', '文生图'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
