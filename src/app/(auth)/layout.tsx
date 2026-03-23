export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md glass-strong shadow-ios-lg rounded-3xl p-8">{children}</div>
    </div>
  )
}
