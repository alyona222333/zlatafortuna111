import { getTranslations } from 'next-intl/server'
import { AnalyticsReportPage } from '../report-page'
export default async function UpsellsAnalyticsPage() { const t = await getTranslations('analyticsNew'); return <AnalyticsReportPage report="upsells" title={t('upsellsTitle')} /> }
