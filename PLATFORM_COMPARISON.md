# 플랫폼 비교 — 서울 인 타임

> 상태: v1.0 · 2026-09-10 · **결정 확정 — 웹 PWA** (§5·§6)
> 상위 문서: [PRD.md](PRD.md) · 범위: [MVP.md](MVP.md)
> 아래 기술 사양은 조사 시점 기준. **착수 전 실기기 검증 필요** 항목을 표시했다.

---

## 0. 먼저 — 이 결정의 성격

플랫폼 선택은 이 프로젝트에서 **생각보다 덜 중요하다.**

이유: [PRD §8.3](PRD.md)에서 정리했듯 실질 원가는 **콘텐츠 제작**이다. 스팟
하나당 수 시간~수십 시간. 반면 플랫폼별 개발 차이는 MVP 규모(스팟 3개)에서는
몇 주 수준이다.

그리고 콘텐츠 데이터(좌표·방위각·화각·사진·메타데이터)는 **플랫폼과 무관한
JSON**이다. 즉:

> **플랫폼을 나중에 갈아타도 콘텐츠는 그대로 살아남는다.**
> 따라서 결정을 미룰수록 유리하고, 초기에는 가장 싼 것으로 검증하는 게 맞다.

단 한 가지 조건이 붙는다 — **스팟 데이터 스키마를 처음부터 플랫폼 중립으로
설계할 것.** 이것만 지키면 플랫폼 전환 비용은 낮게 유지된다.

---

## 1. 후보 4종 비교

| 항목 | A. 웹 PWA | B. Flutter / React Native | C. Unity + AR Foundation | D. 웹 AR (8th Wall 등) |
|---|---|---|---|---|
| **정렬 방식** | GPS + 나침반 + 사진 오버레이 | 동일 (센서 접근 더 안정) | **VPS 앵커** — 실제 3D 공간 정합 | SLAM + VPS |
| **정렬 정확도** | 낮음 (±15도) | 낮~중 | **높음** (수 m / 수 도) | 중~높 |
| **MVP 개발 기간** | **가장 짧음** | 2~3배 | 3~5배 | 2~3배 |
| **배포** | **URL 하나** | 앱스토어 심사 + 개발자 계정 | 앱스토어 심사 | **URL 하나** |
| **SNS 확산** | **최적** — 링크가 곧 앱 | 나쁨 (설치 장벽) | 나쁨 | **최적** |
| **iOS 지원** | Safari (권한 처리 필요) | 좋음 | 좋음 (ARKit) | 좋음 |
| **비용** | 호스팅비만 | 스토어 계정 연 $99+$25 | 동일 + Google 과금 | **구독료 유의미** |
| **초기 진입장벽** | 없음 | 설치 필요 | 설치 + 용량 큼 | 없음 |
| **성숙도 리스크** | 낮음 | 낮음 | 낮음 | **벤더 종속** |

---

## 2. 각 옵션 상세

### A. 웹 PWA

카메라는 `getUserMedia`, 위치는 `Geolocation`, 방위는 `DeviceOrientation`.
옛 사진을 반투명으로 겹치고 슬라이더로 비교.

**할 수 있는 것**
- 지정 지점·지정 방위에서 사진 오버레이 + 슬라이더 비교 — MVP 요구사항 전부 충족
- 링크 하나로 즉시 실행. P2(MZ)의 SNS 확산 채널과 완벽히 맞음
- 원격 모드(PRD F10)가 자연스럽게 따라옴

**할 수 없는 것**
- 진짜 AR (평면 인식, 3D 앵커, 폰을 움직여도 사진이 공간에 고정되는 것)
- iOS Safari는 WebXR 미지원 — **확인 필요**, 정책 변동 가능

**주의할 구현 함정**
- `getUserMedia`는 **HTTPS(보안 컨텍스트) 필수.** localhost 외에는 인증서 필요
- iOS 13+는 `DeviceOrientationEvent.requestPermission()`을 **사용자 제스처
  안에서** 호출해야 함. 자동 실행 불가 → "시작하기" 버튼이 UX상 강제됨
- iOS는 `webkitCompassHeading`(진북 기준), Android는 `deviceorientationabsolute`의
  `alpha`(자북 기준). **두 경로를 따로 처리해야 한다.** 여기서 시간 많이 씀
- 자기 간섭(철골 건물, 지하철 인근)으로 나침반이 크게 튐 → **수동 미세조정
  슬라이더가 사실상 필수**

### B. Flutter / React Native

**장점:** 센서·카메라 접근이 웹보다 안정적. 오프라인·푸시 가능. 나침반 보정을
네이티브 API로 더 잘 다룰 수 있음.

**단점:** 설치 장벽이 P2 확산 전략을 정면으로 깬다. AR 플러그인은 성숙도가
낮아 결국 C로 갈 거면 우회로가 된다.

**평가:** **가장 애매한 선택.** 웹만큼 싸지도, Unity만큼 정확하지도 않다.
푸시 알림이나 오프라인이 핵심 요구사항이 되기 전엔 고를 이유가 약하다.

### C. Unity + AR Foundation + ARCore Geospatial API

City in Time과 가장 가까운 구조. **ARCore Geospatial API**는 Google Street View
데이터 기반 VPS로 단말 위치·방위를 정합한다. 서울은 Street View 커버리지가
조밀해 조건이 좋다 — **실측 검증 필요**.

**장점:** 정렬 문제를 **근본적으로 해결한다.** GPS·나침반 오차 문제가 사라짐.
폰을 움직여도 옛 사진이 공간에 고정된다. iOS·Android 동시 지원(ARKit/ARCore).

**단점**
- 학습곡선·개발기간 최대
- 앱 용량 큼, 배터리 소모 큼
- ARCore 미지원 구형 단말 배제
- Google Maps Platform **사용량 과금** — 상업화 단계에서 단가 계산 필요
- 골목·실내·나무 그늘 등 Street View 커버리지 약한 곳에서 성능 저하

### D. 웹 AR 플랫폼 (8th Wall 등)

브라우저에서 SLAM 기반 AR. 링크 확산 + AR 정확도를 동시에 노림.

**단점:** **상용 구독료가 유의미하고, 벤더 종속이 크다.** 서비스 정책·가격이
바뀌면 프로젝트가 통째로 흔들린다. 개인·공공 지원사업 단계에서는 부담.
**가격 정책 확인 필요.**

---

## 3. 권장안

> **Phase 0(MVP) = A. 웹 PWA.**
> **Phase 2(상업화) 진입 시 C. Unity + Geospatial 재평가.**

### 근거

1. **병목이 콘텐츠라서** 플랫폼에 초기 자본을 쓰는 게 비합리적이다.
2. **P2(MZ) 확산 전략과 정합.** 링크 공유가 성장 채널인데 설치 장벽을 세우는 건
   자기모순이다.
3. **PRD Phase 0의 판정 기준이 곧 플랫폼 판정 기준이다.** 정렬 성공률 70%를
   웹으로 넘기면 웹으로 계속 간다. 못 넘기면 그때 C로 간다 — **그리고 그
   판단에 필요한 데이터가 바로 Phase 0에서 나온다.**
4. **공공 지원사업 심사에는 데모 접근성이 중요하다.** 심사위원이 링크만 눌러
   바로 보는 것과 앱을 설치해야 하는 것은 체감 차이가 크다.

### 이 권장을 뒤집는 조건

아래 중 하나라도 해당하면 처음부터 C로 간다:
- Phase 0 현장 테스트에서 나침반 정렬이 실용 수준에 도달하지 못함
- 목표 공공 공모가 "AR 기술 활용"을 명시적 요건으로 요구함
- 파노라마 재구성을 MVP부터 하기로 결정 (파노라마는 3D 정합과 궁합이 좋음)

---

## 4. 플랫폼과 무관하게 지금 확정할 것 — 스팟 데이터 스키마

> **2026-09-10 확정 → [SPOT_SCHEMA.md](SPOT_SCHEMA.md) · [schema/spot.schema.json](schema/spot.schema.json).**
> 아래는 최초 초안. 확정본은 `media_type`, `license.evidence*`, `present`,
> `alignment.hints`, `confidence`가 추가되고 `guide`가 구조화됐다.

이것만 잘 잡으면 플랫폼 전환 비용이 낮게 유지된다. 초안:

```json
{
  "id": "gwanghwamun-01",
  "name_ko": "광화문 앞",
  "viewpoint": {
    "lat": 37.5759,
    "lng": 126.9769,
    "heading_deg": 0,
    "pitch_deg": 0,
    "hfov_deg": 60,
    "eye_height_m": 1.6,
    "confidence": "surveyed"
  },
  "guide": {
    "instruction_ko": "광화문 광장 세종대왕상 남쪽 10m 지점에서 북쪽을 보세요",
    "reference_photo": "guides/gwanghwamun-01-stand-here.jpg"
  },
  "historical": [
    {
      "year": 1958,
      "year_precision": "circa",
      "image": "photos/gwanghwamun-1958.jpg",
      "source": { "org": "", "id": "", "url": "" },
      "license": { "type": "KOGL-1", "attribution": "" },
      "alignment_hints": []
    }
  ]
}
```

핵심 필드 설명:
- `confidence` — 좌표·방위각의 신뢰도(`surveyed` 현장검증 / `estimated` 추정 /
  `rough` 대략). 정렬 실패 원인 분석에 필수
- `license.type` — **나중에 소급 확인 불가능.** 수집 시점에 반드시 기록
- `alignment_hints` — 사진 속 어느 윤곽선이 현재 무엇에 대응하는지. 정렬 UI의 핵심
- `year_precision` — 아카이브 사진은 연도가 부정확한 경우가 많음

---

## 5. 결정 — 웹 PWA (2026-09-10)

**Phase 0~1은 A. 웹 PWA.** Phase 2 상업화 진입 시 C. Unity + Geospatial 재평가.

받아들인 한계 (§2-A 단점 그대로):
- 진짜 AR 없음 — 나침반 각도 맞추면 사진이 뜨는 방식. 공간 고정 안 됨
- 나침반 ±15도 — 수동 미세조정 슬라이더 필수. **Phase 0 성공률 70%가 이 한계의 판정 기준**
- iOS 권한은 사용자 탭 안에서만 — "시작하기" 버튼 강제

뒤집는 조건 (둘 중 하나면 C로):
- 목표 공모 요건에 "AR 앱" 명시
- Phase 0 정렬 성공률 70% 미달

남은 조사 (결정에 영향 없음, Phase 1 전 참고용):
- [ ] 8th Wall 등 웹 AR 상용 플랫폼 가격 정책
- [ ] ARCore Geospatial 서울 도심 실측 정확도

---

## 6. 기술 스택 (확정)

기준: 사용자가 이미 쓰는 것(React 19 · Tailwind 4 · TypeScript · GitHub Pages ·
Playwright)을 그대로, 서버 없는 클라이언트 앱에 맞게 최소 구성.

| 층 | 선택 | 이유 |
|---|---|---|
| 빌드·프레임워크 | **Vite + React 19 + TypeScript + Tailwind 4** | 카메라·센서 코드 전부 브라우저 쪽 → SSR 이점 0. Next.js보다 가볍고 `vite-plugin-pwa` 성숙 |
| PWA | `vite-plugin-pwa` | manifest + 최소 서비스워커. 오프라인 캐싱은 MVP 밖 |
| 호스팅 | **GitHub Pages + GitHub Actions** | HTTPS 무료 — `getUserMedia` 필수 조건. 이미 사용 중 |
| 지도 (F1) | **Leaflet + OpenStreetMap 타일** | API 키·도메인 등록 없음. 핀 3개면 충분. 카카오맵은 Phase 1(스팟 30개)에서 재검토 |
| 센서 (F2) | 자체 `heading.ts` 모듈 | iOS `webkitCompassHeading`(진북) / Android `deviceorientationabsolute.alpha`(자북) 분기 + 편각 보정. 순수 함수로 작성해 단위 테스트 |
| 카메라·대조 뷰 (F3) | `<video>` + `<img>` 오버레이, 슬라이더 = `clip-path` | CSS만으로 성립. Canvas 실시간 합성 안 함 → 저사양 폰 발열 회피 |
| 공유 (F5) | Canvas 2D **1회** 합성 → `toBlob` → Web Share API(files) | iOS·Android 파일 공유 지원. 미지원 브라우저는 이미지 저장 폴백 |
| 데이터 | `public/spots/*.json` + 이미지 파생본 | 백엔드 없음 (MVP §4). 스키마 §4 |
| 이미지 파이프라인 | `scripts/build-images.mjs` (sharp) | 원본 → 오버레이용 1000px + 열람용 2000px, WebP + JPEG 폴백. 원본은 `/archive-raw/` (gitignore) |
| 테스트 | Vitest (방위·거리 계산) + Playwright 스모크 | 센서 수학은 순수 함수. UI는 이미 쓰는 Playwright |
| 제외 | 상태관리 라이브러리 · 라우터 · 분석 · i18n 프레임워크 | 화면 4개. 필요해지면 그때 |

### 화면 4개

1. **홈/지도** — Leaflet 핀 3개 + 목록. 원격 모드 진입점
2. **스팟 안내** — "여기 서서 이쪽" 참고 사진 + 메타 카드 + [시작하기] (iOS 권한 트리거)
3. **정렬/대조** — 카메라 + 오버레이 + 나침반 유도 + 수동 미세조정 + 슬라이더
4. **공유** — 합성 결과 미리보기 + 공유/저장

### 알려진 구현 함정 (착수 전 재확인)

- `DeviceOrientationEvent.requestPermission()` 은 iOS 13+에서 **사용자 제스처 안**에서만
- Android `alpha`는 자북·반시계, iOS `webkitCompassHeading`은 진북·시계 — 부호와 기준 둘 다 다름
- 편각(서울 약 −8~−9°)은 `geomagnetism` 계열 계산 또는 상수로 처리. MVP는 상수
- `getUserMedia`는 `https://` 또는 `localhost`만. 개발 시 `vite --host` + 자체 인증서 필요 (실기기 테스트)
- Web Share API `files`는 사용자 제스처 안에서만, HTTPS 필수
