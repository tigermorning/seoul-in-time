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
| 구현 | ⬜ 미착수 |

---

## 문서

| 문서 | 내용 |
|---|---|
| [PRD.md](PRD.md) | 무엇을 · 누구를 위해 · 왜. 성공 기준, 제약, 리스크 |
| [MVP.md](MVP.md) | 실제로 만들 최소 범위. 완료의 정의. 보류 목록 |
| [PLATFORM_COMPARISON.md](PLATFORM_COMPARISON.md) | 웹 PWA / Flutter / Unity AR / 웹AR 비교 및 권장안 |
| [LICENSE_GATE.md](LICENSE_GATE.md) | 사진 라이선스 확보 가능성 조사 결과 · 소스별 판정 |

---

## 다음 할 일

우선순위 순:

1. ~~사진 라이선스 게이트~~ → **통과.** 잔여 확인 항목은
   [LICENSE_GATE.md §5](LICENSE_GATE.md)
2. ~~실물 확인~~ 완료 — 서울역사아카이브 2480~4483px + 사진별 제1유형 배지,
   서울기록원 2000px + "이용유형 제한없음"(배지 없음, 보도자료로 상업·변형 허용
   확인). 상업화 전 서울기록원 서면 확인 1회 남음
3. ~~플랫폼 확정~~ 완료 — 웹 PWA, 스택 [PLATFORM_COMPARISON.md §6](PLATFORM_COMPARISON.md)
4. 스팟 데이터 스키마 확정 → [PLATFORM_COMPARISON.md §4](PLATFORM_COMPARISON.md)
5. 프로젝트 스캐폴딩 (Vite + React + TS + Tailwind + PWA + Pages 배포)
6. 스팟 1곳(청계천 권장 — 자료 26건 확인됨) 콘텐츠 제작
7. 정렬 프로토타입 구현

---

## 실행법

아직 코드 없음. 구현 착수 시 이 절을 갱신한다.

---

## 원칙

- [MVP.md](MVP.md)에 없는 기능은 MVP 완료 전까지 만들지 않는다.
  아이디어는 보류 목록에만 적는다.
- 사진은 수집 시점에 라이선스 유형을 반드시 기록한다. 소급 확인은 불가능하다.
- 옛 사진을 복원·컬러화·AI 변형하지 않는다. 원본의 사실성이 이 제품의 신뢰
  기반이다.
