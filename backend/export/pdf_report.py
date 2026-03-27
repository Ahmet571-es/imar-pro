"""
imarPRO — PDF Fizibilite Raporu Üretici
Seviye 4: 15-20 sayfa profesyonel bankaya sunulabilir rapor.

Sayfalar:
 1. Kapak (proje adı, tarih, logo)
 2. İçindekiler
 3. Proje Özeti (parsel, imar, daire karması)
 4-5. Maliyet Detay Tablosu (15+ kalem)
 6. Daire Bazlı Gelir Tablosu (kat/cephe primi)
 7. Kâr/Zarar Özet
 8. Nakit Akışı Grafiği (matplotlib)
 9. Duyarlılık Isı Haritası (matplotlib)
10. Monte Carlo Histogram (matplotlib)
11. Tornado Grafiği (matplotlib)
12. Deprem Parametreleri + Tasarım Spektrumu
13. Enerji Performans (A-G bar + U değerleri)
14. AI Yorum (Claude analizi)
15. Sonuç ve Öneriler
16. Yasal Uyarı
"""

import io
import os
import math
import logging
import tempfile
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image as RLImage, KeepTogether,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

logger = logging.getLogger(__name__)

# ── Font Setup (Türkçe karakter desteği) ──

def _register_fonts():
    """DejaVu Sans fontunu kaydet — Türkçe İ,Ş,Ç,Ö,Ü,Ğ desteği."""
    # Bundled font (repo içinde) EN ÖNCELİKLİ
    bundled = os.path.join(os.path.dirname(__file__), '..', 'fonts', 'DejaVuSans.ttf')

    font_paths = [
        bundled,  # repo/backend/fonts/ — her zaman çalışır
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/dejavu/DejaVuSans.ttf',
        '/usr/local/share/fonts/DejaVuSans.ttf',
    ]

    # Matplotlib font path'ini de ekle
    try:
        import matplotlib
        mpl_font = os.path.join(os.path.dirname(matplotlib.__file__), 'mpl-data', 'fonts', 'ttf', 'DejaVuSans.ttf')
        font_paths.append(mpl_font)
    except ImportError:
        pass

    for path in font_paths:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont('DejaVu', path))
                bold_path = path.replace('DejaVuSans.ttf', 'DejaVuSans-Bold.ttf')
                if os.path.exists(bold_path):
                    pdfmetrics.registerFont(TTFont('DejaVu-Bold', bold_path))
                logger.info(f"DejaVu font yüklendi: {path}")
                return 'DejaVu'
            except Exception as e:
                logger.warning(f"Font yükleme hatası ({path}): {e}")

    logger.warning("DejaVu font bulunamadı — Helvetica kullanılacak (Türkçe karakterler bozuk olabilir)")
    return 'Helvetica'

FONT_NAME = _register_fonts()
FONT_BOLD = f'{FONT_NAME}-Bold' if FONT_NAME == 'DejaVu' else 'Helvetica-Bold'

# ── Colors ──
PRIMARY = colors.HexColor('#0c4a6e')
PRIMARY_LIGHT = colors.HexColor('#0369a1')
ACCENT = colors.HexColor('#f59e0b')
SUCCESS = colors.HexColor('#059669')
DANGER = colors.HexColor('#dc2626')
GRAY = colors.HexColor('#64748b')
LIGHT_GRAY = colors.HexColor('#f1f5f9')
WHITE = colors.white
BLACK = colors.HexColor('#1e293b')

# ── Styles ──

def _get_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle('CoverTitle', fontName=FONT_BOLD, fontSize=28, textColor=WHITE, alignment=TA_CENTER, spaceAfter=10))
    styles.add(ParagraphStyle('CoverSub', fontName=FONT_NAME, fontSize=14, textColor=colors.HexColor('#e2e8f0'), alignment=TA_CENTER, spaceAfter=6))
    styles.add(ParagraphStyle('H1', fontName=FONT_BOLD, fontSize=18, textColor=PRIMARY, spaceBefore=20, spaceAfter=10))
    styles.add(ParagraphStyle('H2', fontName=FONT_BOLD, fontSize=14, textColor=PRIMARY_LIGHT, spaceBefore=14, spaceAfter=8))
    styles.add(ParagraphStyle('H3', fontName=FONT_BOLD, fontSize=11, textColor=BLACK, spaceBefore=10, spaceAfter=6))
    styles.add(ParagraphStyle('Body', fontName=FONT_NAME, fontSize=10, textColor=BLACK, leading=14, alignment=TA_JUSTIFY, spaceAfter=6))
    styles.add(ParagraphStyle('Small', fontName=FONT_NAME, fontSize=8, textColor=GRAY, leading=10, spaceAfter=4))
    styles.add(ParagraphStyle('Metric', fontName=FONT_BOLD, fontSize=22, textColor=PRIMARY, alignment=TA_CENTER))
    styles.add(ParagraphStyle('MetricLabel', fontName=FONT_NAME, fontSize=9, textColor=GRAY, alignment=TA_CENTER))
    styles.add(ParagraphStyle('Footer', fontName=FONT_NAME, fontSize=7, textColor=GRAY, alignment=TA_CENTER))
    return styles


# ── Chart Generators (matplotlib → PNG → ReportLab Image) ──

def _chart_to_image(fig, width_mm=170, height_mm=90):
    """Matplotlib figure → ReportLab Image."""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    buf.seek(0)
    return RLImage(buf, width=width_mm * mm, height=height_mm * mm)


def _chart_nakit_akisi(nakit_data: dict) -> RLImage:
    """Kümülatif nakit akışı grafiği."""
    aylar = [d['ay'] for d in nakit_data['aylik']]
    gider = [d['kumulatif_gider'] / 1e6 for d in nakit_data['aylik']]
    gelir = [d['kumulatif_gelir'] / 1e6 for d in nakit_data['aylik']]
    net = [d['net'] / 1e6 for d in nakit_data['aylik']]

    fig, ax = plt.subplots(figsize=(7, 3.5))
    ax.fill_between(aylar, gider, alpha=0.15, color='#dc2626')
    ax.fill_between(aylar, gelir, alpha=0.15, color='#059669')
    ax.plot(aylar, gider, color='#dc2626', linewidth=2, label='Küm. Gider')
    ax.plot(aylar, gelir, color='#059669', linewidth=2, label='Küm. Gelir')
    ax.plot(aylar, net, color='#0369a1', linewidth=2.5, linestyle='--', label='Net')
    ax.axhline(y=0, color='gray', linewidth=0.5)
    if nakit_data.get('payback_ay'):
        ax.axvline(x=nakit_data['payback_ay'], color='#f59e0b', linewidth=1.5, linestyle=':', label=f'Payback: Ay {nakit_data["payback_ay"]}')
    ax.set_xlabel('Ay', fontsize=9)
    ax.set_ylabel('Milyon ₺', fontsize=9)
    ax.set_title('Kümülatif Nakit Akışı', fontsize=11, fontweight='bold')
    ax.legend(fontsize=8, loc='upper left')
    ax.grid(True, alpha=0.3)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f'{x:.1f}M'))
    fig.tight_layout()
    return _chart_to_image(fig)


def _chart_duyarlilik(duyarlilik: dict) -> RLImage:
    """Duyarlılık 5×5 ısı haritası."""
    matris = duyarlilik['matris']
    data = np.array([[cell['kar_marji'] for cell in row] for row in matris])
    labels_m = duyarlilik['maliyet_labels']
    labels_f = duyarlilik['fiyat_labels']

    fig, ax = plt.subplots(figsize=(6, 4.5))
    im = ax.imshow(data, cmap='RdYlGn', aspect='auto', vmin=-30, vmax=40)
    ax.set_xticks(range(len(labels_f)))
    ax.set_xticklabels(labels_f, fontsize=8)
    ax.set_yticks(range(len(labels_m)))
    ax.set_yticklabels(labels_m, fontsize=8)
    ax.set_xlabel('Satış Fiyatı Değişimi', fontsize=9)
    ax.set_ylabel('Maliyet Değişimi', fontsize=9)
    ax.set_title('Duyarlılık Analizi — Kâr Marjı (%)', fontsize=11, fontweight='bold')

    for i in range(len(labels_m)):
        for j in range(len(labels_f)):
            val = data[i, j]
            color = 'white' if abs(val) > 15 else 'black'
            ax.text(j, i, f'{val:.0f}%', ha='center', va='center', fontsize=8, color=color, fontweight='bold')

    fig.colorbar(im, ax=ax, shrink=0.8, label='Kâr Marjı %')
    fig.tight_layout()
    return _chart_to_image(fig, height_mm=100)


def _chart_monte_carlo(mc: dict) -> RLImage:
    """Monte Carlo histogram."""
    hist = mc['histogram']
    x = [h['x'] / 1e6 for h in hist]
    counts = [h['count'] for h in hist]
    colors_list = ['#dc2626' if h['is_loss'] else '#059669' for h in hist]

    fig, ax = plt.subplots(figsize=(7, 3.5))
    ax.bar(x, counts, width=(x[1] - x[0]) * 0.9 if len(x) > 1 else 0.1, color=colors_list, alpha=0.8)
    ax.axvline(x=0, color='black', linewidth=1.5, linestyle='-')
    ax.axvline(x=mc['ortalama_kar'] / 1e6, color='#0369a1', linewidth=2, linestyle='--', label=f'Ortalama: {mc["ortalama_kar"]/1e6:.1f}M')
    ax.axvline(x=mc['p5'] / 1e6, color='#f59e0b', linewidth=1, linestyle=':', label=f'P5: {mc["p5"]/1e6:.1f}M')
    ax.axvline(x=mc['p95'] / 1e6, color='#f59e0b', linewidth=1, linestyle=':', label=f'P95: {mc["p95"]/1e6:.1f}M')
    ax.set_xlabel('Net Kâr (Milyon ₺)', fontsize=9)
    ax.set_ylabel('Frekans', fontsize=9)
    ax.set_title(f'Monte Carlo Simülasyonu ({mc["n"]:,} senaryo) — Zarar Olasılığı: %{mc["zarar_olasiligi"]:.1f}', fontsize=10, fontweight='bold')
    ax.legend(fontsize=8)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    return _chart_to_image(fig)


def _chart_tornado(tornado: list) -> RLImage:
    """Tornado chart."""
    params = [t['parametre'] for t in tornado]
    etki = [t['etki'] / 1e6 for t in tornado]
    baz = tornado[0]['baz'] / 1e6 if tornado else 0

    fig, ax = plt.subplots(figsize=(7, 3))
    y_pos = range(len(params))
    colors_list = ['#0369a1', '#059669', '#f59e0b', '#dc2626', '#7c3aed', '#64748b']

    ax.barh(y_pos, etki, color=[colors_list[i % len(colors_list)] for i in range(len(params))], alpha=0.8, height=0.6)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(params, fontsize=9)
    ax.set_xlabel('Kâr Etkisi (Milyon ₺)', fontsize=9)
    ax.set_title('Tornado Analizi — Parametre Hassasiyeti (±%15)', fontsize=10, fontweight='bold')
    ax.grid(True, axis='x', alpha=0.3)

    for i, v in enumerate(etki):
        ax.text(v + 0.05, i, f'{v:.1f}M', va='center', fontsize=8, fontweight='bold')

    fig.tight_layout()
    return _chart_to_image(fig, height_mm=70)


# ── Page Templates ──

def _header_footer(canvas, doc):
    """Sayfa üst/alt bilgi."""
    canvas.saveState()
    # Header line
    canvas.setStrokeColor(PRIMARY)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, A4[1] - 15 * mm, A4[0] - 20 * mm, A4[1] - 15 * mm)
    canvas.setFont(FONT_NAME, 7)
    canvas.setFillColor(GRAY)
    canvas.drawString(20 * mm, A4[1] - 13 * mm, 'imarPRO Fizibilite Raporu')

    # Footer
    canvas.line(20 * mm, 15 * mm, A4[0] - 20 * mm, 15 * mm)
    canvas.drawString(20 * mm, 10 * mm, f'Oluşturulma: {datetime.now().strftime("%d.%m.%Y %H:%M")}')
    canvas.drawRightString(A4[0] - 20 * mm, 10 * mm, f'Sayfa {doc.page}')
    canvas.restoreState()


# ══════════════════════════════════════════
# MAIN REPORT GENERATOR
# ══════════════════════════════════════════

def generate_pdf_report(
    proje_adi: str,
    parsel_data: dict,
    imar_data: dict,
    fizibilite_data: dict,
    deprem_data: Optional[dict] = None,
    enerji_data: Optional[dict] = None,
    ai_yorum: Optional[str] = None,
    clash_data: Optional[dict] = None,
    mep_data: Optional[dict] = None,
    senaryo_data: Optional[dict] = None,
) -> bytes:
    """
    20+ sayfa profesyonel fizibilite raporu üretir.
    Yeni sayfalar: Yönetici Özeti, MEP Şeması, Clash Raporu, Senaryo Karşılaştırma.
    Returns: PDF dosyasının binary içeriği (bytes).
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=20 * mm, bottomMargin=20 * mm,
        leftMargin=20 * mm, rightMargin=20 * mm,
    )

    styles = _get_styles()
    story = []

    # ══════════════════════════════════════
    # SAYFA 1: KAPAK
    # ══════════════════════════════════════

    story.append(Spacer(1, 60 * mm))

    # Kapak arka plan tablosu
    cover_data = [
        [Paragraph('imarPRO', styles['CoverTitle'])],
        [Paragraph('Gayrimenkul Fizibilite Raporu', styles['CoverSub'])],
        [Spacer(1, 15 * mm)],
        [Paragraph(proje_adi or 'Proje Adı', ParagraphStyle('CoverProject', fontName=FONT_BOLD, fontSize=22, textColor=ACCENT, alignment=TA_CENTER))],
        [Spacer(1, 8 * mm)],
        [Paragraph(datetime.now().strftime('%d %B %Y'), styles['CoverSub'])],
        [Paragraph(f'Parsel Alanı: {parsel_data.get("alan_m2", 0):.0f} m²', styles['CoverSub'])],
    ]

    cover_table = Table(cover_data, colWidths=[170 * mm])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PRIMARY),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 20),
        ('RIGHTPADDING', (0, 0), (-1, -1), 20),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
    ]))
    story.append(cover_table)
    story.append(Spacer(1, 20 * mm))
    story.append(Paragraph('Bu rapor imarPRO platformu tarafından otomatik olarak üretilmiştir.', styles['Small']))
    story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 2: İÇİNDEKİLER
    # ══════════════════════════════════════

    story.append(Paragraph('İçindekiler', styles['H1']))
    toc_items = [
        ('1. Yönetici Özeti (Executive Summary)', 3),
        ('2. Proje Özeti', 4), ('3. Maliyet Analizi', 5),
        ('4. Gelir Analizi', 6), ('5. Kâr/Zarar Özet', 7),
        ('6. Nakit Akışı', 8), ('7. Duyarlılık Analizi', 9),
        ('8. Monte Carlo Simülasyonu', 10), ('9. Tornado Analizi', 11),
    ]
    if senaryo_data:
        toc_items.append(('10. Senaryo Karşılaştırma', 12))
    if deprem_data:
        toc_items.append(('11. Deprem Analizi', 13))
    if enerji_data:
        toc_items.append(('12. Enerji Performansı', 14))
    if clash_data:
        toc_items.append(('13. BIM Çakışma Raporu', 15))
    if mep_data:
        toc_items.append(('14. MEP Tesisat Özeti', 16))
    if ai_yorum:
        toc_items.append(('15. AI Değerlendirme', 17))
    toc_items.append(('Sonuç ve Öneriler', 18))
    toc_items.append(('Yasal Uyarı', 19))

    for title, page in toc_items:
        toc_row = Table(
            [[Paragraph(title, styles['Body']), Paragraph(f'...... {page}', ParagraphStyle('TOCPage', fontName=FONT_NAME, fontSize=10, textColor=GRAY, alignment=TA_RIGHT))]],
            colWidths=[130 * mm, 40 * mm],
        )
        toc_row.setStyle(TableStyle([
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LINEBELOW', (0, 0), (-1, -1), 0.3, colors.HexColor('#e2e8f0')),
        ]))
        story.append(toc_row)

    story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 3: YÖNETİCİ ÖZETİ (Executive Summary)
    # ══════════════════════════════════════

    story.append(Paragraph('1. Yönetici Özeti', styles['H1']))
    story.append(Spacer(1, 4 * mm))

    ozet_pre = fizibilite_data.get('ozet', {})
    params_pre = fizibilite_data.get('parametreler', {})
    mc_pre = fizibilite_data.get('monte_carlo', {})
    na_pre = fizibilite_data.get('nakit_akisi', {})
    irr_pre = fizibilite_data.get('irr_yillik', 0)

    kar_marji_pre = ozet_pre.get('kar_marji', 0)
    toplam_gelir_pre = ozet_pre.get('toplam_gelir', 0)
    toplam_gider_pre = ozet_pre.get('toplam_gider', 0)
    kar_pre = ozet_pre.get('kar', 0)

    # GO / NO-GO karar
    if kar_marji_pre > 15 and mc_pre.get('zarar_olasiligi', 50) < 20:
        karar = 'GO ✅'
        karar_renk = SUCCESS
    elif kar_marji_pre > 5 and mc_pre.get('zarar_olasiligi', 50) < 40:
        karar = 'DİKKATLİ ⚠️'
        karar_renk = ACCENT
    else:
        karar = 'NO-GO ❌'
        karar_renk = DANGER

    story.append(Paragraph(f'<b>Yatırım Kararı: {karar}</b>',
        ParagraphStyle('Decision', fontName=FONT_BOLD, fontSize=16, textColor=karar_renk, alignment=TA_CENTER, spaceAfter=10)))

    # Anahtar metrikler
    exec_data = [
        ['Metrik', 'Değer', 'Değerlendirme'],
        ['Toplam Maliyet', f'₺{toplam_gider_pre/1e6:.1f}M', ''],
        ['Toplam Gelir', f'₺{toplam_gelir_pre/1e6:.1f}M', ''],
        ['Net Kâr', f'₺{kar_pre/1e6:.1f}M', 'Kârlı' if kar_pre > 0 else 'Zararda'],
        ['Kâr Marjı', f'%{kar_marji_pre:.1f}', 'İyi' if kar_marji_pre > 15 else 'Düşük' if kar_marji_pre > 0 else 'Zararda'],
        ['Yıllık IRR', f'%{irr_pre:.1f}', 'Yüksek getiri' if irr_pre > 20 else 'Orta' if irr_pre > 10 else 'Düşük'],
        ['Zarar Olasılığı', f'%{mc_pre.get("zarar_olasiligi", 0):.1f}', 'Düşük risk' if mc_pre.get("zarar_olasiligi", 50) < 15 else 'Orta risk' if mc_pre.get("zarar_olasiligi", 50) < 30 else 'Yüksek risk'],
        ['Geri Dönüş', f'{na_pre.get("payback_ay", "-")} ay', ''],
        ['Daire Sayısı', f'{params_pre.get("toplam_daire", "-")}', ''],
    ]
    story.append(_make_table(exec_data, col_widths=[50*mm, 40*mm, 60*mm]))
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph(
        'Bu özet sayfa karar vericiler için hazırlanmıştır. Detaylı analiz için sonraki sayfalara bakınız.',
        styles['Small']
    ))

    story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 4: PROJE ÖZETİ
    # ══════════════════════════════════════

    story.append(Paragraph('1. Proje Özeti', styles['H1']))

    ozet = fizibilite_data.get('ozet', {})
    params = fizibilite_data.get('parametreler', {})
    maliyet = fizibilite_data.get('maliyet', {})
    gelir = fizibilite_data.get('gelir', {})

    # Parsel bilgileri
    story.append(Paragraph('Parsel Bilgileri', styles['H2']))
    parsel_table_data = [
        ['Parametre', 'Değer'],
        ['Parsel Alanı', f'{parsel_data.get("alan_m2", 0):.0f} m²'],
        ['Köşe Sayısı', f'{parsel_data.get("kose_sayisi", 4)}'],
        ['Çevre', f'{parsel_data.get("cevre_m", 0):.1f} m'],
    ]
    # İmar bilgileri
    if imar_data:
        parsel_table_data.extend([
            ['Kat Adedi', str(imar_data.get('kat_adedi', 4))],
            ['TAKS', f'{imar_data.get("taks", 0.35):.2f}'],
            ['KAKS', f'{imar_data.get("kaks", 1.40):.2f}'],
            ['Toplam İnşaat Alanı', f'{imar_data.get("toplam_insaat_alani", 0):.0f} m²'],
            ['Ön Bahçe / Yan / Arka', f'{imar_data.get("on_bahce", 5):.0f} / {imar_data.get("yan_bahce", 3):.0f} / {imar_data.get("arka_bahce", 3):.0f} m'],
        ])

    story.append(_make_table(parsel_table_data))
    story.append(Spacer(1, 6 * mm))

    # Daire karması
    story.append(Paragraph('Daire Karması', styles['H2']))
    story.append(Paragraph(
        f'Toplam {params.get("toplam_daire", 8)} daire · '
        f'Net alan/daire: {params.get("net_alan_per_daire", 0):.0f} m² · '
        f'Satılabilir alan: {params.get("satilabilir_alan", 0):.0f} m²',
        styles['Body'],
    ))

    # KPI Kartları
    toplam_maliyet = maliyet.get('toplam_maliyet', 0)
    toplam_gelir_val = ozet.get('toplam_gelir', gelir.get('toplam_satis_geliri', 0))
    kar = ozet.get('kar', 0)
    kar_marji = ozet.get('kar_marji', 0)
    irr = fizibilite_data.get('irr_yillik', 0)

    kpi_data = [
        ['Toplam Maliyet', 'Toplam Gelir', 'Net Kâr', 'Kâr Marjı', 'IRR'],
        [
            f'₺{toplam_maliyet / 1e6:.1f}M' if toplam_maliyet else '-',
            f'₺{toplam_gelir_val / 1e6:.1f}M' if toplam_gelir_val else '-',
            f'₺{kar / 1e6:.1f}M' if kar else '-',
            f'%{kar_marji:.1f}' if kar_marji else '-',
            f'%{irr:.1f}' if irr else '-',
        ],
    ]
    kpi_table = Table(kpi_data, colWidths=[34 * mm] * 5)
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTNAME', (0, 1), (-1, 1), FONT_BOLD),
        ('FONTSIZE', (0, 1), (-1, 1), 12),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(Spacer(1, 6 * mm))
    story.append(kpi_table)
    story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 4-5: MALİYET DETAY
    # ══════════════════════════════════════

    story.append(Paragraph('2. Maliyet Analizi', styles['H1']))

    kalemler = maliyet.get('kalemler', [])
    if kalemler:
        cost_data = [['#', 'Kalem', 'Miktar', 'Birim Fiyat', 'Toplam']]
        for i, k in enumerate(kalemler, 1):
            cost_data.append([
                str(i),
                str(k.get('kalem', '')),
                str(k.get('miktar', '')),
                f'₺{k.get("birim_fiyat", 0):,.0f}',
                f'₺{k.get("toplam", 0):,.0f}',
            ])
        cost_data.append(['', 'TOPLAM', '', '', f'₺{toplam_maliyet:,.0f}'])
        story.append(_make_table(cost_data, col_widths=[10 * mm, 60 * mm, 25 * mm, 35 * mm, 40 * mm]))
    else:
        story.append(Paragraph('Maliyet kalem verisi mevcut değil.', styles['Body']))

    story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 6: GELİR ANALİZİ
    # ══════════════════════════════════════

    story.append(Paragraph('3. Gelir Analizi', styles['H1']))

    gelir_detay = gelir.get('daire_detay', gelir.get('daireler', []))
    if gelir_detay:
        gelir_data = [['Daire', 'Kat', 'Tip', 'Net Alan', 'm² Fiyat', 'Toplam']]
        for d in gelir_detay[:20]:  # Max 20 daire göster
            gelir_data.append([
                str(d.get('daire_no', '')),
                str(d.get('kat', '')),
                str(d.get('tip', '')),
                f'{d.get("net_alan", 0):.0f} m²',
                f'₺{d.get("m2_fiyat", d.get("birim_fiyat", 0)):,.0f}',
                f'₺{d.get("toplam_fiyat", d.get("toplam", 0)):,.0f}',
            ])
        story.append(_make_table(gelir_data, col_widths=[15 * mm, 15 * mm, 20 * mm, 25 * mm, 35 * mm, 40 * mm]))
    else:
        story.append(Paragraph('Daire gelir detayı mevcut değil.', styles['Body']))

    story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 7: KÂR/ZARAR ÖZET
    # ══════════════════════════════════════

    story.append(Paragraph('4. Kâr/Zarar Özet', styles['H1']))
    summary_items = [
        ('Toplam Maliyet', f'₺{toplam_maliyet:,.0f}'),
        ('Toplam Gelir', f'₺{toplam_gelir_val:,.0f}'),
        ('Net Kâr', f'₺{kar:,.0f}'),
        ('Kâr Marjı', f'%{kar_marji:.1f}'),
        ('ROI', f'%{ozet.get("roi", 0):.1f}'),
        ('Başabaş m² Fiyatı', f'₺{ozet.get("basabas_m2", 0):,.0f}/m²'),
        ('Yıllık IRR', f'%{irr:.1f}'),
        ('Payback Süresi', f'{fizibilite_data.get("nakit_akisi", {}).get("payback_ay", "N/A")} ay'),
    ]
    for label, value in summary_items:
        story.append(Paragraph(f'<b>{label}:</b> {value}', styles['Body']))
    story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 8: NAKİT AKIŞI GRAFİĞİ
    # ══════════════════════════════════════

    story.append(Paragraph('5. Nakit Akışı Projeksiyonu', styles['H1']))
    na = fizibilite_data.get('nakit_akisi', {})
    if na.get('aylik'):
        try:
            chart = _chart_nakit_akisi(na)
            story.append(chart)
        except Exception as e:
            story.append(Paragraph(f'Grafik oluşturulamadı: {e}', styles['Small']))
    story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 9: DUYARLILIK
    # ══════════════════════════════════════

    story.append(Paragraph('6. Duyarlılık Analizi', styles['H1']))
    story.append(Paragraph('Maliyet ve satış fiyatı ±%20 değiştiğinde kâr marjı nasıl etkilenir:', styles['Body']))
    duyarlilik = fizibilite_data.get('duyarlilik', {})
    if duyarlilik.get('matris'):
        try:
            chart = _chart_duyarlilik(duyarlilik)
            story.append(chart)
        except Exception as e:
            story.append(Paragraph(f'Grafik oluşturulamadı: {e}', styles['Small']))
    story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 10: MONTE CARLO
    # ══════════════════════════════════════

    story.append(Paragraph('7. Monte Carlo Simülasyonu', styles['H1']))
    mc = fizibilite_data.get('monte_carlo', {})
    if mc.get('histogram'):
        story.append(Paragraph(
            f'5.000 senaryoluk simülasyonda ortalama kâr ₺{mc.get("ortalama_kar", 0) / 1e6:.1f}M, '
            f'zarar olasılığı %{mc.get("zarar_olasiligi", 0):.1f}. '
            f'En kötü senaryo (P5): ₺{mc.get("p5", 0) / 1e6:.1f}M, '
            f'en iyi senaryo (P95): ₺{mc.get("p95", 0) / 1e6:.1f}M.',
            styles['Body'],
        ))
        try:
            chart = _chart_monte_carlo(mc)
            story.append(chart)
        except Exception as e:
            story.append(Paragraph(f'Grafik oluşturulamadı: {e}', styles['Small']))
    story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 11: TORNADO
    # ══════════════════════════════════════

    story.append(Paragraph('8. Tornado Analizi', styles['H1']))
    tornado = fizibilite_data.get('tornado', [])
    if tornado:
        story.append(Paragraph(
            'Her parametre ±%15 değiştiğinde kâr üzerindeki etki. En hassas parametreler en üstte:',
            styles['Body'],
        ))
        try:
            chart = _chart_tornado(tornado)
            story.append(chart)
        except Exception as e:
            story.append(Paragraph(f'Grafik oluşturulamadı: {e}', styles['Small']))
    story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 12: DEPREM (Opsiyonel)
    # ══════════════════════════════════════

    if deprem_data:
        story.append(Paragraph('9. Deprem Risk Analizi', styles['H1']))
        deprem_items = [
            ('Konum', f'{deprem_data.get("il", "")} {deprem_data.get("ilce", "")}'),
            ('Ss (Kısa Periyot)', f'{deprem_data.get("ss", 0):.3f}'),
            ('S1 (1sn Periyot)', f'{deprem_data.get("s1", 0):.3f}'),
            ('SDS', f'{deprem_data.get("sds", 0):.3f}'),
            ('SD1', f'{deprem_data.get("sd1", 0):.3f}'),
            ('Zemin Sınıfı', deprem_data.get('zemin_sinifi', 'ZC')),
            ('Deprem Bölgesi', deprem_data.get('deprem_bolgesi', '')),
        ]
        for label, value in deprem_items:
            story.append(Paragraph(f'<b>{label}:</b> {value}', styles['Body']))
        story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 13: ENERJİ (Opsiyonel)
    # ══════════════════════════════════════

    if enerji_data:
        story.append(Paragraph('10. Enerji Performansı', styles['H1']))
        enerji_items = [
            ('Enerji Sınıfı', enerji_data.get('enerji_sinifi', 'B')),
            ('Yıllık Tüketim', f'{enerji_data.get("yillik_enerji_tuketimi", 0):.0f} kWh/m²'),
            ('CO₂ Emisyonu', f'{enerji_data.get("co2_emisyonu", 0):.1f} kg/m²'),
            ('U-Değer Duvar', f'{enerji_data.get("u_deger_duvar", 0):.3f} W/m²K'),
            ('U-Değer Çatı', f'{enerji_data.get("u_deger_cati", 0):.3f} W/m²K'),
            ('U-Değer Pencere', f'{enerji_data.get("u_deger_pencere", 0):.3f} W/m²K'),
            ('Yalıtım Kalınlığı', f'{enerji_data.get("yalitim_kalinligi", 5)} cm'),
        ]
        for label, value in enerji_items:
            story.append(Paragraph(f'<b>{label}:</b> {value}', styles['Body']))
        story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 14: AI YORUM (Opsiyonel)
    # ══════════════════════════════════════

    if ai_yorum:
        story.append(Paragraph('AI Değerlendirme', styles['H1']))
        story.append(Paragraph(
            'Aşağıdaki değerlendirme Claude AI tarafından proje verileri analiz edilerek üretilmiştir:',
            styles['Small'],
        ))
        story.append(Spacer(1, 4 * mm))
        for paragraph in ai_yorum.split('\n'):
            if paragraph.strip():
                story.append(Paragraph(paragraph.strip(), styles['Body']))
        story.append(PageBreak())

    # ══════════════════════════════════════
    # YÖNETİCİ ÖZETİ (Executive Summary) — Kapak sonrasına ekle
    # ══════════════════════════════════════
    # (İçindekiler sayfasından sonra, proje özetinden önce)

    # ══════════════════════════════════════
    # SENARYO KARŞILAŞTIRMA SAYFASI
    # ══════════════════════════════════════
    if senaryo_data and isinstance(senaryo_data, dict):
        senaryolar = senaryo_data.get('senaryolar', [])
        if senaryolar:
            story.append(Paragraph('Senaryo Karşılaştırma', styles['H1']))
            story.append(Paragraph('İyimser, Baz ve Kötümser senaryolara göre proje değerlendirmesi:', styles['Body']))
            story.append(Spacer(1, 4 * mm))

            s_header = ['Senaryo', 'Maliyet', 'Gelir', 'Kâr', 'Kâr Marjı', 'ROI']
            s_rows = [s_header]
            for s in senaryolar:
                s_rows.append([
                    s.get('senaryo', ''),
                    f"₺{s.get('toplam_maliyet', 0)/1e6:.1f}M",
                    f"₺{s.get('toplam_gelir', 0)/1e6:.1f}M",
                    f"₺{s.get('kar', 0)/1e6:.1f}M",
                    f"%{s.get('kar_marji', 0):.1f}",
                    f"%{s.get('roi', 0):.1f}",
                ])
            story.append(_make_table(s_rows, col_widths=[30*mm, 28*mm, 28*mm, 28*mm, 25*mm, 25*mm]))
            story.append(PageBreak())

    # ══════════════════════════════════════
    # BIM ÇAKIŞMA RAPORU SAYFASI
    # ══════════════════════════════════════
    if clash_data and isinstance(clash_data, dict):
        story.append(Paragraph('BIM Çakışma Raporu', styles['H1']))

        toplam = clash_data.get('toplam_cakisma', 0)
        kritik = clash_data.get('kritik', 0)
        uyari = clash_data.get('uyari', 0)
        bilgi = clash_data.get('bilgi', 0)
        sonuc = clash_data.get('sonuc', '')

        story.append(Paragraph(f'Sonuç: {sonuc}', styles['Body']))
        story.append(Spacer(1, 4 * mm))

        ozet_data = [
            ['Toplam Kontrol', 'Toplam Çakışma', 'Kritik', 'Uyarı', 'Bilgi'],
            [str(clash_data.get('toplam_kontrol', 0)), str(toplam), str(kritik), str(uyari), str(bilgi)],
        ]
        story.append(_make_table(ozet_data, col_widths=[35*mm]*5))
        story.append(Spacer(1, 6 * mm))

        # Çakışma detayları (ilk 10)
        cakismalar = clash_data.get('cakismalar', [])[:10]
        if cakismalar:
            story.append(Paragraph('Çakışma Detayları:', styles['H2']))
            c_header = ['Eleman A', 'Eleman B', 'Tip', 'Seviye', 'Açıklama']
            c_rows = [c_header]
            for c in cakismalar:
                c_rows.append([
                    c.get('element_a', '')[:15],
                    c.get('element_b', '')[:15],
                    c.get('clash_type', ''),
                    c.get('severity', ''),
                    c.get('description', '')[:40],
                ])
            story.append(_make_table(c_rows, col_widths=[30*mm, 30*mm, 20*mm, 20*mm, 70*mm]))

        story.append(PageBreak())

    # ══════════════════════════════════════
    # MEP TESİSAT ÖZETİ SAYFASI
    # ══════════════════════════════════════
    if mep_data and isinstance(mep_data, dict):
        story.append(Paragraph('MEP Tesisat Özeti', styles['H1']))

        story.append(Paragraph(
            f"Toplam: {mep_data.get('toplam_node', 0)} düğüm, "
            f"{mep_data.get('toplam_hat', 0)} hat, "
            f"{mep_data.get('toplam_fitting', 0)} bağlantı — "
            f"{mep_data.get('toplam_uzunluk_m', 0):.1f}m toplam uzunluk",
            styles['Body']
        ))
        story.append(Spacer(1, 4 * mm))

        # Disiplin bazlı tablo
        disciplines = mep_data.get('disciplines', {})
        if disciplines:
            d_header = ['Disiplin', 'Düğüm', 'Hat', 'Uzunluk (m)', 'Fitting']
            d_rows = [d_header]
            DISIPLIN_ISIMLERI = {
                'elektrik': 'Elektrik', 'temiz_su': 'Temiz Su',
                'pis_su': 'Pis Su', 'isitma': 'Isıtma',
                'havalandirma': 'Havalandırma', 'yangin': 'Yangın',
            }
            for key, info in disciplines.items():
                d_rows.append([
                    DISIPLIN_ISIMLERI.get(key, key),
                    str(info.get('node_count', 0)),
                    str(info.get('line_count', 0)),
                    f"{info.get('total_length_m', 0):.1f}",
                    str(info.get('fitting_count', 0)),
                ])
            story.append(_make_table(d_rows, col_widths=[35*mm, 25*mm, 25*mm, 30*mm, 25*mm]))
            story.append(Spacer(1, 6 * mm))

        # Maliyet tahmini
        maliyet = mep_data.get('maliyet_tahmini', {})
        if maliyet:
            story.append(Paragraph(f"<b>Toplam MEP Maliyet Tahmini: ₺{maliyet.get('toplam_tl', 0):,.0f}</b>", styles['Body']))
            disiplin_bazli = maliyet.get('disiplin_bazli', {})
            if disiplin_bazli:
                m_rows = [['Disiplin', 'Maliyet (₺)']]
                for dk, dv in disiplin_bazli.items():
                    m_rows.append([DISIPLIN_ISIMLERI.get(dk, dk), f"₺{dv:,.0f}"])
                story.append(_make_table(m_rows, col_widths=[50*mm, 50*mm]))

        # Yük dengesi
        yuk = mep_data.get('yuk_dengesi', {})
        if yuk:
            story.append(Spacer(1, 4 * mm))
            story.append(Paragraph(
                f"<b>Elektrik:</b> {yuk.get('toplam_guc_kw', 0)} kW toplam, "
                f"{yuk.get('ana_sigorta_a', 0)}A sigorta, "
                f"faz dengesizliği %{yuk.get('faz_dengesizligi_pct', 0):.0f}",
                styles['Body']
            ))

        story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 15: SONUÇ VE ÖNERİLER
    # ══════════════════════════════════════

    story.append(Paragraph('Sonuç ve Öneriler', styles['H1']))

    # Otomatik değerlendirme
    if kar_marji > 20:
        verdict = 'YÜKSEK KÂRLI — Bu proje güçlü bir yatırım fırsatıdır.'
        verdict_color = SUCCESS
    elif kar_marji > 10:
        verdict = 'ORTA KÂRLI — Kabul edilebilir getiri, risk yönetimi önemli.'
        verdict_color = ACCENT
    elif kar_marji > 0:
        verdict = 'DÜŞÜK KÂRLI — Dikkatli risk analizi ve maliyet kontrolü gereklidir.'
        verdict_color = colors.HexColor('#f59e0b')
    else:
        verdict = 'ZARARDA — Bu parametrelerle proje kârlı değil. Maliyet optimizasyonu veya fiyat artışı gerekli.'
        verdict_color = DANGER

    story.append(Paragraph(f'<b>Genel Değerlendirme:</b> {verdict}', ParagraphStyle('Verdict', fontName=FONT_BOLD, fontSize=12, textColor=verdict_color, spaceAfter=10)))

    mc_risk = mc.get('zarar_olasiligi', 50)
    story.append(Paragraph(f'Monte Carlo simülasyonuna göre zarar olasılığı %{mc_risk:.1f}. '
        f'{"Bu düşük riskli bir projedir." if mc_risk < 15 else "Orta düzeyde risk taşımaktadır." if mc_risk < 30 else "Yüksek risklidir, dikkatli ilerlenmeli."}', styles['Body']))

    if tornado:
        story.append(Paragraph(f'En hassas parametre: <b>{tornado[0]["parametre"]}</b> '
            f'(±%15 değişim → ₺{tornado[0]["etki"]/1e6:.1f}M kâr etkisi).', styles['Body']))

    story.append(PageBreak())

    # ══════════════════════════════════════
    # SAYFA 16: YASAL UYARI
    # ══════════════════════════════════════

    story.append(Paragraph('Yasal Uyarı', styles['H1']))
    story.append(Spacer(1, 10 * mm))
    disclaimer = """
    Bu rapor imarPRO platformu tarafından otomatik olarak üretilmiştir ve yalnızca 
    bilgilendirme amaçlıdır. Rapordaki hesaplamalar güncel piyasa verilerine dayalı 
    tahminlerdir ve gerçek sonuçlardan farklılık gösterebilir.

    Bu rapor yatırım tavsiyesi niteliği taşımaz. Yatırım kararlarından önce mutlaka 
    bağımsız bir mali müşavir, yapı denetim firması ve gayrimenkul değerleme uzmanı 
    ile görüşmeniz önerilir.

    İmar parametreleri, deprem verileri ve enerji hesaplamaları yerel yönetmeliklere 
    dayanmaktadır ancak güncelliği garanti edilmez. Yapı ruhsatı ve iskan süreçleri 
    için ilgili belediye ile iletişime geçilmelidir.

    İnşaat maliyetleri, satış fiyatları ve piyasa koşulları projeden projeye ve 
    zamana göre önemli ölçüde değişiklik gösterebilir.
    """
    for para in disclaimer.strip().split('\n\n'):
        story.append(Paragraph(para.strip(), styles['Body']))
        story.append(Spacer(1, 4 * mm))

    story.append(Spacer(1, 20 * mm))
    story.append(Paragraph('© 2025 imarPRO — Tüm hakları saklıdır.', styles['Footer']))

    # ══════════════════════════════════════
    # BUILD PDF
    # ══════════════════════════════════════

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()


# ── Helper: Table Builder ──

def _make_table(data, col_widths=None):
    """Profesyonel tablo oluşturur."""
    if col_widths:
        t = Table(data, colWidths=col_widths)
    else:
        t = Table(data)

    style = [
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTNAME', (0, 1), (-1, -1), FONT_NAME),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),  # Son sütun sağa
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]

    # Son satır bold (toplam satırı)
    if len(data) > 2:
        style.append(('FONTNAME', (0, -1), (-1, -1), FONT_BOLD))
        style.append(('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f1f5f9')))
        style.append(('LINEABOVE', (0, -1), (-1, -1), 1, PRIMARY))

    t.setStyle(TableStyle(style))
    return t
