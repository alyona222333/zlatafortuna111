import { getTranslations } from 'next-intl/server'
import { AnalyticsReportPage } from '../report-page'
export default async function ManagersAnalyticsPage() { const t = await getTranslations('analyticsNew'); return <AnalyticsReportPage report="managers" title={t('managersTitle')} /> }
