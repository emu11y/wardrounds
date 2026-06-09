import { useState, useEffect } from 'react'
import { BarChart2, TrendingUp, Users, DollarSign, Calendar } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { fetchAdmissionsByDateRange, fetchRevenueByDateRange } from '../lib/api'
import TopHeader from '../components/TopHeader'

const COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', '#5AC8FA']

function groupByDay(items, dateField) {
  const map = {}
  items.forEach(item => {
    const day = new Date(item[dateField]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    map[day] = (map[day] || 0) + 1
  })
  return Object.entries(map).map(([date, count]) => ({ date, count }))
}

function groupRevenueByDay(items) {
  const map = {}
  items.forEach(item => {
    const day = new Date(item.accrual_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    map[day] = (map[day] || 0) + Number(item.amount)
  })
  return Object.entries(map).map(([date, amount]) => ({ date, amount: Math.round(amount) }))
}

export default function Analytics() {
  const { user } = useAuth()
  const [range, setRange] = useState('30')
  const [admissions, setAdmissions] = useState([])
  const [revenue, setRevenue] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.team_id) return
    setLoading(true)
    const to = new Date().toISOString()
    const from = new Date(Date.now() - parseInt(range) * 86400000).toISOString()

    Promise.all([
      fetchAdmissionsByDateRange(user.team_id, from, to),
      fetchRevenueByDateRange(user.team_id, from, to),
    ]).then(([adm, rev]) => {
      setAdmissions(adm || [])
      setRevenue(rev || [])
    }).catch(console.error).finally(() => setLoading(false))
  }, [user?.team_id, range])

  const admissionsByDay = groupByDay(admissions, 'admission_date')
  const revenueByDay = groupRevenueByDay(revenue)
  const totalRevenue = revenue.reduce((s, r) => s + Number(r.amount), 0)
  const statusBreakdown = [
    { name: 'Admitted', value: admissions.filter(a => a.status === 'admitted').length },
    { name: 'Discharged', value: admissions.filter(a => a.status === 'discharged').length },
    { name: 'Transferred', value: admissions.filter(a => a.status === 'transferred').length },
  ].filter(d => d.value > 0)

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Analytics" />

      <div className="p-4 space-y-4">
        {/* Range selector */}
        <div className="flex gap-2">
          {[
            { label: '7d', value: '7' },
            { label: '30d', value: '30' },
            { label: '90d', value: '90' },
          ].map(({ label, value }) => (
            <button key={value} onClick={() => setRange(value)}
              className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all
                ${range === value ? 'bg-ios-blue text-white shadow-ios-card' : 'glass-button text-ios-gray-1'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard icon={Users} label="Total Admissions" value={admissions.length} color="blue" loading={loading} />
          <KpiCard icon={TrendingUp} label="Discharged" value={admissions.filter(a => a.status === 'discharged').length} color="green" loading={loading} />
          <KpiCard icon={DollarSign} label="Revenue" value={`£${totalRevenue.toLocaleString()}`} color="orange" loading={loading} />
          <KpiCard icon={Calendar} label="Avg Stay" value={(() => {
            const dis = admissions.filter(a => a.discharge_date)
            if (!dis.length) return '—'
            const avg = dis.reduce((s, a) => s + (new Date(a.discharge_date) - new Date(a.admission_date)), 0) / dis.length
            return `${Math.round(avg / 86400000)}d`
          })()} color="purple" loading={loading} />
        </div>

        {/* Admissions bar chart */}
        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={18} className="text-ios-blue" />
            <h3 className="font-semibold">Admissions by Day</h3>
          </div>
          {loading ? <ChartSkeleton /> : admissionsByDay.length === 0 ? (
            <EmptyChart label="No admissions in range" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={admissionsByDay} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" fill="#007AFF" radius={[6, 6, 0, 0]} name="Admissions" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue line chart */}
        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-ios-green" />
            <h3 className="font-semibold">Revenue Over Time</h3>
          </div>
          {loading ? <ChartSkeleton /> : revenueByDay.length === 0 ? (
            <EmptyChart label="No billing records in range" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenueByDay} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={v => [`£${v.toLocaleString()}`, 'Revenue']}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                />
                <Line type="monotone" dataKey="amount" stroke="#34C759" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#34C759' }} activeDot={{ r: 6 }} name="Revenue (£)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status pie chart */}
        {statusBreakdown.length > 0 && (
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={18} className="text-ios-purple" />
              <h3 className="font-semibold">Admission Status Breakdown</h3>
            </div>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} paddingAngle={3}>
                    {statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {statusBreakdown.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-ios-gray-1">{d.name}</span>
                    <span className="font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, color, loading }) {
  const colors = {
    blue: 'bg-ios-blue/10 text-ios-blue',
    green: 'bg-ios-green/10 text-ios-green',
    orange: 'bg-ios-orange/10 text-ios-orange',
    purple: 'bg-ios-purple/10 text-ios-purple',
  }
  return (
    <div className="glass-card">
      <div className={`w-9 h-9 rounded-2xl ${colors[color]} flex items-center justify-center mb-2`}>
        <Icon size={18} />
      </div>
      {loading ? (
        <div className="h-6 bg-ios-gray-5 rounded w-12 animate-pulse" />
      ) : (
        <p className="text-xl font-bold">{value}</p>
      )}
      <p className="text-xs text-ios-gray-1 mt-0.5">{label}</p>
    </div>
  )
}

function ChartSkeleton() {
  return <div className="h-48 bg-ios-gray-6 rounded-2xl animate-pulse" />
}

function EmptyChart({ label }) {
  return (
    <div className="h-48 flex items-center justify-center text-ios-gray-1 text-sm">{label}</div>
  )
}
