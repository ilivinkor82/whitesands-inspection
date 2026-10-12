import { TopNav } from "@/components/TopNav";
import { prisma } from "@/lib/prisma";
import { formatDateTimeKST } from "@/lib/datetime";

// 로그인한 작업자마다 최신 이력을 보여줘야 하므로 빌드 시점에 정적으로 생성하지 않는다.
export const dynamic = "force-dynamic";

export default async function ImportHistoryPage() {
  const imports = await prisma.import.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 100,
  });

  return (
    <>
      <TopNav />
      <div className="page">
        <h1>업로드 이력</h1>
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>업로드 시각(KST)</th>
                <th>파일명</th>
                <th>종류</th>
                <th>신규</th>
                <th>수정</th>
                <th>건너뜀</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <tr key={imp.id}>
                  <td>{formatDateTimeKST(imp.uploadedAt)}</td>
                  <td>{imp.filename}</td>
                  <td>{imp.type}</td>
                  <td>{imp.insertedCount}</td>
                  <td>{imp.updatedCount}</td>
                  <td>{imp.skippedCount}</td>
                </tr>
              ))}
              {imports.length === 0 && (
                <tr>
                  <td colSpan={6}>업로드 이력이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
