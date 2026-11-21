import { useEffect, useState } from 'react'
import { JourneyContext } from './journey.js'
import { analyze, mockCatalog, mockResult } from './mock.js'
import { koreanDate } from './alerts.js'
import { Screen, ApplyButton } from './components/UI.jsx'
import Nearby from './components/Nearby.jsx'
import LoginScreen from './screens/LoginScreen.jsx'
import DraftScreen from './screens/DraftScreen.jsx'
import BenefitsScreen from './screens/BenefitsScreen.jsx'
import NoticeScreen from './screens/NoticeScreen.jsx'
import SettingsScreen from './screens/SettingsScreen.jsx'
import { Program } from './screens/ChecklistScreen.jsx'

const FONT = { normal: '1.25rem', large: '1.5rem', xlarge: '1.75rem' }

const read = (k, f) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? f
  } catch {
    return f
  }
}
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* 이번 세션만 유지 */
  }
}
const hasStored = (k) => {
  try {
    return localStorage.getItem(k) !== null
  } catch {
    return false
  }
}
const clearStored = (...keys) => {
  try {
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* 무시 */
  }
}
const storedFont = () => {
  const f = read('ws-font', 'normal')
  return f in FONT ? f : 'normal'
}

export default function App() {
  const [screen, setScreen] = useState('login')
  const [back, setBack] = useState('benefits')
  const [data, setData] = useState(null)
  const [profile, setProfile] = useState(null)
  const [font, setFont] = useState(storedFont)
  const [alertOn, setAlertOn] = useState(() => read('ws-alert', true))
  const [applied, setApplied] = useState(() => read('ws-applied', []))
  const [journeys, setJourneys] = useState(() => read('wm-journeys', {}))
  const [favorites, setFavorites] = useState(() => read('wm-favorites', []))
  const [mypageTab, setMypageTab] = useState('즐겨찾기')
  const [benefitCategory, setBenefitCategory] = useState(null)
  const [resumeName, setResumeName] = useState(null)
  const [resumeBack, setResumeBack] = useState('settings')

  useEffect(() => {
    document.title = '복지메이트'
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--ws-font-size', FONT[font])
  }, [font])

  useEffect(() => {
    const h1 = document.querySelector('.ws-ui-title')
    h1?.setAttribute('tabindex', '-1')
    h1?.focus()
  }, [screen, resumeName])

  const saveProfile = (p) => {
    setProfile(p)
    if (p.age >= 60 && !hasStored('ws-font')) setFont('large')
  }

  const changeFont = (f) => {
    setFont(f)
    write('ws-font', f)
  }

  const changeAlert = (v) => {
    setAlertOn(v)
    write('ws-alert', v)
  }

  const updateJourney = (program, patch) => {
    const next = { ...journeys, [program.name]: { program, checked: [], guide: null, ...journeys[program.name], ...patch } }
    setJourneys(next)
    write('wm-journeys', next)
  }

  const toggleApplied = (program) => {
    if (program.docs) updateJourney(program)
    const next = applied.some((a) => a.name === program.name)
      ? applied.filter((a) => a.name !== program.name)
      : [...applied, { ...program, name: program.name, deadline: program.deadline }]
    setApplied(next)
    write('ws-applied', next)
  }

  const toggleFavorite = (program) => {
    const next = favorites.some((f) => f.name === program.name) ? favorites.filter((f) => f.name !== program.name) : [...favorites, program]
    setFavorites(next)
    write('wm-favorites', next)
  }

  const findProgram = (name) =>
    journeys[name]?.program ?? [favorites, mockCatalog, mockResult.programs, applied].flat().find((p) => p.name === name)

  const resumeProgram = (name) => {
    if (!findProgram(name)) return
    setResumeName(name)
    setResumeBack('settings')
    setScreen('resume')
  }

  const openProgram = (program) => {
    updateJourney(program)
    setResumeName(program.name)
    setResumeBack('benefits')
    setScreen('resume')
  }

  const scan = async (selection) => {
    const result = await analyze(selection)
    setData(result)
    setScreen('notice')
  }

  const logout = () => {
    setFavorites([])
    setJourneys({})
    setApplied([])
    clearStored('wm-favorites', 'wm-journeys', 'ws-applied')
    setMypageTab('즐겨찾기')
    setBenefitCategory(null)
    setResumeName(null)
    setProfile(null)
    setData(null)
    setFont(storedFont())
    setScreen('login')
  }

  const goSettings = () => {
    setBack(screen)
    setScreen('settings')
  }
  const home = () => setScreen('benefits')

  let view
  if (screen === 'login') view = <LoginScreen onLogin={() => setScreen('draft')} />
  else if (screen === 'draft')
    view = (
      <DraftScreen
        onBack={() => setScreen('login')}
        onDone={(p) => {
          saveProfile(p)
          setBenefitCategory(null)
          setScreen('benefits')
        }}
      />
    )
  else if (screen === 'benefits')
    view = (
      <BenefitsScreen
        profile={profile}
        category={benefitCategory}
        setCategory={setBenefitCategory}
        alertOn={alertOn}
        applied={applied}
        favorites={favorites}
        onFavorite={toggleFavorite}
        onOpen={openProgram}
        onScan={scan}
        onBack={() => setScreen('draft')}
        onHome={home}
      />
    )
  else if (screen === 'notice')
    view = <NoticeScreen data={data} profile={profile} applied={applied} onToggleApplied={toggleApplied} onBack={() => setScreen('benefits')} onHome={home} />
  else if (screen === 'resume') {
    const program = findProgram(resumeName)
    const isApplied = applied.some((a) => a.name === program?.name)
    view = program ? (
      <Screen
        variant="detail"
        title={program.name}
        onBack={() => setScreen(resumeBack)}
        onHome={home}
        footer={<ApplyButton applied={isApplied} onToggle={() => toggleApplied(program)} />}
      >
        <details className="wm-disclosure" open={isApplied}>
          <summary>혜택 설명 · 신청 조건 확인</summary>
          <p>{program.summary || '저장된 상세 설명이 없어요. 제출처에서 제도 내용을 다시 확인해 주세요.'}</p>
          {program.eligibility && <p className="ws-ui-note">{program.eligibility}</p>}
          {program.source && <p className="ws-ui-muted">출처: {program.source}</p>}
        </details>
        <Program program={program} today={koreanDate()} />
        <details className="wm-disclosure">
          <summary>가까운 제출처 찾기</summary>
          <Nearby gu={profile.gu} dong={profile.dong} program={program} />
        </details>
      </Screen>
    ) : null
  } else if (screen === 'settings')
    view = (
      <SettingsScreen
        tab={mypageTab}
        setTab={setMypageTab}
        profile={profile}
        font={font}
        setFont={changeFont}
        alertOn={alertOn}
        setAlertOn={changeAlert}
        journeys={journeys}
        favorites={favorites}
        applied={applied}
        onResume={resumeProgram}
        onFavorite={toggleFavorite}
        onRemoveApplied={(name) => toggleApplied({ name })}
        onSaveProfile={(p) => {
          saveProfile(p)
          setScreen(back)
        }}
        onLogout={logout}
        onBack={() => setScreen(back)}
        onHome={home}
      />
    )

  return (
    <JourneyContext.Provider value={{ journeys, updateJourney }}>
      {view}
      {profile && screen !== 'settings' && (
        <button type="button" className="ws-gear" onClick={goSettings}>♡ 마이페이지</button>
      )}
    </JourneyContext.Provider>
  )
}
