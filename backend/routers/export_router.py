"""
Export API Router — DXF, SVG dosya üretimi.
"""

import os
import uuid
import logging
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/export", tags=["Export"])

EXPORT_DIR = "/tmp/imar-pro-exports"
os.makedirs(EXPORT_DIR, exist_ok=True)


class ExportRoom(BaseModel):
    name: str
    type: str
    x: float
    y: float
    width: float
    height: float
    is_exterior: bool = False
    facing: str = ""
    doors: list = []
    windows: list = []


class DXFExportRequest(BaseModel):
    rooms: list[ExportRoom]
    scale: float = Field(default=1.0, gt=0)
    filename: Optional[str] = None


class SVGExportRequest(BaseModel):
    rooms: list[ExportRoom]
    buildable_width: float = Field(default=14.0, gt=0)
    buildable_height: float = Field(default=10.0, gt=0)
    width: int = Field(default=800)
    height: int = Field(default=600)


@router.post("/dxf")
async def export_dxf(req: DXFExportRequest):
    """Kat planını DXF (AutoCAD) formatında üretir."""
    try:
        from core.plan_scorer import FloorPlan, PlanRoom
        from export.dxf_exporter import export_dxf as do_export

        rooms = []
        for r in req.rooms:
            rooms.append(PlanRoom(
                name=r.name, room_type=r.type,
                x=r.x, y=r.y, width=r.width, height=r.height,
                has_exterior_wall=r.is_exterior,
                facing_direction=r.facing,
                doors=r.doors, windows=r.windows,
            ))

        plan = FloorPlan(rooms=rooms, total_area=sum(r.area for r in rooms))

        filename = req.filename or f"kat_plani_{uuid.uuid4().hex[:8]}.dxf"
        filepath = os.path.join(EXPORT_DIR, filename)

        result_path = do_export(plan, output_path=filepath, scale=req.scale)

        if result_path and os.path.exists(result_path):
            return FileResponse(
                result_path,
                media_type="application/dxf",
                filename=filename,
            )
        else:
            raise HTTPException(status_code=500, detail="DXF üretimi başarısız — ezdxf kurulu mu?")

    except ImportError:
        raise HTTPException(status_code=500, detail="ezdxf kütüphanesi kurulu değil. pip install ezdxf")
    except Exception as e:
        logger.error(f"DXF export hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/svg")
async def export_svg(req: SVGExportRequest):
    """Kat planını SVG formatında üretir."""
    try:
        svg = _generate_svg(req.rooms, req.buildable_width, req.buildable_height, req.width, req.height)

        filename = f"kat_plani_{uuid.uuid4().hex[:8]}.svg"
        filepath = os.path.join(EXPORT_DIR, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(svg)

        return FileResponse(
            filepath,
            media_type="image/svg+xml",
            filename=filename,
        )
    except Exception as e:
        logger.error(f"SVG export hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _generate_svg(rooms: list[ExportRoom], bw: float, bh: float, svg_w: int, svg_h: int) -> str:
    """Mimari standart SVG üretir."""
    padding = 60
    scale_x = (svg_w - 2 * padding) / bw
    scale_y = (svg_h - 2 * padding) / bh
    scale = min(scale_x, scale_y)
    ox = padding + ((svg_w - 2 * padding) - bw * scale) / 2
    oy = padding + ((svg_h - 2 * padding) - bh * scale) / 2

    def tx(x): return ox + x * scale
    def ty(y): return svg_h - (oy + y * scale)
    def ts(s): return s * scale

    COLORS = {
        'salon': '#E3F2FD', 'yatak_odasi': '#F3E5F5', 'mutfak': '#FFF3E0',
        'banyo': '#E0F2F1', 'wc': '#E0F2F1', 'antre': '#FFF8E1',
        'koridor': '#ECEFF1', 'balkon': '#E8F5E9',
    }

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_w}" height="{svg_h}" viewBox="0 0 {svg_w} {svg_h}">',
        '<defs>',
        '<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">',
        '<line x1="0" y1="0" x2="0" y2="6" stroke="#90A4AE" stroke-width="0.5" opacity="0.4"/>',
        '</pattern>',
        '</defs>',
        f'<rect width="{svg_w}" height="{svg_h}" fill="white"/>',
    ]

    # Buildable area
    lines.append(f'<rect x="{tx(0)}" y="{ty(bh)}" width="{ts(bw)}" height="{ts(bh)}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 2"/>')

    for room in rooms:
        rx, ry = tx(room.x), ty(room.y + room.height)
        rw, rh = ts(room.width), ts(room.height)
        fill = COLORS.get(room.type, '#F5F5F5')
        area = room.width * room.height

        # Room fill
        lines.append(f'<rect x="{rx}" y="{ry}" width="{rw}" height="{rh}" fill="{fill}"/>')

        # Wet area hatch
        if room.type in ('banyo', 'wc'):
            lines.append(f'<rect x="{rx}" y="{ry}" width="{rw}" height="{rh}" fill="url(#hatch)"/>')

        # Walls
        sw = 3 if room.is_exterior else 1.5
        lines.append(f'<rect x="{rx}" y="{ry}" width="{rw}" height="{rh}" fill="none" stroke="#1e293b" stroke-width="{sw}"/>')

        # Room label
        cx, cy = rx + rw / 2, ry + rh / 2
        fs = min(11, rw / 6)
        lines.append(f'<text x="{cx}" y="{cy - 4}" text-anchor="middle" font-size="{fs}" font-weight="600" fill="#334155">{room.name}</text>')
        lines.append(f'<text x="{cx}" y="{cy + 10}" text-anchor="middle" font-size="{fs * 0.8}" fill="#64748b">{area:.1f} m²</text>')

    # North arrow
    lines.append(f'<g transform="translate({svg_w - 30}, 25)">')
    lines.append('<line x1="0" y1="18" x2="0" y2="-2" stroke="#dc2626" stroke-width="1.5"/>')
    lines.append('<polygon points="-4,2 0,-6 4,2" fill="#dc2626"/>')
    lines.append('<text x="0" y="-10" text-anchor="middle" font-size="9" font-weight="700" fill="#dc2626">K</text>')
    lines.append('</g>')

    # Scale bar
    lines.append(f'<g transform="translate({svg_w - 80}, {svg_h - 16})">')
    lines.append(f'<line x1="0" y1="0" x2="{ts(1)}" y2="0" stroke="#475569" stroke-width="1.5"/>')
    lines.append(f'<line x1="0" y1="-3" x2="0" y2="3" stroke="#475569" stroke-width="0.7"/>')
    lines.append(f'<line x1="{ts(1)}" y1="-3" x2="{ts(1)}" y2="3" stroke="#475569" stroke-width="0.7"/>')
    lines.append(f'<text x="{ts(1)/2}" y="12" text-anchor="middle" font-size="8" fill="#64748b">1m</text>')
    lines.append('</g>')

    lines.append('</svg>')
    return '\n'.join(lines)


# ══════════════════════════════════════
# PDF RAPOR
# ══════════════════════════════════════

class PDFReportRequest(BaseModel):
    proje_adi: str = "İsimsiz Proje"
    parsel_data: dict = {}
    imar_data: dict = {}
    fizibilite_data: dict = {}
    deprem_data: Optional[dict] = None
    enerji_data: Optional[dict] = None
    ai_yorum: Optional[str] = None
    clash_data: Optional[dict] = None
    mep_data: Optional[dict] = None
    senaryo_data: Optional[dict] = None


@router.post("/pdf")
async def export_pdf(req: PDFReportRequest):
    """Profesyonel fizibilite PDF raporu üret (20+ sayfa)."""
    try:
        from export.pdf_report import generate_pdf_report

        pdf_bytes = generate_pdf_report(
            proje_adi=req.proje_adi,
            parsel_data=req.parsel_data,
            imar_data=req.imar_data,
            fizibilite_data=req.fizibilite_data,
            deprem_data=req.deprem_data,
            enerji_data=req.enerji_data,
            ai_yorum=req.ai_yorum,
            clash_data=req.clash_data,
            mep_data=req.mep_data,
            senaryo_data=req.senaryo_data,
        )

        # Dosyaya kaydet ve dön
        filename = f"imarPRO_rapor_{uuid.uuid4().hex[:8]}.pdf"
        filepath = os.path.join(EXPORT_DIR, filename)
        with open(filepath, 'wb') as f:
            f.write(pdf_bytes)

        return FileResponse(
            filepath,
            media_type='application/pdf',
            filename=filename,
            headers={'Content-Disposition': f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        logger.error(f"PDF rapor hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
