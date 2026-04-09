import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await auth()

  // Middleware handles the redirect, but this is a safety net
  if (!session) redirect('/')

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl mx-auto mb-4">
          {session.user?.image
            ? <img src={session.user.image} alt="" className="w-16 h-16 rounded-full" />
            : '👤'
          }
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">Dashboard</h1>
        <p className="text-slate-500 text-sm mb-4">
          Signed in as <span className="font-medium text-slate-700">{session.user?.email}</span>
        </p>
        <div className="bg-slate-50 rounded-xl p-4 text-left text-xs text-slate-500 font-mono break-all">
          {JSON.stringify({ name: session.user?.name, email: session.user?.email }, null, 2)}
        </div>
      </div>
    </div>
  )
}
