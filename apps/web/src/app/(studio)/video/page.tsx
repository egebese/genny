import type { Metadata } from 'next'
import { studioProps } from '@/features/studio/server/studio-page.ts'
import { Studio } from '@/features/studio/ui/studio.tsx'

export const metadata: Metadata = { title: 'Video' }

export default async function VideoStudioPage() {
  return <Studio {...(await studioProps('video'))} />
}
