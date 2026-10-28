import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { MarketIcon } from '@/components/ui/MarketIcon'
import '@/features/apartments/marketplace.i18n'

export default function HomePage() {
  const { t } = useTranslation('marketplace')
  const { t: common } = useTranslation()
  const navigate = useNavigate()
  function start(type: string) { navigate('/login', { state: { from: { pathname: '/', search: `?listingType=${type}` } } }) }
  return <div className="flex flex-col gap-8">
    <section className="market-hero grid lg:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col items-start gap-5 p-7 sm:p-12">
        <p className="market-kicker">DOMIX · {t('tagline')}</p>
        <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{t('welcome')}</h1>
        <p className="max-w-lg text-base leading-relaxed text-muted">{t('welcomeHint')}</p>
        <div className="mt-2 flex flex-wrap gap-3">{['Sale','Rent','Exchange'].map(type => <Button key={type} size="lg" variant={type === 'Rent' ? 'primary' : 'secondary'} className="rounded-full" onClick={() => start(type)}>{t(type)}</Button>)}</div>
        <p className="text-xs text-muted">{t('joinHint')}</p>
      </div>
      <div className="market-hero-art p-8" aria-hidden="true">
        <svg viewBox="0 0 420 300" className="w-full max-w-md" fill="none">
          <circle cx="218" cy="143" r="126" fill="var(--color-border)" />
          <rect x="61" y="126" width="87" height="143" rx="8" fill="#b7cbbf" />
          <rect x="142" y="70" width="123" height="199" rx="9" fill="#116a52" />
          <path d="m138 76 66-43 65 43" stroke="#0c5542" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="260" y="151" width="101" height="118" rx="8" fill="#d7c9ae" />
          {[0,1,2].flatMap(row => [0,1,2].map(col => <rect key={`${row}-${col}`} x={161+col*31} y={102+row*40} width="19" height="24" rx="3" fill="#c4ebd8" />))}
          {[0,1].flatMap(row => [0,1].map(col => <rect key={`b${row}-${col}`} x={78+col*36} y={149+row*42} width="20" height="24" rx="3" fill="#f6f7f4" />))}
          {[0,1].map(col => <rect key={`c${col}`} x={278+col*38} y="174" width="22" height="27" rx="3" fill="#fff6e6" />)}
          <path d="M190 269v-40h28v40" fill="#b8d6c7" /><path d="M39 270h344" stroke="#61716c" strokeWidth="3" strokeLinecap="round" />
          <path d="M334 269v-58" stroke="#116a52" strokeWidth="5" /><circle cx="334" cy="206" r="28" fill="#81ac90" />
          <circle cx="84" cy="56" r="17" fill="#e3c995" />
        </svg>
      </div>
    </section>
    <section className="grid gap-4 md:grid-cols-3">
      {([['heart','savedTitle','savedHint'],['bell','alertsTitle','alertsHint'],['calendar','visitTitle','visitHint']] as const).map(([icon,title,hint]) => <div key={title} className="rounded-2xl border border-border bg-card p-6"><span className="inline-flex rounded-xl bg-card-muted p-3 text-primary"><MarketIcon name={icon} /></span><h2 className="mt-4 text-base font-bold">{t(title)}</h2><p className="mt-2 text-sm leading-relaxed text-muted">{t(hint)}</p></div>)}
    </section>
    <div className="flex flex-wrap items-center justify-center gap-3"><Button className="rounded-full" onClick={() => navigate('/register')}>{common('home.createAccount')}</Button><Button variant="ghost" onClick={() => navigate('/login')}>{common('home.signIn')}</Button></div>
  </div>
}
