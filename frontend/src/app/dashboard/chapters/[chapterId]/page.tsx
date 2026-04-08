import ChapterWorkspaceClient from './workspace-client';

interface ChapterWorkspacePageProps {
  params: Promise<{ chapterId: string }>;
}

export default async function ChapterWorkspacePage({ params }: ChapterWorkspacePageProps) {
  const { chapterId } = await params;
  return <ChapterWorkspaceClient chapterId={chapterId} />;
}
