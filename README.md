# 서울 인 타임 (Seoul in Time)

지금 서 있는 그 자리에서, 그때를 본다.

서울 시내 특정 지점에 서서 휴대폰을 들면, 같은 위치·같은 방향에서 촬영된
수십 년 전 사진이 현재 풍경과 정렬되어 비교되는 위치 기반 아카이브 프로젝트.

레퍼런스: 홍콩 **City in Time** (홍콩 정부·홍콩대, 2021~).

---

## 현재 상태

**Phase 0 — 기획 단계. 코드 없음.**

| 단계 | 상태 |
|---|---|
| PRD 작성 | ✅ 초안 |
| MVP 범위 정의 | ✅ 초안 |
| 플랫폼 선택 | ✅ **웹 PWA** — Vite + React 19 + TS + Tailwind 4, GitHub Pages, Leaflet ([§5·§6](PLATFORM_COMPARISON.md)) |
| 사진 라이선스 게이트 | ✅ **조건부 통과** — [LICENSE_GATE.md](LICENSE_GATE.md) |
| 구현 | 🔧 스캐폴딩 완료 — 홈(지도+목록) 동작, 정렬·공유 화면은 자리표시 |

---

## 문서

| 문서 | 내용 |
|---|---|
| [PRD.md](PRD.md) | 무엇을 · 누구를 위해 · 왜. 성공 기준, 제약, 리스크 |
| [MVP.md](MVP.md) | 실제로 만들 최소 범위. 완료의 정의. 보류 목록 |
| [PLATFORM_COMPARISON.md](PLATFORM_COMPARISON.md) | 웹 PWA / Flutter / Unity AR / 웹AR 비교 및 권장안 |
| [LICENSE_GATE.md](LICENSE_GATE.md) | 사진 라이선스 확보 가능성 조사 결과 · 소스별 판정 |
| [SPOT_SCHEMA.md](SPOT_SCHEMA.md) | 스팟 데이터 스키마 v1 설명 — 콘텐츠 작업자용 |
| [schema/spot.schema.json](schema/spot.schema.json) | 스키마 기계 정의 (JSON Schema 2020-12) |
| [spots/](spots/) | 스팟 데이터. 현재 청계천 광교 draft 1건 |

---

## 다음 할 일

우선순위 순:

1. ~~사진 라이선스 게이트~~ → **통과.** 잔여 확인 항목은
   [LICENSE_GATE.md §5](LICENSE_GATE.md)
2. ~~실물 확인~~ 완료 — 서울역사아카이브 2480~4483px + 사진별 제1유형 배지,
   서울기록원 2000px + "이용유형 제한없음"(배지 없음, 보도자료로 상업·변형 허용
   확인). 상업화 전 서울기록원 서면 확인 1회 남음
3. ~~플랫폼 확정~~ 완료 — 웹 PWA, 스택 [PLATFORM_COMPARISON.md §6](PLATFORM_COMPARISON.md)
4. ~~스팟 데이터 스키마 확정~~ 완료 — [SPOT_SCHEMA.md](SPOT_SCHEMA.md)
5. ~~스캐폴딩~~ 완료. 남은 병렬 작업:
   - 콘텐츠: 청계천 광교 `historical[]` 채우기 (시대 3개), 촬영 지점 역산, 현장 답사
   - 코드: GitHub 저장소 생성 + Pages 활성화
6. 정렬 프로토타입 — 카메라 + 오버레이 + 나침반 유도 + 수동 미세조정 + 슬라이더
7. 공유 화면 — 합성 + Web Share

---

## 실행법

Node 24 기준.

```bash
npm install
```

```bash
npm run dev
```

데스크톱 브라우저에서 http://localhost:5173. 카메라·나침반은 `localhost`가
보안 컨텍스트로 취급되므로 http로도 동작한다.

**실제 폰으로 테스트할 때**는 https가 필요하다. 자체 서명 인증서로 띄운다:

```bash
npm run dev:https
```

폰에서 터미널에 찍힌 `Network:` 주소로 접속하고 인증서 경고를 한 번 수락한다.

### 검사

```bash
npm run check
```

= 스팟 JSON 스키마 검증 + 타입체크 + 단위 테스트. GitHub Actions가 배포 전에
같은 명령을 돌린다.

### 배포

`master`에 push하면 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)이
빌드해 GitHub Pages로 올린다. 저장소 Settings → Pages → Source를
**GitHub Actions**로 한 번 바꿔야 한다. 커스텀 도메인을 붙이면 워크플로의
`VITE_BASE`를 `/`로 바꾼다.

### 구조

```
spots/*.json            스팟 데이터 (플랫폼 중립, 스키마: schema/)
src/types/spot.ts       스키마의 TS 타입
src/lib/spots.ts        spots/*.json 로더
src/lib/heading.ts      나침반 수학 (순수 함수, 테스트 있음)
src/components/SpotMap  Leaflet 지도
src/App.tsx             화면 4개 상태 전환 (홈만 구현, 나머지 자리표시)
scripts/validate-spots  스키마 + 교차 규칙 검증
```

---

## 원칙

- [MVP.md](MVP.md)에 없는 기능은 MVP 완료 전까지 만들지 않는다.
  아이디어는 보류 목록에만 적는다.
- 사진은 수집 시점에 라이선스 유형을 반드시 기록한다. 소급 확인은 불가능하다.
- 옛 사진을 복원·컬러화·AI 변형하지 않는다. 원본의 사실성이 이 제품의 신뢰
  기반이다.
