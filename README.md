# 화이트샌즈 검수 관리 웹앱

주희물류 → 제이에스컴퍼니 출고 / 검수 / 복귀 현황을 관리하는 웹앱.
기존 Google Sheets 추적을 완전히 대체한다 — 이 앱의 DB가 유일한 정본이다.

## 기능

- 엑셀(.xlsx) 업로드 → 변경 미리보기(diff) → 선택 반영 (`/import`)
- 여러 작업자가 각자 계정으로 로그인해 동시에 조회/수정 (`/orders`)
- 검수수량/불량수량/복귀일자/복귀수량/비고를 인라인으로 수정
- 양품수량(=검수-불량), 차이(=이동-복귀)는 항상 자동 계산 — 수동 입력/임포트로 덮어쓸 수 없음
- 업로드 이력 (`/import/history`)

## 로컬 개발

```bash
npm install
cp .env.example .env.local   # DATABASE_URL, SESSION_SECRET을 채운다
npx prisma migrate dev --name init
npm run create-user -- --username worker1 --password temp1234 --displayName "작업자1"
npm run dev
```

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

3. **로컬에서 마이그레이션 + 계정 생성**
   ```bash
   # .env.local에 Neon DATABASE_URL과 SESSION_SECRET(openssl rand -base64 32) 설정
   npx prisma migrate deploy
   npm run create-user -- --username <작업자아이디> --password <임시비밀번호> --displayName <이름>
   # 작업자마다 반복
   ```

4. **Vercel (무료 Hobby)**
   - https://vercel.com 에서 가입 (같은 GitHub 계정)
   - "Add New Project" → 방금 push한 저장소 Import
   - Settings → Environment Variables에 추가:
     - `DATABASE_URL` = Neon pooled connection string (3번과 동일)
     - `SESSION_SECRET` = 3번과 동일한 값 (배포마다 바뀌면 기존 로그인 세션이 전부 풀림)
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

- 필드 단위 변경 이력(누가 언제 무엇을 바꿨는지 전부 기록)은 만들지 않았다 — 지금은
  각 행의 `updatedById`/`updatedAt`과 임포트 단위 이력만 남는다.
- 비밀번호 재설정 UI 없음 — 관리자가 `npm run create-user`를 같은 username으로 다시
  실행하면 비밀번호가 갱신된다.
- Playwright e2e 테스트는 아직 작성하지 않았다 (Vitest 단위 테스트만 있음) — 실제
  배포 후 §5 체크리스트를 수동으로 1회 돌려본다.
