-- CreateTable
CREATE TABLE "BarcodeProduct" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "sizeName" TEXT NOT NULL,
    "barcode1" TEXT NOT NULL,
    "barcode2" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarcodeProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanLog" (
    "id" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderNo" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "sizeName" TEXT NOT NULL,
    "scannedBarcode" TEXT NOT NULL,
    "expectedBarcode" TEXT,
    "result" TEXT NOT NULL,

    CONSTRAINT "ScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BarcodeProduct_barcode1_idx" ON "BarcodeProduct"("barcode1");

-- CreateIndex
CREATE UNIQUE INDEX "BarcodeProduct_productCode_colorName_sizeName_key" ON "BarcodeProduct"("productCode", "colorName", "sizeName");

-- CreateIndex
CREATE INDEX "ScanLog_orderNo_idx" ON "ScanLog"("orderNo");

-- CreateIndex
CREATE INDEX "ScanLog_scannedAt_idx" ON "ScanLog"("scannedAt");
