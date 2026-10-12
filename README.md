# 화이트샌즈 검수 관리 웹앱

주희물류 → 제이에스컴퍼니 출고 / 검수 / 복귀 현황을 관리하는 웹앱.
기존 Google Sheets 추적을 완전히 대체한다 — 이 앱의 DB가 유일한 정본이다.

## 기능

- 엑셀(.xlsx) 업로드 → 변경 미리보기(diff) → 선택 반영 (`/import`). 자체 양식 외에도
  "발주서_택배" 형식(오더제목/상품컬러코드/옵션(수집)/수량/출고일 등)을 그대로 인식한다 —
  수령인/주소/전화번호 같은 개인정보 열은 아예 필드 매핑이 없어서 읽지도 저장하지도 않고
  "무시된 열"로만 표시됨
- 공용 비밀번호 1개로 로그인 (작업자 계정 구분 없음), 외부인 접근만 차단 — 로그인 후 여러 작업자가 동시에 조회/수정 (`/orders`)
- 검수수량/불량수량/복귀일자/복귀수량/비고를 인라인으로 수정
- 양품수량(=검수-불량), 차이(=이동-복귀)는 항상 자동 계산 — 수동 입력/임포트로 덮어쓸 수 없음
- 업로드 이력 (`/import/history`)
- 바코드 검수 (`/barcode`): 오더번호 → 상품 선택 → USB 스캐너로 바코드 스캔 → 즉시 일치/불일치
  표시. 원래 별도 실행파일(`BarcodeInspector.exe`)로 쓰던 기능을 이 웹앱에 통합한 것 —
  상품/바코드 등록표도 엑셀 양식 다운로드 → 업로드(추가/병합)로 관리하고, 스캔 기록은
  오더번호 단위로 엑셀 다운로드 가능

## 로컬 개발

```bash
npm install
cp .env.example .env.local   # DATABASE_URL, SESSION_SECRET, APP_PASSWORD를 채운다
npx prisma migrate dev --name init
npm run dev
```

로그인은 `APP_PASSWORD`에 설정한 값 하나만 입력하면 된다 — 작업자별 아이디 없음.

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
   # .env.local에 Neon DATABASE_URL, SESSION_SECRET(openssl rand -base64 32), APP_PASSWORD 설정
   npx prisma migrate deploy
   ```

4. **Vercel (무료 Hobby)**
   - https://vercel.com 에서 가입 (같은 GitHub 계정)
   - "Add New Project" → 방금 push한 저장소 Import
   - Settings → Environment Variables에 추가:
     - `DATABASE_URL` = Neon pooled connection string (3번과 동일)
     - `SESSION_SECRET` = 3번과 동일한 값 (배포마다 바뀌면 기존 로그인 세션이 전부 풀림)
     - `APP_PASSWORD` = 작업자들에게 공유할 로그인 비밀번호
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

- 로그인이 공용 비밀번호 1개라 **누가 입력/수정했는지는 구분할 수 없다** — 외부인
  접근 차단만 된다. 작업자별 구분이 필요해지면 계정 기반 로그인으로 다시 바꿔야 한다.
- 비밀번호를 바꾸려면 Vercel/`.env.local`의 `APP_PASSWORD` 값을 바꾸고 재배포하면 된다
  (바뀌는 순간 기존에 로그인해 있던 모든 사람도 다시 로그인해야 함).
- Playwright e2e 테스트는 아직 작성하지 않았다 (Vitest 단위 테스트만 있음) — 실제
  배포 후 §5 체크리스트를 수동으로 1회 돌려본다.
- 바코드 검수의 오더번호는 OrderLine과 강제로 연결되지 않는 자유 입력 텍스트다 —
  오타가 나면 다른 오더로 기록된다 (자동완성 목록은 제공하지만 강제하지 않음).
- 바코드 등록표 업로드는 미리보기 없이 바로 추가/병합된다 (원래 프로그램과 동일한
  동작) — 수량 데이터(OrderLine)와 달리 되돌리기 쉬운 성격의 데이터라 판단했다.
