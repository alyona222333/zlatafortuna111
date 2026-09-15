import { getTranslations } from 'next-intl/server'
import { AnalyticsReportPage } from '../report-page'
export default async function ProductStatusAnalyticsPage() { const t = await getTranslations('analyticsNew'); return <AnalyticsReportPage report="product-status" title={t('productStatusTitle')} /> }
