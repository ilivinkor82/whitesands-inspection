-- AlterTable
ALTER TABLE "Import" ADD COLUMN     "uploadedBy" TEXT;

-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "ScanLog" ADD COLUMN     "scannedBy" TEXT;
