import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { prisma } from '../../utils/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { logger } from '../../utils/logger.js';
import { generateQRString } from './qr.generator.js';
import type { QRMerchantData } from './qr.generator.js';

// ── Helper: load merchant and cast mcc_codes ──

async function loadMerchantForQR(merchantId: string): Promise<QRMerchantData & { id: string; terminal?: string | null }> {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }
  if (merchant.status !== 'ACTIVE') {
    throw new AppError(400, 'Merchant is not active', 'MERCHANT_NOT_ACTIVE');
  }

  const mccCodes = merchant.mcc_codes as Array<{ mcc: string; desc: string; commission: number }>;

  return {
    id: merchant.id,
    cbu: merchant.cbu,
    cuit: merchant.cuit,
    business_name: merchant.business_name,
    city: merchant.city,
    postal_code: merchant.postal_code,
    mcc_codes: mccCodes,
    terminal: merchant.terminal,
  };
}

// ── Create Static QR ──

export async function createStaticQR(merchantId: string, label?: string) {
  const merchant = await loadMerchantForQR(merchantId);

  const qrData = generateQRString(merchant, {
    type: 'STATIC',
    terminal: merchant.terminal ?? undefined,
  });

  const qrCode = await prisma.qrCode.create({
    data: {
      merchant_id: merchantId,
      type: 'STATIC',
      qr_data: qrData,
      label: label ?? null,
      status: 'ACTIVE',
    },
  });

  logger.info({ qrCodeId: qrCode.id, merchantId }, 'Static QR created');
  return qrCode;
}

// ── Create Dynamic QR ──

export async function createDynamicQR(
  merchantId: string,
  amount: number,
  expiration?: number, // minutes until expiration
) {
  if (amount <= 0) {
    throw new AppError(400, 'Amount must be positive', 'INVALID_AMOUNT');
  }

  const merchant = await loadMerchantForQR(merchantId);
  const qrIdTrx = crypto.randomUUID();

  const expiresAt = expiration
    ? new Date(Date.now() + expiration * 60 * 1000)
    : new Date(Date.now() + 10 * 60 * 1000); // Default 10 minutes

  const qrData = generateQRString(merchant, {
    type: 'DYNAMIC',
    amount,
    reference: qrIdTrx,
    terminal: merchant.terminal ?? undefined,
  });

  const qrCode = await prisma.qrCode.create({
    data: {
      merchant_id: merchantId,
      type: 'DYNAMIC',
      qr_data: qrData,
      qr_id_trx: qrIdTrx,
      amount,
      label: `QR Dinamico - $${amount.toFixed(2)}`,
      expires_at: expiresAt,
      status: 'ACTIVE',
    },
  });

  logger.info({ qrCodeId: qrCode.id, merchantId, qrIdTrx, amount }, 'Dynamic QR created');
  return qrCode;
}

// ── Get QR Codes (paginated) ──

export interface QRFilters {
  merchant_id?: string;
  type?: 'STATIC' | 'DYNAMIC';
  status?: 'ACTIVE' | 'EXPIRED' | 'DISABLED';
  page?: number;
  limit?: number;
}

export async function getQRCodes(filters: QRFilters) {
  const where: Record<string, unknown> = {};

  if (filters.merchant_id) where.merchant_id = filters.merchant_id;
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const [qrCodes, total] = await Promise.all([
    prisma.qrCode.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        merchant: {
          select: { id: true, business_name: true, cuit: true },
        },
      },
    }),
    prisma.qrCode.count({ where }),
  ]);

  return {
    data: qrCodes,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

// ── Get QR By ID ──

export async function getQRById(id: string) {
  const qrCode = await prisma.qrCode.findUnique({
    where: { id },
    include: {
      merchant: {
        select: { id: true, business_name: true, cuit: true, cbu: true, city: true },
      },
      transactions: {
        take: 10,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          qr_id_trx: true,
          status: true,
          amount: true,
          created_at: true,
        },
      },
    },
  });

  if (!qrCode) {
    throw new AppError(404, 'QR code not found', 'QR_NOT_FOUND');
  }

  return qrCode;
}

// ── Get QR Image ──

export async function getQRImage(
  id: string,
  format: 'png' | 'svg' = 'png',
  size: number = 300,
): Promise<{ data: Buffer | string; contentType: string }> {
  const qrCode = await prisma.qrCode.findUnique({ where: { id } });
  if (!qrCode) {
    throw new AppError(404, 'QR code not found', 'QR_NOT_FOUND');
  }

  if (format === 'svg') {
    const svgString = await QRCode.toString(qrCode.qr_data, {
      type: 'svg',
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    return { data: svgString, contentType: 'image/svg+xml' };
  }

  const pngBuffer = await QRCode.toBuffer(qrCode.qr_data, {
    type: 'png',
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  return { data: pngBuffer, contentType: 'image/png' };
}

// ── Get QR PDF ──

export async function getQRPdf(id: string): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const qrCode = await prisma.qrCode.findUnique({
    where: { id },
    include: {
      merchant: {
        select: { business_name: true, cuit: true, cbu: true, city: true, address: true },
      },
    },
  });

  if (!qrCode) {
    throw new AppError(404, 'QR code not found', 'QR_NOT_FOUND');
  }

  // Generate QR image as base64 for embedding
  const qrImageBase64 = await QRCode.toDataURL(qrCode.qr_data, {
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  // Build a simple HTML-based PDF content
  // In production, you would use a proper PDF library (e.g., PDFKit, puppeteer)
  // This generates an SVG-based printable document
  const svgContent = await QRCode.toString(qrCode.qr_data, {
    type: 'svg',
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>QR Code - ${qrCode.merchant.business_name}</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
    .qr-container { margin: 20px auto; }
    .merchant-info { margin-top: 20px; }
    .merchant-info h2 { margin-bottom: 5px; }
    .merchant-info p { margin: 3px 0; color: #555; }
    .qr-type { font-size: 12px; color: #888; margin-top: 10px; }
    .amount { font-size: 24px; font-weight: bold; color: #333; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="qr-container">
    ${svgContent}
  </div>
  <div class="merchant-info">
    <h2>${qrCode.merchant.business_name}</h2>
    <p>CUIT: ${qrCode.merchant.cuit}</p>
    ${qrCode.merchant.address ? `<p>${qrCode.merchant.address}</p>` : ''}
    ${qrCode.merchant.city ? `<p>${qrCode.merchant.city}</p>` : ''}
    ${qrCode.amount ? `<p class="amount">$${Number(qrCode.amount).toFixed(2)}</p>` : ''}
    <p class="qr-type">${qrCode.type === 'STATIC' ? 'QR Estatico' : 'QR Dinamico'}</p>
    ${qrCode.label ? `<p class="qr-type">${qrCode.label}</p>` : ''}
  </div>
</body>
</html>`;

  const pdfBuffer = Buffer.from(htmlContent, 'utf-8');
  const filename = `qr-${qrCode.merchant.business_name.replace(/[^a-zA-Z0-9]/g, '_')}-${qrCode.id.slice(0, 8)}.html`;

  return {
    data: pdfBuffer,
    contentType: 'text/html',
    filename,
  };
}

// ── Disable QR ──

export async function disableQR(id: string) {
  const qrCode = await prisma.qrCode.findUnique({ where: { id } });
  if (!qrCode) {
    throw new AppError(404, 'QR code not found', 'QR_NOT_FOUND');
  }

  if (qrCode.status === 'DISABLED') {
    throw new AppError(400, 'QR code is already disabled', 'ALREADY_DISABLED');
  }

  const updated = await prisma.qrCode.update({
    where: { id },
    data: { status: 'DISABLED' },
  });

  logger.info({ qrCodeId: id }, 'QR code disabled');
  return updated;
}
