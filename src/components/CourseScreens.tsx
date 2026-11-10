import { CourseMap } from './CourseMap'
import { CompareSlider } from './CompareSlider'
import { CreditBar, PhotoCredits } from './PhotoCredit'
import { spotImageUrl } from '../lib/spots'
import { COURSE_WALK, LANGS, LANG_LABEL, stopName, t } from '../lib/course'
import type { CourseEntry, Lang } from '../lib/course'

function LangSwitch({ lang, onLang }: { lang: Lang; onLang: (l: Lang) => void }) {
  return (
    <div className="flex shrink-0 gap-1 whitespace-nowrap" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onLang(l)}
          aria-pressed={l === lang}
          className={`rounded px-2 py-1 text-xs ${l === lang ? 'bg-amber-400 text-black' : 'bg-neutral-800 text-neutral-300'}`}
        >
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
  )
}

export function CourseHome({
  course,
  lang,
  onLang,
  onSelect,
  onLab,
}: {
  course: CourseEntry[]
  lang: Lang
  onLang: (l: Lang) => void
  onSelect: (entry: CourseEntry) => void
  onLab: () => void
}) {
  return (
    <main className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
        <div>
          <h1 className="text-xl font-semibold">{t(lang, 'title')}</h1>
          <p className="text-sm text-neutral-400">{t(lang, 'tagline')}</p>
          <p className="mt-1 text-xs text-amber-400">
            {t(lang, 'walk', { km: COURSE_WALK.km, min: COURSE_WALK.minutes })}
          </p>
        </div>
        <LangSwitch lang={lang} onLang={onLang} />
      </header>
      <div className="h-72 shrink-0">
        <CourseMap course={course} lang={lang} onSelect={onSelect} />
      </div>
      <ol className="flex-1 divide-y divide-neutral-800 overflow-y-auto">
        {course.map((entry) => {
          const photo = entry.spot.historical[0]
          return (
            <li key={entry.spot.id}>
              <button
                type="button"
                onClick={() => onSelect(entry)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-neutral-900"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-semibold text-black">
                  {entry.index + 1}
                </span>
                <img
                  src={spotImageUrl(entry.spot, photo.image.file)}
                  alt=""
                  loading="lazy"
                  className="h-12 w-16 shrink-0 rounded object-cover"
                />
                <span className="flex-1">{stopName(entry, lang)}</span>
                <span className="text-neutral-500">›</span>
              </button>
            </li>
          )
        })}
      </ol>
      <footer className="px-4 py-2 text-right">
        <button type="button" onClick={onLab} className="text-xs text-neutral-500 underline">
          {t(lang, 'lab')}
        </button>
      </footer>
    </main>
  )
}

export function CourseStopScreen({
  entry,
  total,
  lang,
  onLang,
  onBack,
  onGo,
}: {
  entry: CourseEntry
  total: number
  lang: Lang
  onLang: (l: Lang) => void
  onBack: () => void
  onGo: (index: number) => void
}) {
  const { spot, stop, index } = entry
  const photo = spot.historical[0]
  const story = stop.story[lang]
  const audio = lang === 'ko' ? undefined : stop.audio[lang]

  return (
    <main className="flex h-full flex-col">
      <header className="flex items-center justify-between px-4 pt-3 pb-2">
        <button type="button" onClick={onBack} className="text-sm text-neutral-400">
          {t(lang, 'back')}
        </button>
        <LangSwitch lang={lang} onLang={onLang} />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <h1 className="px-4 text-lg font-semibold">
          <span className="mr-2 text-amber-400">{index + 1}</span>
          {stopName(entry, lang)}
        </h1>
        <div className="mt-2">
          <CompareSlider
            thenSrc={spotImageUrl(spot, photo.image.file)}
            nowSrc={spot.present ? spotImageUrl(spot, spot.present.file) : null}
            thenLabel={t(lang, 'then')}
            nowLabel={t(lang, 'now')}
            alt={photo.title.ko}
          />
          <div className="px-4 pt-1">
            <CreditBar photo={photo} />
          </div>
        </div>
        {!spot.present && <p className="px-4 pt-2 text-xs text-neutral-500">{t(lang, 'nowSoon')}</p>}
        {audio && (
          <div className="px-4 pt-3">
            <span className="text-xs text-neutral-400">{t(lang, 'listen')}</span>
            <audio controls preload="none" src={`${import.meta.env.BASE_URL}audio/${audio}`} className="mt-1 w-full" />
          </div>
        )}
        <p className="px-4 pt-3 leading-relaxed text-neutral-200">
          {story ?? <span className="text-sm text-neutral-500">{t(lang, 'storySoon')}</span>}
        </p>
        <details className="px-4 pt-4 pb-4">
          <summary className="cursor-pointer text-xs text-neutral-500">{t(lang, 'credits')}</summary>
          <div className="mt-2">
            <PhotoCredits photos={spot.historical} />
          </div>
        </details>
      </div>
      <nav className="flex gap-2 border-t border-neutral-800 px-4 py-2">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onGo(index - 1)}
          className="flex-1 rounded-lg bg-neutral-800 px-3 py-2 text-sm disabled:opacity-30"
        >
          {t(lang, 'prev')}
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onGo(index + 1)}
          className="flex-1 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-black disabled:opacity-30"
        >
          {t(lang, 'next')}
        </button>
      </nav>
    </main>
  )
}
