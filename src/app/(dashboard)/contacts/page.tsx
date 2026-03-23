import { ContactsList } from '@/components/contacts/contacts-list'

export const metadata = {
  title: 'אנשי קשר | WhatsApp AI Agent',
  description: 'ניהול אנשי קשר',
}

export default function ContactsPage() {
  return (
    <div className="min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1B2E24]">לקוחות</h1>
      </div>
      <ContactsList />
    </div>
  )
}
