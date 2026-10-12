# 화이트샌즈 검수 관리 웹앱

주희물류 → 제이에스컴퍼니 출고 / 검수 / 복귀 현황을 관리하는 웹앱.
기존 Google Sheets 추적을 완전히 대체한다 — 이 앱의 DB가 유일한 정본이다.

## 기능

- 엑셀(.xlsx) 업로드 → 변경 미리보기(diff) → 선택 반영 (`/import`). 자체 양식 외에도
  "발주서_택배" 형식(오더제목/상품컬러코드/옵션(수집)/수량/출고일 등)을 그대로 인식한다 —
  수령인/주소/전화번호 같은 개인정보 열은 아예 필드 매핑이 없어서 읽지도 저장하지도 않고
  "무시된 열"로만 표시됨
- 로그인 — 아이디 입력창은 없고 **비밀번호만으로 계정을 구분**한다. 마스터/작업자 등
  계정마다 다른 비밀번호를 `ACCOUNTS_JSON`에 등록해두면, 어떤 비밀번호를 입력했는지로
  로그인한 사람이 정해진다. 상단에 로그인한 사람 표시, 수정/업로드/스캔 기록에도
  계정 id가 같이 남는다 (`/orders`, `/import/history`, 스캔 내역 다운로드)
- 검수수량/불량수량/복귀일자/복귀수량/비고를 인라인으로 수정
- 양품수량(=검수-불량), 차이(=이동-복귀)는 항상 자동 계산 — 수동 입력/임포트로 덮어쓸 수 없음
- 업로드 이력 (`/import/history`)
- 바코드 검수 (`/barcode`): 오더번호 → 상품 선택 → USB 스캐너로 바코드 스캔 → 즉시 일치/불일치
  표시. 원래 별도 실행파일(`BarcodeInspector.exe`)로 쓰던 기능을 이 웹앱에 통합한 것 —
  상품/바코드 등록표도 엑셀 양식 다운로드 → 업로드(추가/병합)로 관리하고, 스캔 기록은
  오더번호 단위로 엑셀 다운로드 가능
  - **스캔할 때마다 `/orders`(현황)에도 자동 반영된다**: 일치 1건당 검수수량 +1, 불일치
    1건당 검수수량 +1·불량수량 +1. (오더번호+상품코드+컬러명)으로 OrderLine을 찾아서
    반영하며, 일치하는 행이 없거나 여러 개면 반영하지 않고 화면에 그 이유를 보여준다

## 로컬 개발

```bash
npm install
cp .env.example .env.local   # DATABASE_URL, SESSION_SECRET, ACCOUNTS_JSON을 채운다
npx prisma migrate dev --name init
npm run dev
```

로그인 화면엔 비밀번호 칸 하나만 있다. `ACCOUNTS_JSON`에 등록해둔 비밀번호 중 어느 것을
입력하느냐로 계정이 정해진다 (예: `test1234` → 마스터, `jsc1234` → 작업자(jsc)).

`fixtures/sample-shipment.xlsx`, `fixtures/sample-inspection.xlsx`로 `/import` 플로우를
바로 테스트할 수 있다 (`npx tsx scripts/generate-fixtures.ts`로 재생성 가능).

### 테스트

```bash
npm test            # Vitest 단위 테스트 (헤더 매핑, 파싱, diff 분류, 계산 필드)
npx tsc --noEmit     # 타입 체크
```

## 배포 (무료, 카드 불필요) — Vercel + Neon

아래 단계는 **직접 수행해야 한다** — 계정 생성/OAuth 로그인은 에이전트가 대신 할 수 없다.

1. **GitHub 저장소 생성**
   ```bash
   git remote add origin https://github.com/<your-id>/whitesands-inspection.git
   git push -u origin main
   ```

2. **Neon (무료 PostgreSQL)**
   - https://neon.tech 에서 가입 (GitHub 계정으로 로그인 가능)
   - 새 프로젝트 생성 (가능하면 한국에서 가까운 리전 선택)
   - Dashboard → Connection Details → **Pooled connection** 문자열 복사 → `DATABASE_URL`로 사용

3. **로컬에서 마이그레이션**
   ```bash
   # .env.local에 Neon DATABASE_URL, SESSION_SECRET(openssl rand -base64 32), ACCOUNTS_JSON 설정
   npx prisma migrate deploy
   ```

4. **Vercel (무료 Hobby)**
   - https://vercel.com 에서 가입 (같은 GitHub 계정)
   - "Add New Project" → 방금 push한 저장소 Import
   - Settings → Environment Variables에 추가:
     - `DATABASE_URL` = Neon pooled connection string (3번과 동일)
     - `SESSION_SECRET` = 3번과 동일한 값 (배포마다 바뀌면 기존 로그인 세션이 전부 풀림)
     - `ACCOUNTS_JSON` = 계정별 비밀번호 목록 (.env.example 형식 그대로, 한 줄 JSON)
   - Deploy 클릭

5. **확인**
   - `https://<project>.vercel.app` 접속 → 로그인 → `/import`에서 `fixtures/sample-shipment.xlsx` 업로드
     → 미리보기에서 신규 2건 확인 → 확정 → `/orders`에 반영 확인
   - `fixtures/sample-inspection.xlsx` 업로드 → 수정 2건으로 분류되는지, 출고 관련 필드는
     그대로인지 확인 → 확정 → `/orders`에서 양품수량/차이가 계산되는지 확인

6. **스키마를 바꿀 때마다**
   ```bash
   npx prisma migrate dev --name <설명>   # 로컬에서 마이그레이션 생성 + 커밋
   git push                                # Vercel이 자동 재배포
   npx prisma migrate deploy               # Neon DATABASE_URL로 1회 실행 (로컬 또는 CI에서)
   ```

### 만약 Vercel/Neon 무료 정책이 바뀌면

같은 코드로 Fly.io(무료 웹) + Supabase(무료 Postgres)로 바꿀 수 있다 — Prisma/Postgres라
`DATABASE_URL`만 바꿔서 재배포하면 된다.

## 알려진 한계 / 다음 단계로 미룬 것

- 계정 추가/삭제/비밀번호 변경은 `ACCOUNTS_JSON` 값을 고쳐서 재배포하는 방식이다 —
  가입 화면이나 관리자 UI는 없다. 비밀번호를 하나라도 바꾸면 그 비밀번호로 로그인해
  있던 사람은 다시 로그인해야 한다.
- 비밀번호 하나로 계정을 구분하기 때문에, **두 사람이 같은 비밀번호를 쓰면 같은
  계정으로 기록된다** — 구분이 필요한 사람 수만큼 `ACCOUNTS_JSON`에 항목을 늘려야 한다.
- Playwright e2e 테스트는 아직 작성하지 않았다 (Vitest 단위 테스트만 있음) — 실제
  배포 후 §5 체크리스트를 수동으로 1회 돌려본다.
- 바코드 검수의 오더번호는 OrderLine과 강제로 연결되지 않는 자유 입력 텍스트다 —
  오타가 나면 다른 오더로 기록되고, `/orders`에도 반영되지 않는다 (자동완성 목록은
  제공하지만 강제하지 않음).
- `/orders`의 검수수량/불량수량은 **직접 입력**과 **바코드 스캔 반영**이 같은 값을
  공유한다 — 같은 행을 두 방식으로 같이 쓰면(예: 수동으로 60 입력해놓고 그 위에 또
  스캔으로 쌓기) 숫자가 꼬일 수 있다. 한 행은 한 가지 방식으로만 채우는 걸 권장한다.
- 바코드 등록표 업로드는 미리보기 없이 바로 추가/병합된다 (원래 프로그램과 동일한
  동작) — 수량 데이터(OrderLine)와 달리 되돌리기 쉬운 성격의 데이터라 판단했다.
