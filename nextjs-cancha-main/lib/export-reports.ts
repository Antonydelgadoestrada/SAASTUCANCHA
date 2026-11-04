import { format } from "date-fns"
import { es } from "date-fns/locale"

export interface ClubReportData {
  id?: string
  bookingReference?: string
  date: string | Date
  startTime?: string
  endTime?: string
  userName?: string
  userEmail?: string
  userPhone?: string
  court?: string
  sport?: string
  duration?: number
  price?: number
  status?: string
  paymentStatus?: string
  paymentMethod?: string
  createdAt?: string | Date
}

export interface ClubInfoData {
  id?: string
  name?: string
  email?: string
  phone?: string
  address?: string
  district?: string
  logo?: string
}

export interface ClubReportOptions {
  club: ClubInfoData | null
  report: ClubReportData[]
  summary?: { revenue: string | number; bookings: string | number }
  popularCourts?: Array<{ name: string; bookings: number; revenue: number; occupancyRate?: number }>
  dateRangeLabel: string
  auditorName?: string
}

// Helpers de formateo
const formatCurrency = (val: number | string | undefined): string => {
  const num = typeof val === "string" ? parseFloat(val) : Number(val || 0)
  return `S/ ${isNaN(num) ? "0.00" : num.toFixed(2)}`
}

const formatDateSafely = (dateVal: string | Date | undefined): string => {
  if (!dateVal) return "-"
  try {
    const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal
    if (isNaN(d.getTime())) return String(dateVal)
    if (typeof dateVal === "string" && dateVal.includes("T")) {
      return format(d, "dd/MM/yyyy", { locale: es })
    }
    const utcDate = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    return format(utcDate, "dd/MM/yyyy", { locale: es })
  } catch {
    return String(dateVal)
  }
}

const translateStatus = (status?: string): string => {
  if (!status) return "Pendiente"
  const s = status.toLowerCase()
  switch (s) {
    case "confirmed":
      return "Confirmada"
    case "completed":
      return "Completada"
    case "pending":
      return "Pendiente"
    case "cancelled":
      return "Cancelada"
    default:
      return status
  }
}

const translatePaymentStatus = (status?: string): string => {
  if (!status) return "Pendiente"
  const s = status.toLowerCase()
  switch (s) {
    case "paid":
      return "Pagado"
    case "pending":
      return "Pendiente"
    case "refunded":
      return "Reembolsado"
    default:
      return status
  }
}

const translatePaymentMethod = (method?: string): string => {
  if (!method) return "Manual / Efectivo"
  const m = method.toLowerCase()
  if (m.includes("online") || m.includes("mercadopago")) return "En línea (Mercado Pago)"
  if (m.includes("whatsapp")) return "WhatsApp / Coordinación"
  if (m.includes("manual") || m.includes("efectivo")) return "Efectivo / Caja"
  if (m.includes("yape")) return "Yape"
  if (m.includes("plin")) return "Plin"
  if (m.includes("transfer")) return "Transferencia Bancaria"
  return method
}

const sanitizeSlug = (name: string): string => {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "club"
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIÓN A EXCEL CON DISEÑO CORPORATIVO (EXCELJS)
// ─────────────────────────────────────────────────────────────────────────────
export async function exportClubReportToExcel(options: ClubReportOptions): Promise<void> {
  const ExcelJSModule = await import("exceljs")
  const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule

  const { club, report, popularCourts, dateRangeLabel, auditorName = "Administrador" } = options
  const clubDisplayName = club?.name?.trim() || "Club Deportivo"
  const clubAddress = club?.address ? `${club.address}${club.district ? `, ${club.district}` : ""}` : "Sede Principal"
  const clubContact = [club?.phone, club?.email].filter(Boolean).join(" | ") || "Sin contacto registrado"
  const emissionDate = format(new Date(), "dd/MM/yyyy HH:mm:ss")
  const auditCode = `AUD-${format(new Date(), "yyyyMMdd")}`

  // Cálculos de KPIs
  const totalRevenue = report.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0)
  const totalBookings = report.length
  const confirmedBookings = report.filter((r) => r.status === "confirmed" || r.status === "completed").length
  const pendingBookings = report.filter((r) => r.status === "pending" || !r.status).length
  const cancelledBookings = report.filter((r) => r.status === "cancelled").length
  const totalDuration = report.reduce((acc, curr) => acc + (Number(curr.duration) || 1), 0)
  const avgTicket = totalBookings > 0 ? totalRevenue / totalBookings : 0
  const successRate = totalBookings > 0 ? Math.round((confirmedBookings / totalBookings) * 100) : 0

  const wb = new ExcelJS.Workbook()
  wb.creator = "Tucancha SaaS"
  wb.created = new Date()

  // Colores corporativos
  const COLOR_HEADER_NAVY = "FF0F172A"   // Slate 900
  const COLOR_SUBHEADER   = "FF1E293B"   // Slate 800
  const COLOR_SECTION_BAR = "FF334155"   // Slate 700
  const COLOR_EMERALD     = "FF10B981"   // Emerald 500
  const COLOR_BG_LIGHT    = "FFF8FAFC"   // Slate 50
  const COLOR_BORDER      = "FFE2E8F0"   // Slate 200
  const COLOR_MUTED       = "FF64748B"   // Slate 500

  const borderThin = {
    top: { style: "thin", color: { argb: COLOR_BORDER } },
    left: { style: "thin", color: { argb: COLOR_BORDER } },
    bottom: { style: "thin", color: { argb: COLOR_BORDER } },
    right: { style: "thin", color: { argb: COLOR_BORDER } },
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOJA 1: RESUMEN EJECUTIVO Y AUDITORÍA
  // ═══════════════════════════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet("Resumen Ejecutivo", {
    views: [{ showGridLines: true }],
  })

  // Fila 1: Acento esmeralda superior
  ws1.mergeCells("A1:F1")
  ws1.getRow(1).height = 6
  ws1.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_EMERALD } }

  // Fila 2: Título Principal del Club
  ws1.mergeCells("A2:F2")
  ws1.getRow(2).height = 34
  const cClub = ws1.getCell("A2")
  cClub.value = `CLUB: ${clubDisplayName.toUpperCase()}`
  cClub.font = { name: "Segoe UI", size: 15, bold: true, color: { argb: "FFFFFFFF" } }
  cClub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_NAVY } }
  cClub.alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  // Fila 3: Subtítulo de Auditoría
  ws1.mergeCells("A3:F3")
  ws1.getRow(3).height = 22
  const cSub = ws1.getCell("A3")
  cSub.value = "INFORME EJECUTIVO Y AUDITORÍA DE CONTROL ADMINISTRATIVO"
  cSub.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF94A3B8" } }
  cSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_NAVY } }
  cSub.alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  // Fila 4: Separador en blanco
  ws1.getRow(4).height = 10

  // Fila 5: Barra de Sección: Parámetros de la Entidad
  ws1.mergeCells("A5:F5")
  ws1.getRow(5).height = 24
  const cSec1 = ws1.getCell("A5")
  cSec1.value = "DATOS DE LA ENTIDAD Y PARÁMETROS DE AUDITORÍA"
  cSec1.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } }
  cSec1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_SECTION_BAR } }
  cSec1.alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  // Filas 6 a 9: Metadatos en dos bloques estilizados
  const metaRowsData = [
    { labelL: "Club / Entidad:", valL: clubDisplayName, labelR: "Período Auditado:", valR: dateRangeLabel },
    { labelL: "Dirección / Sede:", valL: clubAddress, labelR: "Fecha de Emisión:", valR: emissionDate },
    { labelL: "Contacto Oficial:", valL: clubContact, labelR: "Auditor / Responsable:", valR: auditorName },
    { labelL: "Sistema Emisor:", valL: "Tucancha SaaS Platform", labelR: "Código de Auditoría:", valR: auditCode },
  ]

  metaRowsData.forEach((row, i) => {
    const rIdx = 6 + i
    ws1.getRow(rIdx).height = 21

    // Bloque Izquierdo
    const cL1 = ws1.getCell(`A${rIdx}`)
    cL1.value = row.labelL
    cL1.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: COLOR_MUTED } }
    cL1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_BG_LIGHT } }
    cL1.border = borderThin
    cL1.alignment = { vertical: "middle" }

    ws1.mergeCells(`B${rIdx}:C${rIdx}`)
    const cL2 = ws1.getCell(`B${rIdx}`)
    cL2.value = row.valL
    cL2.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF0F172A" } }
    cL2.border = borderThin
    cL2.alignment = { vertical: "middle" }

    // Bloque Derecho
    const cR1 = ws1.getCell(`D${rIdx}`)
    cR1.value = row.labelR
    cR1.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: COLOR_MUTED } }
    cR1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_BG_LIGHT } }
    cR1.border = borderThin
    cR1.alignment = { vertical: "middle" }

    ws1.mergeCells(`E${rIdx}:F${rIdx}`)
    const cR2 = ws1.getCell(`E${rIdx}`)
    cR2.value = row.valR
    cR2.font = { name: "Segoe UI", size: 9, color: { argb: "FF0F172A" } }
    cR2.border = borderThin
    cR2.alignment = { vertical: "middle" }
  })

  // Fila 10: Separador
  ws1.getRow(10).height = 12

  // Fila 11: Barra de Sección: KPIs
  ws1.mergeCells("A11:F11")
  ws1.getRow(11).height = 24
  const cSec2 = ws1.getCell("A11")
  cSec2.value = "INDICADORES CLAVE DE GESTIÓN Y RENDIMIENTO OPERATIVO (KPIs)"
  cSec2.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } }
  cSec2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_SECTION_BAR } }
  cSec2.alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  // Fila 12: Cabeceras de KPIs
  ws1.getRow(12).height = 24
  const kpiHeaders = ["Indicador de Gestión", "Valor Registrado", "Unidad de Medida", "Evaluación de Auditoría"]
  ws1.mergeCells("A12:B12")
  ws1.getCell("A12").value = kpiHeaders[0]
  ws1.getCell("C12").value = kpiHeaders[1]
  ws1.getCell("D12").value = kpiHeaders[2]
  ws1.mergeCells("E12:F12")
  ws1.getCell("E12").value = kpiHeaders[3]

  ;["A12", "C12", "D12", "E12"].forEach((pos) => {
    const c = ws1.getCell(pos)
    c.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } }
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_SUBHEADER } }
    c.alignment = { vertical: "middle", horizontal: pos === "C12" ? "right" : "left", indent: pos === "A12" ? 1 : 0 }
    c.border = borderThin
  })

  // Filas de KPIs
  const kpisData = [
    { label: "Ingresos Totales Brutos", val: totalRevenue, unit: "PEN (S/.)", isCurrency: true, note: "Consolidado total del período", fgColor: "FF047857" },
    { label: "Total de Reservas Auditadas", val: totalBookings, unit: "Reservas", isCurrency: false, note: "100% registros procesados", fgColor: "FF1D4ED8" },
    { label: "Reservas Confirmadas / Completadas", val: confirmedBookings, unit: "Reservas", isCurrency: false, note: `${successRate}% tasa de efectividad`, fgColor: "FF047857" },
    { label: "Reservas Pendientes de Validación", val: pendingBookings, unit: "Reservas", isCurrency: false, note: pendingBookings > 0 ? "Requiere conciliación de caja" : "Caja al día", fgColor: pendingBookings > 0 ? "FFB45309" : "FF64748B" },
    { label: "Reservas Canceladas", val: cancelledBookings, unit: "Reservas", isCurrency: false, note: cancelledBookings > 0 ? "Cancelaciones computadas" : "0 cancelaciones", fgColor: cancelledBookings > 0 ? "FFB91C1C" : "FF64748B" },
    { label: "Horas Totales de Cancha Ocupadas", val: totalDuration, unit: "Horas", isCurrency: false, note: "Horas efectivas facturadas", fgColor: "FF0F172A" },
    { label: "Ticket Promedio por Reserva", val: avgTicket, unit: "PEN (S/.)", isCurrency: true, note: "Rendimiento medio por turno", fgColor: "FF6D28D9" },
  ]

  kpisData.forEach((kpi, idx) => {
    const rIdx = 13 + idx
    ws1.getRow(rIdx).height = 22
    const bgRow = idx % 2 === 0 ? "FFFFFFFF" : COLOR_BG_LIGHT

    ws1.mergeCells(`A${rIdx}:B${rIdx}`)
    const cLabel = ws1.getCell(`A${rIdx}`)
    cLabel.value = kpi.label
    cLabel.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF1E293B" } }
    cLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgRow } }
    cLabel.border = borderThin
    cLabel.alignment = { vertical: "middle", indent: 1 }

    const cVal = ws1.getCell(`C${rIdx}`)
    cVal.value = kpi.val
    cVal.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: kpi.fgColor } }
    cVal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgRow } }
    cVal.border = borderThin
    cVal.alignment = { vertical: "middle", horizontal: "right" }
    if (kpi.isCurrency) {
      cVal.numFmt = '"S/ "#,##0.00'
    }

    const cUnit = ws1.getCell(`D${rIdx}`)
    cUnit.value = kpi.unit
    cUnit.font = { name: "Segoe UI", size: 8.5, color: { argb: COLOR_MUTED } }
    cUnit.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgRow } }
    cUnit.border = borderThin
    cUnit.alignment = { vertical: "middle", horizontal: "center" }

    ws1.mergeCells(`E${rIdx}:F${rIdx}`)
    const cNote = ws1.getCell(`E${rIdx}`)
    cNote.value = kpi.note
    cNote.font = { name: "Segoe UI", size: 8.5, color: { argb: "FF475569" } }
    cNote.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgRow } }
    cNote.border = borderThin
    cNote.alignment = { vertical: "middle" }
  })

  // Fila de separación para Desglose por Canchas
  const courtStartRow = 13 + kpisData.length + 1
  ws1.getRow(courtStartRow - 1).height = 12

  // Barra de Sección: Desglose por Instalación
  ws1.mergeCells(`A${courtStartRow}:F${courtStartRow}`)
  ws1.getRow(courtStartRow).height = 24
  const cSec3 = ws1.getCell(`A${courtStartRow}`)
  cSec3.value = "DESGLOSE Y RENDIMIENTO POR INSTALACIÓN / CANCHA"
  cSec3.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } }
  cSec3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_SECTION_BAR } }
  cSec3.alignment = { vertical: "middle", horizontal: "left", indent: 1 }

  // Cabecera tabla de canchas
  const courtHeaderRow = courtStartRow + 1
  ws1.getRow(courtHeaderRow).height = 22
  ws1.mergeCells(`A${courtHeaderRow}:B${courtHeaderRow}`)
  ws1.getCell(`A${courtHeaderRow}`).value = "Cancha / Instalación"
  ws1.getCell(`C${courtHeaderRow}`).value = "N° Reservas"
  ws1.getCell(`D${courtHeaderRow}`).value = "Ingresos Totales (S/.)"
  ws1.mergeCells(`E${courtHeaderRow}:F${courtHeaderRow}`)
  ws1.getCell(`E${courtHeaderRow}`).value = "% Participación / Ocupación"

  ;[`A${courtHeaderRow}`, `C${courtHeaderRow}`, `D${courtHeaderRow}`, `E${courtHeaderRow}`].forEach((pos) => {
    const c = ws1.getCell(pos)
    c.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } }
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_SUBHEADER } }
    c.alignment = { vertical: "middle", horizontal: pos.startsWith("C") || pos.startsWith("D") ? "right" : "left", indent: pos.startsWith("A") ? 1 : 0 }
    c.border = borderThin
  })

  // Filas de canchas
  let nextRow = courtHeaderRow + 1
  if (popularCourts && popularCourts.length > 0) {
    popularCourts.forEach((court, idx) => {
      ws1.getRow(nextRow).height = 20
      const bg = idx % 2 === 0 ? "FFFFFFFF" : COLOR_BG_LIGHT

      ws1.mergeCells(`A${nextRow}:B${nextRow}`)
      const c1 = ws1.getCell(`A${nextRow}`)
      c1.value = court.name || "Cancha"
      c1.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF0F172A" } }
      c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      c1.border = borderThin
      c1.alignment = { vertical: "middle", indent: 1 }

      const c2 = ws1.getCell(`C${nextRow}`)
      c2.value = court.bookings || 0
      c2.font = { name: "Segoe UI", size: 9, color: { argb: "FF0F172A" } }
      c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      c2.border = borderThin
      c2.alignment = { vertical: "middle", horizontal: "right" }

      const c3 = ws1.getCell(`D${nextRow}`)
      c3.value = Number(court.revenue || 0)
      c3.numFmt = '"S/ "#,##0.00'
      c3.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF047857" } }
      c3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      c3.border = borderThin
      c3.alignment = { vertical: "middle", horizontal: "right" }

      ws1.mergeCells(`E${nextRow}:F${nextRow}`)
      const c4 = ws1.getCell(`E${nextRow}`)
      c4.value = court.occupancyRate !== undefined ? `${court.occupancyRate}%` : "-"
      c4.font = { name: "Segoe UI", size: 9, color: { argb: COLOR_MUTED } }
      c4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      c4.border = borderThin
      c4.alignment = { vertical: "middle", horizontal: "center" }

      nextRow++
    })
  } else {
    // Agrupación alternativa
    const courtMap = new Map<string, { count: number; revenue: number }>()
    report.forEach((r) => {
      const cName = r.court || "Cancha General"
      const prev = courtMap.get(cName) || { count: 0, revenue: 0 }
      courtMap.set(cName, { count: prev.count + 1, revenue: prev.revenue + (Number(r.price) || 0) })
    })

    let idx = 0
    courtMap.forEach((val, cName) => {
      ws1.getRow(nextRow).height = 20
      const bg = idx % 2 === 0 ? "FFFFFFFF" : COLOR_BG_LIGHT
      const part = totalRevenue > 0 ? `${((val.revenue / totalRevenue) * 100).toFixed(1)}%` : "-"

      ws1.mergeCells(`A${nextRow}:B${nextRow}`)
      ws1.getCell(`A${nextRow}`).value = cName
      ws1.getCell(`A${nextRow}`).font = { name: "Segoe UI", size: 9, bold: true }
      ws1.getCell(`A${nextRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      ws1.getCell(`A${nextRow}`).border = borderThin
      ws1.getCell(`A${nextRow}`).alignment = { vertical: "middle", indent: 1 }

      ws1.getCell(`C${nextRow}`).value = val.count
      ws1.getCell(`C${nextRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      ws1.getCell(`C${nextRow}`).border = borderThin
      ws1.getCell(`C${nextRow}`).alignment = { vertical: "middle", horizontal: "right" }

      ws1.getCell(`D${nextRow}`).value = val.revenue
      ws1.getCell(`D${nextRow}`).numFmt = '"S/ "#,##0.00'
      ws1.getCell(`D${nextRow}`).font = { bold: true, color: { argb: "FF047857" } }
      ws1.getCell(`D${nextRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      ws1.getCell(`D${nextRow}`).border = borderThin
      ws1.getCell(`D${nextRow}`).alignment = { vertical: "middle", horizontal: "right" }

      ws1.mergeCells(`E${nextRow}:F${nextRow}`)
      ws1.getCell(`E${nextRow}`).value = part
      ws1.getCell(`E${nextRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      ws1.getCell(`E${nextRow}`).border = borderThin
      ws1.getCell(`E${nextRow}`).alignment = { vertical: "middle", horizontal: "center" }

      idx++
      nextRow++
    })
  }

  // Firmas de Auditoría al pie
  nextRow += 2
  ws1.mergeCells(`A${nextRow}:C${nextRow}`)
  ws1.mergeCells(`D${nextRow}:F${nextRow}`)
  ws1.getCell(`A${nextRow}`).value = "________________________________________"
  ws1.getCell(`D${nextRow}`).value = "________________________________________"
  ws1.getCell(`A${nextRow}`).alignment = { horizontal: "center" }
  ws1.getCell(`D${nextRow}`).alignment = { horizontal: "center" }

  nextRow++
  ws1.mergeCells(`A${nextRow}:C${nextRow}`)
  ws1.mergeCells(`D${nextRow}:F${nextRow}`)
  ws1.getCell(`A${nextRow}`).value = "FIRMA Y SELLO DE ADMINISTRACIÓN"
  ws1.getCell(`D${nextRow}`).value = "CONTROL INTERNO Y AUDITORÍA"
  ws1.getCell(`A${nextRow}`).font = { bold: true, size: 8.5 }
  ws1.getCell(`D${nextRow}`).font = { bold: true, size: 8.5 }
  ws1.getCell(`A${nextRow}`).alignment = { horizontal: "center" }
  ws1.getCell(`D${nextRow}`).alignment = { horizontal: "center" }

  // Ajuste de columnas en Hoja 1
  ws1.columns = [
    { width: 26 }, // A
    { width: 22 }, // B
    { width: 20 }, // C
    { width: 24 }, // D
    { width: 20 }, // E
    { width: 22 }, // F
  ]

  // ═══════════════════════════════════════════════════════════════════════════
  // HOJA 2: DETALLE DE RESERVAS Y OPERACIONES
  // ═══════════════════════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet("Detalle de Reservas", {
    views: [{ showGridLines: true }],
  })

  // Fila 1: Acento esmeralda superior
  ws2.mergeCells("A1:O1")
  ws2.getRow(1).height = 6
  ws2.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_EMERALD } }

  // Fila 2: Cabecera Detalle
  ws2.mergeCells("A2:O2")
  ws2.getRow(2).height = 34
  const cDetTitle = ws2.getCell("A2")
  cDetTitle.value = `CLUB: ${clubDisplayName.toUpperCase()} - REGISTRO DETALLADO PARA INSPECCIÓN Y CONTROL`
  cDetTitle.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FFFFFFFF" } }
  cDetTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_NAVY } }
  cDetTitle.alignment = { vertical: "middle", indent: 1 }

  // Fila 3: Subtítulo
  ws2.mergeCells("A3:O3")
  ws2.getRow(3).height = 20
  const cDetSub = ws2.getCell("A3")
  cDetSub.value = `Período: ${dateRangeLabel} | Registros Auditados: ${totalBookings} | Ingresos Consolidados: S/ ${totalRevenue.toFixed(2)} | Emisión: ${emissionDate}`
  cDetSub.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF94A3B8" } }
  cDetSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_NAVY } }
  cDetSub.alignment = { vertical: "middle", indent: 1 }

  // Fila 4: Separador
  ws2.getRow(4).height = 8

  // Fila 5: Cabecera de la tabla detallada
  ws2.getRow(5).height = 26
  const detailHeaders = [
    "#",
    "Código Ref.",
    "Fecha",
    "Horario Inicio",
    "Horario Fin",
    "Duración (h)",
    "Cancha",
    "Deporte",
    "Cliente / Titular",
    "Teléfono",
    "Email",
    "Estado Reserva",
    "Método de Pago",
    "Estado de Pago",
    "Importe (S/.)",
  ]

  detailHeaders.forEach((h, idx) => {
    const colLetter = String.fromCharCode(65 + idx)
    const cell = ws2.getCell(`${colLetter}5`)
    cell.value = h
    cell.font = { name: "Segoe UI", size: 8.5, bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_SUBHEADER } }
    cell.alignment = { vertical: "middle", horizontal: idx === 14 ? "right" : "center" }
    cell.border = borderThin
  })

  // Filas de datos
  report.forEach((item, index) => {
    const rIdx = 6 + index
    ws2.getRow(rIdx).height = 21
    const bgRow = index % 2 === 0 ? "FFFFFFFF" : COLOR_BG_LIGHT
    const refCode = item.bookingReference || (item.id ? `REF-${String(item.id).slice(0, 8).toUpperCase()}` : `REF-${index + 1}`)
    const stLabel = translateStatus(item.status)
    const payStatus = translatePaymentStatus(item.paymentStatus)

    // Estilos de estado (Pill colors)
    let stBg = bgRow
    let stFg = "FF0F172A"
    if (stLabel === "Confirmada" || stLabel === "Completada") {
      stBg = "FFDCFCE7" // Verde suave
      stFg = "FF166534"
    } else if (stLabel === "Pendiente") {
      stBg = "FFFEF3C7" // Ámbar suave
      stFg = "FF92400E"
    } else if (stLabel === "Cancelada") {
      stBg = "FFFEE2E2" // Rojo suave
      stFg = "FF991B1B"
    }

    const rowValues = [
      index + 1,
      refCode,
      formatDateSafely(item.date),
      item.startTime || "-",
      item.endTime || "-",
      Number(item.duration) || 1,
      item.court || "Cancha General",
      item.sport || "General",
      item.userName || "Cliente General",
      item.userPhone || "-",
      item.userEmail || "-",
      stLabel,
      translatePaymentMethod(item.paymentMethod),
      payStatus,
      Number(item.price) || 0,
    ]

    rowValues.forEach((val, colIdx) => {
      const colLetter = String.fromCharCode(65 + colIdx)
      const cell = ws2.getCell(`${colLetter}${rIdx}`)
      cell.value = val
      cell.font = { name: "Segoe UI", size: 8.5 }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgRow } }
      cell.border = borderThin

      // Alineación
      if (colIdx === 0 || colIdx === 1 || colIdx === 2 || colIdx === 3 || colIdx === 4 || colIdx === 5 || colIdx === 7 || colIdx === 9 || colIdx === 13) {
        cell.alignment = { vertical: "middle", horizontal: "center" }
      } else if (colIdx === 14) {
        cell.alignment = { vertical: "middle", horizontal: "right" }
        cell.numFmt = '"S/ "#,##0.00'
        cell.font = { name: "Segoe UI", size: 8.5, bold: true, color: { argb: "FF047857" } }
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" }
      }

      // Estilizar píldora de estado
      if (colIdx === 11) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: stBg } }
        cell.font = { name: "Segoe UI", size: 8, bold: true, color: { argb: stFg } }
        cell.alignment = { vertical: "middle", horizontal: "center" }
      }
    })
  })

  // Fila de Totales al final
  const totRow = 6 + report.length
  ws2.getRow(totRow).height = 25
  ws2.mergeCells(`A${totRow}:N${totRow}`)
  const cTotLabel = ws2.getCell(`A${totRow}`)
  cTotLabel.value = `TOTAL GENERAL AUDITADO (${totalBookings} reservas)`
  cTotLabel.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: COLOR_HEADER_NAVY } }
  cTotLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }
  cTotLabel.alignment = { vertical: "middle", horizontal: "right" }
  cTotLabel.border = {
    top: { style: "thin", color: { argb: COLOR_HEADER_NAVY } },
    bottom: { style: "double", color: { argb: COLOR_HEADER_NAVY } },
  }

  const cTotVal = ws2.getCell(`O${totRow}`)
  cTotVal.value = totalRevenue
  cTotVal.numFmt = '"S/ "#,##0.00'
  cTotVal.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF047857" } }
  cTotVal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }
  cTotVal.alignment = { vertical: "middle", horizontal: "right" }
  cTotVal.border = {
    top: { style: "thin", color: { argb: COLOR_HEADER_NAVY } },
    bottom: { style: "double", color: { argb: COLOR_HEADER_NAVY } },
  }

  // Anchos de columnas en Hoja 2
  ws2.columns = [
    { width: 6 },  // #
    { width: 16 }, // Ref
    { width: 14 }, // Fecha
    { width: 14 }, // Inicio
    { width: 14 }, // Fin
    { width: 12 }, // Duración
    { width: 22 }, // Cancha
    { width: 14 }, // Deporte
    { width: 24 }, // Cliente
    { width: 15 }, // Teléfono
    { width: 24 }, // Email
    { width: 16 }, // Estado
    { width: 22 }, // Método
    { width: 14 }, // Estado Pago
    { width: 16 }, // Importe
  ]

  // Generar buffer y descargar archivo
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const filename = `Reporte_Administrativo_${sanitizeSlug(clubDisplayName)}_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`

  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIÓN A PDF OFICIAL CON DISEÑO CORPORATIVO (JSPDF + AUTOTABLE)
// ─────────────────────────────────────────────────────────────────────────────
export async function exportClubReportToPDF(options: ClubReportOptions): Promise<void> {
  const { jsPDF } = await import("jspdf")
  const autoTablePkg = await import("jspdf-autotable")
  const autoTable = (autoTablePkg as any).default || autoTablePkg

  const { club, report, popularCourts, dateRangeLabel, auditorName = "Administrador" } = options
  const clubDisplayName = club?.name?.trim() || "Club Deportivo"
  const clubAddress = club?.address ? `${club.address}${club.district ? `, ${club.district}` : ""}` : "Sede Principal"
  const clubContact = [club?.phone, club?.email].filter(Boolean).join(" | ") || "Sin contacto registrado"
  const emissionDate = format(new Date(), "dd/MM/yyyy HH:mm:ss")
  const auditCode = `AUD-${format(new Date(), "yyyyMMdd")}`

  // Cálculos de KPIs
  const totalRevenue = report.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0)
  const totalBookings = report.length
  const confirmedBookings = report.filter((r) => r.status === "confirmed" || r.status === "completed").length
  const pendingBookings = report.filter((r) => r.status === "pending" || !r.status).length
  const cancelledBookings = report.filter((r) => r.status === "cancelled").length
  const avgTicket = totalBookings > 0 ? totalRevenue / totalBookings : 0
  const successRate = totalBookings > 0 ? Math.round((confirmedBookings / totalBookings) * 100) : 0

  // Documento A4 Horizontal (Landscape: 297mm x 210mm)
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = 297
  const pageHeight = 210
  const marginX = 14

  // ── CABECERA CORPORATIVA SUPERIOR ──
  // Franja decorativa esmeralda
  doc.setFillColor(16, 185, 129) // Emerald 500
  doc.rect(0, 0, pageWidth, 4, "F")

  // Bloque principal Slate 900
  doc.setFillColor(15, 23, 42) // Slate 900
  doc.rect(0, 4, pageWidth, 29, "F")

  // Título del Club
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text(`CLUB: ${clubDisplayName.toUpperCase()}`, marginX, 16.5)

  // Subtítulo
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(203, 213, 225) // Slate 300
  doc.text("INFORME EJECUTIVO DE GESTIÓN Y AUDITORÍA DE CONTROL ADMINISTRATIVO", marginX, 23.5)

  // Sello Oficial / Badge de Control a la derecha
  doc.setFillColor(30, 41, 59) // Slate 800
  doc.roundedRect(pageWidth - marginX - 58, 9, 58, 19, 2.5, 2.5, "F")
  doc.setDrawColor(52, 211, 153) // Emerald border
  doc.setLineWidth(0.4)
  doc.roundedRect(pageWidth - marginX - 58, 9, 58, 19, 2.5, 2.5, "S")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(52, 211, 153) // Emerald
  doc.text("● DOCUMENTO OFICIAL", pageWidth - marginX - 54, 15.5)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(226, 232, 240)
  doc.text("Auditoría & Control Interno", pageWidth - marginX - 54, 20.5)
  doc.text(`Ref: ${auditCode}`, pageWidth - marginX - 54, 25)

  // ── TARJETA DE METADATOS ──
  let curY = 37
  doc.setFillColor(248, 250, 252) // Slate 50
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.roundedRect(marginX, curY, pageWidth - marginX * 2, 17, 2, 2, "FD")

  // Columna Izquierda
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "bold")
  doc.text("SEDE / DIRECCIÓN:", marginX + 4, curY + 6)
  doc.text("CONTACTO OFICIAL:", marginX + 4, curY + 12)

  doc.setFont("helvetica", "normal")
  doc.setTextColor(30, 41, 59)
  doc.text(clubAddress, marginX + 35, curY + 6)
  doc.text(clubContact, marginX + 35, curY + 12)

  // Columna Derecha
  const metaColR = marginX + 155
  doc.setFont("helvetica", "bold")
  doc.setTextColor(100, 116, 139)
  doc.text("PERÍODO AUDITADO:", metaColR, curY + 6)
  doc.text("EMISIÓN & RESPONSABLE:", metaColR, curY + 12)

  doc.setFont("helvetica", "normal")
  doc.setTextColor(30, 41, 59)
  doc.text(dateRangeLabel, metaColR + 36, curY + 6)
  doc.text(`${emissionDate}  |  Por: ${auditorName}`, metaColR + 36, curY + 12)

  // ── TARJETAS DE INDICADORES (KPIs) ──
  curY = 58
  const cardGap = 4
  const cardWidth = (pageWidth - marginX * 2 - cardGap * 3) / 4
  const cardHeight = 18

  const kpis = [
    { label: "INGRESOS TOTALES", val: formatCurrency(totalRevenue), sub: `${totalBookings} reservas totales`, color: [16, 185, 129] },
    { label: "RESERVAS COMPLETADAS", val: `${confirmedBookings}`, sub: `${successRate}% efectividad operativa`, color: [37, 99, 235] },
    { label: "RESERVAS PENDIENTES", val: `${pendingBookings}`, sub: `${cancelledBookings} canceladas`, color: [217, 119, 6] },
    { label: "TICKET PROMEDIO", val: formatCurrency(avgTicket), sub: "Rendimiento medio / reserva", color: [124, 58, 237] },
  ]

  kpis.forEach((kpi, idx) => {
    const cX = marginX + idx * (cardWidth + cardGap)

    // Fondo blanco y borde
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.roundedRect(cX, curY, cardWidth, cardHeight, 2, 2, "FD")

    // Barra de acento izquierda
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2])
    doc.roundedRect(cX, curY, 3, cardHeight, 1, 1, "F")

    // Título de la tarjeta
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6.8)
    doc.setTextColor(100, 116, 139)
    doc.text(kpi.label, cX + 6, curY + 5)

    // Valor principal
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(15, 23, 42)
    doc.text(kpi.val, cX + 6, curY + 11.5)

    // Subtítulo
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(148, 163, 184)
    doc.text(kpi.sub, cX + 6, curY + 15.5)
  })

  // ── CABECERA DE TABLA DE AUDITORÍA ──
  curY = 80
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(15, 23, 42)
  doc.text("REGISTRO OPERATIVO Y DETALLE DE AUDITORÍA", marginX, curY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(`Total de registros auditados: ${totalBookings}`, pageWidth - marginX - 44, curY)

  // Mapeo de filas
  const tableRows = report.map((item, index) => {
    const horario = item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : item.startTime || "-"
    const refCode = item.bookingReference || (item.id ? `REF-${String(item.id).slice(0, 8).toUpperCase()}` : `REF-${index + 1}`)
    const courtName = item.court || "Cancha General"
    const sportName = item.sport ? ` (${item.sport})` : ""

    return [
      String(index + 1),
      refCode,
      formatDateSafely(item.date),
      horario,
      `${courtName}${sportName}`,
      item.userName || "Cliente General",
      item.userPhone || "-",
      translateStatus(item.status),
      translatePaymentMethod(item.paymentMethod),
      formatCurrency(item.price),
    ]
  })

  // Tabla AutoTable
  autoTable(doc, {
    startY: curY + 3,
    margin: { left: marginX, right: marginX, bottom: 20 },
    head: [["#", "Ref. Control", "Fecha", "Horario", "Cancha / Deporte", "Cliente / Titular", "Teléfono", "Estado", "Método de Pago", "Importe"]],
    body: tableRows,
    foot: [
      [
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        `${confirmedBookings} conf.`,
        `${totalBookings} reservas`,
        formatCurrency(totalRevenue),
      ],
    ],
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "left",
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 7.5,
      fontStyle: "bold",
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: 26, fontStyle: "bold" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 42 },
      5: { cellWidth: 44 },
      6: { cellWidth: 24, halign: "center" },
      7: { cellWidth: 24, halign: "center" },
      8: { cellWidth: 35 },
      9: { cellWidth: 23, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data: any) => {
      // Estilos en columna de estado
      if (data.section === "body" && data.column.index === 7) {
        const text = String(data.cell.raw).toLowerCase()
        if (text.includes("confirmada") || text.includes("completada")) {
          data.cell.styles.textColor = [16, 120, 80]
          data.cell.styles.fontStyle = "bold"
        } else if (text.includes("pendiente")) {
          data.cell.styles.textColor = [180, 110, 10]
          data.cell.styles.fontStyle = "bold"
        } else if (text.includes("cancelada")) {
          data.cell.styles.textColor = [220, 38, 38]
          data.cell.styles.fontStyle = "bold"
        }
      }
      // Fila de pie
      if (data.section === "foot" && data.column.index === 9) {
        data.cell.styles.textColor = [16, 120, 80]
        data.cell.styles.halign = "right"
      }
    },
  })

  // Espacio para bloque de firmas y sellos
  const finalY = (doc as any).lastAutoTable?.finalY || 160
  const remainingSpace = pageHeight - finalY
  if (remainingSpace < 36) {
    doc.addPage()
    renderSignaturesAndStamp(doc, 30, pageWidth, marginX)
  } else {
    renderSignaturesAndStamp(doc, finalY + 12, pageWidth, marginX)
  }

  // ── PIE DE PÁGINA EN TODAS LAS HOJAS ──
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(marginX, pageHeight - 11, pageWidth - marginX, pageHeight - 11)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.8)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Tucancha SaaS Platform | Documento Oficial de Control Interno | Club: ${clubDisplayName} | Estricta Confidencialidad`,
      marginX,
      pageHeight - 6.5
    )

    doc.setFont("helvetica", "bold")
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginX - 18, pageHeight - 6.5)
  }

  const filename = `Reporte_Administrativo_${sanitizeSlug(clubDisplayName)}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`
  doc.save(filename)
}

function renderSignaturesAndStamp(doc: any, y: number, pageWidth: number, marginX: number) {
  const sigWidth = 72
  const sig1X = marginX + 25
  const sig2X = pageWidth - marginX - 25 - sigWidth

  // Línea 1 de firma
  doc.setDrawColor(148, 163, 184)
  doc.setLineDashPattern([1.5, 1.5], 0)
  doc.line(sig1X, y + 10, sig1X + sigWidth, y + 10)
  doc.line(sig2X, y + 10, sig2X + sigWidth, y + 10)
  doc.setLineDashPattern([], 0)

  // Textos de firma
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(51, 65, 85)
  doc.text("FIRMA Y SELLO DE ADMINISTRACIÓN", sig1X + 8, y + 14)
  doc.text("CONTROL INTERNO Y AUDITORÍA", sig2X + 10, y + 14)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  doc.text("Responsable de Operaciones y Sede", sig1X + 12, y + 17.5)
  doc.text("Supervisión y Conformidad de Caja", sig2X + 12, y + 17.5)

  // Sello central de validación digital
  const stampX = (pageWidth - 54) / 2
  doc.setDrawColor(16, 185, 129) // Emerald
  doc.setLineWidth(0.4)
  doc.roundedRect(stampX, y + 3, 54, 18, 2, 2, "S")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.5)
  doc.setTextColor(16, 120, 80)
  doc.text("AUDITADO & CERTIFICADO", stampX + 11, y + 8)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(5.8)
  doc.setTextColor(100, 116, 139)
  doc.text("SISTEMA DE GESTIÓN TUCANCHA", stampX + 7, y + 12.5)
  doc.text("CONTROL INTERNO OFICIAL", stampX + 11, y + 16.5)
}
