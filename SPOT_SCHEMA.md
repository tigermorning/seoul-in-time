# 스팟 데이터 스키마 v1

> 2026-09-10 확정. 기계용 정의는 [schema/spot.schema.json](schema/spot.schema.json),
> 채운 예시는 [spots/cheonggyecheon-gwanggyo.json](spots/cheonggyecheon-gwanggyo.json).
> 이 문서는 사람이 읽는 설명 — **콘텐츠 작업자가 JSON을 채울 때 보는 문서.**

---

## 1. 이 파일 하나가 스팟 하나

```
spots/
  cheonggyecheon-gwanggyo.json     ← 스팟 정의
  cheonggyecheon-gwanggyo/         ← 그 스팟의 이미지 (파생본만 커밋)
    1964-covering-opening.jpg
    stand-here.jpg
archive-raw/                       ← 아카이브 원본. gitignore. 커밋 안 함
```

코드는 `spots/*.json`을 읽는다. 플랫폼이 바뀌어도 이 폴더는 그대로 간다.

---

## 2. 설계 원칙 3개

1. **플랫폼 중립.** 픽셀·CSS 값 없음. 위치는 위경도, 방향은 진북 기준 각도,
   이미지 안의 위치는 0~1 정규화. 웹이 실패해 Unity로 가도 파일 수정 없음.
2. **모르는 건 `null`로 적는다.** 빈 문자열이나 추정값으로 메우지 않는다.
   `year: null` + `year_precision: "unknown"`이 "1960"보다 낫다.
3. **라이선스는 근거까지 적는다.** 유형만 적으면 나중에 "왜 1유형이라고 했지"를
   재조사한다. 근거 URL + 원문 인용 + 확인일을 수집 시점에 넣는다.

---

## 3. 필드 설명

### 최상위

| 필드 | 값 | 설명 |
|---|---|---|
| `schema_version` | `1` | 스키마 바뀌면 올림. 코드가 이걸 보고 마이그레이션 |
| `id` | `cheonggyecheon-gwanggyo` | 슬러그. **공유 URL이 되므로 공개 후 절대 안 바꿈** |
| `status` | `draft` → `surveyed` → `published` | 현장 검증 전엔 `surveyed`로 못 올림 |
| `name.ko` | 표시 이름 | `en`은 선택. i18n 프레임워크 없이 확장 가능하게 객체로 |

### `viewpoint` — 어디 서서 어디를 보나

| 필드 | 설명 |
|---|---|
| `lat`, `lng` | 서 있을 지점. 서울 범위 밖이면 스키마가 거부 |
| `heading_deg` | 카메라 광축 방위. **진북 기준, 시계방향 0~360.** 편각 보정은 앱이 함 — 여기 넣지 않음 |
| `pitch_deg` | 위(+)/아래(−) 기울기. 대부분 0 |
| `hfov_deg` | 옛 사진의 수평 화각 추정치. 오버레이가 카메라 화면의 얼마를 덮을지 결정 |
| `eye_height_m` | 촬영 높이. 사람 눈높이 1.6, 2층 창이면 5 등 |
| `confidence` | `rough`(지도에서 찍음) / `estimated`(사진 속 랜드마크로 역산) / `surveyed`(현장에서 폰으로 확인) |
| `surveyed_at` | 현장 확인 날짜. `confidence: surveyed`면 필수로 채움 |
| `notes` | **어떻게 이 값에 도달했는지.** 다음 사람(또는 미래의 나)이 재검증할 수 있게 |

### `guide` — 카메라 켜기 전 안내

| 필드 | 설명 |
|---|---|
| `instruction.ko` | "광교 남쪽 끝 보도에 서서 동쪽을 보세요" 수준의 한 문장 |
| `stand_here_image` | 서 있을 자리를 찍은 현재 사진. 발판 표시용 |
| `landmarks[]` | 지금도 남아 있어서 방향 확인에 쓸 것들. 중요한 순서. `bearing_deg` 선택 |

### `present` — 원격 모드용 현재 사진

현장에 없는 사용자(공유 링크 유입, 심사위원)에게 보여줄 **미리 찍은 현재 사진.**
`published` 전까지는 `null` 허용. 촬영일 필수 — 현재도 변한다.

### `historical[]` — 옛 사진들

**오래된 것부터.** 첫 항목이 기본 정렬 대상, 나머지는 시대 선택기에 뜸.
청계천처럼 시대 3개면 항목 3개.

| 필드 | 설명 |
|---|---|
| `id` | 스팟 안에서만 유일. `1964-covering-opening` |
| `year` / `year_precision` | 연도 + `exact`/`circa`/`decade`/`unknown`. 아카이브에 연도 없으면 `null` + `unknown` |
| `date` | 아카이브가 일자까지 주면 (서울기록원은 대부분 줌) |
| `media_type` | `photo` / `tinted_postcard` / `drawing` / `aerial`. **1910~30년대 자료엔 채색 엽서가 섞여 있음** — UI가 "채색 엽서"라고 표시해 컬러 사진으로 오해 방지 |
| `description.ko` | **아카이브 캡션 원문 그대로.** 서울역사아카이브 캡션은 "왼쪽 해태상 뒤로 옛 삼군부 행랑담장" 수준으로 정밀 — 촬영 지점 추정의 1차 자료 |

#### `image`

| 필드 | 설명 |
|---|---|
| `file` | `spots/<id>/` 아래 기본 파일명. **크기 접미사 없음.** 파이프라인이 `-1000.webp`, `-2000.jpg` 등을 만듦 |
| `original_ref` | 원본 출처 URL. 원본 자체는 `archive-raw/`에만 |
| `original_px` | 원본 크기. 서울역사아카이브 2480~4483, 서울기록원 2000 |
| `crop` | 정렬에 쓸 부분 사각형(0~1). 액자·캡션·엽서 테두리 제거용. 전체면 `null` |

#### `source`

| 필드 | 설명 |
|---|---|
| `org` | `서울역사박물관` / `서울기록원` / `서울연구원` / `국가기록원` / `기타` |
| `archive_id` | 아카이브 고유번호. `H-TRNS-103296-809`, `RG5-SR79-IT329` |
| `url` | 상세페이지. **사용자에게 "원본 보기"로 노출됨** — 살아 있어야 함 |
| `producer` | 아카이브가 명시한 생산자. `서울특별시 공보실` |

#### `license` — 이 파일에서 가장 엄격한 부분

| 필드 | 설명 |
|---|---|
| `type` | `KOGL-1` / `CC-BY-4.0` / `PUBLIC-DOMAIN`만. **상업 이용 + 변형 둘 다 허용되는 것만 열거.** KOGL-2/3/4는 이 파일에 못 들어옴 — 스키마가 거부 |
| `evidence` | `badge`(상세페이지에 공공누리 마크) / `metadata`(이용유형 제한없음 등) / `statement`(기관 차원 성명) |
| `evidence_url` | 근거 페이지 |
| `evidence_quote` | **근거 문장 원문.** 페이지가 바뀌어도 우리가 뭘 보고 판단했는지 남음 |
| `attribution` | 앱이 표시할 출처 문구 그대로. 공공누리 권장 형식: *"본 저작물은 ○○에서 작성하여 공공누리 제1유형으로 개방한 '제목'을 이용하였습니다"* + URL |
| `checked_at` | 확인일 |

실제 사례 두 가지:
- **서울역사박물관** — `evidence: badge`. 상세페이지에 "공공누리 제1유형 (출처표시) 조건에 따라 이용할 수 있습니다" 문구. 가장 강함.
- **서울기록원** — `evidence: metadata`. 배지 없음. "이용유형 제한없음" + 2016 보도자료 인용. 상업화 전 서면 확인 1회 필요 ([LICENSE_GATE.md §6](LICENSE_GATE.md)).

#### `alignment.hints[]`

사진 속 "이 선이 지금 저기"를 적는 곳. `point`는 크롭 기준 0~1.
`still_exists: true`인 것만 정렬 가이드에 씀. MVP에선 텍스트 라벨만 있어도 됨.

---

## 4. 넣지 않은 것 (의도적)

- 파노라마 / 360도 — MVP.md 보류 목록
- 시대 음향 — 보류
- 다국어 본문 — `ko`/`en` 키 자리만 있음. 프레임워크 없음
- 사용자 제보 필드 — 보류
- 픽셀 좌표, CSS 값, 화면 크기 — 플랫폼 중립 위반

추가는 `schema_version` 올리면서. 삭제는 안 함.

---

## 5. 채우는 순서 (콘텐츠 작업 체크리스트)

1. 아카이브에서 사진 고름 → `historical[]` 항목 생성. `source`, `license` **그 자리에서** 채움
2. 캡션 원문 → `description.ko`
3. 캡션·랜드마크로 촬영 지점 역산 → `viewpoint` (`confidence: estimated`)
4. 현장 답사 → 좌표·방위 확인, `stand_here.jpg` + `present` 촬영 → `confidence: surveyed`, `status: surveyed`
5. 파생 이미지 생성, 앱에서 확인 → `status: published`

라이선스를 1번에서 채우는 이유: 나중엔 못 채운다.
