import { NextResponse } from 'next/server';

import {
  getLegalDocument,
  legalDocumentToPlainText,
} from '@/shared/legal/documents';

type Context = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, context: Context) {
  const { slug } = await context.params;
  const document = getLegalDocument(slug);

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  return new NextResponse(legalDocumentToPlainText(document), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${document.slug}.txt"`,
    },
  });
}
