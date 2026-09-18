'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Props {
  atLimit?: boolean
}

export function InventoryImportButton({ atLimit }: Props) {
  const t = useTranslations('inventory')

  return (
    <Link href="/suppliers">
      <Button size="sm" variant="outline" disabled={atLimit} title={t('import.catalogHint')}>
        <Upload className="w-4 h-4 mr-1" />
        {t('importCsv')}
      </Button>
    </Link>
  )
}
