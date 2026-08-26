import type { Metadata } from 'next'
import { studioProps } from '@/features/studio/server/studio-page.ts'
import { Studio } from '@/features/studio/ui/studio.tsx'

export const metadata: Metadata = { title: 'Audio' }

export default async function AudioStudioPage() {
  return <Studio {...(await studioProps('audio'))} />
}
