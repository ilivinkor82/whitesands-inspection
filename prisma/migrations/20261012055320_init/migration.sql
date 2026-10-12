-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "colorCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "requestedQty" INTEGER,
    "shipDate" TIMESTAMP(3),
    "shippedQty" INTEGER,
    "inspectedQty" INTEGER,
    "defectQty" INTEGER,
    "returnDate" TIMESTAMP(3),
    "returnQty" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "insertedCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,

    CONSTRAINT "Import_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderLine_orderNo_idx" ON "OrderLine"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLine_orderNo_productCode_colorCode_key" ON "OrderLine"("orderNo", "productCode", "colorCode");
