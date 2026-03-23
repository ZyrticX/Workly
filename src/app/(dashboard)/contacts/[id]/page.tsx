import Link from 'next/link'
import { ContactDetail } from '@/components/contacts/contact-detail'

interface ContactDetailPageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'פרטי איש קשר | WhatsApp AI Agent',
  description: 'צפייה בפרטי איש קשר',
}

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  const { id } = await params

  return (
    <main className="min-h-screen bg-[#F7FAF8]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link href="/contacts" className="flex items-center gap-1 text-sm text-[#5A6E62] hover:text-[#1B2E24] transition-colors mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          חזרה ללקוחות
        </Link>
        <ContactDetail contactId={id} />
      </div>
    </main>
  )
}
