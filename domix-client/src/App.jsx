import { useState } from 'react'
import './App.css'

const GmailIcon = () => (
  <svg viewBox="0 0 48 36" aria-hidden="true">
    <path fill="#4285f4" d="M4 36h8V17L4 11z" />
    <path fill="#34a853" d="M36 36h8V11l-8 6z" />
    <path fill="#ea4335" d="M4 11l4-7 16 12L40 4l4 7-20 15z" />
    <path fill="#c5221f" d="M4 11l8 6v-7L8 7z" />
    <path fill="#fbbc04" d="M36 10v7l8-6-4-4z" />
  </svg>
)

function App() {
  const [activeItem, setActiveItem] = useState('overview')
  const [notice, setNotice] = useState('')

  const openGmail = () => {
    window.open('https://mail.google.com/', '_blank', 'noopener,noreferrer')
    setNotice('Gmail נפתח בכרטיסייה חדשה. התחברות לחשבון Google מתבצעת בדפדפן.')
  }

  return (
    <div className="admin-shell" dir="rtl">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setActiveItem('overview')}>
          <span className="brand-mark">D</span><span>DOMix</span>
        </a>
        <div className="workspace-label">סביבת עבודה</div>
        <nav aria-label="תפריט ניהול">
          <button className={activeItem === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveItem('overview'); setNotice('') }}>
            <span className="nav-icon" aria-hidden="true">⌂</span>סקירה כללית
          </button>
          <button className={activeItem === 'gmail' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveItem('gmail'); setNotice('') }}>
            <span className="nav-icon" aria-hidden="true">✉</span>חיבור Gmail<span className="nav-chevron" aria-hidden="true">‹</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">מ</div><div className="profile"><strong>מנהל מערכת</strong><span>חשבון מנהל</span></div><span className="more" aria-hidden="true">···</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>ניהול</span><span>/</span><strong>{activeItem === 'gmail' ? 'חיבור Gmail' : 'סקירה כללית'}</strong></div>
          <span className="system-status"><i /> המערכת פעילה</span>
        </header>
        <div className="page">
          {activeItem === 'gmail' ? <>
            <div className="page-heading"><div><p className="eyebrow">ניהול מערכת <span>/</span> חיבורים</p><h1>חיבור Gmail</h1><p className="subtitle">פתחי את Gmail בדפדפן כדי להתחבר לחשבון Google שלך.</p></div></div>
            <section className="integration-card" aria-labelledby="gmail-title">
              <div className="integration-top"><div className="gmail-icon"><GmailIcon /></div><span className="connection-badge"><i /> לא מחובר</span></div>
              <h2 id="gmail-title">Google Gmail</h2>
              <p className="integration-description">התחברי לחשבון Gmail שלך בחלון דפדפן מאובטח. ההתחברות ל‑Google מתבצעת מחוץ ל‑DOMix.</p>
              {notice && <div className="notice" role="status">{notice}</div>}
              <button className="primary-button" onClick={openGmail}><GmailIcon />פתיחת Gmail בדפדפן<span aria-hidden="true">↗</span></button>
              <p className="helper-text">הכפתור פותח את Gmail. קישור חשבון Google לנתוני DOMix ידרוש הגדרת OAuth בשרת.</p>
            </section>
          </> : <>
            <div className="page-heading"><div><p className="eyebrow">מרכז הבקרה</p><h1>סקירה כללית</h1><p className="subtitle">ניהול החיבורים וההגדרות של DOMix.</p></div></div>
            <section className="overview-card"><div className="overview-copy"><span className="overview-icon">✦</span><div><h2>חיבורים חיצוניים</h2><p>נהלי את החיבורים לשירותים שלך במקום אחד.</p></div></div><button className="secondary-button" onClick={() => setActiveItem('gmail')}>ניהול חיבורים <span>←</span></button></section>
            <div className="section-title">חיבורים</div>
            <button className="service-row" onClick={() => setActiveItem('gmail')}><div className="gmail-icon small"><GmailIcon /></div><span className="service-name"><strong>Gmail</strong><small>חיבור חשבון Google</small></span><span className="connection-badge"><i /> לא מחובר</span><span className="row-arrow">←</span></button>
          </>}
        </div>
      </main>
    </div>
  )
}

export default App
